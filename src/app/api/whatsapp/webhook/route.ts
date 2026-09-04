import { NextResponse } from "next/server";

import { SANTUARIO_NOMBRE } from "@/lib/config";
import { enviarTexto, firmaValida, whatsappConfigurado, yaLeEscribimos } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Horas que esperamos antes de volver a mandarle el link a la misma persona. */
const VENTANA_HORAS = Number(process.env.WHATSAPP_VENTANA_HORAS ?? 12);

function linkDeReservas(request: Request): string {
  if (process.env.RESERVAS_URL) return process.env.RESERVAS_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return new URL(request.url).origin;
}

function mensajeBienvenida(link: string): string {
  const plantilla =
    process.env.WHATSAPP_MENSAJE_BIENVENIDA ??
    `¡Hola! Gracias por escribir al {santuario} 🙏\n\n` +
      `• Si querés hacer una consulta, seguí escribiendo por acá y te responde alguien del equipo.\n` +
      `• Si querés reservar el santuario, entrá a este link y cargás la fecha y el horario: {link}`;

  return plantilla.replaceAll("{link}", link).replaceAll("{santuario}", SANTUARIO_NOMBRE);
}

/** Verificación del webhook: Meta llama una vez con hub.challenge. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modo = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const desafio = searchParams.get("hub.challenge") ?? "";

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!esperado) {
    return new NextResponse("Falta WHATSAPP_VERIFY_TOKEN", { status: 503 });
  }

  if (modo === "subscribe" && token === esperado) {
    return new NextResponse(desafio, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Verificación fallida", { status: 403 });
}

interface MensajeEntrante {
  from?: string;
  type?: string;
  text?: { body?: string };
}

/**
 * Mensajes entrantes. La única automatización es mandar el link de reservas:
 * todo lo demás queda en el chat para que lo conteste una persona.
 */
export async function POST(request: Request) {
  const crudo = await request.text();

  if (!firmaValida(crudo, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  // Siempre contestamos 200: si devolvemos error, Meta reintenta el mismo evento.
  if (!whatsappConfigurado()) {
    console.warn("[whatsapp] webhook recibido pero el número no está configurado");
    return NextResponse.json({ ok: true });
  }

  try {
    const datos = JSON.parse(crudo);
    const link = linkDeReservas(request);

    for (const entrada of datos?.entry ?? []) {
      for (const cambio of entrada?.changes ?? []) {
        const mensajes: MensajeEntrante[] = cambio?.value?.messages ?? [];

        for (const mensaje of mensajes) {
          const telefono = mensaje.from;
          if (!telefono) continue;

          const texto = (mensaje.text?.body ?? "").toLowerCase();
          const pideReservar = /reserv|turno|alquil|santuario libre/.test(texto);

          // Le escribimos si es la primera vez en la ventana, o si pide reservar
          // explícitamente (ahí el link le sirve aunque ya lo haya recibido).
          const yaEnviado = yaLeEscribimos(telefono, VENTANA_HORAS);
          if (yaEnviado && !pideReservar) continue;

          await enviarTexto(telefono, mensajeBienvenida(link));
        }
      }
    }
  } catch (error) {
    console.error("[whatsapp] error procesando el webhook:", error);
  }

  return NextResponse.json({ ok: true });
}
