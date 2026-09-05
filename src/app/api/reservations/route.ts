import { NextResponse } from "next/server";

import { IDS_LUGARES, MAX_PERSONAS, TIMEZONE, nombreDeLugar } from "@/lib/config";
import {
  MENSAJES,
  lugaresLibres,
  ocupacionDelDia,
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
import { formatearTelefono, telefonoValido } from "@/lib/telefono";
import { aInstanteUTC, fechaEnPalabras, formatearHora, parsearHora } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cuerpo {
  fecha?: unknown;
  horaInicio?: unknown;
  horaFin?: unknown;
  lugares?: unknown;
  personas?: unknown;
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
  const nombre = texto(cuerpo.nombre, 80);
  const telefono = texto(cuerpo.telefono, 30);
  const motivo = texto(cuerpo.motivo, 200);

  // Sin duplicados y en el orden en que están configurados los lugares.
  const pedidos = Array.isArray(cuerpo.lugares) ? cuerpo.lugares.map(String) : [];
  const lugares = IDS_LUGARES.filter((id) => pedidos.includes(id));

  const personas = Number(cuerpo.personas);
  if (!Number.isInteger(personas) || personas < 1 || personas > MAX_PERSONAS) {
    return error(
      "personas_invalido",
      `Decinos cuántas personas van a ser (entre 1 y ${MAX_PERSONAS}).`,
      400,
    );
  }

  if (nombre.length < 2) {
    return error("nombre_invalido", "Escribí a nombre de quién va la reserva.", 400);
  }
  if (!telefonoValido(telefono)) {
    return error(
      "telefono_invalido",
      "El teléfono tiene que tener diez números, con la característica y sin el 0 ni el 15. Por ejemplo: 351 555 1234.",
      400,
    );
  }
  if (motivo.length < 3) {
    return error("motivo_invalido", "Contanos brevemente para qué es la reserva.", 400);
  }

  const inicioMin = parsearHora(texto(cuerpo.horaInicio, 5));
  const finMin = parsearHora(texto(cuerpo.horaFin, 5));
  if (inicioMin === null || finMin === null) {
    return error("horario_invalido", MENSAJES.horario_invalido, 400);
  }

  const motivoRechazo = validarPedido(fecha, inicioMin, finMin, lugares);
  if (motivoRechazo) {
    return error(motivoRechazo, MENSAJES[motivoRechazo], 400);
  }

  const detalleReserva = {
    fecha,
    fechaTexto: fechaEnPalabras(fecha, TIMEZONE),
    horaInicio: formatearHora(inicioMin),
    horaFin: formatearHora(finMin),
    lugares: lugares.map(nombreDeLugar),
    personas,
    nombre,
  };

  // En demostración devolvemos una confirmación falsa, que la página muestra
  // bien marcada como tal, y no tocamos el calendario.
  if (modoDemo()) {
    return NextResponse.json({ ok: true, reserva: { id: "demo", demo: true, ...detalleReserva } });
  }

  try {
    // 1) Chequeo de disponibilidad contra el calendario, lugar por lugar.
    const eventos = await listarEventosDelDia(fecha);
    const ocupados = ocupacionDelDia(eventos, fecha);
    const libres = lugaresLibres(ocupados, inicioMin, finMin, lugares);
    const tomados = lugares.filter((id) => !libres.includes(id));

    if (tomados.length > 0) {
      const nombres = tomados.map(nombreDeLugar).join(" y ");
      return error(
        "ocupado",
        `${nombres} ya ${tomados.length > 1 ? "están reservados" : "está reservado"} en ese horario. Elegí otro horario u otro lugar.`,
        409,
        { ocupados, tomados },
      );
    }

    // 2) Creamos el evento.
    const evento = await crearReserva({
      fecha,
      inicioMin,
      finMin,
      lugares,
      personas,
      nombre,
      telefono: formatearTelefono(telefono),
      motivo,
    });

    // 3) Releemos por si alguien reservó lo mismo en el mismo momento. Si otra
    //    reserva del mismo lugar se creó antes, damos de baja la nuestra.
    const inicio = aInstanteUTC(fecha, inicioMin, TIMEZONE);
    const fin = aInstanteUTC(fecha, finMin, TIMEZONE);
    const posteriores = await listarEventos(inicio, fin);

    const pisada = posteriores.find((otro) => {
      if (otro.id === evento.id) return false;
      if (otro.inicio >= fin || otro.fin <= inicio) return false;
      if (!otro.lugares.some((id) => lugares.includes(id))) return false;
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
        { ocupados: ocupacionDelDia(eventosFrescos, fecha) },
      );
    }

    return NextResponse.json({ ok: true, reserva: { id: evento.id, ...detalleReserva } });
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
