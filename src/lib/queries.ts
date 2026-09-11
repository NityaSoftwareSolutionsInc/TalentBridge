import {
  OrganizationRoleKind,
  PersonKind,
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
import { outreachChannelBlocks, normalizeEmail, normalizePhone } from "./normalize";
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
    prisma.activityEvent.count({ where: { tenantId, wrapUp: null } }),
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



export async function searchPeople(
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
    lastOutreach?: string;
    excludeRequirementId?: string;
    stage?: string;
    workAuthorization?: string;
  },
) {
  const tenantId = session.tenantId;
  const skillNeedles = (filters.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const listSelect = {
    id: true,
    name: true,
    title: true,
    department: true,
    location: true,
    status: true,
    source: true,
    lastOutreachAt: true,
    nextAction: true,
    nextActionDueAt: true,
    availability: true,
    workAuthorization: true,
    skills: true,
    owner: { select: { name: true } },
    affiliations: {
      take: 1,
      select: {
        roleOnOrganization: true,
        organization: { select: { name: true } },
      },
    },
    candidateSubs: {
      take: 3,
      orderBy: { sentAt: "desc" as const },
      select: {
        stage: true,
        organization: { select: { name: true } },
        requirement: { select: { title: true } },
      },
    },
  } satisfies Prisma.PersonSelect;

  if (module === "clients" || module === "vendors") {
    const kind = module === "clients" ? PersonKind.client_person : PersonKind.vendor_person;
    const people = await prisma.person.findMany({
      where: {
        tenantId,
        kind,
        location: filters.location ? { contains: filters.location, mode: "insensitive" } : undefined,
        status: filters.stage || undefined,
        AND: [
          filters.q
            ? {
                OR: [
                  { name: { contains: filters.q, mode: "insensitive" } },
                  { title: { contains: filters.q, mode: "insensitive" } },
                  { email: { contains: filters.q, mode: "insensitive" } },
                  { affiliations: { some: { organization: { name: { contains: filters.q, mode: "insensitive" } } } } },
                ],
              }
            : {},
          skillNeedles.length
            ? {
                OR: [
                  { skills: { hasEvery: skillNeedles } },
                  { titleIndex: { is: { skills: { hasEvery: skillNeedles } } } },
                ],
              }
            : {},
        ],
      },
      select: listSelect,
      orderBy: { lastOutreachAt: "desc" },
      take: 100,
    });
    return people.map((c) => serializePersonList(c));
  }

  const lastOutreachDays = filters.lastOutreach ? Number(filters.lastOutreach) : undefined;
  const lastOutreachBefore =
    lastOutreachDays && !Number.isNaN(lastOutreachDays)
      ? new Date(Date.now() - lastOutreachDays * 24 * 60 * 60 * 1000)
      : undefined;

  const people = await prisma.person.findMany({
    where: {
      tenantId,
      kind: PersonKind.candidate,
      stage: filters.stage || undefined,
      source: filters.source || undefined,
      ownerId: filters.owner || undefined,
      availability: filters.availability
        ? { contains: filters.availability, mode: "insensitive" }
        : undefined,
      location: filters.location ? { contains: filters.location, mode: "insensitive" } : undefined,
      experienceYears: filters.experience ? { gte: Number(filters.experience) || 0 } : undefined,
      lastOutreachAt: lastOutreachBefore ? { lte: lastOutreachBefore } : undefined,
      workAuthorization: filters.workAuthorization
        ? { contains: filters.workAuthorization, mode: "insensitive" }
        : undefined,
      // Exclude candidates already submitted to this requirement (anti-join, not huge NOT IN)
      ...(filters.excludeRequirementId
        ? {
            candidateSubs: {
              none: { tenantId, requirementId: filters.excludeRequirementId },
            },
          }
        : {}),
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
        // Skills filter in SQL (uses GIN) — every token must match person or title-index skills
        skillNeedles.length
          ? {
              OR: [
                { skills: { hasEvery: skillNeedles } },
                { titleIndex: { is: { skills: { hasEvery: skillNeedles } } } },
              ],
            }
          : {},
      ],
    },
    select: listSelect,
    orderBy: { lastOutreachAt: "desc" },
    take: 100,
  });

  return people.map((c) => serializePersonList(c));
}

