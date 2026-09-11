import {
  AccountRoleKind,
  ContactKind,
  ExceptionKind,
  OwnershipRequestType,
  Prisma,
  TbRole,
  WrapUpOutcome,
} from "@prisma/client";
import { audit } from "./audit";
import { prisma } from "./db";
import { integrations } from "@/integrations";
import type { Session } from "./auth";
import { canSeePoAmounts } from "./rbac";
import { tenantSettings } from "./settings";
import { appBaseUrl, issuePasswordEmail, type PasswordMailKind } from "./account-mail";
import { assertPassword, hashPassword, hashToken } from "./password";
import { contactChannelBlocks, normalizeEmail, normalizePhone } from "./normalize";
export type ModuleKey =
  | "dashboard"
  | "candidates"
  | "clients"
  | "vendors"
  | "communications"
  | "calendar"
  | "tasks"
  | "msa-po"
  | "reports"
  | "settings";

export async function navBadges(tenantId: string) {
  const [tasks, communications] = await Promise.all([
    prisma.task.count({ where: { tenantId, status: "open" } }),
    prisma.activity.count({ where: { tenantId, wrapUp: null } }),
  ]);
  return { tasks, communications };
}

export async function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, enabled: true },
    include: { memberships: true, agentMap: true, mailboxMap: true },
    orderBy: { name: "asc" },
  });
}



export async function searchContacts(
  session: Session,
  module: ModuleKey,
  filters: {
    q?: string;
    title?: string;
    skills?: string;
    location?: string;
    experience?: string;
    source?: string;
    owner?: string;
    availability?: string;
    lastContact?: string;
    excludeRequirementId?: string;
    stage?: string;
    workAuthorization?: string;
  },
) {
  const tenantId = session.tenantId;

  if (module === "clients" || module === "vendors") {
    const kind = module === "clients" ? ContactKind.client_person : ContactKind.vendor_person;
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        kind,
        OR: filters.q
          ? [
              { name: { contains: filters.q, mode: "insensitive" } },
              { title: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
              { accounts: { some: { account: { name: { contains: filters.q, mode: "insensitive" } } } } },
            ]
          : undefined,
        location: filters.location ? { contains: filters.location, mode: "insensitive" } : undefined,
        status: filters.stage || undefined,
      },
      include: {
        owner: true,
        titleIndex: true,
        candidateSubs: { include: { requirement: true, account: true } },
        accounts: { include: { account: true } },
      },
      orderBy: { lastContactAt: "desc" },
      take: 100,
    });
    return contacts.map((c) => serializeContactList(c));
  }

  const kind = module === "candidates" ? ContactKind.candidate : undefined;

  const submittedIds = filters.excludeRequirementId
    ? (
        await prisma.submission.findMany({
          where: { tenantId, requirementId: filters.excludeRequirementId },
          select: { candidateId: true },
        })
      ).map((s) => s.candidateId)
    : [];

  const lastContactDays = filters.lastContact ? Number(filters.lastContact) : undefined;
  const lastContactBefore =
    lastContactDays && !Number.isNaN(lastContactDays)
      ? new Date(Date.now() - lastContactDays * 24 * 60 * 60 * 1000)
      : undefined;

  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
      kind: kind ?? ContactKind.candidate,
      id: submittedIds.length ? { notIn: submittedIds } : undefined,
      stage: filters.stage || undefined,
      source: filters.source || undefined,
      ownerId: filters.owner || undefined,
      availability: filters.availability
        ? { contains: filters.availability, mode: "insensitive" }
        : undefined,
      location: filters.location ? { contains: filters.location, mode: "insensitive" } : undefined,
      experienceYears: filters.experience ? { gte: Number(filters.experience) || 0 } : undefined,
      lastContactAt: lastContactBefore ? { lte: lastContactBefore } : undefined,
      workAuthorization: filters.workAuthorization
        ? { contains: filters.workAuthorization, mode: "insensitive" }
        : undefined,
      AND: [
        filters.q
          ? {
              OR: [
                { name: { contains: filters.q, mode: "insensitive" } },
                { email: { contains: filters.q, mode: "insensitive" } },
                { title: { contains: filters.q, mode: "insensitive" } },
                { skills: { has: filters.q } },
              ],
            }
          : {},
        filters.title
          ? {
              OR: [
                { title: { contains: filters.title, mode: "insensitive" } },
                {
                  titleIndex: {
                    is: {
                      OR: [
                        { currentTitle: { contains: filters.title, mode: "insensitive" } },
                        { previousTitles: { has: filters.title } },
                        { resumeTitles: { has: filters.title } },
                      ],
                    },
                  },
                },
              ],
            }
          : {},
      ],
    },
    include: {
      owner: true,
      titleIndex: true,
      candidateSubs: { include: { requirement: true, account: true } },
      accounts: { include: { account: true } },
    },
    orderBy: { lastContactAt: "desc" },
    take: 100,
  });

  const needles = (filters.skills || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const filtered = needles.length
    ? contacts.filter((c) => {
        const hay = [...c.skills, ...(c.titleIndex?.skills ?? [])].map((s) => s.toLowerCase());
        return needles.every((n) => hay.some((h) => h.includes(n)));
      })
    : contacts;

  return filtered.map((c) => serializeContactList(c));
}

export async function getContactWorkspace(session: Session, contactId: string) {
  const c = await prisma.contact.findFirst({
    where: { id: contactId, tenantId: session.tenantId },
    include: {
      owner: true,
      coOwners: { include: { user: true } },
      titleIndex: true,
      accounts: { include: { account: { include: { roles: true, msaDocuments: true, purchaseOrders: true } } } },
      candidateSubs: { include: { requirement: true, account: true, clientContact: true } },
      clientContactSubs: { include: { requirement: true, candidate: true } },
      hiringManagerReqs: true,
      activities: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { include: { owner: true }, orderBy: { dueAt: "asc" } },
      documents: true,
      interviews: { include: { requirement: true, account: true } },
      placements: { include: { account: true, requirement: true } },
      ownershipReqs: { where: { status: "pending" }, include: { requester: true } },
    },
  });
  if (!c) return null;
  const accountIds = c.accounts.map((p) => p.account.id);
  const people = accountIds.length
    ? await prisma.accountPerson.findMany({
        where: { accountId: { in: accountIds }, contactId: { not: c.id } },
        include: { contact: true },
        take: 8,
      })
    : [];
  return { ...serializeContactDetail(c, session), people };
}

export async function getAccountWorkspace(session: Session, accountId: string) {
  const a = await prisma.account.findFirst({
    where: { id: accountId, tenantId: session.tenantId },
    include: {
      owner: true,
      roles: true,
      people: { include: { contact: true } },
      requirements: { include: { hiringManager: true, recruiters: { include: { user: true } }, submissions: true } },
      submissions: { include: { candidate: true, requirement: true } },
      interviews: { include: { candidate: true, requirement: true } },
      placements: { include: { candidate: true } },
      msaDocuments: true,
      purchaseOrders: true,
      documents: true,
      activities: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 40 },
      tasks: { include: { owner: true }, orderBy: { dueAt: "asc" } },
    },
  });
  if (!a) return null;
  return serializeAccountDetail(a, session);
}

