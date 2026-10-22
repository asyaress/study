export const runtime = "nodejs";

export async function POST() {
  return Response.json({ message: "Pendaftaran ditutup." }, { status: 404 });
}
