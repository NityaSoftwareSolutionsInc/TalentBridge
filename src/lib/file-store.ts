import fs from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".txt", ".rtf"]);

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
  const hinted = String(mime || "").trim();
  if (hinted && hinted !== "application/octet-stream") return hinted;
  return "application/octet-stream";
}

export function assertUploadable(fileName: string, size: number) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("File is empty");
  if (size > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 10 MB)");
  const ext = fileExtension(fileName);
  if (!ALLOWED_EXT.has(ext)) throw new Error("Use a PDF, Word, text, or RTF file");
}

export async function writeStoredFile(key: string, body: Buffer) {
  const full = assertInsideRoot(path.join(storageRoot(), key));
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
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

export function sniffContentType(buffer: Buffer, fileName?: string, hinted?: string) {
  if (buffer.length >= 5) {
    const head = buffer.subarray(0, 8);
    const ascii = head.toString("latin1");
    if (ascii.startsWith("%PDF")) return "application/pdf";
    if (ascii.startsWith("{\\rtf")) return "application/rtf";
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
  if (Buffer.isBuffer(body)) return new Uint8Array(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}
