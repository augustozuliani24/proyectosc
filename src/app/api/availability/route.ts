import { NextResponse } from "next/server";

import {
  APERTURA_MIN,
  CIERRE_MIN,
  DIAS_CERRADOS,
  DURACIONES,
  MAX_DIAS_ANTICIPACION,
  PASO_MIN,
  TIMEZONE,
} from "@/lib/config";
import {
  bloquesOcupados,
  fechaMaxima,
  hoyLocal,
  horariosPosibles,
  minimoInicio,
} from "@/lib/disponibilidad";
import { CalendarioError, calendarioConfigurado, listarEventosDelDia } from "@/lib/google-calendar";
import { diaDeLaSemana, esFechaValida, fechaEnPalabras } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Modo de prueba: permite usar la página sin haber configurado Google todavía. */
const MODO_DEMO = process.env.RESERVAS_MODO_DEMO === "1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("date") ?? "";

  if (!esFechaValida(fecha)) {
    return NextResponse.json(
      { ok: false, codigo: "fecha_invalida", mensaje: "La fecha no es válida." },
      { status: 400 },
    );
  }

  const ahora = new Date();
  const diaCerrado = DIAS_CERRADOS.includes(diaDeLaSemana(fecha, TIMEZONE));

  const base = {
    ok: true as const,
    fecha,
    fechaTexto: fechaEnPalabras(fecha, TIMEZONE),
    zonaHoraria: TIMEZONE,
    aperturaMin: APERTURA_MIN,
    cierreMin: CIERRE_MIN,
    pasoMin: PASO_MIN,
    duraciones: DURACIONES,
    minimoInicioMin: minimoInicio(fecha, ahora),
    horarios: horariosPosibles(fecha, ahora),
    hoy: hoyLocal(ahora),
    fechaMaxima: fechaMaxima(ahora),
    maxDias: MAX_DIAS_ANTICIPACION,
    diaCerrado,
    demo: MODO_DEMO,
  };

  if (diaCerrado) {
    return NextResponse.json({ ...base, ocupados: [] });
  }

  if (!calendarioConfigurado()) {
    if (MODO_DEMO) {
      return NextResponse.json({ ...base, ocupados: [] });
    }
    return NextResponse.json(
      {
        ok: false,
        codigo: "sin_configurar",
        mensaje:
          "Todavía no está conectado el Google Calendar del santuario. Escribinos por WhatsApp y lo coordinamos.",
      },
      { status: 503 },
    );
  }

  try {
    const eventos = await listarEventosDelDia(fecha);
    return NextResponse.json({ ...base, ocupados: bloquesOcupados(eventos, fecha) });
  } catch (error) {
    const detalle = error instanceof CalendarioError ? error.message : String(error);
    console.error("[availability]", detalle);
    return NextResponse.json(
      {
        ok: false,
        codigo: "error_calendario",
        mensaje: "No pudimos leer la agenda del santuario. Probá de nuevo en un momento.",
      },
      { status: 502 },
    );
  }
}