export async function globalSearch(session: Session, q: string) {
  const tenantId = session.tenantId;
  if (!q.trim()) return { candidates: [], clients: [], vendors: [], conversations: [], documents: [] };

  const [people, accounts, activities, documents] = await Promise.all([
    prisma.contact.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 16,
    }),
    prisma.account.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      include: { roles: true },
      take: 8,
    }),
    prisma.activity.findMany({
      where: {
        tenantId,
        OR: [{ summary: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }],
      },
      take: 8,
    }),
    prisma.document.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
  ]);

  const strip = (snippet: string) =>
    session.permissions.includes("po") && session.permissions.includes("recording")
      ? snippet
      : snippet.replace(/\bPO[- ]?\d+\b/gi, "[restricted]").replace(/recording/gi, "[restricted]");

  return {
    candidates: people
      .filter((c) => c.kind === ContactKind.candidate)
      .map((c) => ({ id: c.id, name: c.name, title: c.title, module: "candidates", type: "contact" })),
    clients: [
      ...people
        .filter((c) => c.kind === ContactKind.client_person)
        .map((c) => ({ id: c.id, name: c.name, module: "clients", type: "contact" })),
      ...accounts
        .filter((a) => a.roles.some((r) => r.role === "client"))
        .map((a) => ({ id: a.id, name: a.name, module: "clients", type: "account" })),
    ],
    vendors: [
      ...people
        .filter((c) => c.kind === ContactKind.vendor_person)
        .map((c) => ({ id: c.id, name: c.name, module: "vendors", type: "contact" })),
      ...accounts
        .filter((a) => a.roles.some((r) => r.role === "vendor"))
        .map((a) => ({ id: a.id, name: a.name, module: "vendors", type: "account" })),
    ],
    conversations: activities.map((a) => ({
      id: a.id,
      name: strip(a.summary),
      contactId: a.contactId,
      accountId: a.accountId,
      module: a.contactId ? "candidates" : "clients",
    })),
    documents: documents.map((d) => ({ id: d.id, name: d.name, module: "clients" })),
  };
}

export async function dashboard(session: Session) {
  const settings = await tenantSettings(session.tenantId);
  const tenantId = session.tenantId;
  const now = new Date();
  const reqCutoff = daysAgo(settings.slaRequirementNoSubDays);
  const subCutoff = daysAgo(settings.slaSubmissionFeedbackDays);
  const interviewCutoff = daysAgo(settings.slaInterviewFeedbackDays);
  const clientCutoff = daysAgo(settings.slaClientLastContactDays);
  const msaCutoff = daysFromNow(settings.slaMsaExpiryDays);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  const [
    agingReqs,
    waitingSubs,
    pendingInterviews,
    staleClients,
    callbacks,
    expiringMsa,
    lowPo,
    openTasks,
    unmatched,
  ] = await Promise.all([
    prisma.requirement.findMany({
      where: { tenantId, status: "open", openedAt: { lte: reqCutoff }, submissions: { none: {} } },
      include: { account: true },
    }),
    prisma.submission.findMany({
      where: { tenantId, stage: { in: ["Submitted", "Client Review"] }, sentAt: { lte: subCutoff } },
      include: { candidate: true, requirement: true, account: true },
    }),
    prisma.interview.findMany({
      where: { tenantId, outcome: "pending", scheduledAt: { lte: interviewCutoff } },
      include: { candidate: true, requirement: true },
    }),
    prisma.account.findMany({
      where: {
        tenantId,
        roles: { some: { role: "client" } },
        OR: [{ lastContactAt: { lte: clientCutoff } }, { lastContactAt: null }],
      },
    }),
    prisma.task.findMany({
      where: { tenantId, status: "open", dueAt: { gte: startToday, lte: endToday } },
      include: { contact: true },
    }),
    prisma.msaDocument.findMany({
      where: { tenantId, expiresAt: { lte: msaCutoff, gte: now } },
      include: { account: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: ["low", "exhausted"] } },
      include: { account: true },
    }),
    prisma.task.count({ where: { tenantId, status: "open" } }),
    prisma.exceptionItem.findMany({ where: { tenantId, status: "open" } }),
  ]);

  const risks = [
    ...agingReqs.map((r) => ({
      id: r.id,
      type: "requirement_aging",
      title: `${r.title} open ${settings.slaRequirementNoSubDays}+ days with no submissions`,
      module: "clients" as const,
      recordId: r.accountId,
    })),
    ...waitingSubs.map((s) => ({
      id: s.id,
      type: "submission_feedback",
      title: `${s.candidate.name} submitted ${settings.slaSubmissionFeedbackDays}+ days ago — no client feedback`,
      module: "candidates" as const,
      recordId: s.candidateId,
    })),
    ...pendingInterviews.map((i) => ({
      id: i.id,
      type: "interview_feedback",
      title: `Interview for ${i.candidate.name} pending feedback`,
      module: "candidates" as const,
      recordId: i.candidateId,
    })),
    ...staleClients.map((a) => ({
      id: a.id,
      type: "client_silence",
      title: `${a.name} not contacted in ${settings.slaClientLastContactDays}+ days`,
      module: "clients" as const,
      recordId: a.id,
    })),
    ...callbacks.map((t) => ({
      id: t.id,
      type: "callback_today",
      title: t.title,
      module: "tasks" as const,
      recordId: t.contactId ?? t.id,
    })),
    ...expiringMsa.map((m) => ({
      id: m.id,
      type: "msa_expiry",
      title: `${m.account.name} MSA ${m.number} expires within ${settings.slaMsaExpiryDays} days`,
      module: "msa-po" as const,
      recordId: m.accountId,
    })),
    ...lowPo.map((p) => ({
      id: p.id,
      type: "po_risk",
      title: canSeePoAmounts(session.role, session.permissions)
        ? `${p.account.name} PO ${p.number} ${p.status} ($${Number(p.utilized).toLocaleString()} / $${Number(p.ceiling).toLocaleString()})`
        : `${p.account.name} has a PO that needs attention`,
      module: "msa-po" as const,
      recordId: p.accountId,
    })),
  ];

  const opportunities = [
    {
      id: "fill-devops",
      type: "open_req",
      title: "Open DevOps requirement with no submissions — find candidates",
      module: "candidates" as const,
      recordId: null,
    },
  ];

  return {
    risks,
    opportunities,
    kpis: {
      openTasks,
      openExceptions: unmatched.length,
      openRequirements: await prisma.requirement.count({ where: { tenantId, status: "open" } }),
      submissionsWaiting: waitingSubs.length,
    },
    exceptions: unmatched,
  };
}

export async function listTasks(session: Session) {
  return prisma.task.findMany({
    where: { tenantId: session.tenantId },
    include: { owner: true, contact: true, account: true, requirement: true },
    orderBy: { dueAt: "asc" },
  });
}

