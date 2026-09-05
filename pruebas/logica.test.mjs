import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TIMEZONE } from "@/lib/config.ts";
import {
  horarioDeFecha,
  lugaresLibres,
  minimoInicio,
  ocupacionDelDia,
  primeraFechaReservable,
  puntosDelDia,
  validarPedido,
} from "@/lib/disponibilidad.ts";
import { lugaresDelEvento } from "@/lib/google-calendar.ts";
import {
  aFechaLocal,
  aInstanteUTC,
  aMinutosDelDia,
  diaDeLaSemana,
  diferenciaEnDias,
  esFechaValida,
  formatearHora,
  parsearHora,
  sumarDias,
} from "@/lib/time.ts";
import { digitosTelefono, formatearTelefono, telefonoValido } from "@/lib/telefono.ts";

const JUEVES = "2026-09-17";
const DOMINGO = "2026-09-20";

/** Un "ahora" fijo para que las pruebas no dependan del día en que corran. */
const AHORA = aInstanteUTC("2026-09-10", 10 * 60, TIMEZONE);

/** Arma un evento del calendario como los que devuelve listarEventos. */
function evento(fecha, desdeMin, hastaMin, lugares, extra = {}) {
  return {
    id: extra.id ?? `e${desdeMin}`,
    creado: extra.creado ?? "2026-09-01T10:00:00Z",
    inicio: aInstanteUTC(fecha, desdeMin, TIMEZONE),
    fin: aInstanteUTC(fecha, hastaMin, TIMEZONE),
    todoElDia: false,
    lugares,
  };
}

describe("fechas y horas", () => {
  it("convierte de local a UTC y vuelve sin perder el día", () => {
    const instante = aInstanteUTC(JUEVES, 9 * 60, TIMEZONE);
    assert.equal(aFechaLocal(instante, TIMEZONE), JUEVES);
    assert.equal(aMinutosDelDia(instante, TIMEZONE), 9 * 60);
  });

  it("a las 22 de Argentina sigue siendo el mismo día, aunque en UTC ya sea el siguiente", () => {
    const instante = aInstanteUTC(JUEVES, 22 * 60, TIMEZONE);
    assert.equal(instante.toISOString().slice(0, 10), "2026-09-18");
    assert.equal(aFechaLocal(instante, TIMEZONE), JUEVES);
  });

  it("reconoce el día de la semana", () => {
    assert.equal(diaDeLaSemana(DOMINGO, TIMEZONE), 0);
    assert.equal(diaDeLaSemana(JUEVES, TIMEZONE), 4);
  });

  it("suma días cruzando fin de mes y de año", () => {
    assert.equal(sumarDias("2026-09-30", 1), "2026-10-01");
    assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  });

  it("cuenta los días entre fechas", () => {
    assert.equal(diferenciaEnDias("2026-09-17", "2026-09-20"), 3);
    assert.equal(diferenciaEnDias("2026-09-20", "2026-09-17"), -3);
  });

  it("rechaza fechas que no existen", () => {
    assert.equal(esFechaValida("2026-02-31"), false);
    assert.equal(esFechaValida("2026-13-01"), false);
    assert.equal(esFechaValida("17/09/2026"), false);
    assert.equal(esFechaValida("2026-09-17"), true);
  });

  it("formatea y lee horas", () => {
    assert.equal(formatearHora(810), "13:30");
    assert.equal(formatearHora(480), "08:00");
    assert.equal(parsearHora("13:30"), 810);
    assert.equal(parsearHora("25:00"), null);
    assert.equal(parsearHora("hola"), null);
  });
});

describe("teléfono", () => {
  it("acepta los diez números escritos de cualquier forma", () => {
    for (const valor of ["3515551234", "351 555 1234", "351-555-1234", "(351) 555 1234"]) {
      assert.equal(telefonoValido(valor), true, valor);
    }
  });

  it("tolera el +54 y el 0 de adelante", () => {
    assert.equal(telefonoValido("+54 351 555 1234"), true);
    assert.equal(telefonoValido("0351 555 1234"), true);
  });

  it("rechaza los que tienen de menos o de más", () => {
    assert.equal(telefonoValido("351555"), false);
    assert.equal(telefonoValido("35155512345"), false, "un dígito de más no se recorta en silencio");
    assert.equal(telefonoValido(""), false);
  });

  it("muestra el formato mientras se escribe", () => {
    assert.equal(formatearTelefono("3515551234"), "351 555 1234");
    assert.equal(formatearTelefono("35155"), "351 55");
    assert.equal(digitosTelefono("+54 351 555 1234"), "3515551234");
  });
});

describe("horario por día", () => {
  it("los domingos recién abre 13:30", () => {
    assert.deepEqual(horarioDeFecha(DOMINGO), { aperturaMin: 810, cierreMin: 1320 });
    assert.equal(puntosDelDia(DOMINGO)[0], 810);
    assert.equal(minimoInicio(DOMINGO, AHORA), 810);
  });

  it("el resto de los días abre a las 8", () => {
    assert.deepEqual(horarioDeFecha(JUEVES), { aperturaMin: 480, cierreMin: 1320 });
    assert.equal(puntosDelDia(JUEVES)[0], 480);
    assert.equal(puntosDelDia(JUEVES).at(-1), 1320, "el cierre entra como hora de fin");
  });

  it("hoy no deja reservar sobre la hora", () => {
    const hoy = aFechaLocal(AHORA, TIMEZONE);
    assert.ok(minimoInicio(hoy, AHORA) >= aMinutosDelDia(AHORA, TIMEZONE) + 60);
  });

  it("propone un día que todavía tenga horarios libres", () => {
    const fecha = primeraFechaReservable(AHORA);
    assert.ok(esFechaValida(fecha));
    assert.ok(minimoInicio(fecha, AHORA) < horarioDeFecha(fecha).cierreMin);
  });
});

