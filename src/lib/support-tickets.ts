import { prisma } from "./db";
import type { Session } from "./auth";

type PlatformTicketCategory = "access" | "integrations" | "billing" | "bug" | "how_to" | "other";
type PlatformTicketPriority = "normal" | "high";
type PlatformTicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";

const OPEN_FOR_REPLY: PlatformTicketStatus[] = ["open", "in_progress", "waiting_on_customer"];

function parseCategory(value: unknown): PlatformTicketCategory | null {
  if (
    value === "access" ||
    value === "integrations" ||
    value === "billing" ||
    value === "bug" ||
    value === "how_to" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

function parsePriority(value: unknown): PlatformTicketPriority {
  return value === "high" ? "high" : "normal";
}

export const TICKET_CATEGORY_LABEL: Record<PlatformTicketCategory, string> = {
  access: "Access",
  integrations: "Integrations",
  billing: "Billing",
  bug: "Bug",
  how_to: "How to",
  other: "Other",
};

export const TICKET_STATUS_LABEL: Record<PlatformTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on support",
  resolved: "Resolved",
  closed: "Closed",
};

function mapTicket(row: {
  id: string;
  subject: string;
  category: PlatformTicketCategory;
  priority: PlatformTicketPriority;
  status: PlatformTicketStatus;
  createdAt: Date;
  updatedAt: Date;
  createdByUser?: { id: string; name: string; email: string } | null;
  messages?: Array<{
    id: string;
    authorKind: string;
    body: string;
    createdAt: Date;
    authorUser?: { name: string } | null;
    authorPlatformAdmin?: { name: string } | null;
  }>;
}) {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    categoryLabel: TICKET_CATEGORY_LABEL[row.category],
    priority: row.priority,
    status: row.status,
    statusLabel: TICKET_STATUS_LABEL[row.status],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requesterName: row.createdByUser?.name || "",
    messages: (row.messages || []).map((m) => ({
      id: m.id,
      authorKind: m.authorKind,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      authorName:
        m.authorKind === "platform_staff"
          ? m.authorPlatformAdmin?.name || "Support"
          : m.authorUser?.name || "You",
    })),
  };
}

function ticketWhere(session: Session) {
  if (session.role === "admin") return { tenantId: session.tenantId };
  return { tenantId: session.tenantId, createdByUserId: session.userId };
}

export async function listTenantTickets(session: Session) {
  const rows = await prisma.platformSupportTicket.findMany({
    where: ticketWhere(session),
    orderBy: { updatedAt: "desc" },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
    },
    take: 50,
  });
  return rows.map((row) => mapTicket(row));
}

export async function getTenantTicket(session: Session, ticketId: string) {
  const row = await prisma.platformSupportTicket.findFirst({
    where: { id: ticketId, ...ticketWhere(session) },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          authorUser: { select: { name: true } },
          authorPlatformAdmin: { select: { name: true } },
        },
      },
    },
  });
  if (!row) throw new Error("Ticket not found");
  return mapTicket(row);
}

export async function createTenantTicket(
  session: Session,
  input: { subject?: string; body?: string; category?: string; priority?: string },
) {
  if (session.supportMode) throw new Error("Support access cannot file tickets as a tenant user");
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();
  const category = parseCategory(input.category) || "other";
  if (!subject) throw new Error("Subject is required");
  if (!body) throw new Error("Describe the issue");

  const ticket = await prisma.platformSupportTicket.create({
    data: {
      tenantId: session.tenantId,
      createdByUserId: session.userId,
      category,
      priority: parsePriority(input.priority),
      subject,
      status: "open",
      messages: {
        create: {
          authorKind: "tenant_user",
          authorUserId: session.userId,
          body,
        },
      },
    },
  });
  return getTenantTicket(session, ticket.id);
}

export async function replyToTenantTicket(session: Session, ticketId: string, bodyRaw: string) {
  if (session.supportMode) throw new Error("Support access cannot reply as a tenant user");
  const body = String(bodyRaw || "").trim();
  if (!body) throw new Error("Message is required");

  const ticket = await prisma.platformSupportTicket.findFirst({
    where: { id: ticketId, ...ticketWhere(session) },
  });
  if (!ticket) throw new Error("Ticket not found");

  const reopen = ticket.status === "resolved" || ticket.status === "closed";
  await prisma.platformSupportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorKind: "tenant_user",
      authorUserId: session.userId,
      body,
    },
  });
  await prisma.platformSupportTicket.update({
    where: { id: ticket.id },
    data: {
      status: reopen || !OPEN_FOR_REPLY.includes(ticket.status) ? "open" : ticket.status,
      resolvedAt: reopen ? null : ticket.resolvedAt,
      closedAt: reopen ? null : ticket.closedAt,
    },
  });
  return getTenantTicket(session, ticket.id);
}
