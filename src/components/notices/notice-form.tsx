"use client";

import { NoticeType, NotificationChannel, RoleName } from "@prisma/client";
import { useEffect, useState } from "react";

import {
  audienceRoleLabels,
  noticeAudienceScopeLabels,
  noticeTypeLabels,
  notificationChannelLabels,
} from "@/config/notices";
import { createNoticeAction } from "@/server/actions/notices";

type AudienceScope = keyof typeof noticeAudienceScopeLabels;

export function NoticeForm({
  zones,
  dwellings,
  defaultPublishedAt,
  availableChannels,
}: {
  zones: string[];
  dwellings: Array<{ id: string; code: string; zone: string | null }>;
  defaultPublishedAt: string;
  availableChannels: NotificationChannel[];
}) {
  const [scope, setScope] = useState<AudienceScope>("ALL");
  const [timezoneOffset, setTimezoneOffset] = useState(360);
  useEffect(() => setTimezoneOffset(new Date().getTimezoneOffset()), []);
  return (
    <form action={createNoticeAction} className="mt-6 space-y-5">
      <input type="hidden" name="timezoneOffset" value={timezoneOffset} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Tipo
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="type"
            defaultValue={NoticeType.AVISO_OPERATIVO}
          >
            {Object.values(NoticeType).map((type) => (
              <option key={type} value={type}>
                {noticeTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Audiencia
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="audienceScope"
            value={scope}
            onChange={(event) => setScope(event.target.value as AudienceScope)}
          >
            {Object.entries(noticeAudienceScopeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scope !== "ALL" && (
        <label className="block text-sm font-medium">
          Selecciona uno o más destinos
          <select
            className="mt-2 min-h-32 w-full rounded-md border bg-background p-3"
            name="audienceValues"
            multiple
            required
          >
            {scope === "ZONE" &&
              zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            {scope === "DWELLING" &&
              dwellings.map((dwelling) => (
                <option key={dwelling.id} value={dwelling.id}>
                  {dwelling.code}
                  {dwelling.zone ? ` · ${dwelling.zone}` : ""}
                </option>
              ))}
            {scope === "ROLE" &&
              Object.values(RoleName).map((role) => (
                <option key={role} value={role}>
                  {audienceRoleLabels[role]}
                </option>
              ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">
            Usa Ctrl/Cmd para seleccionar varios elementos.
          </span>
        </label>
      )}

      <label className="block text-sm font-medium">
        Título
        <input
          className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
          name="title"
          minLength={4}
          maxLength={120}
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Mensaje
        <textarea
          className="mt-2 min-h-36 w-full rounded-md border bg-background p-3"
          name="body"
          minLength={10}
          maxLength={5000}
          required
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Canales</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {availableChannels.map((channel) => (
            <label
              key={channel}
              className="flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm"
            >
              <input
                name="channels"
                type="checkbox"
                value={channel}
                defaultChecked={channel === NotificationChannel.IN_APP}
              />
              {notificationChannelLabels[channel]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Publicar o programar
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="publishedAt"
            type="datetime-local"
            defaultValue={defaultPublishedAt}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Vence (opcional)
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="expiresAt"
            type="datetime-local"
          />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-md border bg-background p-4 text-sm">
        <input className="mt-1" name="requiresReadReceipt" type="checkbox" />
        <span>
          <strong className="block">Requerir confirmación de lectura</strong>
          <span className="text-muted">
            Úsalo para alertas, asambleas y cambios administrativos relevantes.
          </span>
        </span>
      </label>
      <button className="min-h-12 w-full rounded-md bg-brand px-5 font-semibold text-white">
        Guardar y distribuir aviso
      </button>
    </form>
  );
}