export async function getPersonWorkspace(session: Session, personId: string) {
  const c = await prisma.person.findFirst({
    where: { id: personId, tenantId: session.tenantId },
    include: {
      owner: true,
      coOwners: { include: { user: true } },
      titleIndex: true,
      affiliations: { include: { organization: { include: { roles: true, msaDocuments: true, purchaseOrders: true } } } },
      candidateSubs: { include: { requirement: true, organization: true, clientPerson: true } },
      clientPersonSubs: { include: { requirement: true, candidate: true } },
      hiringManagerReqs: true,
      activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { include: { owner: true }, orderBy: { dueAt: "asc" } },
      files: true,
      interviews: { include: { requirement: true, organization: true } },
      placements: { include: { organization: true, requirement: true } },
      ownershipReqs: { where: { status: "pending" }, include: { requester: true } },
    },
  });
  if (!c) return null;
  const organizationIds = c.affiliations.map((p) => p.organization.id);
  const people = organizationIds.length
    ? await prisma.personOrganizationAffiliation.findMany({
        where: { organizationId: { in: organizationIds }, personId: { not: c.id } },
        include: { person: true },
        take: 8,
      })
    : [];
  return { ...serializePersonDetail(c, session), people };
}

export async function getOrganizationWorkspace(session: Session, organizationId: string) {
  const a = await prisma.organization.findFirst({
    where: { id: organizationId, tenantId: session.tenantId },
    include: {
      owner: true,
      roles: true,
      affiliations: { include: { person: true } },
      requirements: { include: { hiringManager: true, recruiters: { include: { user: true } }, submissions: true } },
      submissions: { include: { candidate: true, requirement: true } },
      interviews: { include: { candidate: true, requirement: true } },
      placements: { include: { candidate: true } },
      msaDocuments: true,
      purchaseOrders: true,
      files: true,
      activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 40 },
      tasks: { include: { owner: true }, orderBy: { dueAt: "asc" } },
    },
  });
  if (!a) return null;
  return serializeOrganizationDetail(a, session);
}

