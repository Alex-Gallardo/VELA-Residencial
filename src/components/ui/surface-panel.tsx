import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function SurfacePanel({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("rounded-xl border bg-surface p-6 shadow-sm", className)}
      {...props}
    />
  );
}
