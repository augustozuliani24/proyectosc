import Link from "next/link";

import AccionesComprobante from "@/components/acciones-comprobante";
import { SANTUARIO_NOMBRE, TIMEZONE, nombreDeLugar } from "@/lib/config";
import { obtenerReserva } from "@/lib/google-calendar";
import { modoDemo } from "@/lib/modo";
import { aMinutosDelDia, fechaEnPalabras, formatearHora } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Comprobante de reserva" };

/** ["a", "b", "c"] a "a, b y c" */
function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-14">
      <div className="tarjeta p-8">{children}</div>
      <p className="no-imprimir mt-6 text-center text-sm">
        <Link href="/" className="text-marian underline underline-offset-2">
          Volver a las reservas
        </Link>
      </p>
    </main>
  );
}

export default async function Comprobante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "demo" || modoDemo()) {
    return (
      <Marco>
        <h1 className="text-xl font-semibold text-marian-dark">Comprobante de demostración</h1>
        <p className="mt-3 text-tinta/70">
          Esta reserva era una demostración, así que no quedó guardada en ningún lado y no hay
          comprobante que mostrar.
        </p>
      </Marco>
    );
  }

  const reserva = await obtenerReserva(id).catch(() => null);

  if (!reserva) {
    return (
      <Marco>
        <h1 className="text-xl font-semibold text-marian-dark">No encontramos esta reserva</h1>
        <p className="mt-3 text-tinta/70">
          Puede que se haya cancelado, o que el link esté incompleto. Si creés que es un error,
          escribinos por WhatsApp con el código de la reserva.
        </p>
      </Marco>
    );
  }

  const inicioMin = aMinutosDelDia(reserva.inicio, TIMEZONE);
  const finMin = aMinutosDelDia(reserva.fin, TIMEZONE);
  const codigo = reserva.id.slice(0, 8).toUpperCase();

  const filas: [string, string][] = [
    [reserva.lugares.length > 1 ? "Lugares" : "Lugar", enumerar(reserva.lugares.map(nombreDeLugar))],
    ["Día", fechaEnPalabras(reserva.fecha, TIMEZONE)],
    ["Horario", `${formatearHora(inicioMin)} a ${formatearHora(finMin)}`],
    ["A nombre de", reserva.nombre],
  ];

  if (reserva.personas !== null) filas.push(["Personas", String(reserva.personas)]);
  if (reserva.motivo) filas.push(["Motivo", reserva.motivo]);

  return (
    <Marco>
      <header className="border-b border-borde pb-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dorado">
          Movimiento de Schoenstatt
        </p>
        <h1 className="mt-1 text-xl font-semibold text-marian-dark">Comprobante de reserva</h1>
        <p className="mt-1 text-sm text-tinta/60">{SANTUARIO_NOMBRE}</p>
      </header>

      <dl className="mt-5 space-y-3 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-4 border-b border-borde/60 pb-2">
            <dt className="text-tinta/60">{etiqueta}</dt>
            <dd className="text-right font-medium first-letter:uppercase">{valor}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <dt className="text-tinta/60">Código</dt>
          <dd className="font-mono font-medium">{codigo}</dd>
        </div>
      </dl>

      <p className="mt-5 text-center text-xs leading-relaxed text-tinta/50">
        Guardá este comprobante. Si hiciera falta verificar la reserva, mostralo o pasá el código
        por WhatsApp.
      </p>

      <AccionesComprobante urlIcs={`/api/reservas/${encodeURIComponent(reserva.id)}/ics`} />
    </Marco>
  );
}