export async function listCommunications(session: Session) {
  return prisma.activity.findMany({
    where: { tenantId: session.tenantId, wrapUp: null },
    include: { actor: true, contact: true, account: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listRequirements(session: Session, accountId?: string) {
  return prisma.requirement.findMany({
    where: { tenantId: session.tenantId, accountId: accountId || undefined },
    include: { account: true, hiringManager: true, recruiters: { include: { user: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function wrapUp(session: Session, input: {
  activityId?: string;
  contactId: string;
  outcome: WrapUpOutcome;
  nextActionTitle?: string;
  dueAt?: string;
  requirementId?: string;
}) {
  const activity = input.activityId
    ? await prisma.activity.findFirst({ where: { id: input.activityId, tenantId: session.tenantId } })
    : await prisma.activity.create({
        data: {
          tenantId: session.tenantId,
          kind: "note",
          summary: `Wrap-up: ${input.outcome}`,
          actorId: session.userId,
          contactId: input.contactId,
          requirementId: input.requirementId,
          wrapUp: input.outcome,
        },
      });

  if (activity && input.activityId) {
    await prisma.activity.update({
      where: { id: activity.id },
      data: { wrapUp: input.outcome },
    });
  }

  let taskId: string | undefined;
  if (input.outcome === WrapUpOutcome.next_action && input.nextActionTitle) {
    const task = await prisma.task.create({
      data: {
        tenantId: session.tenantId,
        title: input.nextActionTitle,
        dueAt: input.dueAt ? new Date(input.dueAt) : daysFromNow(1),
        ownerId: session.userId,
        contactId: input.contactId,
        requirementId: input.requirementId,
        sourceEventId: activity?.id,
      },
    });
    taskId = task.id;
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        nextAction: input.nextActionTitle,
        nextActionDueAt: task.dueAt,
        lastContactAt: new Date(),
      },
    });
  } else {
    await prisma.contact.update({
      where: { id: input.contactId },
      data: { nextAction: input.outcome === "closed" ? "Closed" : "No action required", lastContactAt: new Date() },
    });
  }

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "wrap_up",
    entityType: "activity",
    entityId: activity?.id ?? input.contactId,
    after: { outcome: input.outcome, taskId },
  });

  return { activityId: activity?.id, taskId };
}

export async function placeCall(session: Session, contactId: string) {
  if (!session.vioTalkMapped) {
    throw new Error("No VioTalk agent mapping. Users with no mapping cannot use VioTalk Call.");
  }
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId: session.tenantId },
  });
  if (!contact) throw new Error("Contact not found");
  if (contactChannelBlocks(contact).call) throw new Error("Do Not Contact is on — outbound call disabled.");

  const result = await integrations.vioTalk.placeCall({
    contactId,
    phone: contact.phone,
    userId: session.userId,
  });

  const activity = await prisma.activity.create({
    data: {
      tenantId: session.tenantId,
      kind: "call",
      summary: `VioTalk call – ${Math.round(result.durationSeconds / 60)} minutes.`,
      body: result.aiSummary,
      source: "viotalk",
      externalId: result.callId,
      actorId: session.userId,
      contactId,
      recordingRef: result.recordingRef,
      transcriptRef: result.transcriptRef,
      aiSummary: result.aiSummary,
    },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactAt: new Date() },
  });

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "viotalk_call",
    entityType: "activity",
    entityId: activity.id,
    after: { callId: result.callId },
  });

  return { activityId: activity.id, proposedFollowUp: result.proposedFollowUp, callId: result.callId };
}

export async function submitProfile(
  session: Session,
  input: {
    candidateId: string;
    requirementId: string;
    clientContactId: string;
    message: string;
    resumeName: string;
  },
) {
  if (!session.permissions.includes("submit")) throw new Error("No Submit Profile permission");
  const req = await prisma.requirement.findFirst({
    where: { id: input.requirementId, tenantId: session.tenantId },
    include: { account: true },
  });
  if (!req) throw new Error("Requirement required — cannot submit to a company with no job");
  const candidate = await prisma.contact.findFirst({
    where: { id: input.candidateId, tenantId: session.tenantId },
  });
  const clientContact = await prisma.contact.findFirst({
    where: { id: input.clientContactId, tenantId: session.tenantId },
  });
  if (!candidate || !clientContact) throw new Error("Candidate and client contact required");
  if (contactChannelBlocks(candidate).email) throw new Error("Do Not Contact is on — outbound email disabled.");
  if (!session.mailbox) throw new Error("No mailbox mapped for Outlook send");

  const sent = await integrations.outlook.sendAsUser({
    fromMailbox: session.mailbox,
    to: clientContact.email,
    subject: `${candidate.name} — ${req.title}`,
    body: input.message,
    attachments: [{ name: input.resumeName || candidate.lastResume || "resume.pdf" }],
  });

  const settings = await tenantSettings(session.tenantId);
  const submission = await prisma.submission.create({
    data: {
      tenantId: session.tenantId,
      candidateId: candidate.id,
      requirementId: req.id,
      accountId: req.accountId,
      clientContactId: clientContact.id,
      recruiterId: session.userId,
      bdmId: req.bdmId,
      stage: settings.submissionStages[0] ?? "Submitted",
      emailMessageId: sent.messageId,
      resumeVersion: input.resumeName || candidate.lastResume,
      source: "hub",
    },
  });

  const activity = await prisma.activity.create({
    data: {
      tenantId: session.tenantId,
      kind: "email",
      summary: `Submitted ${candidate.name} to ${req.account.name} / ${req.title}`,
      body: input.message,
      source: "outlook",
      externalId: sent.messageId,
      actorId: session.userId,
      contactId: candidate.id,
      accountId: req.accountId,
      requirementId: req.id,
      submissionId: submission.id,
    },
  });

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "submit_profile",
    entityType: "submission",
    entityId: submission.id,
    after: { emailMessageId: sent.messageId },
  });

  return { submissionId: submission.id, activityId: activity.id, messageId: sent.messageId };
}

export async function changeStage(session: Session, contactId: string, stage: string) {
  if (!session.permissions.includes("change_stage")) {
    throw new Error("Stage change is permissioned (owner / sales / ops / admin)");
  }
  const settings = await tenantSettings(session.tenantId);
  if (!settings.relationshipStages.includes(stage)) throw new Error("Unknown stage");
  const before = await prisma.contact.findFirst({ where: { id: contactId, tenantId: session.tenantId } });
  if (!before) throw new Error("Contact not found");
  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { stage },
  });
  await prisma.activity.create({
    data: {
      tenantId: session.tenantId,
      kind: "stage",
      summary: `Stage ${before.stage} → ${stage}`,
      actorId: session.userId,
      contactId,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "change_stage",
    entityType: "contact",
    entityId: contactId,
    before: { stage: before.stage },
    after: { stage },
  });
  return updated;
}

export async function requestOwnership(
  session: Session,
  contactId: string,
  type: OwnershipRequestType,
  note: string,
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId: session.tenantId },
  });
  if (!contact) throw new Error("Contact not found");
  const row = await prisma.ownershipRequest.create({
    data: {
      tenantId: session.tenantId,
      contactId,
      requesterId: session.userId,
      targetOwnerId: contact.ownerId,
      type,
      note,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: `ownership_${type}`,
    entityType: "contact",
    entityId: contactId,
    after: { requestId: row.id },
  });
  return row;
}

