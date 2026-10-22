import { getCurrentUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
