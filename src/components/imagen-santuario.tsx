"use client";

import { useEffect, useRef } from "react";

const PRINCIPAL = "/mta.jpg";
const ALTERNATIVA = "/mta.png";

/**
 * La imagen de la Mater en el encabezado.
 *
 * El archivo se sube al repositorio, a public/. Si todavía no está, la imagen
 * se oculta sola en vez de dejar el ícono de imagen rota.
 *
 * Ojo con el momento: el navegador pide la imagen mientras lee el HTML, antes
 * de que React tome el control, así que un error puede ocurrir cuando todavía
 * no hay nadie escuchando. Por eso, además del onError, al montar se revisa si
 * la carga ya falló (una imagen terminada y sin ancho es una que no cargó).
 */
export default function ImagenSantuario() {
  const referencia = useRef<HTMLImageElement>(null);

  function siguienteIntento(imagen: HTMLImageElement) {
    if (!imagen.getAttribute("src")?.endsWith(ALTERNATIVA)) {
      imagen.src = ALTERNATIVA;
      return;
    }
    imagen.hidden = true;
  }

  useEffect(() => {
    const imagen = referencia.current;
    if (imagen && imagen.complete && imagen.naturalWidth === 0) siguienteIntento(imagen);
  }, []);

  // Va un <img> común y no next/image: solo así se puede detectar que el
  // archivo no está y ocultarlo.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={referencia}
      src={PRINCIPAL}
      alt="Mater Ter Admirabilis"
      onError={(evento) => siguienteIntento(evento.currentTarget)}
      className="mx-auto mb-5 w-32 rounded-2xl border border-dorado/30 shadow-xl shadow-marian/15 sm:w-36"
    />
  );
}
