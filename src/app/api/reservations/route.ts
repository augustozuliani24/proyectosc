import { NextResponse } from "next/server";

import { SANTUARIO_NOMBRE, TIMEZONE } from "@/lib/config";
import {
  MENSAJES,
  bloquesOcupados,
  haySuperposicion,
  validarPedido,
} from "@/lib/disponibilidad";
import {
  CalendarioError,
  borrarEvento,
  crearReserva,
  listarEventos,
  listarEventosDelDia,
} from "@/lib/google-calendar";
import { modoDemo } from "@/lib/modo";
import { aInstanteUTC, fechaEnPalabras, formatearHora, parsearHora } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cuerpo {
  fecha?: unknown;
  horaInicio?: unknown;
  duracionMin?: unknown;
  nombre?: unknown;
  telefono?: unknown;
  motivo?: unknown;
  /** Campo trampa: los bots lo completan, las personas no lo ven. */
  web?: unknown;
}

function texto(valor: unknown, maximo: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
}

function error(codigo: string, mensaje: string, status: number, extra?: object) {
  return NextResponse.json({ ok: false, codigo, mensaje, ...extra }, { status });
}

export async function POST(request: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await request.json()) as Cuerpo;
  } catch {
    return error("cuerpo_invalido", "No pudimos leer el formulario.", 400);
  }

  // Campo trampa contra bots: si viene completo, cortamos sin tocar el calendario.
  if (texto(cuerpo.web, 50)) {
    return error("rechazado", "No pudimos procesar la reserva.", 400);
  }

  const fecha = texto(cuerpo.fecha, 10);
  const horaInicio = texto(cuerpo.horaInicio, 5);
  const nombre = texto(cuerpo.nombre, 80);
  const telefono = texto(cuerpo.telefono, 30);
  const motivo = texto(cuerpo.motivo, 200);
  const duracionMin = Number(cuerpo.duracionMin);

  if (nombre.length < 2) {
    return error("nombre_invalido", "Escribí a nombre de quién va la reserva.", 400);
  }
  if (!/^[\d\s+()-]{6,30}$/.test(telefono)) {
    return error("telefono_invalido", "Escribí un teléfono de contacto válido.", 400);
  }

  const inicioMin = parsearHora(horaInicio);
  if (inicioMin === null) {
    return error("horario_invalido", MENSAJES.horario_invalido, 400);
  }

  const motivoRechazo = validarPedido(fecha, inicioMin, duracionMin);
  if (motivoRechazo) {
    return error(motivoRechazo, MENSAJES[motivoRechazo], 400);
  }

  const finMin = inicioMin + duracionMin;

  // En demostración devolvemos una confirmación falsa, que la página muestra
  // bien marcada como tal, y no tocamos el calendario.
  if (modoDemo()) {
    return NextResponse.json({
      ok: true,
      reserva: {
        id: "demo",
        demo: true,
        fecha,
        fechaTexto: fechaEnPalabras(fecha, TIMEZONE),
        horaInicio: formatearHora(inicioMin),
        horaFin: formatearHora(finMin),
        nombre,
        lugar: SANTUARIO_NOMBRE,
      },
    });
  }

  try {
    // 1) Chequeo de disponibilidad contra el calendario.
    const eventos = await listarEventosDelDia(fecha);
    const ocupados = bloquesOcupados(eventos, fecha);

    if (haySuperposicion(ocupados, inicioMin, finMin)) {
      return error(
        "ocupado",
        "Ese horario ya está reservado. Elegí otro horario o cambiá la duración.",
        409,
        { ocupados },
      );
    }

    // 2) Creamos el evento.
    const evento = await crearReserva({ fecha, inicioMin, finMin, nombre, telefono, motivo });

    // 3) Releemos por si alguien reservó lo mismo en el mismo momento. Si otra
    //    reserva se creó antes, damos de baja la nuestra y avisamos.
    const inicio = aInstanteUTC(fecha, inicioMin, TIMEZONE);
    const fin = aInstanteUTC(fecha, finMin, TIMEZONE);
    const posteriores = await listarEventos(inicio, fin);

    const pisada = posteriores.find((otro) => {
      if (otro.id === evento.id) return false;
      const seSuperpone = otro.inicio < fin && otro.fin > inicio;
      if (!seSuperpone) return false;
      if (!otro.creado || !evento.creado) return true;
      if (otro.creado !== evento.creado) return otro.creado < evento.creado;
      return otro.id < evento.id;
    });

    if (pisada) {
      await borrarEvento(evento.id).catch((e) => console.error("[reservations] rollback", e));
      const eventosFrescos = await listarEventosDelDia(fecha);
      return error(
        "ocupado",
        "Justo alguien reservó ese horario. Elegí otro, por favor.",
        409,
        { ocupados: bloquesOcupados(eventosFrescos, fecha) },
      );
    }

    return NextResponse.json({
      ok: true,
      reserva: {
        id: evento.id,
        fecha,
        fechaTexto: fechaEnPalabras(fecha, TIMEZONE),
        horaInicio: formatearHora(inicioMin),
        horaFin: formatearHora(finMin),
        nombre,
        lugar: SANTUARIO_NOMBRE,
      },
    });
  } catch (e) {
    const detalle = e instanceof CalendarioError ? e.message : String(e);
    console.error("[reservations]", detalle);
    return error(
      "error_calendario",
      "No pudimos guardar la reserva. Probá de nuevo en un momento.",
      502,
    );
  }
}
