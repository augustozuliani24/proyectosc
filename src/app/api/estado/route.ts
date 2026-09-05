import { NextResponse } from "next/server";

import { hoyLocal } from "@/lib/disponibilidad";
import { CalendarioError, calendarioConfigurado, listarEventosDelDia } from "@/lib/google-calendar";
import { modoDemo } from "@/lib/modo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de la conexión con Google Calendar.
 *
 * Dice si cada variable está cargada y si el calendario responde, pero nunca
 * devuelve su contenido: solo true/false y un mensaje ya interpretado. Así se
 * puede compartir sin filtrar credenciales ni datos de las reservas.
 */
export async function GET() {
  const variables = {
    GOOGLE_CALENDAR_ID: Boolean(process.env.GOOGLE_CALENDAR_ID),
    GOOGLE_CLIENT_EMAIL: Boolean(process.env.GOOGLE_CLIENT_EMAIL),
    GOOGLE_PRIVATE_KEY: Boolean(process.env.GOOGLE_PRIVATE_KEY),
  };

  const clave = process.env.GOOGLE_PRIVATE_KEY ?? "";
  const claveParecePem =
    clave.includes("BEGIN PRIVATE KEY") || /^[A-Za-z0-9+/=\s]+$/.test(clave.slice(0, 40));

  const faltantes = Object.entries(variables)
    .filter(([, cargada]) => !cargada)
    .map(([nombre]) => nombre);

  if (!calendarioConfigurado()) {
    return NextResponse.json({
      modoDemo: modoDemo(),
      variables,
      faltantes,
      calendario: null,
      queHacer:
        faltantes.length > 0
          ? `Faltan cargar en Vercel: ${faltantes.join(", ")}. Después hay que volver a desplegar.`
          : "Las variables están cargadas pero este deploy no las ve: hay que volver a desplegar.",
    });
  }

  try {
    await listarEventosDelDia(hoyLocal());
    return NextResponse.json({
      modoDemo: modoDemo(),
      variables,
      faltantes,
      calendario: { ok: true },
      queHacer: "Todo conectado. Las reservas se guardan en el calendario.",
    });
  } catch (error) {
    const mensaje = error instanceof CalendarioError ? error.message : String(error);
    const estado = Number(/respondió (\d{3})/.exec(mensaje)?.[1] ?? 0);

    // Un error acá casi siempre es una de estas cuatro cosas, y conviene decir cuál.
    const explicaciones: Record<number, string> = {
      400: "Google rechazó el pedido. Suele ser un GOOGLE_CALENDAR_ID mal copiado.",
      401: "Las credenciales no son válidas. Revisá GOOGLE_PRIVATE_KEY y GOOGLE_CLIENT_EMAIL.",
      403: "Sin permiso. Puede faltar habilitar la Google Calendar API en el proyecto de Google Cloud, o el calendario está compartido solo para ver y no para hacer cambios.",
      404: "No se encuentra el calendario. O el GOOGLE_CALENDAR_ID está mal, o no se compartió con la cuenta de servicio.",
    };

    return NextResponse.json({
      modoDemo: modoDemo(),
      variables,
      faltantes,
      calendario: {
        ok: false,
        estado: estado || null,
        claveParecePem,
        detalle:
          explicaciones[estado] ??
          (claveParecePem
            ? "No pudimos hablar con Google Calendar."
            : "La clave privada no parece estar bien copiada: tiene que empezar con -----BEGIN PRIVATE KEY-----."),
      },
      queHacer: "Corregí lo que dice el detalle y volvé a desplegar.",
    });
  }
}
