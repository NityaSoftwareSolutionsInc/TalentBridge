import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  dashboard,
  globalSearch,
  listCommunications,
  listRequirements,
  listTasks,
  listUsers,
  navBadges,
  searchPeople,
  settingsPayload,
  type ModuleKey,
} from "@/lib/queries";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const module = (url.searchParams.get("module") || session.landing) as ModuleKey;
  const q = url.searchParams.get("q") || undefined;

  if (url.searchParams.get("global") === "1") {
    return NextResponse.json({ results: await globalSearch(session, q || "") });
  }

  const filters = {
    q,
    title: url.searchParams.get("title") || undefined,
    skills: url.searchParams.get("skills") || undefined,
    location: url.searchParams.get("location") || undefined,
    experience: url.searchParams.get("experience") || undefined,
    source: url.searchParams.get("source") || undefined,
    owner: url.searchParams.get("owner") || undefined,
    availability: url.searchParams.get("availability") || undefined,
    lastOutreach: url.searchParams.get("lastOutreach") || undefined,
    excludeRequirementId: url.searchParams.get("excludeRequirementId") || undefined,
    workAuthorization: url.searchParams.get("workAuthorization") || undefined,
    stage: url.searchParams.get("stage") || undefined,
  };

  const badges = await navBadges(session.tenantId);

  if (module === "dashboard") {
    return NextResponse.json({ dashboard: await dashboard(session), badges });
  }
  if (module === "tasks" || module === "calendar") {
    return NextResponse.json({ tasks: await listTasks(session), badges });
  }
  if (module === "communications") {
    return NextResponse.json({ activityEvents: await listCommunications(session), badges });
  }
  if (module === "settings") {
    return NextResponse.json({ ...(await settingsPayload(session)), badges });
  }
  if (module === "reports") {
    const dash = await dashboard(session);
    return NextResponse.json({ reports: dash.kpis, risks: dash.risks, badges });
  }
  if (module === "msa-po") {
    const dash = await dashboard(session);
    return NextResponse.json({
      items: dash.risks.filter((r) => r.module === "msa-po").map((r) => ({ ...r, name: r.title })),
      badges,
    });
  }

  const list = await searchPeople(session, module, filters);
  const requirements = await listRequirements(session);
  const users = await listUsers(session.tenantId);
  return NextResponse.json({ list, requirements, users, badges });
}
