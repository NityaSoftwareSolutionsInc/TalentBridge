import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addPersonFile } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File) || uploaded.size <= 0) {
      return NextResponse.json({ error: "A file is required to preview it later" }, { status: 400 });
    }
    const bytes = Buffer.from(await uploaded.arrayBuffer());
    const file = await addPersonFile(session, {
      personId: String(form.get("personId") || "").trim() || undefined,
      organizationId: String(form.get("organizationId") || "").trim() || undefined,
      name: String(form.get("name") || uploaded.name || "").trim(),
      kind: String(form.get("kind") || "resume"),
      originalName: uploaded.name,
      contentType: uploaded.type,
      bytes,
    });
    return NextResponse.json(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