export async function decideOwnership(session: Session, requestId: string, accept: boolean) {
  if (!session.permissions.includes("ownership_transfer")) {
    throw new Error("Ownership transfer is permissioned");
  }
  const req = await prisma.ownershipRequest.findFirst({
    where: { id: requestId, tenantId: session.tenantId },
  });
  if (!req) throw new Error("Request not found");
  if (accept && req.type === "transfer") {
    await prisma.contact.update({
      where: { id: req.contactId },
      data: { ownerId: req.requesterId },
    });
  }
  if (accept && req.type === "collaboration") {
    await prisma.contactCoOwner.create({
      data: { contactId: req.contactId, userId: req.requesterId },
    });
  }
  return prisma.ownershipRequest.update({
    where: { id: requestId },
    data: { status: accept ? "accepted" : "dismissed" },
  });
}

export async function syncJnp(session: Session, portalCandidateId: string) {
  const profile = await integrations.jobsNProfiles.fetchProfile(portalCandidateId);
  if (!profile) throw new Error("Portal profile not found");

  const emailNormalized = normalizeEmail(profile.email);
  const phoneNormalized = normalizePhone(profile.phone);

  const existingByPortal = await prisma.contact.findFirst({
    where: { tenantId: session.tenantId, portalCandidateId },
  });

  // Match cascade: portal ID (above) → normalized email → normalized phone. Never auto-merge.
  const collision = await prisma.contact.findFirst({
    where: {
      tenantId: session.tenantId,
      portalCandidateId: { not: portalCandidateId },
      OR: [
        ...(emailNormalized ? [{ emailNormalized }] : []),
        ...(phoneNormalized ? [{ phoneNormalized }] : []),
        { email: profile.email },
        { phone: profile.phone },
      ],
    },
  });

  if (collision && !existingByPortal) {
    await prisma.exceptionItem.create({
      data: {
        tenantId: session.tenantId,
        kind: ExceptionKind.duplicate,
        title: `Collision on ${profile.email} / ${profile.phone}`,
        detail: `Portal ${portalCandidateId} matches existing ${collision.name}. Never auto-merge.`,
        payload: JSON.stringify({ existingId: collision.id, portalCandidateId }),
      },
    });
    return { status: "collision" as const, existingId: collision.id, existingOwnerId: collision.ownerId };
  }

  const data = {
    tenantId: session.tenantId,
    kind: ContactKind.candidate,
    name: profile.name,
    title: profile.title,
    email: profile.email,
    phone: profile.phone,
    emailNormalized,
    phoneNormalized,
    location: profile.location,
    source: "JobsNProfiles",
    ownerId: session.userId,
    skills: profile.skills,
    experienceYears: profile.experienceYears,
    availability: profile.availability,
    portalCandidateId,
  };

  const contact = existingByPortal
    ? await prisma.contact.update({ where: { id: existingByPortal.id }, data })
    : await prisma.contact.create({ data });

  await prisma.titleIndex.upsert({
    where: { contactId: contact.id },
    create: {
      tenantId: session.tenantId,
      contactId: contact.id,
      currentTitle: profile.title,
      previousTitles: profile.previousTitles,
      resumeTitles: profile.resumeTitles,
      skills: profile.skills,
    },
    update: {
      currentTitle: profile.title,
      previousTitles: profile.previousTitles,
      resumeTitles: profile.resumeTitles,
      skills: profile.skills,
      lastIndexedAt: new Date(),
    },
  });

  await prisma.externalEntityLink.upsert({
    where: {
      tenantId_entityType_entityId_externalSystem_externalEntityType: {
        tenantId: session.tenantId,
        entityType: "contact",
        entityId: contact.id,
        externalSystem: "JobsNProfiles",
        externalEntityType: "candidate",
      },
    },
    create: {
      tenantId: session.tenantId,
      entityType: "contact",
      entityId: contact.id,
      externalSystem: "JobsNProfiles",
      externalEntityType: "candidate",
      externalId: portalCandidateId,
      lastSyncedAt: new Date(),
    },
    update: {
      externalId: portalCandidateId,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.provenance.create({
    data: {
      tenantId: session.tenantId,
      entityType: "contact",
      entityId: contact.id,
      field: "profile",
      sourceSystem: "JobsNProfiles",
      externalId: portalCandidateId,
      lastSyncedAt: new Date(),
      updatedBy: session.userId,
    },
  });

  return { status: "upserted" as const, contactId: contact.id };
}

export async function createContact(
  session: Session,
  input: { name: string; kind: "candidate" | "client_person" | "vendor_person"; email?: string; phone?: string; title?: string },
) {
  const kind =
    input.kind === "candidate"
      ? ContactKind.candidate
      : input.kind === "vendor_person"
        ? ContactKind.vendor_person
        : ContactKind.client_person;
  const contact = await prisma.contact.create({
    data: {
      tenantId: session.tenantId,
      kind,
      name: input.name,
      email: input.email || "",
      phone: input.phone || "",
      emailNormalized: normalizeEmail(input.email),
      phoneNormalized: normalizePhone(input.phone),
      title: input.title || "",
      ownerId: session.userId,
      source: "manual",
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "create_contact",
    entityType: "contact",
    entityId: contact.id,
  });
  return contact;
}

export async function updateContact(
  session: Session,
  contactId: string,
  input: {
    name?: string;
    title?: string;
    secondaryTitle?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedIn?: string;
    availability?: string;
    experienceYears?: number | string;
    citizenship?: string;
    workAuthorization?: string;
    visaExpiry?: string;
    willingToRelocate?: string;
    preferredLocation?: string;
    noticePeriod?: string;
    employmentType?: string;
    currentRate?: string;
    expectedRate?: string;
    timezone?: string;
  },
) {
  const existing = await prisma.contact.findFirst({ where: { id: contactId, tenantId: session.tenantId } });
  if (!existing) throw new Error("Contact not found");
  const nextEmail = input.email ?? existing.email;
  const nextPhone = input.phone ?? existing.phone;
  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      name: input.name ?? existing.name,
      title: input.title ?? existing.title,
      secondaryTitle: input.secondaryTitle ?? existing.secondaryTitle,
      email: nextEmail,
      phone: nextPhone,
      emailNormalized: normalizeEmail(nextEmail),
      phoneNormalized: normalizePhone(nextPhone),
      location: input.location ?? existing.location,
      linkedIn: input.linkedIn ?? existing.linkedIn,
      availability: input.availability ?? existing.availability,
      experienceYears: input.experienceYears != null && input.experienceYears !== ("" as unknown)
        ? Number(input.experienceYears) || existing.experienceYears
        : existing.experienceYears,
      citizenship: input.citizenship ?? existing.citizenship,
      workAuthorization: input.workAuthorization ?? existing.workAuthorization,
      visaExpiry:
        input.visaExpiry === ""
          ? null
          : input.visaExpiry
            ? new Date(input.visaExpiry)
            : existing.visaExpiry,
      willingToRelocate: input.willingToRelocate ?? existing.willingToRelocate,
      preferredLocation: input.preferredLocation ?? existing.preferredLocation,
      noticePeriod: input.noticePeriod ?? existing.noticePeriod,
      employmentType: input.employmentType ?? existing.employmentType,
      currentRate: input.currentRate ?? existing.currentRate,
      expectedRate: input.expectedRate ?? existing.expectedRate,
      timezone: input.timezone ?? existing.timezone,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "update_contact",
    entityType: "contact",
    entityId: contact.id,
  });
  return contact;
}

export async function createAccount(
  session: Session,
  input: { name: string; role: "client" | "vendor"; industry?: string; location?: string },
) {
  if (!["sales", "operations", "admin"].includes(session.role)) {
    throw new Error("Clients/Vendors are created in TalentBridge by sales/ops/admin — not fetched from JobsNProfiles");
  }
  const account = await prisma.account.create({
    data: {
      tenantId: session.tenantId,
      name: input.name,
      industry: input.industry || "",
      location: input.location || "",
      ownerId: session.userId,
      roles: { create: { role: input.role === "vendor" ? AccountRoleKind.vendor : AccountRoleKind.client } },
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "create_account",
    entityType: "account",
    entityId: account.id,
  });
  return account;
}

export async function createRequirement(
  session: Session,
  input: {
    accountId: string;
    title: string;
    skills: string[];
    location: string;
    hiringManagerId?: string;
    assignedRecruiterIds: string[];
  },
) {
  if (!session.permissions.includes("clients") && session.role !== "recruiter") {
    // sales/ops/admin create reqs; recruiter may not
  }
  if (!["sales", "operations", "admin"].includes(session.role)) {
    throw new Error("Create Requirement is a sales/ops/admin action");
  }
  const req = await prisma.requirement.create({
    data: {
      tenantId: session.tenantId,
      accountId: input.accountId,
      title: input.title,
      skills: input.skills,
      location: input.location,
      hiringManagerId: input.hiringManagerId,
      bdmId: session.userId,
      recruiters: { create: input.assignedRecruiterIds.map((userId) => ({ userId })) },
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "create_requirement",
    entityType: "requirement",
    entityId: req.id,
  });
  return req;
}

export async function addNote(session: Session, contactId: string, body: string, visibility: "shared" | "internal") {
  return prisma.activity.create({
    data: {
      tenantId: session.tenantId,
      kind: visibility === "internal" ? "internal_note" : "note",
      summary: body.slice(0, 80),
      body,
      actorId: session.userId,
      contactId,
    },
  });
}

export async function toggleDnc(session: Session, contactId: string, on: boolean) {
  if (!["sales", "operations", "admin"].includes(session.role)) throw new Error("DNC change not permitted");
  return prisma.contact.update({
    where: { id: contactId },
    data: { doNotContact: on },
  });
}

const LOGIN_ROLES = ["recruiter", "sales", "operations", "leadership", "admin"] as const;
const EXTRA_PERMISSIONS = ["recording", "export"] as const;

function requireAdmin(session: Session) {
  if (!session.permissions.includes("admin") && session.role !== "admin") {
    throw new Error("Administrator only");
  }
}

function parseLoginRole(raw: unknown): TbRole {
  if (typeof raw === "string" && (LOGIN_ROLES as readonly string[]).includes(raw)) {
    return raw as TbRole;
  }
  throw new Error(
    "Role must be recruiter, sales, operations, leadership, or admin. Candidates, clients and vendors never log in.",
  );
}

function sanitizeExtraPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string" && (EXTRA_PERMISSIONS as readonly string[]).includes(p));
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function assertNotSelfAccount(session: Session, userId: string, message: string) {
  if (userId === session.userId) throw new Error(message);
}

function userInviteFields(u: {
  passwordHash?: string | null;
  passwordSetAt?: Date | null;
  inviteSentAt?: Date | null;
  passwordResetKind?: string | null;
  passwordResetExpiresAt?: Date | null;
}) {
  const now = new Date();
  const passwordSet = Boolean(u.passwordHash);
  const inviteExpiry =
    u.passwordResetKind === "invite" && u.passwordResetExpiresAt ? u.passwordResetExpiresAt : null;
  const resetExpiry =
    u.passwordResetKind === "reset" && u.passwordResetExpiresAt ? u.passwordResetExpiresAt : null;
  const inviteOpen = Boolean(inviteExpiry && inviteExpiry > now);
  const resetOpen = Boolean(resetExpiry && resetExpiry > now);
  let inviteStatus: "not_invited" | "pending" | "expired" | "accepted" = "not_invited";
  if (passwordSet && u.inviteSentAt) inviteStatus = "accepted";
  else if (inviteOpen) inviteStatus = "pending";
  else if (u.inviteSentAt && !passwordSet) inviteStatus = "expired";
  return {
    passwordSet,
    passwordSetAt: u.passwordSetAt ? u.passwordSetAt.toISOString() : null,
    inviteStatus,
    invitePending: inviteStatus === "pending",
    inviteSentAt: u.inviteSentAt ? u.inviteSentAt.toISOString() : null,
    inviteExpiresAt: inviteExpiry ? inviteExpiry.toISOString() : null,
    resetPending: resetOpen,
    resetExpiresAt: resetExpiry ? resetExpiry.toISOString() : null,
  };
}

async function assertNotLastAdmin(
  tenantId: string,
  userId: string,
  next: { role?: TbRole; enabled?: boolean },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    include: { memberships: true },
  });
  if (!user) throw new Error("User not found in this tenant");
  const currentlyAdmin = user.enabled && user.memberships[0]?.role === TbRole.admin;
  if (!currentlyAdmin) return;
  const demoting = next.role != null && next.role !== TbRole.admin;
  const disabling = next.enabled === false;
  if (!demoting && !disabling) return;
  const enabledAdmins = await prisma.membership.count({
    where: { tenantId, role: TbRole.admin, user: { enabled: true } },
  });
  if (enabledAdmins <= 1) {
    throw new Error("Cannot disable or demote the last administrator");
  }
}

export async function settingsPayload(session: Session) {
  if (!session.permissions.includes("admin") && session.role !== "admin") {
    return { forbidden: true };
  }
  const [userRows, maps, mailboxMaps, exceptions, auditEvents, settings, lastJnpSync, lastJnpException] =
    await Promise.all([
      prisma.user.findMany({
        where: { tenantId: session.tenantId },
        include: { memberships: true, agentMap: true, mailboxMap: true },
        orderBy: { name: "asc" },
      }),
      prisma.vioTalkAgentMap.findMany({
        where: { tenantId: session.tenantId },
        include: { user: true },
        orderBy: { assignedNumber: "asc" },
      }),
      prisma.mailboxMap.findMany({
        where: { tenantId: session.tenantId },
        include: { user: true },
        orderBy: { mailbox: "asc" },
      }),
      prisma.exceptionItem.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } }),
      prisma.auditEvent.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      tenantSettings(session.tenantId),
      prisma.provenance.findFirst({
        where: { tenantId: session.tenantId, sourceSystem: "JobsNProfiles" },
        orderBy: { lastSyncedAt: "desc" },
      }),
      prisma.exceptionItem.findFirst({
        where: {
          tenantId: session.tenantId,
          kind: { in: [ExceptionKind.failed_sync, ExceptionKind.duplicate] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const actorIds = [...new Set(auditEvents.map((e) => e.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { tenantId: session.tenantId, id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  return {
    users: userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      title: u.title,
      enabled: u.enabled,
      role: u.memberships[0]?.role ?? TbRole.recruiter,
      extraPermissions: u.memberships[0]?.permissions ?? [],
      vioTalkMapped: Boolean(u.agentMap),
      vioTalkUserId: u.agentMap?.vioTalkUserId ?? "",
      assignedNumber: u.agentMap?.assignedNumber ?? "",
      mailboxMapped: Boolean(u.mailboxMap),
      mailbox: u.mailboxMap?.mailbox ?? "",
      ...userInviteFields(u),
    })),
    maps: maps.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      vioTalkUserId: m.vioTalkUserId,
      assignedNumber: m.assignedNumber,
    })),
    mailboxMaps: mailboxMaps.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      mailbox: m.mailbox,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      detail: e.detail,
      status: e.status,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
    auditEvents: auditEvents.map((e) => ({
      id: e.id,
      actorId: e.actorId,
      actorName: actorName.get(e.actorId) ?? "System",
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      before: e.before,
      after: e.after,
      createdAt: e.createdAt.toISOString(),
    })),
    settings: {
      recordingPlaybackAllowed: settings.recordingPlaybackAllowed,
      slaRequirementNoSubDays: settings.slaRequirementNoSubDays,
      slaSubmissionFeedbackDays: settings.slaSubmissionFeedbackDays,
      slaInterviewFeedbackDays: settings.slaInterviewFeedbackDays,
      slaClientLastContactDays: settings.slaClientLastContactDays,
      slaMsaExpiryDays: settings.slaMsaExpiryDays,
    },
    jnp: {
      oneWayIn: true,
      writeBack: false,
      copy: "JobsNProfiles is one-way in. TalentBridge never writes submissions or profiles back.",
      lastException: lastJnpException
        ? {
            id: lastJnpException.id,
            kind: lastJnpException.kind,
            title: lastJnpException.title,
            detail: lastJnpException.detail,
            status: lastJnpException.status,
            createdAt: lastJnpException.createdAt.toISOString(),
          }
        : null,
      lastSync: lastJnpSync
        ? {
            externalId: lastJnpSync.externalId,
            lastSyncedAt: lastJnpSync.lastSyncedAt ? lastJnpSync.lastSyncedAt.toISOString() : "",
            syncStatus: lastJnpSync.syncStatus,
          }
        : null,
      secretsVault: [
        { name: "DATABASE_URL", present: Boolean(process.env.DATABASE_URL) },
        { name: "AUTH_JWT_SECRET", present: Boolean(process.env.AUTH_JWT_SECRET || process.env.STUB_AUTH_SECRET) },
        { name: "SENDGRID_API_KEY", present: Boolean(process.env.SENDGRID_API_KEY) },
        { name: "SENDGRID_FROM_EMAIL", present: Boolean(process.env.SENDGRID_FROM_EMAIL) },
      ],
      adapterStatus:
        "JobsNProfiles, VioTalk and Outlook adapters are stubbed. Credentials stay in the secrets vault — this screen never collects API keys.",
    },
  };
}

export async function adminCreateUser(
  session: Session,
  input: {
    name: string;
    email: string;
    title?: string;
    role: unknown;
    enabled?: boolean;
    extraPermissions?: unknown;
    origin?: string | null;
  },
) {
  requireAdmin(session);
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const title = String(input.title || "").trim();
  if (!name) throw new Error("Name is required");
  if (!email || !email.includes("@")) throw new Error("A valid email is required");
  const role = parseLoginRole(input.role);
  const extraPermissions = sanitizeExtraPermissions(input.extraPermissions);
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        name,
        email,
        title,
        enabled: input.enabled !== false,
        memberships: {
          create: { tenantId: session.tenantId, role, permissions: extraPermissions },
        },
      },
      include: { memberships: true },
    });
    await audit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "admin_create_user",
      entityType: "user",
      entityId: user.id,
      after: { name, email, title, role, enabled: user.enabled, extraPermissions },
    });
    let invite: Awaited<ReturnType<typeof issuePasswordEmail>> | { sent: false; stub: false; email: string; userId: string; error: string };
    try {
      invite = await issuePasswordEmail({
        userId: user.id,
        tenantId: session.tenantId,
        kind: "invite",
        actorName: session.name,
        tenantName: session.tenantName,
        baseUrl: appBaseUrl(input.origin),
      });
      await audit({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: "admin_invite_user",
        entityType: "user",
        entityId: user.id,
        after: { email, sent: invite.sent, stub: invite.stub },
      });
    } catch (mailError) {
      invite = {
        sent: false,
        stub: false,
        email: user.email,
        userId: user.id,
        error: mailError instanceof Error ? mailError.message : "Invitation email failed",
      };
    }
    return { id: user.id, name: user.name, email: user.email, role, invite };
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error("A user with that email already exists in this tenant");
    throw e;
  }
}

