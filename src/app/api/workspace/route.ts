import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  dashboard,
  globalSearch,
  listCalendar,
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
  const moduleKey = (url.searchParams.get("module") || session.landing) as ModuleKey;
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
    segment: url.searchParams.get("segment") || undefined,
  };

  const badges = await navBadges(session.tenantId);

  if (moduleKey === "dashboard") {
    return NextResponse.json({ dashboard: await dashboard(session), badges });
  }
  if (moduleKey === "tasks") {
    return NextResponse.json({ tasks: await listTasks(session), badges });
  }
  if (moduleKey === "calendar") {
    const [calendar, requirements] = await Promise.all([listCalendar(session), listRequirements(session)]);
    return NextResponse.json({ calendar, requirements, badges });
  }
  if (moduleKey === "communications") {
    return NextResponse.json({ activityEvents: await listCommunications(session), badges });
  }
  if (moduleKey === "settings") {
    return NextResponse.json({ ...(await settingsPayload(session)), badges });
  }
  if (moduleKey === "reports") {
    const dash = await dashboard(session);
    return NextResponse.json({ reports: dash.kpis, risks: dash.risks, badges });
  }
  if (moduleKey === "msa-po") {
    const dash = await dashboard(session);
    return NextResponse.json({
      items: dash.risks.filter((r) => r.module === "msa-po").map((r) => ({ ...r, name: r.title })),
      badges,
    });
  }

  const list = await searchPeople(session, moduleKey, filters);
  const requirements = await listRequirements(session);
  const users = await listUsers(session.tenantId);
  return NextResponse.json({ list, requirements, users, badges });
}
