/**
 * Prueba las rutas contra un servidor levantado, sin tocar Google Calendar.
 *
 *   npm run build && npx next start -p 3111
 *   npm run pruebas:api
 *
 * Corre en modo demostración (sin credenciales), así que verifica las
 * validaciones y la forma de las respuestas, no la escritura en el calendario.
 */
const BASE = process.env.URL_PRUEBAS ?? "http://localhost:3111";

let ok = 0;
const fallas = [];

function chequear(nombre, condicion, detalle = "") {
  if (condicion) {
    ok += 1;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallas.push(`${nombre}${detalle ? ` — ${detalle}` : ""}`);
    console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

async function reservar(datos) {
  const respuesta = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

const base = {
  fecha: "2026-09-17",
  horaInicio: "10:00",
  horaFin: "11:00",
  lugares: ["santuario"],
  personas: 10,
  nombre: "Familia de prueba",
  telefono: "351 555 1234",
  motivo: "Prueba automática",
};

console.log("\nDisponibilidad");
const jueves = await (await fetch(`${BASE}/api/availability?date=2026-09-17`)).json();
chequear("responde el jueves", jueves.ok === true);
chequear("la grilla arranca a las 08:00", jueves.puntos[0] === 480, `dio ${jueves.puntos[0]}`);
chequear("el cierre entra como fin", jueves.puntos.at(-1) === 1320);
chequear("trae los tres lugares", jueves.lugares.length === 3);
chequear("trae la ocupación por lugar", jueves.lugares.every((l) => Array.isArray(jueves.ocupados[l.id])));

const domingo = await (await fetch(`${BASE}/api/availability?date=2026-09-20`)).json();
chequear("el domingo arranca 13:30", domingo.puntos[0] === 810, `dio ${domingo.puntos[0]}`);
chequear("el domingo no está cerrado", domingo.diaCerrado === false);

const invalida = await fetch(`${BASE}/api/availability?date=hola`);
chequear("rechaza una fecha inválida", invalida.status === 400);

console.log("\nCombinaciones de lugares");
for (const lugares of [
  ["santuario"],
  ["sum"],
  ["cocina"],
  ["santuario", "sum"],
  ["santuario", "cocina"],
  ["sum", "cocina"],
  ["santuario", "sum", "cocina"],
]) {
  const { cuerpo } = await reservar({ ...base, lugares });
  chequear(`reserva ${lugares.join(" + ")}`, cuerpo.ok === true, cuerpo.mensaje);
}

console.log("\nDuraciones");
for (const [desde, hasta, etiqueta] of [
  ["10:00", "10:30", "media hora"],
  ["10:00", "11:00", "una hora"],
  ["15:00", "21:00", "seis horas"],
  ["08:00", "22:00", "el día entero"],
]) {
  const { cuerpo } = await reservar({ ...base, horaInicio: desde, horaFin: hasta });
  chequear(`reserva de ${etiqueta}`, cuerpo.ok === true, cuerpo.mensaje);
}

console.log("\nPedidos que hay que rechazar");
const rechazos = [
  ["fecha pasada", { fecha: "2020-01-01" }, "fecha_pasada"],
  ["más de 90 días", { fecha: "2030-01-01" }, "fecha_lejana"],
  ["fin antes del inicio", { horaInicio: "11:00", horaFin: "10:00" }, "duracion_invalida"],
  ["mismo inicio y fin", { horaInicio: "10:00", horaFin: "10:00" }, "duracion_invalida"],
  ["fuera de la grilla", { horaInicio: "10:07" }, "horario_invalido"],
  ["antes de abrir", { horaInicio: "06:00", horaFin: "07:00" }, "fuera_de_horario"],
  ["después de cerrar", { horaInicio: "21:30", horaFin: "23:00" }, "fuera_de_horario"],
  ["domingo a la mañana", { fecha: "2026-09-20", horaInicio: "10:00", horaFin: "11:00" }, "fuera_de_horario"],
  ["sin lugar", { lugares: [] }, "sin_lugar"],
  ["lugar inexistente", { lugares: ["patio"] }, "sin_lugar"],
  ["sin personas", { personas: undefined }, "personas_invalido"],
  ["cero personas", { personas: 0 }, "personas_invalido"],
  ["nombre vacío", { nombre: "" }, "nombre_invalido"],
  ["teléfono corto", { telefono: "3515" }, "telefono_invalido"],
  ["teléfono largo", { telefono: "35155512345" }, "telefono_invalido"],
  ["sin motivo", { motivo: "" }, "motivo_invalido"],
  ["campo trampa completo", { web: "spam" }, "rechazado"],
];

for (const [nombre, cambio, codigoEsperado] of rechazos) {
  const { cuerpo } = await reservar({ ...base, ...cambio });
  chequear(`rechaza: ${nombre}`, cuerpo.codigo === codigoEsperado, `dio ${cuerpo.codigo ?? "ok"}`);
}

console.log("\nDomingo dentro del horario");
const domingoOk = await reservar({
  ...base,
  fecha: "2026-09-20",
  horaInicio: "13:30",
  horaFin: "15:00",
});
chequear("acepta domingo 13:30", domingoOk.cuerpo.ok === true, domingoOk.cuerpo.mensaje);

console.log(`\n${ok} pruebas pasaron, ${fallas.length} fallaron`);
if (fallas.length > 0) {
  console.log(fallas.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
