/**
 * Configuración del santuario. Todo se puede ajustar por variables de entorno
 * sin tocar código (ver .env.example).
 */

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return parsed.length > 0 ? parsed : fallback;
}

export const TIMEZONE = process.env.SANTUARIO_TIMEZONE ?? "America/Argentina/Buenos_Aires";

/** Nombre que se muestra en la página y en el título de los eventos. */
export const SANTUARIO_NOMBRE = process.env.SANTUARIO_NOMBRE ?? "Santuario de Schoenstatt";

/** Horario en el que se puede reservar, en minutos desde la medianoche. */
export const APERTURA_MIN = num(process.env.SANTUARIO_APERTURA_HORA, 8) * 60;
export const CIERRE_MIN = num(process.env.SANTUARIO_CIERRE_HORA, 22) * 60;

/** Cada cuántos minutos puede empezar una reserva (granularidad de la grilla). */
export const PASO_MIN = num(process.env.SANTUARIO_PASO_MINUTOS, 30);

/** Duraciones que se ofrecen en el formulario, en minutos. */
export const DURACIONES = list(process.env.SANTUARIO_DURACIONES, [60, 90, 120, 180]);

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
