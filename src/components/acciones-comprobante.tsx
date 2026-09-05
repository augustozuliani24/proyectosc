"use client";

interface Props {
  urlIcs: string;
}

export default function AccionesComprobante({ urlIcs }: Props) {
  return (
    <div className="no-imprimir mt-6 flex flex-wrap justify-center gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl bg-marian px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-marian-dark"
      >
        Descargar o imprimir
      </button>

      <a
        href={urlIcs}
        className="rounded-xl border border-borde bg-white px-5 py-2.5 text-sm font-medium text-marian-dark transition hover:bg-marian-soft"
      >
        Agregar a mi calendario
      </a>
    </div>
  );
}
