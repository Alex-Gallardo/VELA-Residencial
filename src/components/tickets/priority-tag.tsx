import type { Priority } from "@prisma/client";

const styles: Record<Priority, string> = {
  BAJA: "bg-background text-muted",
  MEDIA: "bg-info/10 text-info",
  ALTA: "bg-warning/10 text-warning",
  URGENTE: "bg-danger/10 text-danger",
};

export function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[priority]}`}
    >
      {priority.toLowerCase()}
    </span>
  );
}
