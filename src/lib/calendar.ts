import type { Session } from "./auth";
import { prisma } from "./db";

export type CalendarItemKind = "meeting" | "interview";

export type CalendarItem = {
  id: string;
  kind: CalendarItemKind;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  location?: string;
  teamsJoinUrl?: string;
  personId?: string | null;
  personName?: string;
  personKind?: string;
  organizationId?: string | null;
  organizationName?: string;
  requirementId?: string | null;
  requirementTitle?: string;
  organizerName?: string;
  attendees?: string[];
  body?: string;
};

function personHref(kind?: string | null, personId?: string | null) {
  if (!personId) return undefined;
  if (kind === "candidate") return `/candidates?id=${personId}&type=person`;
  if (kind === "vendor_person") return `/vendors?id=${personId}&type=person`;
  return `/clients?id=${personId}&type=person`;
}

function orgHref(organizationId?: string | null) {
  if (!organizationId) return undefined;
  return `/clients?id=${organizationId}&type=organization`;
}

/** TalentBridge Calendar is not Outlook. Only meetings created from this hub. */
export async function listCalendarItems(session: Session): Promise<(CalendarItem & { href?: string })[]> {
  const stored = await prisma.calendarEvent.findMany({
    where: {
      tenantId: session.tenantId,
      source: { in: ["hub", "teams"] },
    },
    include: {
      organizer: { select: { name: true } },
      person: { select: { id: true, name: true, kind: true } },
      organization: { select: { id: true, name: true } },
      requirement: { select: { id: true, title: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  return stored.map((e) => ({
    id: e.id,
    kind: e.kind === "interview" ? "interview" : "meeting",
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    location: e.location || (e.teamsJoinUrl ? "Microsoft Teams" : ""),
    teamsJoinUrl: e.teamsJoinUrl || undefined,
    personId: e.personId,
    personName: e.person?.name,
    personKind: e.person?.kind,
    organizationId: e.organizationId,
    organizationName: e.organization?.name,
    requirementId: e.requirementId,
    requirementTitle: e.requirement?.title,
    organizerName: e.organizer.name,
    attendees: e.attendees,
    body: e.body || undefined,
    href: personHref(e.person?.kind, e.personId) || orgHref(e.organizationId),
  }));
}

export async function listCalendarPeople(session: Session) {
  return prisma.person.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, email: true, kind: true, title: true },
    orderBy: { name: "asc" },
    take: 250,
  });
}
