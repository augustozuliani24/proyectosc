import { NextResponse } from "next/server";

import { SANTUARIO_NOMBRE, nombreDeLugar } from "@/lib/config";
import { obtenerReserva } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fecha y hora en el formato que pide el estándar: 20260917T130000Z */
function comoIcs(fecha: Date): string {
  return `${fecha.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Los saltos de línea y las comas van escapados dentro de un .ics */
function escapar(texto: string): string {
  return texto.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/** Archivo para agregar la reserva al calendario del celular. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reserva = await obtenerReserva(id).catch(() => null);

  if (!reserva) {
    return new NextResponse("No encontramos esta reserva", { status: 404 });
  }

  const lugares = reserva.lugares.map(nombreDeLugar).join(" + ");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santuario Schoenstatt//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${reserva.id}@reservas-santuario`,
    `DTSTAMP:${comoIcs(new Date())}`,
    `DTSTART:${comoIcs(reserva.inicio)}`,
    `DTEND:${comoIcs(reserva.fin)}`,
    `SUMMARY:${escapar(`${lugares} · ${SANTUARIO_NOMBRE}`)}`,
    `LOCATION:${escapar(SANTUARIO_NOMBRE)}`,
    `DESCRIPTION:${escapar(
      [
        `Reserva a nombre de ${reserva.nombre}`,
        reserva.motivo ? `Motivo: ${reserva.motivo}` : "",
        reserva.personas !== null ? `Personas: ${reserva.personas}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(`${lineas.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="reserva-${reserva.id.slice(0, 8)}.ics"`,
    },
  });
}
