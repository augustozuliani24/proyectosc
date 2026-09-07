import { SANTUARIO_NOMBRE, TIMEZONE, nombreDeLugar } from "@/lib/config";
import { fechaEnPalabras, formatearHora } from "@/lib/time";

/**
 * Aviso por mail cada vez que entra una reserva.
 *
 * No se usa la notificación de "evento nuevo" de Google Calendar porque solo
 * se dispara con invitaciones, y las reservas las escribe directo la cuenta de
 * servicio. Agregar a quien organiza como invitada tampoco sirve: una cuenta
 * de servicio no puede invitar a nadie sin Google Workspace.
 */

const API = "https://api.resend.com/emails";

export interface AvisoReserva {
  id: string;
  fecha: string;
  inicioMin: number;
  finMin: number;
  lugares: string[];
  personas: number;
  nombre: string;
  telefono: string;
  motivo: string;
  urlComprobante?: string;
}

function destinatarios(): string[] {
  return (process.env.NOTIFICACIONES_EMAIL ?? "")
    .split(",")
    .map((correo) => correo.trim())
    .filter(Boolean);
}

export function notificacionesConfiguradas(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && destinatarios().length > 0;
}

function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Avisa de una reserva nueva. Nunca lanza: que falle el mail no puede tumbar
 * una reserva que ya quedó guardada en el calendario.
 */
export async function avisarNuevaReserva(aviso: AvisoReserva): Promise<void> {
  if (!notificacionesConfiguradas()) return;

  const lugares = enumerar(aviso.lugares.map(nombreDeLugar));
  const dia = fechaEnPalabras(aviso.fecha, TIMEZONE);
  const horario = `${formatearHora(aviso.inicioMin)} a ${formatearHora(aviso.finMin)}`;

  const filas: [string, string][] = [
    [aviso.lugares.length > 1 ? "Lugares" : "Lugar", lugares],
    ["Día", dia],
    ["Horario", horario],
    ["Personas", String(aviso.personas)],
    ["A nombre de", aviso.nombre],
    ["Teléfono", aviso.telefono],
    ["Motivo", aviso.motivo],
  ];

  const texto = [
    `Nueva reserva en ${SANTUARIO_NOMBRE}`,
    "",
    ...filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
    aviso.urlComprobante ? `\nComprobante: ${aviso.urlComprobante}` : "",
    "",
    "Ya quedó cargada en el calendario.",
  ].join("\n");

  const html = `
    <div lang="es" style="font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2a37;max-width:520px">
      <h2 style="color:#17385f;margin:0 0 4px">Nueva reserva</h2>
      <p style="color:#5b6472;margin:0 0 16px">${escaparHtml(SANTUARIO_NOMBRE)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${filas
          .map(
            ([etiqueta, valor]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #dfe6f1;color:#5b6472">${escaparHtml(etiqueta)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #dfe6f1;text-align:right;font-weight:600">${escaparHtml(valor)}</td>
          </tr>`,
          )
          .join("")}
      </table>
      <p style="color:#5b6472;font-size:13px;margin-top:16px">Ya quedó cargada en el calendario.</p>
      ${
        aviso.urlComprobante
          ? `<p style="font-size:13px"><a href="${escaparHtml(aviso.urlComprobante)}" style="color:#23508f">Ver el comprobante</a></p>`
          : ""
      }
    </div>`;

  try {
    const respuesta = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.NOTIFICACIONES_REMITENTE ??
          "Reservas del Santuario <onboarding@resend.dev>",
        to: destinatarios(),
        subject: `Nueva reserva · ${lugares} · ${dia} ${formatearHora(aviso.inicioMin)}`,
        text: texto,
        html,
      }),
    });

    if (!respuesta.ok) {
      console.error("[notificaciones] no se pudo avisar:", respuesta.status, await respuesta.text());
    }
  } catch (error) {
    console.error("[notificaciones] error al avisar:", error);
  }
}