export async function adminSendPasswordEmail(
  session: Session,
  input: { userId: string; kind?: unknown; origin?: string | null },
) {
  requireAdmin(session);
  const userId = String(input.userId || "");
  assertNotSelfAccount(
    session,
    userId,
    "You cannot send a password invitation or reset for your own account",
  );
  const kind: PasswordMailKind = input.kind === "invite" ? "invite" : "reset";
  const result = await issuePasswordEmail({
    userId,
    tenantId: session.tenantId,
    kind,
    actorName: session.name,
    tenantName: session.tenantName,
    baseUrl: appBaseUrl(input.origin),
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: kind === "invite" ? "admin_invite_user" : "admin_reset_password",
    entityType: "user",
    entityId: result.userId,
    after: { email: result.email, sent: result.sent, stub: result.stub },
  });
  return result;
}

export async function adminSetPassword(session: Session, input: { userId: string; password: string }) {
  requireAdmin(session);
  const userId = String(input.userId || "");
  assertNotSelfAccount(session, userId, "You cannot set your own password here");
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId: session.tenantId } });
  if (!user) throw new Error("User not found in this tenant");
  const passwordHash = await hashPassword(String(input.password || ""));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetKind: null,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_set_password",
    entityType: "user",
    entityId: user.id,
    after: { email: user.email },
  });
  return { id: user.id, passwordSet: true };
}

