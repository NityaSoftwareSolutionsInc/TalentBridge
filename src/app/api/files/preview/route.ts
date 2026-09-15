import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { previewPersonResume } from "@/lib/queries";
import { safeContentDispositionFileName } from "@/lib/jnp-links";
import { previewDisposition, sniffContentType, toBinaryBody } from "@/lib/file-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fileId = String(url.searchParams.get("fileId") || "").trim();
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  try {
    const preview = await previewPersonResume(session, fileId);
    const bytes = Buffer.from(toBinaryBody(preview.body));
    const contentType = sniffContentType(bytes, preview.fileName, preview.contentType);
    const fileName = safeContentDispositionFileName(preview.fileName);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${previewDisposition(contentType)}; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Preview failed";
    const status = /not found/i.test(message)
      ? 404
      : /only available|no stored document|not available|could not read/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
