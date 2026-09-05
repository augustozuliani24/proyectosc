/**
 * Permite que las pruebas importen "@/lib/..." igual que lo hace Next.js, y
 * que los archivos de src se importen entre sí sin escribir la extensión.
 */
import { existsSync } from "node:fs";
import { resolve as resolverRuta } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = pathToFileURL(`${resolverRuta(process.cwd(), "src")}/`).href;
const EXTENSIONES = [".ts", ".tsx", ".mjs", ".js"];

function conExtension(url) {
  const ruta = fileURLToPath(url);
  if (existsSync(ruta)) return url;

  for (const extension of EXTENSIONES) {
    if (existsSync(`${ruta}${extension}`)) return `${url}${extension}`;
  }
  return url;
}

export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith("@/")) {
    return siguiente(conExtension(new URL(especificador.slice(2), raiz).href), contexto);
  }

  if (especificador.startsWith(".") && contexto.parentURL?.includes("/src/")) {
    return siguiente(conExtension(new URL(especificador, contexto.parentURL).href), contexto);
  }

  return siguiente(especificador, contexto);
}
