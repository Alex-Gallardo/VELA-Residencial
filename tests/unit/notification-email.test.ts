import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { NotificationEmail } from "../../src/emails/notification-email";

describe("correo transaccional", () => {
  it("renderiza contenido y enlace de acción de Vela", async () => {
    const html = await render(
      NotificationEmail({
        title: "Reporte actualizado",
        body: "Tu reporte cambió de estado.",
        actionUrl: "https://vela.example/reportes/123",
        tenantName: "Residencial Demo",
      }),
    );
    expect(html).toContain("Reporte actualizado");
    expect(html).toContain("https://vela.example/reportes/123");
    expect(html).toContain("Residencial Demo");
  });
});
