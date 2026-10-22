import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit, rejectCrossSite, requireJson, tooManyRequests } from "@/lib/security";

export const runtime = "nodejs";

const dummyHash = bcrypt.hashSync("studyspace-invalid-login", 12);

type LoginRow = RowDataPacket & {
  id: number;
  name: string;
  username: string;
  password_hash: string;
};

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const json = requireJson(request);
  if (json) return json;

  const ipLimit = rateLimit(`login:${clientIp(request)}`, 8, 15 * 60 * 1000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  try {
    const input = await request.json() as Record<string, unknown>;
    const username = String(input.username ?? "").trim().toLowerCase().slice(0, 50);
    const password = String(input.password ?? "").slice(0, 200);
    if (!username || !password) {
      return Response.json(
        { message: "Username dan kata sandi wajib diisi." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const nameLimit = rateLimit(`login-user:${username}`, 8, 15 * 60 * 1000);
    if (!nameLimit.ok) return tooManyRequests(nameLimit.retryAfter);

    const [rows] = await db.query<LoginRow[]>(
      "SELECT id, name, username, password_hash FROM users WHERE username = ? LIMIT 1",
      [username],
    );
    const record = rows[0];
    const valid = await bcrypt.compare(password, record?.password_hash || dummyHash);
    if (!record || !valid) {
      return Response.json(
        { message: "Username atau kata sandi salah." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    await createSession(Number(record.id));
    return Response.json(
      { user: { id: Number(record.id), name: record.name, username: record.username } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: "Belum bisa masuk. Coba lagi." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
