import {
  ANTICIPACION_MIN,
  DIAS_CERRADOS,
  IDS_LUGARES,
  MAX_DIAS_ANTICIPACION,
  PASO_MIN,
  TIMEZONE,
  horarioDelDia,
  type Horario,
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

/** Bloques ocupados de cada lugar: { santuario: [...], zoom: [...] } */
export type OcupacionPorLugar = Record<string, Bloque[]>;

export type MotivoRechazo =
  | "fecha_invalida"
  | "fecha_pasada"
  | "fecha_lejana"
  | "dia_cerrado"
  | "fuera_de_horario"
  | "horario_invalido"
  | "duracion_invalida"
  | "muy_sobre_la_hora"
  | "sin_lugar"
  | "lugar_invalido";

export const MENSAJES: Record<MotivoRechazo, string> = {
  fecha_invalida: "La fecha no es válida.",
  fecha_pasada: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante.",
  fecha_lejana: `Solo se puede reservar con hasta ${MAX_DIAS_ANTICIPACION} días de anticipación.`,
  dia_cerrado: "Ese día no se toman reservas.",
  fuera_de_horario: "El horario elegido queda fuera del horario en que se puede reservar.",
  horario_invalido: "El horario elegido no es válido.",
  duracion_invalida: "La hora de fin tiene que ser posterior a la de inicio.",
  muy_sobre_la_hora: "Ese horario está demasiado cerca. Elegí uno un poco más tarde.",
  sin_lugar: "Elegí al menos un lugar para reservar.",
  lugar_invalido: "Alguno de los lugares elegidos no existe.",
};

/** El horario que rige una fecha, que puede no ser el general (ej: domingos). */
export function horarioDeFecha(fecha: string): Horario {
  return horarioDelDia(diaDeLaSemana(fecha, TIMEZONE));
}

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
  const { aperturaMin } = horarioDeFecha(fecha);
  if (fecha !== hoyLocal(ahora)) return aperturaMin;

  const ahoraMin = aMinutosDelDia(ahora, TIMEZONE) + ANTICIPACION_MIN;
  const redondeado = Math.ceil(ahoraMin / PASO_MIN) * PASO_MIN;
  return Math.max(aperturaMin, redondeado);
}

/** Todos los horarios de la grilla de esa fecha, de la apertura al cierre inclusive. */
export function puntosDelDia(fecha: string): number[] {
  const { aperturaMin, cierreMin } = horarioDeFecha(fecha);

  const puntos: number[] = [];
  for (let minuto = aperturaMin; minuto <= cierreMin; minuto += PASO_MIN) {
    puntos.push(minuto);
  }
  return puntos;
}

function fusionar(bloques: Bloque[]): Bloque[] {
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

/**
 * Pasa los eventos del calendario a bloques ocupados por lugar, recortados al
 * día y fusionando los que se superponen.
 */
export function ocupacionDelDia(eventos: EventoCalendario[], fecha: string): OcupacionPorLugar {
  const inicioDia = aInstanteUTC(fecha, 0, TIMEZONE).getTime();
  const finDia = aInstanteUTC(fecha, 24 * 60, TIMEZONE).getTime();

  const porLugar: OcupacionPorLugar = {};
  for (const id of IDS_LUGARES) porLugar[id] = [];

  for (const evento of eventos) {
    const desde = Math.max(evento.inicio.getTime(), inicioDia);
    const hasta = Math.min(evento.fin.getTime(), finDia);
    if (hasta <= desde) continue;

    const bloque: Bloque = {
      inicioMin: Math.floor((desde - inicioDia) / 60000),
      finMin: Math.ceil((hasta - inicioDia) / 60000),
    };

    for (const id of evento.lugares) {
      if (porLugar[id]) porLugar[id].push({ ...bloque });
    }
  }

  for (const id of IDS_LUGARES) porLugar[id] = fusionar(porLugar[id]);

  return porLugar;
}

/** true si el rango pisa algún bloque ocupado. */
export function haySuperposicion(bloques: Bloque[], inicioMin: number, finMin: number): boolean {
  return bloques.some((bloque) => inicioMin < bloque.finMin && finMin > bloque.inicioMin);
}

/** Los lugares de la lista que están libres en todo el rango pedido. */
export function lugaresLibres(
  ocupacion: OcupacionPorLugar,
  inicioMin: number,
  finMin: number,
  candidatos: string[] = IDS_LUGARES,
): string[] {
  return candidatos.filter((id) => !haySuperposicion(ocupacion[id] ?? [], inicioMin, finMin));
}

/**
 * Valida un pedido de reserva contra las reglas del santuario, sin mirar el
 * calendario (de eso se encarga quien llama, con la ocupación del día).
 *
 * No hay tope de duración: se puede tomar el día entero. Lo que sí no se puede
 * es cruzar de un día a otro, porque el fin nunca pasa del horario de cierre.
 */
export function validarPedido(
  fecha: string,
  inicioMin: number,
  finMin: number,
  lugares: string[],
  ahora: Date = new Date(),
): MotivoRechazo | null {
  if (!esFechaValida(fecha)) return "fecha_invalida";

  const hoy = hoyLocal(ahora);
  const dias = diferenciaEnDias(hoy, fecha);
  if (dias < 0) return "fecha_pasada";
  if (dias > MAX_DIAS_ANTICIPACION) return "fecha_lejana";

  if (DIAS_CERRADOS.includes(diaDeLaSemana(fecha, TIMEZONE))) return "dia_cerrado";

  if (lugares.length === 0) return "sin_lugar";
  if (lugares.some((id) => !IDS_LUGARES.includes(id))) return "lugar_invalido";

  if (!Number.isInteger(inicioMin) || !Number.isInteger(finMin)) return "horario_invalido";
  if (inicioMin % PASO_MIN !== 0 || finMin % PASO_MIN !== 0) return "horario_invalido";

  if (finMin <= inicioMin) return "duracion_invalida";

  const { aperturaMin, cierreMin } = horarioDeFecha(fecha);
  if (inicioMin < aperturaMin || finMin > cierreMin) return "fuera_de_horario";
  if (inicioMin < minimoInicio(fecha, ahora)) return "muy_sobre_la_hora";

  return null;
}

/**
 * Primer día que conviene mostrar al abrir la página: hoy si todavía queda
 * algún horario, y si no el próximo día que esté abierto.
 */
export function primeraFechaReservable(ahora: Date = new Date()): string {
  let fecha = hoyLocal(ahora);

  for (let intento = 0; intento < 14; intento += 1) {
    const abierto = !DIAS_CERRADOS.includes(diaDeLaSemana(fecha, TIMEZONE));
    const { cierreMin } = horarioDeFecha(fecha);
    if (abierto && minimoInicio(fecha, ahora) + PASO_MIN <= cierreMin) return fecha;
    fecha = sumarDias(fecha, 1);
  }

  return hoyLocal(ahora);
}
