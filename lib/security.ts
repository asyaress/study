import path from "node:path";

export class PublicError extends Error {}

const UPLOAD_ROOT = path.resolve(process.cwd(), "storage", "uploads");
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
]);

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function clientIp(request: Request) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim().slice(0, 64);
  }
  return "direct";
}

export function requestOrigin(request: Request) {
  if (process.env.TRUST_PROXY === "1") {
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (host) return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export function rejectCrossSite(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return Response.json({ message: "Permintaan ditolak." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) {
    return Response.json({ message: "Permintaan ditolak." }, { status: 403 });
  }
  return null;
}

export function requireJson(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return Response.json({ message: "Permintaan tidak valid." }, { status: 415 });
  }
  return null;
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [name, bucket] of buckets) {
      if (bucket.reset < now) buckets.delete(name);
    }
  }
  const current = buckets.get(key);
  if (!current || current.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return { ok: false, retryAfter: Math.ceil((current.reset - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number) {
  return Response.json(
    { message: "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

export function safeId(value: string) {
  if (!/^\d{1,18}$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

export function fileExtension(name: string) {
  const base = path.basename(name).normalize("NFKC");
  const extension = path.extname(base).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return null;
  if (base.slice(0, -extension.length).includes(".")) {
    const earlier = base.slice(0, -extension.length).toLowerCase();
    if (/\.(php|phtml|js|mjs|html|htm|svg|exe|sh|bat|cmd|ps1)$/.test(earlier)) return null;
  }
  return extension;
}

export function storedUploadPath(folder: number | string, storedName: string) {
  const folderName = String(folder);
  if (!/^(?:\d{1,18}|[cst]\d{1,18})$/.test(folderName)) {
    throw new PublicError("File tidak valid.");
  }
  if (
    storedName.includes("..") ||
    storedName.includes("/") ||
    storedName.includes("\\") ||
    storedName.includes("\0")
  ) {
    throw new PublicError("File tidak valid.");
  }
  const fileName = path.basename(storedName);
  if (fileName !== storedName) throw new PublicError("File tidak valid.");
  const full = path.resolve(UPLOAD_ROOT, folderName, fileName);
  const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep;
  if (!full.startsWith(rootWithSep)) throw new PublicError("File tidak valid.");
  return full;
}

export function contentDisposition(name: string) {
  const cleaned = name.replace(/[\r\n"]/g, "_").slice(0, 180);
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

export function safeDownloadType(storedName: string) {
  const extension = path.extname(storedName).toLowerCase();
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
  };
  return types[extension] ?? "application/octet-stream";
}

export function clientMessage(error: unknown, fallback: string) {
  return error instanceof PublicError ? error.message : fallback;
}
