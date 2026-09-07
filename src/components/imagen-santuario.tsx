"use client";

import { useState } from "react";

/**
 * La imagen de la Mater en el encabezado.
 *
 * El archivo se sube al repositorio (public/mta.jpg o public/mta.png). Si
 * todavía no está, el componente no muestra nada en vez de dejar el ícono de
 * imagen rota: la página tiene que verse bien igual.
 */
const CANDIDATAS = ["/mta.jpg", "/mta.png", "/mta.jpeg", "/mta.webp"];

export default function ImagenSantuario() {
  const [intento, setIntento] = useState(0);

  if (intento >= CANDIDATAS.length) return null;

  // Va un <img> común y no next/image: el archivo puede no existir todavía, y
  // solo así se puede detectar con onError para no mostrar una imagen rota.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CANDIDATAS[intento]}
      alt="Mater Ter Admirabilis"
      onError={() => setIntento((valor) => valor + 1)}
      className="mx-auto mb-5 w-32 rounded-2xl border border-dorado/30 shadow-xl shadow-marian/15 sm:w-36"
    />
  );
}