export async function globalSearch(session: Session, q: string) {
  const tenantId = session.tenantId;
  if (!q.trim()) return { candidates: [], clients: [], vendors: [], conversations: [], files: [] };

  const [people, organizations, activityEvents, files] = await Promise.all([
    prisma.person.findMany({
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
    prisma.organization.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      include: { roles: true },
      take: 8,
    }),
    prisma.activityEvent.findMany({
      where: {
        tenantId,
        OR: [{ summary: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }],
      },
      take: 8,
    }),
    prisma.storedFile.findMany({
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
      .filter((c) => c.kind === PersonKind.candidate)
      .map((c) => ({ id: c.id, name: c.name, title: c.title, module: "candidates", type: "person" })),
    clients: [
      ...people
        .filter((c) => c.kind === PersonKind.client_person)
        .map((c) => ({ id: c.id, name: c.name, module: "clients", type: "person" })),
      ...organizations
        .filter((a) => a.roles.some((r) => r.role === "client"))
        .map((a) => ({ id: a.id, name: a.name, module: "clients", type: "organization" })),
    ],
    vendors: [
      ...people
        .filter((c) => c.kind === PersonKind.vendor_person)
        .map((c) => ({ id: c.id, name: c.name, module: "vendors", type: "person" })),
      ...organizations
        .filter((a) => a.roles.some((r) => r.role === "vendor"))
        .map((a) => ({ id: a.id, name: a.name, module: "vendors", type: "organization" })),
    ],
    conversations: activityEvents.map((a) => ({
      id: a.id,
      name: strip(a.summary),
      personId: a.personId,
      organizationId: a.organizationId,
      module: a.personId ? "candidates" : "clients",
    })),
    files: files.map((d) => ({ id: d.id, name: d.name, module: "clients" })),
  };
}

export async function dashboard(session: Session) {
  const settings = await tenantSettings(session.tenantId);
  const tenantId = session.tenantId;
  const now = new Date();
  const reqCutoff = daysAgo(settings.slaRequirementNoSubDays);
  const subCutoff = daysAgo(settings.slaSubmissionFeedbackDays);
  const interviewCutoff = daysAgo(settings.slaInterviewFeedbackDays);
  const clientCutoff = daysAgo(settings.slaClientLastOutreachDays);
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
      include: { organization: true },
    }),
    prisma.submission.findMany({
      where: { tenantId, stage: { in: ["Submitted", "Client Review"] }, sentAt: { lte: subCutoff } },
      include: { candidate: true, requirement: true, organization: true },
    }),
    prisma.interview.findMany({
      where: { tenantId, outcome: "pending", scheduledAt: { lte: interviewCutoff } },
      include: { candidate: true, requirement: true },
    }),
    prisma.organization.findMany({
      where: {
        tenantId,
        roles: { some: { role: "client" } },
        OR: [{ lastOutreachAt: { lte: clientCutoff } }, { lastOutreachAt: null }],
      },
    }),
    prisma.task.findMany({
      where: { tenantId, status: "open", dueAt: { gte: startToday, lte: endToday } },
      include: { person: true },
    }),
    prisma.msaDocument.findMany({
      where: { tenantId, expiresAt: { lte: msaCutoff, gte: now } },
      include: { organization: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: ["low", "exhausted"] } },
      include: { organization: true },
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
      recordId: r.organizationId,
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
      title: `${a.name} no outreach in ${settings.slaClientLastOutreachDays}+ days`,
      module: "clients" as const,
      recordId: a.id,
    })),
    ...callbacks.map((t) => ({
      id: t.id,
      type: "callback_today",
      title: t.title,
      module: "tasks" as const,
      recordId: t.personId ?? t.id,
    })),
    ...expiringMsa.map((m) => ({
      id: m.id,
      type: "msa_expiry",
      title: `${m.organization.name} MSA ${m.number} expires within ${settings.slaMsaExpiryDays} days`,
      module: "msa-po" as const,
      recordId: m.organizationId,
    })),
    ...lowPo.map((p) => ({
      id: p.id,
      type: "po_risk",
      title: canSeePoAmounts(session.role, session.permissions)
        ? `${p.organization.name} PO ${p.number} ${p.status} ($${Number(p.utilized).toLocaleString()} / $${Number(p.ceiling).toLocaleString()})`
        : `${p.organization.name} has a PO that needs attention`,
      module: "msa-po" as const,
      recordId: p.organizationId,
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
    include: { owner: true, person: true, organization: true, requirement: true },
    orderBy: { dueAt: "asc" },
  });
}

