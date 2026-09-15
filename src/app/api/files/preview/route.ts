import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { previewPersonResume } from "@/lib/queries";
import { safeContentDispositionFileName } from "@/lib/jnp-links";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fileId = String(url.searchParams.get("fileId") || "").trim();
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  // UUID-shaped ids only — avoid odd injection into lookups
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  try {
    const preview = await previewPersonResume(session, fileId);
    const fileName = safeContentDispositionFileName(preview.fileName);
    return new NextResponse(preview.body, {
      status: 200,
      headers: {
        "Content-Type": preview.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Preview failed";
    const status = /not found/i.test(message)
      ? 404
      : /only available|no stored document/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
