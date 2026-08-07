"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

import { cn } from "@/lib/utils";

export function ConfirmSubmitButton({
  confirmation,
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmation: string }) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (!event.defaultPrevented && !window.confirm(confirmation))
      event.preventDefault();
  }
  return (
    <button
      {...props}
      className={cn(
        "min-h-11 rounded-md border px-3 text-sm font-medium",
        className,
      )}
      onClick={handleClick}
    />
  );
}
