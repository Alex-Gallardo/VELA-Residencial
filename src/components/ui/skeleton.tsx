import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded-md bg-border", className)}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-5 px-5 py-10"
      aria-busy="true"
      aria-label="Cargando contenido"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
