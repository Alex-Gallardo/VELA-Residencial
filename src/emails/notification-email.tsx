/* eslint-disable @next/next/no-head-element -- this is email HTML, not a Next.js page. */
import * as React from "react";

export function NotificationEmail({
  title,
  body,
  actionUrl,
  tenantName,
}: {
  title: string;
  body: string;
  actionUrl?: string | null;
  tenantName: string;
}) {
  return (
    <html lang="es">
      <head>
        <meta content="text/html; charset=UTF-8" httpEquiv="Content-Type" />
        <title>{title}</title>
      </head>
      <body style={{ backgroundColor: "#f4f6f4", fontFamily: "Arial" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            margin: "32px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <p style={{ color: "#2d7a55", fontWeight: 700, margin: 0 }}>
            Vela · {tenantName}
          </p>
          <h1 style={{ color: "#17211b", fontSize: "26px" }}>{title}</h1>
          <p style={{ color: "#4f5f56", lineHeight: "1.6" }}>{body}</p>
          {actionUrl && (
            <div style={{ marginTop: "28px" }}>
              <a
                href={actionUrl}
                style={{
                  backgroundColor: "#2d7a55",
                  borderRadius: "8px",
                  color: "#ffffff",
                  display: "inline-block",
                  fontWeight: 700,
                  padding: "12px 20px",
                  textDecoration: "none",
                }}
              >
                Abrir en Vela
              </a>
            </div>
          )}
          <p style={{ color: "#78857d", fontSize: "12px", marginTop: 28 }}>
            Ajusta tus canales y horario silencioso desde tu perfil.
          </p>
        </div>
      </body>
    </html>
  );
}
