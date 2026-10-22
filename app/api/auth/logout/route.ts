import { deleteCurrentSession } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  await deleteCurrentSession();
  return Response.json(
    { message: "Kamu sudah keluar." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
