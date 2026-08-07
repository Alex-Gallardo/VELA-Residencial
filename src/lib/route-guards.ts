export const PRIVATE_ROUTE_PREFIXES = [
  "/inicio",
  "/reportes",
  "/admin",
  "/onboarding",
] as const;

export function isPrivateRoute(pathname: string) {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isOnboardingRoute(pathname: string) {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

export function safeRelativePath(
  value: string | null | undefined,
  fallback = "/inicio",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  return value;
}
