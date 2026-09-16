import fs from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".txt", ".rtf"]);
const ALLOWED_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function storageRoot() {
  return path.resolve(process.env.FILE_STORAGE_PATH || path.join(process.cwd(), "data", "uploads"));
}

function assertInsideRoot(fullPath: string) {
  const root = storageRoot();
  const resolved = path.resolve(fullPath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export function storageKeyFor(tenantId: string, fileId: string) {
  const tenant = String(tenantId || "").trim();
  const id = String(fileId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(tenant) || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid storage key");
  }
  return `${tenant}/${id}`;
}

export function fileExtension(fileName: string) {
  return path.extname(String(fileName || "")).toLowerCase();
}

export function guessContentType(fileName: string, mime?: string) {
  const ext = fileExtension(fileName);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".txt") return "text/plain";
  if (ext === ".rtf") return "application/rtf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  const hinted = String(mime || "").trim();
  if (hinted && hinted !== "application/octet-stream") return hinted;
  return "application/octet-stream";
}

export function assertUploadable(fileName: string, size: number, opts?: { images?: boolean }) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("File is empty");
  if (size > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 10 MB)");
  const ext = fileExtension(fileName);
  if (opts?.images) {
    if (!ALLOWED_IMAGE_EXT.has(ext)) throw new Error("Use a PNG, JPG, or WebP image for the company logo");
    return;
  }
  if (!ALLOWED_EXT.has(ext)) throw new Error("Use a PDF, Word, text, or RTF file");
}

export async function writeStoredFile(key: string, body: Buffer) {
  const full = assertInsideRoot(path.join(storageRoot(), key));
  await fs.mkdir(path.dirname(full), { recursive: true });
  // Write a copy so callers cannot mutate the on-disk bytes through a shared buffer.
  const payload = Buffer.from(body);
  await fs.writeFile(full, payload);
  const written = await fs.stat(full);
  if (written.size !== payload.length) {
    await fs.unlink(full).catch(() => undefined);
    throw new Error("Failed to store the uploaded file completely");
  }
}

export async function readStoredFile(key: string) {
  const safeKey = String(key || "").replace(/\\/g, "/");
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(safeKey)) return null;
  const full = assertInsideRoot(path.join(storageRoot(), safeKey));
  try {
    return await fs.readFile(full);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteStoredFile(key: string) {
  const safeKey = String(key || "").replace(/\\/g, "/");
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(safeKey)) return;
  const full = assertInsideRoot(path.join(storageRoot(), safeKey));
  try {
    await fs.unlink(full);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return;
    throw error;
  }
}

export function sniffContentType(buffer: Buffer, fileName?: string, hinted?: string) {
  if (buffer.length >= 5) {
    const head = buffer.subarray(0, 8);
    const ascii = head.toString("latin1");
    if (ascii.startsWith("%PDF")) return "application/pdf";
    if (ascii.startsWith("{\\rtf")) return "application/rtf";
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
    if (ascii.startsWith("RIFF") && buffer.length >= 12 && buffer.subarray(8, 12).toString("latin1") === "WEBP") {
      return "image/webp";
    }
    if (ascii.startsWith("GIF8")) return "image/gif";
    if (head[0] === 0x50 && head[1] === 0x4b) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
      return "application/msword";
    }
  }
  return guessContentType(fileName || "", hinted);
}

export function previewDisposition(contentType: string) {
  const inline =
    contentType === "application/pdf" ||
    contentType.startsWith("text/") ||
    contentType.startsWith("image/");
  return inline ? "inline" : "attachment";
}

export function toBinaryBody(body: Buffer | Uint8Array | ArrayBuffer) {
  if (Buffer.isBuffer(body)) return Uint8Array.from(body);
  if (body instanceof Uint8Array) return Uint8Array.from(body);
  return Uint8Array.from(new Uint8Array(body));
}