describe("ocupación por lugar", () => {
  it("un evento del santuario no bloquea la cocina", () => {
    const ocupacion = ocupacionDelDia([evento(JUEVES, 600, 660, ["santuario"])], JUEVES);
    assert.deepEqual(ocupacion.santuario, [{ inicioMin: 600, finMin: 660 }]);
    assert.deepEqual(ocupacion.cocina, []);
    assert.deepEqual(ocupacion.sum, []);
  });

  it("junta dos reservas pegadas o superpuestas del mismo lugar", () => {
    const ocupacion = ocupacionDelDia(
      [evento(JUEVES, 600, 660, ["santuario"]), evento(JUEVES, 630, 720, ["santuario"], { id: "b" })],
      JUEVES,
    );
    assert.deepEqual(ocupacion.santuario, [{ inicioMin: 600, finMin: 720 }]);
  });

  it("recorta lo que viene del día anterior", () => {
    const anoche = {
      id: "x",
      creado: "",
      inicio: aInstanteUTC("2026-09-16", 22 * 60, TIMEZONE),
      fin: aInstanteUTC(JUEVES, 9 * 60, TIMEZONE),
      todoElDia: false,
      lugares: ["cocina"],
    };
    assert.deepEqual(ocupacionDelDia([anoche], JUEVES).cocina, [{ inicioMin: 0, finMin: 540 }]);
  });

  it("un evento de otro día no ensucia el día pedido", () => {
    assert.deepEqual(ocupacionDelDia([evento(DOMINGO, 900, 960, ["santuario"])], JUEVES).santuario, []);
  });
});

describe("qué lugares quedan libres", () => {
  const ocupacion = ocupacionDelDia(
    [evento(JUEVES, 600, 660, ["santuario", "cocina"])],
    JUEVES,
  );

  it("deja libre lo que nadie tomó", () => {
    assert.deepEqual(lugaresLibres(ocupacion, 600, 660), ["sum"]);
  });

  it("dos reservas que se tocan no se pisan", () => {
    assert.deepEqual(lugaresLibres(ocupacion, 660, 720).sort(), ["cocina", "santuario", "sum"]);
    assert.deepEqual(lugaresLibres(ocupacion, 540, 600).sort(), ["cocina", "santuario", "sum"]);
  });

  it("detecta la superposición aunque sea de un minuto", () => {
    assert.deepEqual(lugaresLibres(ocupacion, 630, 690), ["sum"]);
    assert.deepEqual(lugaresLibres(ocupacion, 570, 630), ["sum"]);
    assert.deepEqual(lugaresLibres(ocupacion, 540, 720), ["sum"], "una reserva que la contiene entera");
  });
});

describe("validación del pedido", () => {
  const ok = (fecha, desde, hasta, lugares = ["santuario"]) =>
    validarPedido(fecha, desde, hasta, lugares, AHORA);

  it("acepta un pedido normal", () => {
    assert.equal(ok(JUEVES, 600, 660), null);
  });

  it("acepta el día entero", () => {
    assert.equal(ok(JUEVES, 480, 1320), null);
  });

  it("acepta los tres lugares juntos", () => {
    assert.equal(ok(JUEVES, 600, 660, ["santuario", "sum", "cocina"]), null);
  });

  it("rechaza fechas imposibles", () => {
    assert.equal(ok("2020-01-01", 600, 660), "fecha_pasada");
    assert.equal(ok("2030-01-01", 600, 660), "fecha_lejana");
    assert.equal(ok("2026-02-31", 600, 660), "fecha_invalida");
  });

  it("rechaza horarios fuera de la grilla o del horario del día", () => {
    assert.equal(ok(JUEVES, 607, 660), "horario_invalido");
    assert.equal(ok(JUEVES, 660, 600), "duracion_invalida");
    assert.equal(ok(JUEVES, 660, 660), "duracion_invalida");
    assert.equal(ok(JUEVES, 420, 660), "fuera_de_horario");
    assert.equal(ok(JUEVES, 1290, 1350), "fuera_de_horario");
  });

  it("aplica el horario especial del domingo", () => {
    assert.equal(ok(DOMINGO, 600, 660), "fuera_de_horario");
    assert.equal(ok(DOMINGO, 780, 900), "fuera_de_horario", "13:00 todavía no");
    assert.equal(ok(DOMINGO, 810, 900), null, "13:30 sí");
  });

  it("exige al menos un lugar y que exista", () => {
    assert.equal(ok(JUEVES, 600, 660, []), "sin_lugar");
    assert.equal(ok(JUEVES, 600, 660, ["patio"]), "lugar_invalido");
  });
});

describe("eventos cargados a mano en el calendario", () => {
  it("respeta lo que anotó el sistema", () => {
    assert.deepEqual(
      lugaresDelEvento({ id: "1", extendedProperties: { private: { lugares: "sum,cocina" } } }),
      ["sum", "cocina"],
    );
  });

  it("lee el lugar del título", () => {
    assert.deepEqual(lugaresDelEvento({ id: "2", summary: "Cocina - reunión" }), ["cocina"]);
    assert.deepEqual(lugaresDelEvento({ id: "3", summary: "misa en el santuario" }), ["santuario"]);
    assert.deepEqual(lugaresDelEvento({ id: "4", summary: "SUM: catequesis" }), ["sum"]);
  });

  it("si el título no nombra ningún lugar, bloquea todo", () => {
    assert.deepEqual(lugaresDelEvento({ id: "5", summary: "Reunión de equipo" }), [
      "santuario",
      "sum",
      "cocina",
    ]);
    assert.deepEqual(lugaresDelEvento({ id: "6" }), ["santuario", "sum", "cocina"]);
  });
});
