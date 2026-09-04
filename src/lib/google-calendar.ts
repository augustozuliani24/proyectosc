import { JWT } from "google-auth-library";

import { CALENDAR_ID, IDS_LUGARES, LUGARES, TIMEZONE, nombreDeLugar } from "@/lib/config";
import { aInstanteUTC } from "@/lib/time";

const API = "https://www.googleapis.com/calendar/v3";
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export class CalendarioError extends Error {
  codigo: "sin_configurar" | "google";

  constructor(codigo: "sin_configurar" | "google", mensaje: string) {
    super(mensaje);
    this.name = "CalendarioError";
    this.codigo = codigo;
  }
}

export interface EventoCalendario {
  id: string;
  creado: string;
  inicio: Date;
  fin: Date;
  todoElDia: boolean;
  /** Qué lugares ocupa este evento. */
  lugares: string[];
}

export interface DatosReserva {
  fecha: string;
  inicioMin: number;
  finMin: number;
  lugares: string[];
  nombre: string;
  telefono: string;
  motivo: string;
}

/** true si están cargadas las credenciales de Google. */
export function calendarioConfigurado(): boolean {
  return Boolean(
    CALENDAR_ID && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY,
  );
}

function clavePrivada(): string {
  const bruta = process.env.GOOGLE_PRIVATE_KEY ?? "";
  // Vercel guarda los saltos de línea escapados; también aceptamos base64.
  if (bruta.includes("BEGIN PRIVATE KEY")) return bruta.replace(/\\n/g, "\n");
  return Buffer.from(bruta, "base64").toString("utf8");
}

let clienteCache: JWT | null = null;

function cliente(): JWT {
  if (!calendarioConfigurado()) {
    throw new CalendarioError(
      "sin_configurar",
      "Faltan GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY.",
    );
  }
  if (!clienteCache) {
    clienteCache = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: clavePrivada(),
      scopes: SCOPES,
    });
  }
  return clienteCache;
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const token = await cliente().getAccessToken();
  const respuesta = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new CalendarioError(
      "google",
      `Google Calendar respondió ${respuesta.status}: ${detalle.slice(0, 500)}`,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

interface EventoAPI {
  id: string;
  summary?: string;
  status?: string;
  created?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Minúsculas y sin acentos, para comparar títulos escritos a mano. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Qué lugares ocupa un evento.
 *
 * Las reservas hechas desde la web lo dejan anotado en el evento, así que ahí
 * es exacto. Para los eventos cargados a mano en Google Calendar miramos si el
 * título nombra algún lugar ("Cocina - reunión"); si no nombra ninguno, damos
 * por ocupado todo, que es lo seguro: preferimos rechazar una reserva de más
 * antes que superponer dos.
 */
function lugaresDelEvento(item: EventoAPI): string[] {
  const anotados = (item.extendedProperties?.private?.lugares ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => IDS_LUGARES.includes(id));

  if (anotados.length > 0) return anotados;

  const titulo = normalizar(item.summary ?? "");
  const nombrados = LUGARES.filter(
    (lugar) => titulo.includes(normalizar(lugar.nombre)) || titulo.includes(lugar.id),
  ).map((lugar) => lugar.id);

  return nombrados.length > 0 ? nombrados : [...IDS_LUGARES];
}

/** Eventos que ocupan algún lugar entre dos instantes. */
export async function listarEventos(desde: Date, hasta: Date): Promise<EventoCalendario[]> {
  const params = new URLSearchParams({
    timeMin: desde.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    showDeleted: "false",
  });

  const datos = await pedir<{ items?: EventoAPI[] }>(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params.toString()}`,
  );

  const eventos: EventoCalendario[] = [];

  for (const item of datos.items ?? []) {
    // Los eventos cancelados y los marcados como "disponible" no bloquean nada.
    if (item.status === "cancelled" || item.transparency === "transparent") continue;

    const todoElDia = Boolean(item.start?.date);
    const inicio = todoElDia
      ? aInstanteUTC(item.start!.date!, 0, TIMEZONE)
      : new Date(item.start?.dateTime ?? "");
    const fin = todoElDia
      ? aInstanteUTC(item.end!.date!, 0, TIMEZONE)
      : new Date(item.end?.dateTime ?? "");

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) continue;

    eventos.push({
      id: item.id,
      creado: item.created ?? "",
      inicio,
      fin,
      todoElDia,
      lugares: lugaresDelEvento(item),
    });
  }

  return eventos;
}

/** Eventos de un día local completo ("2026-09-10"). */
export function listarEventosDelDia(fecha: string): Promise<EventoCalendario[]> {
  return listarEventos(
    aInstanteUTC(fecha, 0, TIMEZONE),
    aInstanteUTC(fecha, 24 * 60, TIMEZONE),
  );
}

/** Crea la reserva en el calendario y devuelve el evento creado. */
export async function crearReserva(datos: DatosReserva): Promise<EventoCalendario> {
  const inicio = aInstanteUTC(datos.fecha, datos.inicioMin, TIMEZONE);
  const fin = aInstanteUTC(datos.fecha, datos.finMin, TIMEZONE);
  const nombresLugares = datos.lugares.map(nombreDeLugar);

  const descripcion = [
    `Lugares: ${nombresLugares.join(", ")}`,
    `Reservado por: ${datos.nombre}`,
    `Teléfono: ${datos.telefono}`,
    `Motivo: ${datos.motivo}`,
    "",
    "Reserva cargada automáticamente desde la página web.",
  ].join("\n");

  const creado = await pedir<EventoAPI>(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: `${nombresLugares.join(" + ")} · ${datos.nombre}`,
        description: descripcion,
        start: { dateTime: inicio.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: fin.toISOString(), timeZone: TIMEZONE },
        extendedProperties: {
          private: {
            origen: "web-reservas",
            lugares: datos.lugares.join(","),
            nombre: datos.nombre,
            telefono: datos.telefono,
          },
        },
      }),
    },
  );

  return {
    id: creado.id,
    creado: creado.created ?? new Date().toISOString(),
    inicio,
    fin,
    todoElDia: false,
    lugares: [...datos.lugares],
  };
}

/** Borra un evento (se usa para deshacer una reserva que quedó pisada). */
export async function borrarEvento(id: string): Promise<void> {
  await pedir<void>(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
