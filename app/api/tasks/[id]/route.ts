import { getCurrentUser, unauthorized } from "@/lib/auth";
import { PublicError, clientMessage, rejectCrossSite, safeId } from "@/lib/security";
import { deleteTask } from "@/lib/task-repository";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const taskId = safeId((await context.params).id);
    if (!taskId) throw new PublicError("Tugas tidak valid.");
    const removed = await deleteTask(taskId, user.id);
    return removed
      ? Response.json({ message: "Tugas dihapus." })
      : Response.json({ message: "Tugas tidak ditemukan." }, { status: 404 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Tugas gagal dihapus.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
