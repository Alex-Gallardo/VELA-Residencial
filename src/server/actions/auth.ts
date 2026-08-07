"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeRelativePath } from "@/lib/route-guards";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

function withMessage(path: string, key: "error" | "message", message: string) {
  const params = new URLSearchParams({ [key]: message });
  return `${path}?${params.toString()}`;
}

export async function loginAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeRelativePath(String(formData.get("next") ?? "/inicio"));
  if (!parsed.success)
    redirect(
      withMessage("/login", "error", "Revisa el correo y la contraseña."),
    );

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    redirect(withMessage("/login", "error", "No pudimos iniciar la sesión."));

  redirect(next);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(withMessage("/login", "message", "Sesión cerrada correctamente."));
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success)
    redirect(
      withMessage("/recuperar-cuenta", "error", "Ingresa un correo válido."),
    );

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appUrl}/auth/callback?next=/actualizar-password`,
  });
  redirect(
    withMessage(
      "/recuperar-cuenta",
      "message",
      "Si la cuenta existe, recibirás instrucciones en tu correo.",
    ),
  );
}

export async function updatePasswordAction(formData: FormData) {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success)
    redirect(
      withMessage(
        "/actualizar-password",
        "error",
        "La contraseña debe tener al menos 8 caracteres.",
      ),
    );

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error)
    redirect(
      withMessage(
        "/actualizar-password",
        "error",
        "El enlace ya no es válido. Solicita uno nuevo.",
      ),
    );
  redirect(withMessage("/inicio", "message", "Contraseña actualizada."));
}
