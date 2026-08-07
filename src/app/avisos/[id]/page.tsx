import { NoticeType } from "@prisma/client";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { noticeTypeLabels } from "@/config/notices";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { markNoticeReadAction } from "@/server/actions/notices";

export default async function NoticeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    getAuthContext(),
  ]);
  if (!context?.user) redirect(`/login?next=/avisos/${encodeURIComponent(id)}`);
  if (!context.membership) redirect("/onboarding");
  const now = new Date();
  const receipt = await db.noticeReceipt.findFirst({
    where: {
      tenantId: context.membership.tenantId,
      userId: context.user.id,
      noticeId: id,
      notice: {
        deliveredAt: { not: null },
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    include: { notice: true },
  });
  if (!receipt) notFound();

  return (
    <ResidentShell active="avisos">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand"
        href="/avisos"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver a avisos
      </Link>
      <article
        className={`mt-5 rounded-xl border bg-surface p-7 shadow-md sm:p-10 ${
          receipt.notice.type === NoticeType.ALERTA_CRITICA
            ? "border-danger/40"
            : ""
        }`}
      >
        <p
          className={`flex items-center gap-2 text-sm font-semibold ${
            receipt.notice.type === NoticeType.ALERTA_CRITICA
              ? "text-danger"
              : "text-brand"
          }`}
        >
          {receipt.notice.type === NoticeType.ALERTA_CRITICA && (
            <AlertTriangle className="size-5" aria-hidden="true" />
          )}
          {noticeTypeLabels[receipt.notice.type]}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {receipt.notice.title}
        </h1>
        <p className="mt-3 text-xs text-muted">
          Publicado {receipt.notice.publishedAt?.toLocaleString("es-GT")}
        </p>
        <div className="mt-7 whitespace-pre-wrap text-base leading-7">
          {receipt.notice.body}
        </div>
        <div className="mt-7">
          <FormMessage error={query.error} message={query.message} />
        </div>
        {receipt.readAt ? (
          <p className="mt-6 flex items-center gap-2 rounded-md bg-success/10 p-4 text-sm font-medium text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" /> Lectura
            confirmada el {receipt.readAt.toLocaleString("es-GT")}
          </p>
        ) : (
          <form action={markNoticeReadAction} className="mt-6">
            <input type="hidden" name="noticeId" value={receipt.notice.id} />
            <button className="min-h-12 rounded-md bg-brand px-5 font-semibold text-white">
              {receipt.notice.requiresReadReceipt
                ? "Confirmar lectura"
                : "Marcar como leído"}
            </button>
          </form>
        )}
      </article>
    </ResidentShell>
  );
}
