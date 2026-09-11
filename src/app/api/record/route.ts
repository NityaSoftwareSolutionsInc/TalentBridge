import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOrganizationWorkspace, getPersonWorkspace } from "@/lib/queries";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ record: null });
  if (type === "organization") {
    return NextResponse.json({ record: await getOrganizationWorkspace(session, id) });
  }
  return NextResponse.json({ record: await getPersonWorkspace(session, id) });
}
