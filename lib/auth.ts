import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-study_session" : "study_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: number;
  name: string;
  username: string;
};

type UserRow = RowDataPacket & AuthUser;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.execute<ResultSetHeader>("DELETE FROM sessions WHERE expires_at <= NOW() OR user_id = ?", [userId]);
  await db.execute<ResultSetHeader>(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [rows] = await db.query<UserRow[]>(
    `SELECT u.id, u.name, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > NOW()
      LIMIT 1`,
    [tokenHash],
  );
  const user = rows[0];
  if (!user) return null;
  return { id: Number(user.id), name: user.name, username: user.username };
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.execute<ResultSetHeader>("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  cookieStore.delete(COOKIE_NAME);
}

export function unauthorized() {
  return Response.json(
    { message: "Silakan masuk terlebih dahulu." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
