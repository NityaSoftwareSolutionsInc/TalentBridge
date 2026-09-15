import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addPersonFile } from "@/lib/queries";
import { MAX_UPLOAD_BYTES } from "@/lib/file-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof Blob) || uploaded.size <= 0) {
      return NextResponse.json({ error: "A file is required to preview it later" }, { status: 400 });
    }
    if (uploaded.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large (max 10 MB)" }, { status: 400 });
    }

    const ab = await uploaded.arrayBuffer();
    if (!ab.byteLength) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    // Copy into a standalone Buffer so the bytes are not a view on a pooled ArrayBuffer.
    const bytes = Buffer.from(new Uint8Array(ab));
    if (bytes.length !== uploaded.size) {
      return NextResponse.json(
        { error: "Upload was truncated. Increase the reverse-proxy body size limit and try again." },
        { status: 400 },
      );
    }

    const originalName =
      typeof File !== "undefined" && uploaded instanceof File && uploaded.name
        ? uploaded.name
        : String(form.get("name") || "upload.bin");

    const file = await addPersonFile(session, {
      personId: String(form.get("personId") || "").trim() || undefined,
      organizationId: String(form.get("organizationId") || "").trim() || undefined,
      name: String(form.get("name") || originalName || "").trim(),
      kind: String(form.get("kind") || "resume"),
      originalName,
      contentType: uploaded.type || undefined,
      bytes,
    });
    return NextResponse.json(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
