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
import { CalendarioError, listarEventosDelDia } from "@/lib/google-calendar";
import { modoDemo } from "@/lib/modo";
import { diaDeLaSemana, esFechaValida, fechaEnPalabras } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    demo: modoDemo(),
  };

  if (diaCerrado) {
    return NextResponse.json({ ...base, ocupados: [] });
  }

  // En demostración mostramos el día entero libre, con el cartel correspondiente:
  // sirve para ver la página antes de tener las credenciales de Google.
  if (modoDemo()) {
    return NextResponse.json({ ...base, ocupados: [] });
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
