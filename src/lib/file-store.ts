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

export function toArrayBuffer(buffer: Buffer) {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}
