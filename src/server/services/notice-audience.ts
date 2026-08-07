import type { RoleName } from "@prisma/client";

import type { NoticeAudience } from "@/lib/validations/notice";

export type AudienceSubject = {
  roles: ReadonlyArray<{ role: RoleName; expiresAt?: Date | null }>;
  dwellings: ReadonlyArray<{ id: string; zone: string | null }>;
};

export function isNoticeAudienceMember(
  audience: NoticeAudience,
  subject: AudienceSubject,
  now = new Date(),
) {
  if (audience.scope === "ALL") return true;
  if (audience.scope === "ZONE")
    return subject.dwellings.some(
      ({ zone }) => zone !== null && audience.values.includes(zone),
    );
  if (audience.scope === "DWELLING")
    return subject.dwellings.some(({ id }) => audience.values.includes(id));

  return subject.roles.some(
    ({ role, expiresAt }) =>
      audience.values.includes(role) && (!expiresAt || expiresAt > now),
  );
}
