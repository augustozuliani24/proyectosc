import {
  ANTICIPACION_MIN,
  APERTURA_MIN,
  CIERRE_MIN,
  DIAS_CERRADOS,
  DURACIONES,
  MAX_DIAS_ANTICIPACION,
  PASO_MIN,
  TIMEZONE,
} from "@/lib/config";
import type { EventoCalendario } from "@/lib/google-calendar";
import {
  aFechaLocal,
  aInstanteUTC,
  aMinutosDelDia,
  diaDeLaSemana,
  diferenciaEnDias,
  esFechaValida,
  sumarDias,
} from "@/lib/time";

export interface Bloque {
  inicioMin: number;
  finMin: number;
}

export type MotivoRechazo =
  | "fecha_invalida"
  | "fecha_pasada"
  | "fecha_lejana"
  | "dia_cerrado"
  | "fuera_de_horario"
  | "horario_invalido"
  | "duracion_invalida"
  | "muy_sobre_la_hora";

export const MENSAJES: Record<MotivoRechazo, string> = {
  fecha_invalida: "La fecha no es válida.",
  fecha_pasada: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante.",
  fecha_lejana: `Solo se puede reservar con hasta ${MAX_DIAS_ANTICIPACION} días de anticipación.`,
  dia_cerrado: "Ese día no se toman reservas.",
  fuera_de_horario: "El horario elegido queda fuera del horario en que se puede reservar.",
  horario_invalido: "El horario elegido no es válido.",
  duracion_invalida: "La duración elegida no está disponible.",
  muy_sobre_la_hora: "Ese horario está demasiado cerca. Elegí uno un poco más tarde.",
};

/** Fecha de hoy en la zona del santuario. */
export function hoyLocal(ahora: Date = new Date()): string {
  return aFechaLocal(ahora, TIMEZONE);
}

/** Última fecha reservable. */
export function fechaMaxima(ahora: Date = new Date()): string {
  const limite = new Date(ahora.getTime() + MAX_DIAS_ANTICIPACION * 86400000);
  return aFechaLocal(limite, TIMEZONE);
}

/**
 * Primer minuto reservable de un día: la apertura, salvo que sea hoy, donde hay
 * que respetar la anticipación mínima.
 */
export function minimoInicio(fecha: string, ahora: Date = new Date()): number {
  if (fecha !== hoyLocal(ahora)) return APERTURA_MIN;
  const ahoraMin = aMinutosDelDia(ahora, TIMEZONE) + ANTICIPACION_MIN;
  const redondeado = Math.ceil(ahoraMin / PASO_MIN) * PASO_MIN;
  return Math.max(APERTURA_MIN, redondeado);
}

/**
 * Pasa los eventos del calendario a bloques ocupados del día, recortados al día
 * y fusionando los que se superponen.
 */
export function bloquesOcupados(eventos: EventoCalendario[], fecha: string): Bloque[] {
  const inicioDia = aInstanteUTC(fecha, 0, TIMEZONE).getTime();
  const finDia = aInstanteUTC(fecha, 24 * 60, TIMEZONE).getTime();

  const bloques: Bloque[] = [];

  for (const evento of eventos) {
    const desde = Math.max(evento.inicio.getTime(), inicioDia);
    const hasta = Math.min(evento.fin.getTime(), finDia);
    if (hasta <= desde) continue;

    bloques.push({
      inicioMin: Math.floor((desde - inicioDia) / 60000),
      finMin: Math.ceil((hasta - inicioDia) / 60000),
    });
  }

  bloques.sort((a, b) => a.inicioMin - b.inicioMin);

  const fusionados: Bloque[] = [];
  for (const bloque of bloques) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo && bloque.inicioMin <= ultimo.finMin) {
      ultimo.finMin = Math.max(ultimo.finMin, bloque.finMin);
    } else {
      fusionados.push({ ...bloque });
    }
  }

  return fusionados;
}

/** true si el rango pedido pisa algún bloque ocupado. */
export function haySuperposicion(ocupados: Bloque[], inicioMin: number, finMin: number): boolean {
  return ocupados.some((bloque) => inicioMin < bloque.finMin && finMin > bloque.inicioMin);
}

/** Todos los horarios de inicio posibles de un día, sin mirar el calendario. */
export function horariosPosibles(fecha: string, ahora: Date = new Date()): number[] {
  const minimo = minimoInicio(fecha, ahora);
  const duracionMinima = Math.min(...DURACIONES);
  const horarios: number[] = [];

  for (let minuto = APERTURA_MIN; minuto + duracionMinima <= CIERRE_MIN; minuto += PASO_MIN) {
    if (minuto >= minimo) horarios.push(minuto);
  }

  return horarios;
}

/**
 * Primer día que conviene mostrar al abrir la página: hoy si todavía queda
 * algún horario, y si no el próximo día que esté abierto.
 */
export function primeraFechaReservable(ahora: Date = new Date()): string {
  let fecha = hoyLocal(ahora);

  for (let intento = 0; intento < 14; intento += 1) {
    const abierto = !DIAS_CERRADOS.includes(diaDeLaSemana(fecha, TIMEZONE));
    if (abierto && horariosPosibles(fecha, ahora).length > 0) return fecha;
    fecha = sumarDias(fecha, 1);
  }

  return hoyLocal(ahora);
}

/** Valida un pedido de reserva contra las reglas del santuario (no contra el calendario). */
export function validarPedido(
  fecha: string,
  inicioMin: number,
  duracionMin: number,
  ahora: Date = new Date(),
): MotivoRechazo | null {
  if (!esFechaValida(fecha)) return "fecha_invalida";

  const hoy = hoyLocal(ahora);
  const dias = diferenciaEnDias(hoy, fecha);
  if (dias < 0) return "fecha_pasada";
  if (dias > MAX_DIAS_ANTICIPACION) return "fecha_lejana";

  if (DIAS_CERRADOS.includes(diaDeLaSemana(fecha, TIMEZONE))) return "dia_cerrado";

  if (!DURACIONES.includes(duracionMin)) return "duracion_invalida";

  if (!Number.isInteger(inicioMin) || inicioMin % PASO_MIN !== 0) return "horario_invalido";
  if (inicioMin < APERTURA_MIN || inicioMin + duracionMin > CIERRE_MIN) return "fuera_de_horario";

  if (inicioMin < minimoInicio(fecha, ahora)) return "muy_sobre_la_hora";

  return null;
}