export async function completePasswordSetup(token: string, password: string) {
  const raw = String(token || "").trim();
  if (!raw) throw new Error("Invitation or reset link is missing");
  assertPassword(password);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashToken(raw),
      passwordResetExpiresAt: { gt: new Date() },
      enabled: true,
    },
  });
  if (!user) throw new Error("This link is invalid or has expired. Ask an administrator to send a new one.");
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetKind: null,
    },
  });
  return { email: user.email };
}

export async function adminUpdateUser(
  session: Session,
  input: {
    userId: string;
    name?: string;
    title?: string;
    enabled?: boolean;
    role?: unknown;
    extraPermissions?: unknown;
  },
) {
  requireAdmin(session);
  const userId = String(input.userId || "");
  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId: session.tenantId },
    include: { memberships: true },
  });
  if (!existing) throw new Error("User not found in this tenant");
  const membership = existing.memberships[0];
  if (!membership) throw new Error("User has no membership");

  const nextRole = input.role != null ? parseLoginRole(input.role) : membership.role;
  const nextEnabled = input.enabled != null ? Boolean(input.enabled) : existing.enabled;
  await assertNotLastAdmin(session.tenantId, userId, { role: nextRole, enabled: nextEnabled });

  const nextName = input.name != null ? String(input.name).trim() : existing.name;
  const nextTitle = input.title != null ? String(input.title).trim() : existing.title;
  if (!nextName) throw new Error("Name is required");
  const extraPermissions =
    input.extraPermissions != null ? sanitizeExtraPermissions(input.extraPermissions) : membership.permissions;

  if (userId === session.userId) {
    const permsChanged =
      [...extraPermissions].sort().join(",") !== [...membership.permissions].sort().join(",");
    if (nextRole !== membership.role || nextEnabled !== existing.enabled || permsChanged) {
      throw new Error("You cannot change your own role, extra permissions, or enabled status");
    }
  }

  const before = {
    name: existing.name,
    title: existing.title,
    enabled: existing.enabled,
    role: membership.role,
    extraPermissions: membership.permissions,
  };

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { name: nextName, title: nextTitle, enabled: nextEnabled },
    }),
    prisma.membership.update({
      where: { id: membership.id },
      data: { role: nextRole, permissions: extraPermissions },
    }),
  ]);

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_update_user",
    entityType: "user",
    entityId: user.id,
    before,
    after: { name: nextName, title: nextTitle, enabled: nextEnabled, role: nextRole, extraPermissions },
  });
  return { id: user.id, name: user.name, enabled: user.enabled, role: nextRole };
}

