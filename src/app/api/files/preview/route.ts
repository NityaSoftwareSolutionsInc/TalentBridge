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
    // Fresh copy — avoid Node Buffer pool / ArrayBufferLike typing issues that can
    // corrupt binary responses in Chrome's PDF viewer.
    const bytes = Uint8Array.from(toBinaryBody(preview.body));
    if (!bytes.byteLength) {
      return NextResponse.json({ error: "File is empty" }, { status: 404 });
    }
    const contentType = sniffContentType(
      Buffer.from(bytes),
      preview.fileName,
      preview.contentType,
    );
    const fileName = safeContentDispositionFileName(preview.fileName);
    const disposition = previewDisposition(contentType);
    // Cast: TS DOM libs disagree on Uint8Array<ArrayBufferLike> vs BodyInit.
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
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
