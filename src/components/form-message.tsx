export function FormMessage({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-md border px-4 py-3 text-sm ${
        error
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-success/30 bg-success/10 text-success"
      }`}
    >
      {error ?? message}
    </p>
  );
}
