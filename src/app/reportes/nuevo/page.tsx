import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { CreateTicketWizard } from "@/components/tickets/create-ticket-wizard";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewTicketPage() {
  const context = await getAuthContext();
  if (!context?.user) redirect("/login?next=/reportes/nuevo");
  if (!context.membership) redirect("/onboarding");

  const [householdMember, categories] = await Promise.all([
    db.householdMember.findFirst({
      where: {
        tenantId: context.membership.tenantId,
        userId: context.user.id,
        active: true,
        household: { active: true },
      },
      include: { household: { include: { dwelling: true } } },
      orderBy: { isPrimary: "desc" },
    }),
    db.categoryConfig.findMany({
      where: { tenantId: context.membership.tenantId, active: true },
      select: { category: true, slaHours: true },
      orderBy: { category: "asc" },
    }),
  ]);

  if (!householdMember)
    redirect("/onboarding?error=Confirma+tu+vivienda+antes+de+reportar");

  return (
    <ResidentShell active="nuevo">
      <CreateTicketWizard
        dwellingId={householdMember.household.dwelling.id}
        dwellingCode={householdMember.household.dwelling.code}
        categories={categories}
      />
    </ResidentShell>
  );
}
