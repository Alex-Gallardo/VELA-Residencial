"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useNotificationStore } from "@/stores/notification-store";

export function NotificationRealtimeBridge({
  userId,
  initialUnreadCount,
  mobile = false,
  active = false,
  subscribe = true,
}: {
  userId: string;
  initialUnreadCount: number;
  mobile?: boolean;
  active?: boolean;
  subscribe?: boolean;
}) {
  const router = useRouter();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const incrementUnread = useNotificationStore(
    (state) => state.incrementUnread,
  );

  useEffect(
    () => setUnreadCount(initialUnreadCount),
    [initialUnreadCount, setUnreadCount],
  );

  useEffect(() => {
    if (!subscribe) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (disposed) return;
      const supabase = createClient();
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            if (payload.new.channel === "IN_APP") incrementUnread();
            router.refresh();
          },
        )
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [incrementUnread, router, subscribe, userId]);

  return (
    <Link
      className={
        mobile
          ? `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${
              active ? "bg-brand-soft text-brand" : "text-muted"
            }`
          : "relative grid size-11 place-items-center rounded-md border bg-surface"
      }
      href="/notificaciones"
      aria-label={`${unreadCount} notificaciones sin leer`}
    >
      <Bell className="size-5" aria-hidden="true" />
      {mobile && <span>Alertas</span>}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
