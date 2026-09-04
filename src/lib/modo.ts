import { calendarioConfigurado } from "@/lib/google-calendar";

/**
 * Modo demostración: la página funciona normalmente pero no guarda nada.
 *
 * Se activa solo cuando faltan las credenciales de Google (así el sitio se
 * puede mostrar antes de tener el calendario conectado) o cuando se fuerza con
 * RESERVAS_MODO_DEMO=1 para probar en local. En cuanto las credenciales están
 * cargadas, se apaga solo: no hay ningún interruptor que quede mal puesto.
 */
export function modoDemo(): boolean {
  return process.env.RESERVAS_MODO_DEMO === "1" || !calendarioConfigurado();
}
