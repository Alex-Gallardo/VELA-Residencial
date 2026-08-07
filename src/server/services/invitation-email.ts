export function invitationEmail(input: {
  invitationUrl: string;
  tenantName: string;
}) {
  return {
    subject: `Invitación a ${input.tenantName} en Vela`,
    text: `Te invitaron a ${input.tenantName}. Acepta la invitación en ${input.invitationUrl}. Este enlace vence en 7 días.`,
  };
}
