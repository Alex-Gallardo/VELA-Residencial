import { NoticeType } from "@prisma/client";
import { AlertTriangle, Megaphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { noticeTypeLabels } from "@/config/notices";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/avisos");
  if (!context.membership) redirect("/onboarding");
  const now = new Date();
  const receipts = await db.noticeReceipt.findMany({
    where: {
      tenantId: context.membership.tenantId,
      userId: context.user.id,
      notice: {
        deliveredAt: { not: null },
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    include: { notice: true },
    orderBy: { notice: { publishedAt: "desc" } },
    take: 50,
  });

  return (
    <ResidentShell active="avisos">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Comunidad
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Avisos
        </h1>
        <p className="mt-2 text-sm text-muted">
          Comunicados dirigidos a tu vivienda, zona o rol.
        </p>
      </div>
      <div className="mt-5">
        <FormMessage error={query.error} />
      </div>
      <div className="mt-7 space-y-3">
        {receipts.length === 0 && (
          <section className="rounded-xl border bg-surface p-10 text-center shadow-sm">
            <Megaphone
              className="mx-auto size-10 text-faint"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold">
              No hay avisos vigentes
            </h2>
            <p className="mt-2 text-sm text-muted">
              Aquí aparecerán únicamente los comunicados de tu audiencia.
            </p>
          </section>
        )}
        {receipts.map(({ notice, readAt }) => (
          <Link
            key={notice.id}
            className={`block rounded-xl border bg-surface p-5 shadow-sm transition hover:border-brand ${
              notice.type === NoticeType.ALERTA_CRITICA
                ? "border-danger/40"
                : ""
            }`}
            href={`/avisos/${notice.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    notice.type === NoticeType.ALERTA_CRITICA
                      ? "text-danger"
                      : "text-brand"
                  }`}
                >
                  {notice.type === NoticeType.ALERTA_CRITICA && (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  )}
                  {noticeTypeLabels[notice.type]}
                </p>
                <h2 className="mt-2 text-lg font-semibold">{notice.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {notice.body}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  readAt
                    ? "bg-background text-muted"
                    : "bg-brand-soft text-brand"
                }`}
              >
                {readAt ? "Leído" : "Pendiente"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </ResidentShell>
  );
}
