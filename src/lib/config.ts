/**
 * Configuración del santuario. Todo se puede ajustar por variables de entorno
 * sin tocar código (ver .env.example).
 */

export interface Lugar {
  id: string;
  nombre: string;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Lee "id:Nombre,id:Nombre" y arma la lista de lugares reservables. */
function lugares(value: string | undefined, fallback: Lugar[]): Lugar[] {
  if (!value) return fallback;

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [id, nombre] = item.split(":").map((parte) => parte.trim());
      return { id, nombre: nombre || id };
    })
    .filter((lugar) => /^[a-z0-9_-]+$/.test(lugar.id));

  return parsed.length > 0 ? parsed : fallback;
}

export const TIMEZONE = process.env.SANTUARIO_TIMEZONE ?? "America/Argentina/Buenos_Aires";

/** Nombre del lugar en general, para títulos y textos. */
export const SANTUARIO_NOMBRE = process.env.SANTUARIO_NOMBRE ?? "Santuario de Schoenstatt";

/**
 * Los espacios que se pueden reservar. Cada uno tiene su propia disponibilidad:
 * dos personas pueden reservar el mismo horario en lugares distintos.
 */
export const LUGARES: Lugar[] = lugares(process.env.SANTUARIO_LUGARES, [
  { id: "santuario", nombre: "Santuario" },
  { id: "zoom", nombre: "Zoom" },
  { id: "cocina", nombre: "Cocina" },
]);

export const IDS_LUGARES = LUGARES.map((lugar) => lugar.id);

export function nombreDeLugar(id: string): string {
  return LUGARES.find((lugar) => lugar.id === id)?.nombre ?? id;
}

/** Horario en el que se puede reservar, en minutos desde la medianoche. */
export const APERTURA_MIN = num(process.env.SANTUARIO_APERTURA_HORA, 8) * 60;
export const CIERRE_MIN = num(process.env.SANTUARIO_CIERRE_HORA, 22) * 60;

/** Cada cuántos minutos cae un horario en la grilla (inicio y fin). */
export const PASO_MIN = num(process.env.SANTUARIO_PASO_MINUTOS, 30);

/** Duración máxima de una reserva, en minutos. */
export const DURACION_MAX_MIN = num(process.env.SANTUARIO_DURACION_MAXIMA_MINUTOS, 12 * 60);

/** Con cuántos días de anticipación como máximo se puede reservar. */
export const MAX_DIAS_ANTICIPACION = num(process.env.SANTUARIO_MAX_DIAS, 90);

/** Anticipación mínima para reservar el mismo día, en minutos. */
export const ANTICIPACION_MIN = num(process.env.SANTUARIO_ANTICIPACION_MINUTOS, 60);

/**
 * Días de la semana en los que no se reserva (0 = domingo ... 6 = sábado).
 * Por defecto está abierto todos los días.
 */
export const DIAS_CERRADOS: number[] = (process.env.SANTUARIO_DIAS_CERRADOS ?? "")
  .split(",")
  .map((item) => Number(item.trim()))
  .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);

/** Calendario de Google donde viven las reservas. */
export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";

/** Contacto que se muestra si algo falla. */
export const CONTACTO_WHATSAPP = process.env.SANTUARIO_CONTACTO ?? "";
