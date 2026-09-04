"use client";

import { useEffect, useMemo, useState } from "react";

interface Bloque {
  inicioMin: number;
  finMin: number;
}

interface Lugar {
  id: string;
  nombre: string;
}

interface Disponibilidad {
  fecha: string;
  fechaTexto: string;
  aperturaMin: number;
  cierreMin: number;
  pasoMin: number;
  duracionMaxMin: number;
  minimoInicioMin: number;
  puntos: number[];
  lugares: Lugar[];
  ocupados: Record<string, Bloque[]>;
  diaCerrado: boolean;
  demo?: boolean;
}

interface Reserva {
  id: string;
  demo?: boolean;
  fecha: string;
  fechaTexto: string;
  horaInicio: string;
  horaFin: string;
  lugares: string[];
  nombre: string;
}

interface Props {
  hoy: string;
  fechaInicial: string;
  fechaMaxima: string;
  lugares: Lugar[];
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

/** ["a", "b", "c"] a "a, b y c" */
function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function ocupado(bloques: Bloque[], inicio: number, fin: number): boolean {
  return bloques.some((bloque) => inicio < bloque.finMin && fin > bloque.inicioMin);
}

/** Hasta qué hora se puede estirar una reserva en un lugar, arrancando en `inicio`. */
function extensionLibre(bloques: Bloque[], inicio: number, tope: number): number {
  for (const bloque of bloques) {
    if (bloque.finMin <= inicio) continue;
    if (bloque.inicioMin <= inicio) return inicio;
    return Math.min(tope, bloque.inicioMin);
  }
  return tope;
}

export default function BookingForm({
  hoy,
  fechaInicial,
  fechaMaxima,
  lugares: lugaresIniciales,
  contacto,
}: Props) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [inicio, setInicio] = useState<number | null>(null);
  const [fin, setFin] = useState<number | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);

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
  // respuesta de este día, estamos cargando.
  const disponibilidad = agenda?.fecha === fecha ? agenda : null;
  const errorAgenda = fallo?.fecha === fecha ? fallo.mensaje : null;
  const cargando = !disponibilidad && !errorAgenda;
  const lugares = disponibilidad?.lugares ?? lugaresIniciales;

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

  /**
   * Hasta qué hora se puede estirar la reserva desde el inicio elegido. Alcanza
   * con que quede libre UN lugar, porque después se elige cuál.
   */
  const topeDelRango = useMemo(() => {
    if (!disponibilidad || inicio === null) return null;
    const tope = Math.min(disponibilidad.cierreMin, inicio + disponibilidad.duracionMaxMin);
    return Math.max(
      ...lugares.map((lugar) =>
        extensionLibre(disponibilidad.ocupados[lugar.id] ?? [], inicio, tope),
      ),
    );
  }, [disponibilidad, inicio, lugares]);

  /** El rango vale si sigue entrando en la agenda; si no, se suelta solo. */
  const rango = useMemo(() => {
    if (inicio === null || fin === null || topeDelRango === null) return null;
    if (fin <= inicio || fin > topeDelRango) return null;
    return { inicio, fin };
  }, [inicio, fin, topeDelRango]);

  /** Qué lugares están libres en el rango elegido. */
  const lugaresLibres = useMemo(() => {
    if (!disponibilidad || !rango) return [];
    return lugares
      .filter((lugar) => !ocupado(disponibilidad.ocupados[lugar.id] ?? [], rango.inicio, rango.fin))
      .map((lugar) => lugar.id);
  }, [disponibilidad, rango, lugares]);

  // También derivado: si el rango cambia y un lugar elegido queda ocupado, deja
  // de estar seleccionado sin que haga falta limpiarlo a mano.
  const seleccionados = elegidos.filter((id) => lugaresLibres.includes(id));

  const listoParaEnviar =
    rango !== null &&
    seleccionados.length > 0 &&
    nombre.trim().length >= 2 &&
    telefono.trim().length >= 6 &&
    motivo.trim().length >= 3 &&
    !enviando;

  function cambiarFecha(nueva: string) {
    setFecha(nueva);
    setInicio(null);
    setFin(null);
    setErrorEnvio(null);
  }

  /** Primer toque: hora de inicio. Segundo: hora de fin. */
  function tocarPunto(punto: number) {
    setErrorEnvio(null);
    if (inicio === null || fin !== null) {
      setInicio(punto);
      setFin(null);
      return;
    }
    if (punto <= inicio) {
      setInicio(punto);
      return;
    }
    setFin(punto);
  }

  function alternarLugar(id: string) {
    setErrorEnvio(null);
    setElegidos((previos) =>
      previos.includes(id) ? previos.filter((otro) => otro !== id) : [...previos, id],
    );
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!rango || seleccionados.length === 0) return;

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const respuesta = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          horaInicio: formatearHora(rango.inicio),
          horaFin: formatearHora(rango.fin),
          lugares: seleccionados,
          nombre,
          telefono,
          motivo,
          web: trampa,
        }),
      });

      const cuerpo = await respuesta.json();

      if (!respuesta.ok || !cuerpo.ok) {
        setErrorEnvio(cuerpo?.mensaje ?? "No pudimos guardar la reserva.");

        // Si nos ganaron de mano, refrescamos la agenda con lo que ya está tomado.
        if (cuerpo?.codigo === "ocupado") {
          if (cuerpo.ocupados) {
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
    setInicio(null);
    setFin(null);
    setElegidos([]);
    setNombre("");
    setTelefono("");
    setMotivo("");
    setErrorEnvio(null);
    setRecarga((valor) => valor + 1);
  }

  if (reserva) {
    return (
      <div className="tarjeta animar-entrada p-8 text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-3xl ${
            reserva.demo ? "bg-amber-100 text-amber-700" : "bg-marian-soft text-marian"
          }`}
        >
          {reserva.demo ? "👁" : "✓"}
        </div>
        <h2 className="text-2xl font-semibold text-marian-dark">
          {reserva.demo ? "Así se vería la confirmación" : "¡Reserva confirmada!"}
        </h2>
        <p className="mt-2 text-tinta/70">
          {reserva.demo
            ? "Esto es una demostración: la reserva no se guardó en ningún lado."
            : "Ya quedó agendada en el calendario."}
        </p>

        <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl bg-marian-soft/60 p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-tinta/60">{reserva.lugares.length > 1 ? "Lugares" : "Lugar"}</dt>
            <dd className="text-right font-medium">{enumerar(reserva.lugares)}</dd>
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

  const paso = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marian text-xs font-bold text-white";
  const titulo = "flex items-center gap-2 text-lg font-semibold text-marian-dark";

  return (
    <form onSubmit={enviar} className="space-y-5">
      {/* Paso 1: el día */}
      <section className="tarjeta p-6">
        <h2 className={titulo}>
          <span className={paso}>1</span>
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

      {/* Paso 2: el horario, tocando inicio y fin */}
      <section className="tarjeta p-6">
        <h2 className={titulo}>
          <span className={paso}>2</span>
          Elegí el horario
        </h2>

        <p className="mt-2 text-sm text-tinta/60">
          {rango
            ? "¿Te equivocaste? Tocá cualquier hora para empezar de nuevo."
            : inicio === null
              ? "Tocá la hora en la que empezás."
              : `Empezás a las ${formatearHora(inicio)}. Ahora tocá la hora en la que terminás.`}
        </p>

        <div className="mt-4">
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
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {disponibilidad.puntos.map((punto) => {
                const eligiendoFin = inicio !== null && fin === null;

                // Un horario sirve como inicio si algún lugar está libre desde ahí,
                // y como fin si no pasa el tope del rango que arrancó el usuario.
                const sirveComoInicio =
                  punto >= disponibilidad.minimoInicioMin &&
                  punto + disponibilidad.pasoMin <= disponibilidad.cierreMin &&
                  lugares.some(
                    (lugar) =>
                      !ocupado(
                        disponibilidad.ocupados[lugar.id] ?? [],
                        punto,
                        punto + disponibilidad.pasoMin,
                      ),
                  );

                const sirveComoFin =
                  eligiendoFin &&
                  topeDelRango !== null &&
                  punto > (inicio as number) &&
                  punto <= topeDelRango;

                const habilitado = eligiendoFin ? sirveComoFin || punto <= (inicio as number) : sirveComoInicio;

                const esExtremo = punto === inicio || punto === fin;
                const dentro =
                  rango !== null && punto > rango.inicio && punto < rango.fin;

                // Tachamos solo lo que está realmente reservado. Un horario que
                // no sirve por otra razón (el cierre, o que quedó fuera del
                // rango) va en gris, sin tachar: tachado se lee como "ocupado".
                const todoOcupado =
                  punto + disponibilidad.pasoMin <= disponibilidad.cierreMin &&
                  lugares.every((lugar) =>
                    ocupado(
                      disponibilidad.ocupados[lugar.id] ?? [],
                      punto,
                      punto + disponibilidad.pasoMin,
                    ),
                  );

                return (
                  <button
                    key={punto}
                    type="button"
                    disabled={!habilitado}
                    onClick={() => tocarPunto(punto)}
                    title={todoOcupado ? "Ya está reservado" : formatearHora(punto)}
                    className={`rounded-lg border py-2 text-sm font-medium transition ${
                      esExtremo
                        ? "border-marian bg-marian text-white"
                        : dentro
                          ? "border-marian/40 bg-marian-soft text-marian-dark"
                          : habilitado
                            ? "border-borde bg-white text-tinta hover:border-marian hover:bg-marian-soft"
                            : `cursor-not-allowed border-borde bg-slate-100 text-slate-400 ${
                                todoOcupado ? "line-through" : ""
                              }`
                    }`}
                  >
                    {formatearHora(punto)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {rango && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-marian-soft p-3 text-sm text-marian-dark">
            <span>
              De <strong>{formatearHora(rango.inicio)}</strong> a{" "}
              <strong>{formatearHora(rango.fin)}</strong> ({duracionEnPalabras(rango.fin - rango.inicio)})
            </span>
            <button
              type="button"
              onClick={() => {
                setInicio(null);
                setFin(null);
              }}
              className="text-xs font-medium underline underline-offset-2"
            >
              Cambiar
            </button>
          </div>
        )}
      </section>

      {/* Paso 3: los lugares */}
      <section className="tarjeta p-6">
        <h2 className={titulo}>
          <span className={paso}>3</span>
          ¿Qué lugar necesitás?
        </h2>

        <p className="mt-2 text-sm text-tinta/60">
          Podés elegir más de uno.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {lugares.map((lugar) => {
            const libre = lugaresLibres.includes(lugar.id);
            const activo = seleccionados.includes(lugar.id);

            return (
              <button
                key={lugar.id}
                type="button"
                disabled={!rango || !libre}
                onClick={() => alternarLugar(lugar.id)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                  activo
                    ? "border-marian bg-marian text-white"
                    : rango && libre
                      ? "border-borde bg-white text-tinta hover:border-marian hover:bg-marian-soft"
                      : "cursor-not-allowed border-borde bg-slate-100 text-slate-400"
                }`}
              >
                <span className="block">{lugar.nombre}</span>
                {rango && !libre && (
                  <span className="mt-0.5 block text-xs font-normal">Ocupado a esa hora</span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm">
          {!rango ? (
            <span className="text-tinta/50">Elegí primero el horario.</span>
          ) : seleccionados.length === 0 ? (
            <span className="text-tinta/50">Todavía no elegiste ningún lugar.</span>
          ) : (
            <span className="text-marian-dark">
              Elegiste:{" "}
              <strong>
                {enumerar(
                  seleccionados.map(
                    (id) => lugares.find((lugar) => lugar.id === id)?.nombre ?? id,
                  ),
                )}
              </strong>
            </span>
          )}
        </p>
      </section>

      {/* Paso 4: los datos */}
      <section className="tarjeta p-6">
        <h2 className={titulo}>
          <span className={paso}>4</span>
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
          <span className="mb-1 block text-sm font-medium text-tinta/70">Motivo</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="campo"
            placeholder="Ej: misa de acción de gracias, retiro, reunión de rama"
            maxLength={200}
            required
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
          : !rango
            ? "Elegí un horario para continuar"
            : seleccionados.length === 0
              ? "Elegí al menos un lugar"
              : "Confirmar reserva"}
      </button>

      <p className="pb-4 text-center text-xs text-tinta/50">
        La reserva se agenda al instante en el calendario.
      </p>
    </form>
  );
}
