import BookingForm from "@/components/booking-form";
import {
  APERTURA_MIN,
  CIERRE_MIN,
  CONTACTO_WHATSAPP,
  DURACIONES,
  MAX_DIAS_ANTICIPACION,
  SANTUARIO_NOMBRE,
} from "@/lib/config";
import { fechaMaxima, hoyLocal, primeraFechaReservable } from "@/lib/disponibilidad";
import { formatearHora } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function Home() {
  const hoy = hoyLocal();
  const fechaInicial = primeraFechaReservable();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-dorado">
          Movimiento de Schoenstatt
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-marian-dark sm:text-4xl">
          Reservá el {SANTUARIO_NOMBRE}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-tinta/70">
          Elegí el día y el horario que necesitás. Si está libre, queda reservado al instante; si no,
          te mostramos qué horarios quedan disponibles.
        </p>
      </header>

      <BookingForm
        hoy={hoy}
        fechaInicial={fechaInicial}
        fechaMaxima={fechaMaxima()}
        duraciones={DURACIONES}
        santuario={SANTUARIO_NOMBRE}
        contacto={CONTACTO_WHATSAPP}
      />

      <footer className="mt-10 border-t border-borde pt-6 text-center text-xs leading-relaxed text-tinta/50">
        <p>
          Se puede reservar de {formatearHora(APERTURA_MIN)} a {formatearHora(CIERRE_MIN)}, con hasta{" "}
          {MAX_DIAS_ANTICIPACION} días de anticipación.
        </p>
        <p className="mt-1">
          ¿Tenés una consulta que no es una reserva? Escribinos por WhatsApp y te responde alguien
          del equipo.
        </p>
      </footer>
    </main>
  );
}
