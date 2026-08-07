"use client";

import { BellRing, BellOff } from "lucide-react";
import { useState } from "react";

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/server/actions/notifications";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushSubscriptionManager({
  publicKey,
  hasSubscription,
}: {
  publicKey?: string;
  hasSubscription: boolean;
}) {
  const [enabled, setEnabled] = useState(hasSubscription);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function enablePush() {
    if (
      !publicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setMessage("Web Push no está configurado o no es compatible.");
      return;
    }
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("El navegador no concedió permiso para notificaciones.");
        return;
      }
      const registration =
        await navigator.serviceWorker.register("/vela-sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const result = await savePushSubscriptionAction(
        subscription.toJSON(),
        navigator.userAgent,
      );
      if (result.error) throw new Error(result.error);
      setEnabled(true);
      setMessage("Notificaciones push activadas en este dispositivo.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo activar Web Push.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/vela-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notificaciones push desactivadas en este dispositivo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Web Push en este dispositivo</p>
          <p className="mt-1 text-xs text-muted">
            {enabled ? "Suscripción activa" : "Suscripción inactiva"}
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={pending}
          onClick={enabled ? disablePush : enablePush}
        >
          {enabled ? (
            <BellOff className="size-4" aria-hidden="true" />
          ) : (
            <BellRing className="size-4" aria-hidden="true" />
          )}
          {enabled ? "Desactivar" : "Activar"}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-muted">{message}</p>}
    </div>
  );
}