export async function adminUpsertVioTalkMap(
  session: Session,
  input: { userId: string; vioTalkUserId?: string; assignedNumber?: string; clear?: boolean },
) {
  requireAdmin(session);
  const userId = String(input.userId || "");
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId: session.tenantId } });
  if (!user) throw new Error("User not found in this tenant");
  const existing = await prisma.vioTalkAgentMap.findFirst({ where: { userId, tenantId: session.tenantId } });
  const vioTalkUserId = String(input.vioTalkUserId || "").trim();
  const assignedNumber = String(input.assignedNumber || "").trim();
  const clear = Boolean(input.clear) || (!vioTalkUserId && !assignedNumber);

  if (clear) {
    if (existing) {
      await prisma.vioTalkAgentMap.delete({ where: { id: existing.id } });
      await audit({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: "admin_upsert_viotalk_map",
        entityType: "viotalk_map",
        entityId: userId,
        before: { vioTalkUserId: existing.vioTalkUserId, assignedNumber: existing.assignedNumber },
        after: { cleared: true },
      });
    }
    return { cleared: true, userId };
  }

  const row = existing
    ? await prisma.vioTalkAgentMap.update({
        where: { id: existing.id },
        data: { vioTalkUserId, assignedNumber },
      })
    : await prisma.vioTalkAgentMap.create({
        data: { tenantId: session.tenantId, userId, vioTalkUserId, assignedNumber },
      });

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_upsert_viotalk_map",
    entityType: "viotalk_map",
    entityId: userId,
    before: existing
      ? { vioTalkUserId: existing.vioTalkUserId, assignedNumber: existing.assignedNumber }
      : undefined,
    after: { vioTalkUserId, assignedNumber },
  });
  return row;
}

export async function adminUpsertMailboxMap(
  session: Session,
  input: { userId: string; mailbox?: string; clear?: boolean },
) {
  requireAdmin(session);
  const userId = String(input.userId || "");
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId: session.tenantId } });
  if (!user) throw new Error("User not found in this tenant");
  const existing = await prisma.mailboxMap.findFirst({ where: { userId, tenantId: session.tenantId } });
  const mailbox = String(input.mailbox || "").trim();
  const clear = Boolean(input.clear) || !mailbox;

  if (clear) {
    if (existing) {
      await prisma.mailboxMap.delete({ where: { id: existing.id } });
      await audit({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: "admin_upsert_mailbox_map",
        entityType: "mailbox_map",
        entityId: userId,
        before: { mailbox: existing.mailbox },
        after: { cleared: true },
      });
    }
    return { cleared: true, userId };
  }

  const row = existing
    ? await prisma.mailboxMap.update({ where: { id: existing.id }, data: { mailbox } })
    : await prisma.mailboxMap.create({ data: { tenantId: session.tenantId, userId, mailbox } });

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_upsert_mailbox_map",
    entityType: "mailbox_map",
    entityId: userId,
    before: existing ? { mailbox: existing.mailbox } : undefined,
    after: { mailbox },
  });
  return row;
}

export async function adminResolveException(session: Session, exceptionId: string) {
  requireAdmin(session);
  const item = await prisma.exceptionItem.findFirst({
    where: { id: exceptionId, tenantId: session.tenantId },
  });
  if (!item) throw new Error("Exception not found in this tenant");
  const updated = await prisma.exceptionItem.update({
    where: { id: item.id },
    data: { status: "reviewed" },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_resolve_exception",
    entityType: "exception",
    entityId: item.id,
    before: { status: item.status },
    after: { status: "reviewed" },
  });
  return updated;
}

export async function adminSetRecordingPolicy(session: Session, allowed: boolean) {
  requireAdmin(session);
  const before = await tenantSettings(session.tenantId);
  const updated = await prisma.tenantSettings.update({
    where: { tenantId: session.tenantId },
    data: { recordingPlaybackAllowed: allowed },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "admin_set_recording_policy",
    entityType: "tenant_settings",
    entityId: updated.id,
    before: { recordingPlaybackAllowed: before.recordingPlaybackAllowed },
    after: { recordingPlaybackAllowed: allowed },
  });
  return { recordingPlaybackAllowed: updated.recordingPlaybackAllowed };
}

function serializeContactList(c: {
  id: string;
  name: string;
  title: string;
  department: string;
  location: string;
  status: string;
  source: string;
    lastContactAt: Date | null;
  nextAction: string;
  nextActionDueAt?: Date | null;
  availability?: string;
  workAuthorization?: string;
  owner: { name: string };
  skills: string[];
  candidateSubs: { stage: string; account: { name: string }; requirement: { title: string } }[];
  accounts: { roleOnAccount: string; account: { name: string } }[];
}) {
  const company = c.accounts[0];
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    department: c.department,
    location: c.location,
    status: c.status,
    source: c.source,
    lastContactAt: c.lastContactAt,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt,
    availability: c.availability,
    workAuthorization: c.workAuthorization,
    ownerName: c.owner.name,
    companyName: company?.account.name ?? "",
    roleOnAccount: company?.roleOnAccount ?? "",
    skills: c.skills,
    tags: [company?.roleOnAccount, c.status, ...c.skills].filter((t, i, a) => Boolean(t) && a.indexOf(t) === i).slice(0, 3),
    previousSubmissions: c.candidateSubs.map((s) => ({
      client: s.account.name,
      job: s.requirement.title,
      stage: s.stage,
    })),
  };
}

