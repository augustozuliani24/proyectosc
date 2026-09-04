import crypto from "node:crypto";

const VERSION_API = process.env.WHATSAPP_API_VERSION ?? "v22.0";

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Valida la firma que manda Meta en cada webhook (X-Hub-Signature-256).
 * Si no hay APP_SECRET configurado, no se valida nada.
 */
export function firmaValida(cuerpoCrudo: string, firma: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return true;
  if (!firma?.startsWith("sha256=")) return false;

  const esperada = crypto.createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const recibida = firma.slice("sha256=".length);

  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recibida, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Envía un mensaje de texto por la Cloud API de WhatsApp. */
export async function enviarTexto(destino: string, cuerpo: string): Promise<void> {
  if (!whatsappConfigurado()) {
    console.warn("[whatsapp] sin configurar: no se envió el mensaje");
    return;
  }

  const url = `https://graph.facebook.com/${VERSION_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: destino,
      type: "text",
      text: { preview_url: true, body: cuerpo },
    }),
  });

  if (!respuesta.ok) {
    console.error("[whatsapp] error al enviar:", respuesta.status, await respuesta.text());
  }
}

/**
 * Memoria simple para no repetir el mensaje automático a la misma persona.
 * Vive en el proceso: si la función se reinicia puede repetirse alguna vez,
 * cosa que a este volumen no molesta y evita depender de una base de datos.
 */
const ultimoEnvio = new Map<string, number>();

export function yaLeEscribimos(telefono: string, horas: number): boolean {
  const previo = ultimoEnvio.get(telefono);
  const ventana = horas * 3600000;

  if (previo && Date.now() - previo < ventana) return true;

  ultimoEnvio.set(telefono, Date.now());

  // Limpieza para que el mapa no crezca sin control.
  if (ultimoEnvio.size > 500) {
    for (const [clave, momento] of ultimoEnvio) {
      if (Date.now() - momento > ventana) ultimoEnvio.delete(clave);
    }
  }

  return false;
}
