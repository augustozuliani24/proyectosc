import type { Metadata } from "next";

import { SANTUARIO_NOMBRE } from "@/lib/config";

import "./globals.css";

export const metadata: Metadata = {
  title: `Reservas · ${SANTUARIO_NOMBRE}`,
  description: `Reservá un horario en el ${SANTUARIO_NOMBRE}. Elegís día y hora, y queda agendado al instante.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
