import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AnalyticsProvider } from "@/components/providers/analytics-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Vela — Tu residencial, en orden",
  description:
    "Acceso seguro e invitaciones para la plataforma de operación residencial Vela.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
