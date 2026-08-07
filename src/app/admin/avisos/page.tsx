import { Megaphone } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { FormMessage } from "@/components/form-message";
import { NoticeForm } from "@/components/notices/notice-form";
import { noticeTypeLabels } from "@/config/notices";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

function localDateTimeValue(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");
}

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/avisos");
  if (!context.membership || !can(context.membership, "create", "notice"))
    redirect("/inicio?denied=1");

  const [dwellings, notices] = await Promise.all([
    db.dwelling.findMany({
      where: { tenantId: context.membership.tenantId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, zone: true },
    }),
    db.notice.findMany({
      where: { tenantId: context.membership.tenantId },
      include: { receipts: { select: { readAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const zones = [
    ...new Set(dwellings.flatMap(({ zone }) => (zone ? [zone] : []))),
  ].sort();

  return (
    <AdminShell permissions={context.membership}>
      <div className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
          <Megaphone className="size-8 text-brand" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-semibold">Crear aviso</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Segmenta la audiencia, programa la publicación y elige canales sin
            exponer información a otros residentes.
          </p>
          <div className="mt-5">
            <FormMessage error={query.error} message={query.message} />
          </div>
          <NoticeForm
            zones={zones}
            dwellings={dwellings}
            defaultPublishedAt={localDateTimeValue(new Date())}
          />
        </section>

        <section className="rounded-xl border bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">Avisos recientes</h2>
          <div className="mt-5 space-y-3">
            {notices.length === 0 && (
              <p className="rounded-md bg-background p-5 text-sm text-muted">
                Aún no hay avisos.
              </p>
            )}
            {notices.map((notice) => {
              const total = notice.receipts.length;
              const read = notice.receipts.filter(
                ({ readAt }) => readAt,
              ).length;
              const percentage = total ? Math.round((read / total) * 100) : 0;
              return (
                <article key={notice.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-brand">
                        {noticeTypeLabels[notice.type]}
                      </p>
                      <h3 className="mt-1 font-semibold">{notice.title}</h3>
                      <p className="mt-2 text-xs text-muted">
                        {notice.deliveredAt
                          ? `Publicado · ${total} destinatario(s)`
                          : `Programado · ${notice.publishedAt?.toLocaleString("es-GT") ?? "sin fecha"}`}
                      </p>
                    </div>
                    {notice.requiresReadReceipt && notice.deliveredAt && (
                      <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                        {percentage}% leído
                      </span>
                    )}
                  </div>
                  {notice.requiresReadReceipt && notice.deliveredAt && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
