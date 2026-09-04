"use client";

import { useEffect, useMemo, useState } from "react";

interface Bloque {
  inicioMin: number;
  finMin: number;
}

interface Disponibilidad {
  fecha: string;
  fechaTexto: string;
  aperturaMin: number;
  cierreMin: number;
  minimoInicioMin: number;
  duraciones: number[];
  horarios: number[];
  ocupados: Bloque[];
  diaCerrado: boolean;
  demo?: boolean;
}

interface Reserva {
  id: string;
  fecha: string;
  fechaTexto: string;
  horaInicio: string;
  horaFin: string;
  nombre: string;
  lugar: string;
}

interface Props {
  hoy: string;
  fechaInicial: string;
  fechaMaxima: string;
  duraciones: number[];
  santuario: string;
  contacto: string;
}

function formatearHora(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function duracionEnPalabras(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return horas === 1 ? "1 hora" : `${horas} horas`;
  return `${horas} h ${resto} min`;
}

function seSuperpone(ocupados: Bloque[], inicio: number, fin: number): boolean {
  return ocupados.some((bloque) => inicio < bloque.finMin && fin > bloque.inicioMin);
}

export default function BookingForm({
  hoy,
  fechaInicial,
  fechaMaxima,
  duraciones,
  santuario,
  contacto,
}: Props) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [duracion, setDuracion] = useState(duraciones[0]);
  const [horaInicio, setHoraInicio] = useState<number | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [motivo, setMotivo] = useState("");
  const [trampa, setTrampa] = useState("");

  const [agenda, setAgenda] = useState<Disponibilidad | null>(null);
  const [fallo, setFallo] = useState<{ fecha: string; mensaje: string } | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);

  // La agenda y el error se derivan de la fecha elegida: si todavía no llegó la
  // respuesta de este día, estamos cargando. Así no hace falta un estado extra
  // que haya que mantener sincronizado a mano.
  const disponibilidad = agenda?.fecha === fecha ? agenda : null;
  const errorAgenda = fallo?.fecha === fecha ? fallo.mensaje : null;
  const cargando = !disponibilidad && !errorAgenda;

  useEffect(() => {
    let vigente = true;
    const controlador = new AbortController();

    async function consultar() {
      try {
        const respuesta = await fetch(`/api/availability?date=${encodeURIComponent(fecha)}`, {
          cache: "no-store",
          signal: controlador.signal,
        });
        const cuerpo = await respuesta.json();
        if (!vigente) return;

        if (!respuesta.ok || !cuerpo.ok) {
          setFallo({ fecha, mensaje: cuerpo?.mensaje ?? "No pudimos consultar la agenda." });
          return;
        }

        setAgenda(cuerpo as Disponibilidad);
      } catch (error) {
        if (!vigente || (error as Error)?.name === "AbortError") return;
        setFallo({
          fecha,
          mensaje: "No pudimos consultar la agenda. Revisá tu conexión e intentá de nuevo.",
        });
      }
    }

    consultar();

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [fecha, recarga]);

  /** Horarios de inicio que entran completos y no pisan ninguna reserva. */
  const horariosLibres = useMemo(() => {
    if (!disponibilidad) return [];
    return disponibilidad.horarios.filter(
      (inicio) =>
        inicio + duracion <= disponibilidad.cierreMin &&
        !seSuperpone(disponibilidad.ocupados, inicio, inicio + duracion),
    );
  }, [disponibilidad, duracion]);

  const horariosOcupados = useMemo(() => {
    const libres = new Set(horariosLibres);
    return new Set((disponibilidad?.horarios ?? []).filter((inicio) => !libres.has(inicio)));
  }, [disponibilidad, horariosLibres]);

  // El horario válido también se deriva: si al cambiar la duración o al
  // refrescar la agenda el elegido deja de entrar, se deselecciona solo.
  const horaElegida =
    horaInicio !== null && horariosLibres.includes(horaInicio) ? horaInicio : null;

  const listoParaEnviar =
    horaElegida !== null && nombre.trim().length >= 2 && telefono.trim().length >= 6 && !enviando;

  function cambiarFecha(nueva: string) {
    setFecha(nueva);
    setHoraInicio(null);
    setErrorEnvio(null);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (horaElegida === null) return;

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const respuesta = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          horaInicio: formatearHora(horaElegida),
          duracionMin: duracion,
          nombre,
          telefono,
          motivo,
          web: trampa,
        }),
      });

      const cuerpo = await respuesta.json();

      if (!respuesta.ok || !cuerpo.ok) {
        setErrorEnvio(cuerpo?.mensaje ?? "No pudimos guardar la reserva.");

        // Si nos ganaron de mano, refrescamos la grilla con lo que ya está tomado.
        if (cuerpo?.codigo === "ocupado") {
          setHoraInicio(null);
          if (Array.isArray(cuerpo.ocupados)) {
            setAgenda((previa) =>
              previa && previa.fecha === fecha ? { ...previa, ocupados: cuerpo.ocupados } : previa,
            );
          } else {
            setRecarga((valor) => valor + 1);
          }
        }
        return;
      }

      setReserva(cuerpo.reserva as Reserva);
    } catch {
      setErrorEnvio("No pudimos guardar la reserva. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function empezarDeNuevo() {
    setReserva(null);
    setHoraInicio(null);
    setNombre("");
    setTelefono("");
    setMotivo("");
    setErrorEnvio(null);
    setRecarga((valor) => valor + 1);
  }

  if (reserva) {
    return (
      <div className="tarjeta animar-entrada p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-marian-soft text-3xl text-marian">
          ✓
        </div>
        <h2 className="text-2xl font-semibold text-marian-dark">¡Reserva confirmada!</h2>
        <p className="mt-2 text-tinta/70">Ya quedó agendada en el calendario del santuario.</p>

        <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl bg-marian-soft/60 p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-tinta/60">Lugar</dt>
            <dd className="text-right font-medium">{reserva.lugar}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta/60">Día</dt>
            <dd className="text-right font-medium first-letter:uppercase">{reserva.fechaTexto}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta/60">Horario</dt>
            <dd className="font-medium">
              {reserva.horaInicio} a {reserva.horaFin}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta/60">A nombre de</dt>
            <dd className="text-right font-medium">{reserva.nombre}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={empezarDeNuevo}
          className="mt-6 rounded-xl border border-borde bg-white px-5 py-2.5 text-sm font-medium text-marian-dark transition hover:bg-marian-soft"
        >
          Hacer otra reserva
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {/* Paso 1: el día */}
      <section className="tarjeta p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-marian-dark">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-marian text-xs font-bold text-white">
            1
          </span>
          Elegí el día
        </h2>

        <input
          type="date"
          value={fecha}
          min={hoy}
          max={fechaMaxima}
          onChange={(e) => cambiarFecha(e.target.value)}
          className="campo mt-4"
          required
        />

        {disponibilidad && (
          <p className="mt-2 text-sm text-tinta/60 first-letter:uppercase">
            {disponibilidad.fechaTexto}
          </p>
        )}
      </section>

      {/* Paso 2: el horario */}
      <section className="tarjeta p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-marian-dark">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-marian text-xs font-bold text-white">
            2
          </span>
          Elegí el horario
        </h2>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-tinta/70">¿Cuánto tiempo lo necesitás?</p>
          <div className="flex flex-wrap gap-2">
            {duraciones.map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setDuracion(opcion)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  duracion === opcion
                    ? "border-marian bg-marian text-white"
                    : "border-borde bg-white text-tinta/70 hover:border-marian/40"
                }`}
              >
                {duracionEnPalabras(opcion)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {cargando && <p className="text-sm text-tinta/60">Consultando la agenda…</p>}

          {errorAgenda && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorAgenda}
            </p>
          )}

          {disponibilidad?.diaCerrado && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Ese día no se toman reservas. Probá con otra fecha.
            </p>
          )}

          {disponibilidad && !disponibilidad.diaCerrado && (
            <>
              {disponibilidad.ocupados.length > 0 && (
                <p className="mb-3 text-sm text-tinta/60">
                  Ya reservado ese día:{" "}
                  <span className="font-medium text-tinta/80">
                    {disponibilidad.ocupados
                      .map((b) => `${formatearHora(b.inicioMin)}–${formatearHora(b.finMin)}`)
                      .join(" · ")}
                  </span>
                </p>
              )}

              {horariosLibres.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  {disponibilidad.minimoInicioMin >= disponibilidad.cierreMin
                    ? "Por hoy ya no quedan horarios disponibles. Elegí otro día."
                    : `No queda ningún horario de ${duracionEnPalabras(duracion)} libre ese día. Probá con una duración más corta u otra fecha.`}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {disponibilidad.horarios.map((inicio) => {
                    const ocupado = horariosOcupados.has(inicio);
                    const elegido = horaElegida === inicio;

                    return (
                      <button
                        key={inicio}
                        type="button"
                        disabled={ocupado}
                        onClick={() => setHoraInicio(inicio)}
                        title={
                          ocupado
                            ? "No disponible"
                            : `De ${formatearHora(inicio)} a ${formatearHora(inicio + duracion)}`
                        }
                        className={`rounded-lg border py-2 text-sm font-medium transition ${
                          elegido
                            ? "border-marian bg-marian text-white"
                            : ocupado
                              ? "cursor-not-allowed border-borde bg-slate-100 text-slate-400 line-through"
                              : "border-borde bg-white text-tinta hover:border-marian hover:bg-marian-soft"
                        }`}
                      >
                        {formatearHora(inicio)}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {horaElegida !== null && (
          <p className="mt-4 rounded-xl bg-marian-soft p-3 text-sm text-marian-dark">
            Reservás de <strong>{formatearHora(horaElegida)}</strong> a{" "}
            <strong>{formatearHora(horaElegida + duracion)}</strong>.
          </p>
        )}
      </section>

      {/* Paso 3: los datos */}
      <section className="tarjeta p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-marian-dark">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-marian text-xs font-bold text-white">
            3
          </span>
          ¿A nombre de quién?
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta/70">Nombre y apellido</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo"
              placeholder="Ej: familia Pérez"
              maxLength={80}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta/70">Teléfono</span>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="campo"
              placeholder="Ej: 351 555 1234"
              maxLength={30}
              required
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-tinta/70">
            Motivo <span className="font-normal text-tinta/40">(opcional)</span>
          </span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="campo"
            placeholder="Ej: misa de acción de gracias, retiro, oración en familia"
            maxLength={200}
          />
        </label>

        {/* Campo trampa para bots: invisible para las personas. */}
        <input
          type="text"
          value={trampa}
          onChange={(e) => setTrampa(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </section>

      {errorEnvio && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorEnvio}
          {contacto && (
            <>
              {" "}
              Si el problema sigue, escribinos a <strong>{contacto}</strong>.
            </>
          )}
        </p>
      )}

      {disponibilidad?.demo && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Modo de prueba: el calendario de Google todavía no está conectado, así que las reservas no
          se guardan en ningún lado.
        </p>
      )}

      <button
        type="submit"
        disabled={!listoParaEnviar}
        className="w-full rounded-xl bg-marian px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-marian/20 transition hover:bg-marian-dark disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {enviando
          ? "Guardando la reserva…"
          : horaElegida === null
            ? "Elegí un horario para continuar"
            : `Reservar el ${santuario}`}
      </button>

      <p className="pb-4 text-center text-xs text-tinta/50">
        La reserva se agenda al instante en el calendario del santuario.
      </p>
    </form>
  );
}
