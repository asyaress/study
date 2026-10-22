export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("Aplikasi tidak boleh dijalankan sebagai root.");
  }

  const dbUser = (process.env.DB_USER ?? "root").toLowerCase();
  if (dbUser === "root" || dbUser === "admin" || !process.env.DB_PASSWORD) {
    throw new Error("Pakai user database terbatas, bukan root, dan isi kata sandinya.");
  }
}