export async function listCommunications(session: Session) {
  return prisma.activityEvent.findMany({
    where: { tenantId: session.tenantId, wrapUp: null },
    include: { actor: true, person: true, organization: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listRequirements(session: Session, organizationId?: string) {
  return prisma.requirement.findMany({
    where: { tenantId: session.tenantId, organizationId: organizationId || undefined },
    include: { organization: true, hiringManager: true, recruiters: { include: { user: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function wrapUp(session: Session, input: {
  activityId?: string;
  personId: string;
  outcome: WrapUpOutcome;
  nextActionTitle?: string;
  dueAt?: string;
  requirementId?: string;
}) {
  const activity = input.activityId
    ? await prisma.activityEvent.findFirst({ where: { id: input.activityId, tenantId: session.tenantId } })
    : await prisma.activityEvent.create({
        data: {
          tenantId: session.tenantId,
          kind: "note",
          summary: `Wrap-up: ${input.outcome}`,
          actorId: session.userId,
          personId: input.personId,
          requirementId: input.requirementId,
          wrapUp: input.outcome,
        },
      });

  if (activity && input.activityId) {
    await prisma.activityEvent.update({
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
        personId: input.personId,
        requirementId: input.requirementId,
        sourceEventId: activity?.id,
      },
    });
    taskId = task.id;
    await prisma.person.update({
      where: { id: input.personId },
      data: {
        nextAction: input.nextActionTitle,
        nextActionDueAt: task.dueAt,
        lastOutreachAt: new Date(),
      },
    });
  } else {
    await prisma.person.update({
      where: { id: input.personId },
      data: { nextAction: input.outcome === "closed" ? "Closed" : "No action required", lastOutreachAt: new Date() },
    });
  }

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "wrap_up",
    entityType: "activity_event",
    entityId: activity?.id ?? input.personId,
    after: { outcome: input.outcome, taskId },
  });

  return { activityId: activity?.id, taskId };
}

export async function placeCall(session: Session, personId: string) {
  if (!session.vioTalkMapped) {
    throw new Error("No VioTalk agent mapping. Users with no mapping cannot use VioTalk Call.");
  }
  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId: session.tenantId },
  });
  if (!person) throw new Error("Contact not found");
  if (outreachChannelBlocks(person).call) throw new Error("Do not reach is on — outbound call disabled.");

  const result = await integrations.vioTalk.placeCall({
    personId,
    phone: person.phone,
    userId: session.userId,
  });

  const activity = await prisma.activityEvent.create({
    data: {
      tenantId: session.tenantId,
      kind: "call",
      summary: `VioTalk call – ${Math.round(result.durationSeconds / 60)} minutes.`,
      body: result.aiSummary,
      source: "viotalk",
      externalId: result.callId,
      actorId: session.userId,
      personId,
      recordingRef: result.recordingRef,
      transcriptRef: result.transcriptRef,
      aiSummary: result.aiSummary,
    },
  });

  await prisma.person.update({
    where: { id: personId },
    data: { lastOutreachAt: new Date() },
  });

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "viotalk_call",
    entityType: "activity_event",
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
    clientPersonId: string;
    message: string;
    resumeName: string;
  },
) {
  if (!session.permissions.includes("submit")) throw new Error("No Submit Profile permission");
  const req = await prisma.requirement.findFirst({
    where: { id: input.requirementId, tenantId: session.tenantId },
    include: { organization: true },
  });
  if (!req) throw new Error("Requirement required — cannot submit to a company with no job");
  const candidate = await prisma.person.findFirst({
    where: { id: input.candidateId, tenantId: session.tenantId },
  });
  const clientPerson = await prisma.person.findFirst({
    where: { id: input.clientPersonId, tenantId: session.tenantId },
  });
  if (!candidate || !clientPerson) throw new Error("Candidate and Client person required");
  if (outreachChannelBlocks(candidate).email) throw new Error("Do not reach is on — outbound email disabled.");
  if (!session.mailbox) throw new Error("No mailbox mapped for Outlook send");

  const sent = await integrations.outlook.sendAsUser({
    fromMailbox: session.mailbox,
    to: clientPerson.email,
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
      organizationId: req.organizationId,
      clientPersonId: clientPerson.id,
      recruiterId: session.userId,
      bdmId: req.bdmId,
      stage: settings.submissionStages[0] ?? "Submitted",
      emailMessageId: sent.messageId,
      resumeVersion: input.resumeName || candidate.lastResume,
      source: "hub",
    },
  });

  const activity = await prisma.activityEvent.create({
    data: {
      tenantId: session.tenantId,
      kind: "email",
      summary: `Submitted ${candidate.name} to ${req.organization.name} / ${req.title}`,
      body: input.message,
      source: "outlook",
      externalId: sent.messageId,
      actorId: session.userId,
      personId: candidate.id,
      organizationId: req.organizationId,
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

export async function changeStage(session: Session, personId: string, stage: string) {
  if (!session.permissions.includes("change_stage")) {
    throw new Error("Stage change is permissioned (owner / sales / ops / admin)");
  }
  const settings = await tenantSettings(session.tenantId);
  if (!settings.relationshipStages.includes(stage)) throw new Error("Unknown stage");
  const before = await prisma.person.findFirst({ where: { id: personId, tenantId: session.tenantId } });
  if (!before) throw new Error("Contact not found");
  const updated = await prisma.person.update({
    where: { id: personId },
    data: { stage },
  });
  await prisma.activityEvent.create({
    data: {
      tenantId: session.tenantId,
      kind: "stage",
      summary: `Stage ${before.stage} → ${stage}`,
      actorId: session.userId,
      personId,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "change_stage",
    entityType: "person",
    entityId: personId,
    before: { stage: before.stage },
    after: { stage },
  });
  return updated;
}

export async function requestOwnership(
  session: Session,
  personId: string,
  type: OwnershipRequestType,
  note: string,
) {
  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId: session.tenantId },
  });
  if (!person) throw new Error("Contact not found");
  const row = await prisma.ownershipRequest.create({
    data: {
      tenantId: session.tenantId,
      personId,
      requesterId: session.userId,
      targetOwnerId: person.ownerId,
      type,
      note,
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: `ownership_${type}`,
    entityType: "person",
    entityId: personId,
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
    await prisma.person.update({
      where: { id: req.personId },
      data: { ownerId: req.requesterId },
    });
  }
  if (accept && req.type === "collaboration") {
    await prisma.personCoOwner.create({
      data: { personId: req.personId, userId: req.requesterId },
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

  const existingByPortal = await prisma.person.findFirst({
    where: { tenantId: session.tenantId, portalCandidateId },
  });

  // Match cascade: portal ID (above) → normalized email → normalized phone. Never auto-merge.
  const collision = await prisma.person.findFirst({
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
    kind: PersonKind.candidate,
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

  const person = existingByPortal
    ? await prisma.person.update({ where: { id: existingByPortal.id }, data })
    : await prisma.person.create({ data });

  await prisma.titleIndex.upsert({
    where: { personId: person.id },
    create: {
      tenantId: session.tenantId,
      personId: person.id,
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
        entityType: "person",
        entityId: person.id,
        externalSystem: "JobsNProfiles",
        externalEntityType: "candidate",
      },
    },
    create: {
      tenantId: session.tenantId,
      entityType: "person",
      entityId: person.id,
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
      entityType: "person",
      entityId: person.id,
      field: "profile",
      sourceSystem: "JobsNProfiles",
      externalId: portalCandidateId,
      lastSyncedAt: new Date(),
      updatedBy: session.userId,
    },
  });

  return { status: "upserted" as const, personId: person.id };
}

export async function createPerson(
  session: Session,
  input: { name: string; kind: "candidate" | "client_person" | "vendor_person"; email?: string; phone?: string; title?: string },
) {
  const kind =
    input.kind === "candidate"
      ? PersonKind.candidate
      : input.kind === "vendor_person"
        ? PersonKind.vendor_person
        : PersonKind.client_person;
  const person = await prisma.person.create({
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
    action: "create_person",
    entityType: "person",
    entityId: person.id,
  });
  return person;
}

export async function updatePerson(
  session: Session,
  personId: string,
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
  const existing = await prisma.person.findFirst({ where: { id: personId, tenantId: session.tenantId } });
  if (!existing) throw new Error("Contact not found");
  const nextEmail = input.email ?? existing.email;
  const nextPhone = input.phone ?? existing.phone;
  const person = await prisma.person.update({
    where: { id: personId },
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
    action: "update_person",
    entityType: "person",
    entityId: person.id,
  });
  return person;
}

export async function createOrganization(
  session: Session,
  input: { name: string; role: "client" | "vendor"; industry?: string; location?: string },
) {
  if (!["sales", "operations", "admin"].includes(session.role)) {
    throw new Error("Clients/Vendors are created in TalentBridge by sales/ops/admin — not fetched from JobsNProfiles");
  }
  const organization = await prisma.organization.create({
    data: {
      tenantId: session.tenantId,
      name: input.name,
      industry: input.industry || "",
      location: input.location || "",
      ownerId: session.userId,
      roles: { create: { role: input.role === "vendor" ? OrganizationRoleKind.vendor : OrganizationRoleKind.client } },
    },
  });
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "create_organization",
    entityType: "organization",
    entityId: organization.id,
  });
  return organization;
}

export async function createRequirement(
  session: Session,
  input: {
    organizationId: string;
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
      organizationId: input.organizationId,
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

export async function addNote(session: Session, personId: string, body: string, visibility: "shared" | "internal") {
  return prisma.activityEvent.create({
    data: {
      tenantId: session.tenantId,
      kind: visibility === "internal" ? "internal_note" : "note",
      summary: body.slice(0, 80),
      body,
      actorId: session.userId,
      personId,
    },
  });
}

export async function toggleDnc(session: Session, personId: string, on: boolean) {
  if (!["sales", "operations", "admin"].includes(session.role)) throw new Error("DNC change not permitted");
  return prisma.person.update({
    where: { id: personId },
    data: { doNotReach: on },
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
      slaClientLastOutreachDays: settings.slaClientLastOutreachDays,
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

function serializePersonList(c: {
  id: string;
  name: string;
  title: string;
  department: string;
  location: string;
  status: string;
  source: string;
    lastOutreachAt: Date | null;
  nextAction: string;
  nextActionDueAt?: Date | null;
  availability?: string;
  workAuthorization?: string;
  owner: { name: string };
  skills: string[];
  candidateSubs: { stage: string; organization: { name: string }; requirement: { title: string } }[];
  affiliations: { roleOnOrganization: string; organization: { name: string } }[];
}) {
  const company = c.affiliations[0];
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    department: c.department,
    location: c.location,
    status: c.status,
    source: c.source,
    lastOutreachAt: c.lastOutreachAt,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt,
    availability: c.availability,
    workAuthorization: c.workAuthorization,
    ownerName: c.owner.name,
    companyName: company?.organization.name ?? "",
    roleOnOrganization: company?.roleOnOrganization ?? "",
    skills: c.skills,
    tags: [company?.roleOnOrganization, c.status, ...c.skills].filter((t, i, a) => Boolean(t) && a.indexOf(t) === i).slice(0, 3),
    previousSubmissions: c.candidateSubs.map((s) => ({
      client: s.organization.name,
      job: s.requirement.title,
      stage: s.stage,
    })),
  };
}

function serializePersonDetail(
  c: Prisma.PersonGetPayload<{
    include: {
      owner: true;
      coOwners: { include: { user: true } };
      titleIndex: true;
      affiliations: { include: { organization: { include: { roles: true; msaDocuments: true; purchaseOrders: true } } } };
      candidateSubs: { include: { requirement: true; organization: true; clientPerson: true } };
      clientPersonSubs: { include: { requirement: true; candidate: true } };
      hiringManagerReqs: true;
      activityEvents: { include: { actor: true } };
      tasks: { include: { owner: true } };
      files: true;
      interviews: { include: { requirement: true; organization: true } };
      placements: { include: { organization: true; requirement: true } };
      ownershipReqs: { include: { requester: true } };
    };
  }>,
  session: Session,
) {
  const showRecording = session.permissions.includes("recording") && session.recordingPlaybackAllowed;
  return {
    type: "person" as const,
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
    doNotReach: c.doNotReach,
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
    lastOutreachAt: c.lastOutreachAt,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt,
    portalCandidateId: c.portalCandidateId,
    owner: { id: c.owner.id, name: c.owner.name },
    isOwnedByOther: c.ownerId !== session.userId,
    coOwners: c.coOwners.map((x) => x.user.name),
    titleIndex: c.titleIndex,
    tags: Array.from(new Set([c.status, ...c.affiliations.map((p) => p.roleOnOrganization), ...c.skills].filter(Boolean))),
    companies: c.affiliations.map((p) => ({
      id: p.organization.id,
      name: p.organization.name,
      role: p.roleOnOrganization,
      industry: p.organization.industry,
      location: p.organization.location,
      roles: p.organization.roles.map((r) => r.role),
      hasMsa: p.organization.msaDocuments.length > 0,
      hasPo: p.organization.purchaseOrders.length > 0,
    })),
    submissions: c.candidateSubs,
    interviews: c.interviews,
    placements: c.placements,
    requirements: c.hiringManagerReqs,
    files: c.files,
    upcoming: c.tasks.filter((t) => t.status === "open"),
    tasks: c.tasks,
    ownershipRequests: c.ownershipReqs,
    activeRequirements: c.candidateSubs.filter((s) => !["Rejected", "Placement"].includes(s.stage)).length,
    activityEvents: c.activityEvents.map((a) => ({
      ...a,
      recordingRef: showRecording ? a.recordingRef : a.recordingRef ? "[hidden]" : null,
      transcriptRef: showRecording ? a.transcriptRef : a.transcriptRef ? "[hidden]" : null,
      aiSummary: showRecording ? a.aiSummary : a.aiSummary ? "AI summary restricted" : null,
    })),
  };
}

function serializeOrganization(
  a: Prisma.OrganizationGetPayload<{
    include: {
      owner: true;
      roles: true;
      msaDocuments: true;
      purchaseOrders: true;
      _count: { select: { requirements: true; submissions: true; affiliations: true } };
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
    lastOutreachAt: a.lastOutreachAt,
    roles: a.roles.map((r) => r.role),
    openRequirements: a._count.requirements,
    submissions: a._count.submissions,
    people: a._count.affiliations,
    msaStatus: a.msaDocuments[0]?.status ?? "none",
    poRisk: a.purchaseOrders[0]
      ? po
        ? `${a.purchaseOrders[0].status} $${Number(a.purchaseOrders[0].utilized)} / $${Number(a.purchaseOrders[0].ceiling)}`
        : "PO on file"
      : "none",
  };
}

function serializeOrganizationDetail(
  a: Prisma.OrganizationGetPayload<{
    include: {
      owner: true;
      roles: true;
      affiliations: { include: { person: true } };
      requirements: { include: { hiringManager: true; recruiters: { include: { user: true } }; submissions: true } };
      submissions: { include: { candidate: true; requirement: true } };
      interviews: { include: { candidate: true; requirement: true } };
      placements: { include: { candidate: true } };
      msaDocuments: true;
      purchaseOrders: true;
      files: true;
      activityEvents: { include: { actor: true } };
      tasks: { include: { owner: true } };
    };
  }>,
  session: Session,
) {
  const po = canSeePoAmounts(session.role, session.permissions);
  return {
    type: "organization" as const,
    id: a.id,
    name: a.name,
    industry: a.industry,
    location: a.location,
    status: a.status,
    owner: { id: a.owner.id, name: a.owner.name },
    lastOutreachAt: a.lastOutreachAt,
    nextAction: a.tasks.find((t) => t.status === "open")?.title ?? "",
    roles: a.roles.map((r) => r.role),
    people: a.affiliations,
    requirements: a.requirements,
    submissions: a.submissions,
    interviews: a.interviews,
    placements: a.placements,
    files: a.files,
    activityEvents: a.activityEvents,
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
      lastOutreach: a.lastOutreachAt,
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