function serializeContactDetail(
  c: Prisma.ContactGetPayload<{
    include: {
      owner: true;
      coOwners: { include: { user: true } };
      titleIndex: true;
      accounts: { include: { account: { include: { roles: true; msaDocuments: true; purchaseOrders: true } } } };
      candidateSubs: { include: { requirement: true; account: true; clientContact: true } };
      clientContactSubs: { include: { requirement: true; candidate: true } };
      hiringManagerReqs: true;
      activities: { include: { actor: true } };
      tasks: { include: { owner: true } };
      documents: true;
      interviews: { include: { requirement: true; account: true } };
      placements: { include: { account: true; requirement: true } };
      ownershipReqs: { include: { requester: true } };
    };
  }>,
  session: Session,
) {
  const showRecording = session.permissions.includes("recording") && session.recordingPlaybackAllowed;
  return {
    type: "contact" as const,
    id: c.id,
    kind: c.kind,
    stage: c.stage,
    status: c.status,
    name: c.name,
    title: c.title,
    department: c.department,
    email: c.email,
    phone: c.phone,
    location: c.location,
    linkedIn: c.linkedIn,
    source: c.source,
    doNotContact: c.doNotContact,
    doNotEmail: c.doNotEmail,
    doNotSms: c.doNotSms,
    availability: c.availability,
    experienceYears: c.experienceYears,
    skills: c.skills,
    lastResume: c.lastResume,
    secondaryTitle: c.secondaryTitle,
    citizenship: c.citizenship,
    workAuthorization: c.workAuthorization,
    visaExpiry: c.visaExpiry,
    willingToRelocate: c.willingToRelocate,
    preferredLocation: c.preferredLocation,
    noticePeriod: c.noticePeriod,
    employmentType: c.employmentType,
    currentRate: c.currentRate,
    expectedRate: c.expectedRate,
    timezone: c.timezone,
    lastContactAt: c.lastContactAt,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt,
    portalCandidateId: c.portalCandidateId,
    owner: { id: c.owner.id, name: c.owner.name },
    isOwnedByOther: c.ownerId !== session.userId,
    coOwners: c.coOwners.map((x) => x.user.name),
    titleIndex: c.titleIndex,
    tags: Array.from(new Set([c.status, ...c.accounts.map((p) => p.roleOnAccount), ...c.skills].filter(Boolean))),
    companies: c.accounts.map((p) => ({
      id: p.account.id,
      name: p.account.name,
      role: p.roleOnAccount,
      industry: p.account.industry,
      location: p.account.location,
      roles: p.account.roles.map((r) => r.role),
      hasMsa: p.account.msaDocuments.length > 0,
      hasPo: p.account.purchaseOrders.length > 0,
    })),
    submissions: c.candidateSubs,
    interviews: c.interviews,
    placements: c.placements,
    requirements: c.hiringManagerReqs,
    documents: c.documents,
    upcoming: c.tasks.filter((t) => t.status === "open"),
    tasks: c.tasks,
    ownershipRequests: c.ownershipReqs,
    activeRequirements: c.candidateSubs.filter((s) => !["Rejected", "Placement"].includes(s.stage)).length,
    activities: c.activities.map((a) => ({
      ...a,
      recordingRef: showRecording ? a.recordingRef : a.recordingRef ? "[hidden]" : null,
      transcriptRef: showRecording ? a.transcriptRef : a.transcriptRef ? "[hidden]" : null,
      aiSummary: showRecording ? a.aiSummary : a.aiSummary ? "AI summary restricted" : null,
    })),
  };
}

function serializeAccount(
  a: Prisma.AccountGetPayload<{
    include: {
      owner: true;
      roles: true;
      msaDocuments: true;
      purchaseOrders: true;
      _count: { select: { requirements: true; submissions: true; people: true } };
    };
  }>,
  session: Session,
) {
  const po = canSeePoAmounts(session.role, session.permissions);
  return {
    id: a.id,
    name: a.name,
    industry: a.industry,
    location: a.location,
    status: a.status,
    ownerName: a.owner.name,
    lastContactAt: a.lastContactAt,
    roles: a.roles.map((r) => r.role),
    openRequirements: a._count.requirements,
    submissions: a._count.submissions,
    people: a._count.people,
    msaStatus: a.msaDocuments[0]?.status ?? "none",
    poRisk: a.purchaseOrders[0]
      ? po
        ? `${a.purchaseOrders[0].status} $${Number(a.purchaseOrders[0].utilized)} / $${Number(a.purchaseOrders[0].ceiling)}`
        : "PO on file"
      : "none",
  };
}

function serializeAccountDetail(
  a: Prisma.AccountGetPayload<{
    include: {
      owner: true;
      roles: true;
      people: { include: { contact: true } };
      requirements: { include: { hiringManager: true; recruiters: { include: { user: true } }; submissions: true } };
      submissions: { include: { candidate: true; requirement: true } };
      interviews: { include: { candidate: true; requirement: true } };
      placements: { include: { candidate: true } };
      msaDocuments: true;
      purchaseOrders: true;
      documents: true;
      activities: { include: { actor: true } };
      tasks: { include: { owner: true } };
    };
  }>,
  session: Session,
) {
  const po = canSeePoAmounts(session.role, session.permissions);
  return {
    type: "account" as const,
    id: a.id,
    name: a.name,
    industry: a.industry,
    location: a.location,
    status: a.status,
    owner: { id: a.owner.id, name: a.owner.name },
    lastContactAt: a.lastContactAt,
    nextAction: a.tasks.find((t) => t.status === "open")?.title ?? "",
    roles: a.roles.map((r) => r.role),
    people: a.people,
    requirements: a.requirements,
    submissions: a.submissions,
    interviews: a.interviews,
    placements: a.placements,
    documents: a.documents,
    activities: a.activities,
    tasks: a.tasks,
    msaDocuments: a.msaDocuments,
    purchaseOrders: a.purchaseOrders.map((p) => ({
      ...p,
      ceiling: po ? Number(p.ceiling) : null,
      utilized: po ? Number(p.utilized) : null,
      available: po ? Number(p.ceiling) - Number(p.utilized) : null,
      exists: true,
    })),
    intelligence: {
      relationshipOwner: a.owner.name,
      lastContact: a.lastContactAt,
      nextAction: a.tasks.find((t) => t.status === "open")?.title ?? "None",
      openRequirements: a.requirements.filter((r) => r.status === "open").length,
      submissions: a.submissions.length,
      interviews: a.interviews.length,
      placements: a.placements.length,
      msaStatus: a.msaDocuments[0]?.status ?? "none",
      poRisk: a.purchaseOrders[0] ? (po ? a.purchaseOrders[0].status : "PO on file") : "none",
    },
  };
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
