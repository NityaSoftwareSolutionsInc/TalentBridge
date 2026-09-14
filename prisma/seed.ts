import {
  OrganizationRoleKind,
  PersonKind,
  ExceptionKind,
  PrismaClient,
  RequirementStatus,
  TbRole,
  WrapUpOutcome,
} from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS talentbridge`);

  await prisma.tenant.deleteMany();
  await prisma.platformAdmin.deleteMany();

  const globalAdmin = await prisma.platformAdmin.create({
    data: {
      email: "global.admin@talentbridge.example",
      name: "Global Admin",
      role: "global_admin",
      passwordHash: await hashPassword("ChangeMe123!"),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });

  await prisma.platformAdmin.create({
    data: {
      email: "manager@talentbridge.example",
      name: "Priya Manager",
      role: "manager",
      passwordHash: await hashPassword("ChangeMe123!"),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });

  await prisma.platformAdmin.create({
    data: {
      email: "support@talentbridge.example",
      name: "Alex Support",
      role: "support",
      passwordHash: await hashPassword("ChangeMe123!"),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const northstar = await prisma.tenant.create({
    data: {
      name: "Northstar Staffing",
      enabled: true,
      jnpAllowed: true,
      createdById: globalAdmin.id,
      settings: { create: { jnpAccountUserId: "1001" } },
    },
  });

  const ghost = await prisma.tenant.create({
    data: {
      name: "Ghost Corp",
      enabled: true,
      jnpAllowed: false,
      createdById: globalAdmin.id,
      settings: { create: {} },
    },
  });

  const [sarah, james, priya, elena, kim] = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: northstar.id,
        email: "sarah.mitchell@northstar.example",
        name: "Sarah Mitchell",
        title: "Recruitment Ops",
        memberships: { create: { tenantId: northstar.id, role: TbRole.recruiter } },
        agentMap: {
          create: {
            tenantId: northstar.id,
            vioTalkUserId: "vt-sarah",
            assignedNumber: "+1-800-555-0101",
          },
        },
        mailboxMap: {
          create: { tenantId: northstar.id, mailbox: "sarah.mitchell@northstar.example" },
        },
        jnpMap: {
          create: { tenantId: northstar.id, jnpUserId: "1001" },
        },
        jnpEnabled: true,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: northstar.id,
        email: "james.dalton@northstar.example",
        name: "James Dalton",
        title: "BDM",
        memberships: { create: { tenantId: northstar.id, role: TbRole.sales } },
        agentMap: {
          create: {
            tenantId: northstar.id,
            vioTalkUserId: "vt-james",
            assignedNumber: "+1-800-555-0102",
          },
        },
        mailboxMap: {
          create: { tenantId: northstar.id, mailbox: "james.dalton@northstar.example" },
        },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: northstar.id,
        email: "priya.shah@northstar.example",
        name: "Priya Shah",
        title: "Operations",
        memberships: { create: { tenantId: northstar.id, role: TbRole.operations } },
        mailboxMap: {
          create: { tenantId: northstar.id, mailbox: "priya.shah@northstar.example" },
        },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: northstar.id,
        email: "elena.vos@northstar.example",
        name: "Elena Vos",
        title: "VP Delivery",
        memberships: { create: { tenantId: northstar.id, role: TbRole.leadership } },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: northstar.id,
        email: "kim.park@northstar.example",
        name: "Kim Park",
        title: "Administrator",
        memberships: { create: { tenantId: northstar.id, role: TbRole.admin } },
      },
    }),
  ]);

  const ghostUser = await prisma.user.create({
    data: {
      tenantId: ghost.id,
      email: "ghost.admin@ghost.example",
      name: "Ghost Admin",
      title: "Admin",
      memberships: { create: { tenantId: ghost.id, role: TbRole.admin } },
    },
  });

  await prisma.person.create({
    data: {
      tenantId: ghost.id,
      kind: PersonKind.candidate,
      name: "Secret Other-Tenant Candidate",
      email: "secret@ghost.example",
      ownerId: ghostUser.id,
      portalCandidateId: "JNP-GHOST",
    },
  });

  const acme = await prisma.organization.create({
    data: {
      tenantId: northstar.id,
      name: "Acme Technologies",
      industry: "Software",
      location: "San Francisco, CA",
      ownerId: james.id,
      lastOutreachAt: daysAgo(25),
      roles: { create: { role: OrganizationRoleKind.client } },
    },
  });

  const apex = await prisma.organization.create({
    data: {
      tenantId: northstar.id,
      name: "Apex Supply Partners",
      industry: "Staffing vendor",
      location: "Dallas, TX",
      ownerId: james.id,
      lastOutreachAt: daysAgo(4),
      roles: { create: { role: OrganizationRoleKind.vendor } },
    },
  });

  const dual = await prisma.organization.create({
    data: {
      tenantId: northstar.id,
      name: "Harbor Logistics",
      industry: "Logistics",
      location: "Chicago, IL",
      ownerId: james.id,
      roles: {
        create: [{ role: OrganizationRoleKind.client }, { role: OrganizationRoleKind.vendor }],
      },
    },
  });

  const jennifer = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.client_person,
      stage: "Customer",
      name: "Jennifer Lawson",
      title: "Head of Talent Acquisition",
      department: "Talent",
      email: "jennifer.lawson@acme.example",
      phone: "+1 (415) 555-0199",
      location: "San Francisco, CA",
      linkedIn: "linkedin.com/in/jenniferlawson",
      source: "Referral",
      ownerId: james.id,
      lastOutreachAt: daysAgo(2),
      nextAction: "Follow up on Q2 hiring plan",
      nextActionDueAt: daysFromNow(1),
      skills: ["Decision Maker", "Tech", "Strategic", "High Value"],
      affiliations: { create: { organizationId: acme.id, roleOnOrganization: "Primary" } },
    },
  });

  const michael = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.client_person,
      stage: "Customer",
      name: "Michael Grant",
      title: "Engineering Manager",
      email: "michael.grant@acme.example",
      phone: "+1-415-555-0111",
      location: "San Francisco, CA",
      ownerId: james.id,
      lastOutreachAt: daysAgo(10),
      skills: ["Decision Maker", "Engineering"],
      affiliations: { create: { organizationId: acme.id, roleOnOrganization: "Hiring Manager" } },
    },
  });

  const extraClients = [
    { name: "Mark Stevens", title: "VP Engineering", location: "Austin, TX", tag: "Engineering", days: 5 },
    { name: "Rachel Kim", title: "Director of Product", location: "Seattle, WA", tag: "Product", days: 7 },
    { name: "Tom Anderson", title: "Finance Manager", location: "San Francisco, CA", tag: "Finance", days: 12 },
    { name: "Lisa Park", title: "HR Business Partner", location: "San Francisco, CA", tag: "Talent", days: 14 },
    { name: "David Wilson", title: "CTO", location: "San Francisco, CA", tag: "Engineering", days: 18 },
    { name: "Emma Roberts", title: "Product Manager", location: "Seattle, WA", tag: "Product", days: 20 },
    { name: "James Carter", title: "Engineering Lead", location: "Austin, TX", tag: "Engineering", days: 22 },
  ];
  for (const person of extraClients) {
    await prisma.person.create({
      data: {
        tenantId: northstar.id,
        kind: PersonKind.client_person,
        stage: "Customer",
        name: person.name,
        title: person.title,
        email: `${person.name.toLowerCase().replace(" ", ".")}@acme.example`,
        location: person.location,
        ownerId: james.id,
        lastOutreachAt: daysAgo(person.days),
        skills: [person.tag],
        affiliations: { create: { organizationId: acme.id, roleOnOrganization: person.tag } },
      },
    });
  }

  const anil = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.candidate,
      stage: "Lead",
      name: "Anil Reddy",
      title: "Senior Java Developer",
      email: "anil.reddy@example.com",
      phone: "+1-415-555-0182",
      location: "Austin, TX",
      source: "JobsNProfiles",
      ownerId: sarah.id,
      skills: ["Java", "Spring Boot", "AWS", "Microservices"],
      experienceYears: 8,
      availability: "2 weeks",
      lastResume: "Anil_Reddy_Java.pdf",
      portalCandidateId: "JNP-104582",
      lastOutreachAt: daysAgo(1),
      nextAction: "Submit to Acme Java Developer",
      nextActionDueAt: daysFromNow(3),
      linkedIn: "linkedin.com/in/anilreddy",
      secondaryTitle: "Cloud Engineer",
      citizenship: "India",
      workAuthorization: "H-1B",
      visaExpiry: daysFromNow(420),
      willingToRelocate: "Yes",
      preferredLocation: "Dallas, TX / Remote",
      noticePeriod: "2 weeks",
      employmentType: "W2",
      currentRate: "$75/hr",
      expectedRate: "$85/hr",
      timezone: "CT",
      titleIndex: {
        create: {
          tenantId: northstar.id,
          currentTitle: "Senior Java Developer",
          previousTitles: ["Java Engineer", "Backend Java Developer"],
          resumeTitles: ["Senior Java Developer", "Spring Boot Engineer"],
          skills: ["Java", "Spring Boot", "AWS", "Microservices"],
        },
      },
    },
  });

  const maya = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.candidate,
      stage: "Lead",
      name: "Maya Chen",
      title: "DevOps Engineer",
      email: "maya.chen@example.com",
      phone: "+1-206-555-0144",
      location: "Seattle, WA",
      source: "JobsNProfiles",
      ownerId: james.id,
      skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
      experienceYears: 6,
      availability: "Immediate",
      lastResume: "Maya_Chen_DevOps.pdf",
      portalCandidateId: "JNP-204901",
      lastOutreachAt: daysAgo(8),
      citizenship: "United States",
      workAuthorization: "US Citizen",
      willingToRelocate: "No",
      preferredLocation: "Seattle, WA",
      noticePeriod: "Immediate",
      employmentType: "W2",
      currentRate: "$80/hr",
      expectedRate: "$90/hr",
      timezone: "PT",
      titleIndex: {
        create: {
          tenantId: northstar.id,
          currentTitle: "DevOps Engineer",
          previousTitles: ["SRE", "Platform Engineer"],
          resumeTitles: ["DevOps Engineer", "Cloud Engineer"],
          skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
        },
      },
    },
  });

  const priyaCandidate = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.candidate,
      name: "Diego Alvarez",
      title: "Java Engineer",
      email: "diego.alvarez@example.com",
      phone: "+1-512-555-0177",
      location: "Remote",
      source: "manual",
      ownerId: sarah.id,
      skills: ["Java", "Kafka"],
      experienceYears: 5,
      availability: "30 days",
      lastResume: "Diego_Alvarez.pdf",
      citizenship: "Mexico",
      workAuthorization: "Green Card",
      willingToRelocate: "Open",
      preferredLocation: "Austin, TX / Remote",
      noticePeriod: "30 days",
      employmentType: "C2C",
      currentRate: "$70/hr",
      expectedRate: "$78/hr",
      timezone: "CT",
      titleIndex: {
        create: {
          tenantId: northstar.id,
          currentTitle: "Java Engineer",
          previousTitles: ["Backend Developer"],
          resumeTitles: ["Java Engineer"],
          skills: ["Java", "Kafka"],
        },
      },
    },
  });

  const vendorContact = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.vendor_person,
      name: "Rita Kapoor",
      title: "Account Manager",
      email: "rita.kapoor@apex.example",
      phone: "+1-214-555-0166",
      location: "Dallas, TX",
      ownerId: james.id,
      lastOutreachAt: daysAgo(3),
      affiliations: { create: { organizationId: apex.id, roleOnOrganization: "Primary" } },
    },
  });

  const javaReq = await prisma.requirement.create({
    data: {
      tenantId: northstar.id,
      organizationId: acme.id,
      title: "Java Developer",
      skills: ["Java", "Spring Boot", "AWS"],
      location: "San Francisco / Remote",
      hiringManagerId: jennifer.id,
      bdmId: james.id,
      status: RequirementStatus.open,
      openedAt: daysAgo(6),
      targetFillAt: daysFromNow(21),
      recruiters: { create: { userId: sarah.id } },
    },
  });

  const devopsReq = await prisma.requirement.create({
    data: {
      tenantId: northstar.id,
      organizationId: acme.id,
      title: "DevOps Engineer",
      skills: ["Kubernetes", "AWS"],
      location: "Seattle",
      hiringManagerId: michael.id,
      bdmId: james.id,
      status: RequirementStatus.open,
      openedAt: daysAgo(4),
      targetFillAt: daysFromNow(14),
      recruiters: { create: { userId: sarah.id } },
    },
  });

  const submission = await prisma.submission.create({
    data: {
      tenantId: northstar.id,
      candidateId: anil.id,
      requirementId: javaReq.id,
      organizationId: acme.id,
      clientPersonId: jennifer.id,
      recruiterId: sarah.id,
      bdmId: james.id,
      stage: "Client Review",
      emailMessageId: "outlook-seed-sub-1",
      resumeVersion: "Anil_Reddy_Java.pdf",
      sentAt: daysAgo(6),
      source: "hub",
    },
  });

  const interview = await prisma.interview.create({
    data: {
      tenantId: northstar.id,
      candidateId: anil.id,
      organizationId: acme.id,
      requirementId: javaReq.id,
      submissionId: submission.id,
      scheduledAt: daysAgo(1),
      endsAt: new Date(daysAgo(1).getTime() + 45 * 60000),
      location: "Microsoft Teams",
      teamsJoinUrl: "https://teams.microsoft.com/l/meetup-join/talentbridge-seed/anil-java",
      graphEventId: "teams-seed-anil-java",
      outcome: "pending",
    },
  });

  await prisma.calendarEvent.create({
    data: {
      tenantId: northstar.id,
      title: "Interview · Anil Reddy / Senior Java Developer",
      kind: "interview",
      startsAt: interview.scheduledAt,
      endsAt: interview.endsAt || new Date(interview.scheduledAt.getTime() + 45 * 60000),
      location: "Microsoft Teams",
      teamsJoinUrl: interview.teamsJoinUrl,
      graphEventId: interview.graphEventId,
      organizerId: sarah.id,
      personId: anil.id,
      organizationId: acme.id,
      requirementId: javaReq.id,
      submissionId: submission.id,
      interviewId: interview.id,
      attendees: ["anil.reddy@example.com", "jennifer.lawson@acme.example", "sarah.mitchell@northstar.example"],
      body: "Screening with Jennifer Walsh.",
      source: "teams",
    },
  });

  await prisma.calendarEvent.create({
    data: {
      tenantId: northstar.id,
      title: "Teams call with Jennifer Walsh",
      kind: "meeting",
      startsAt: daysFromNow(2),
      endsAt: new Date(daysFromNow(2).getTime() + 30 * 60000),
      location: "Microsoft Teams",
      teamsJoinUrl: "https://teams.microsoft.com/l/meetup-join/talentbridge-seed/jennifer-q2",
      graphEventId: "teams-seed-jennifer-q2",
      organizerId: james.id,
      personId: jennifer.id,
      organizationId: acme.id,
      attendees: ["jennifer.lawson@acme.example", "james.dalton@northstar.example"],
      body: "Q2 hiring plan follow-up.",
      source: "teams",
    },
  });

  const placed = await prisma.person.create({
    data: {
      tenantId: northstar.id,
      kind: PersonKind.candidate,
      name: "Noah Patel",
      title: "Platform Engineer",
      email: "noah.patel@example.com",
      ownerId: sarah.id,
      skills: ["Go", "Kubernetes"],
      lastResume: "Noah_Patel.pdf",
      lastOutreachAt: daysAgo(20),
      citizenship: "United States",
      workAuthorization: "US Citizen",
      willingToRelocate: "Yes",
      preferredLocation: "United States",
      noticePeriod: "2 weeks",
      employmentType: "W2",
      timezone: "ET",
    },
  });

  await prisma.placement.create({
    data: {
      tenantId: northstar.id,
      candidateId: placed.id,
      organizationId: acme.id,
      requirementId: javaReq.id,
      ownerId: sarah.id,
      startDate: daysAgo(10),
      endDate: daysFromNow(80),
      followUp: "7-day candidate check-in",
      status: "active",
    },
  });

  await prisma.task.createMany({
    data: [
      {
        tenantId: northstar.id,
        title: "Follow up on Q2 hiring plan",
        dueAt: daysFromNow(1),
        ownerId: james.id,
        personId: jennifer.id,
        organizationId: acme.id,
        status: "open",
      },
      {
        tenantId: northstar.id,
        title: "Callback promised today — Jennifer Lawson",
        dueAt: new Date(),
        ownerId: james.id,
        personId: jennifer.id,
        organizationId: acme.id,
        status: "open",
      },
      {
        tenantId: northstar.id,
        title: "7-day candidate check-in — Noah Patel",
        dueAt: daysAgo(3),
        ownerId: sarah.id,
        personId: placed.id,
        organizationId: acme.id,
        status: "open",
      },
      {
        tenantId: northstar.id,
        title: "Submit Anil Reddy to Acme Java Developer",
        dueAt: daysFromNow(3),
        ownerId: sarah.id,
        personId: anil.id,
        organizationId: acme.id,
        status: "open",
      },
    ],
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "call",
      summary: "VioTalk call – 12 minutes. Interested – follow-up required.",
      body: "Q2 hiring plan discussion. Asked for two Java profiles.",
      source: "viotalk",
      externalId: "vt-call-seed-1",
      actorId: sarah.id,
      personId: anil.id,
      organizationId: acme.id,
      requirementId: javaReq.id,
      wrapUp: WrapUpOutcome.next_action,
      recordingRef: "rec:vt-call-seed-1",
      transcriptRef: "tr:vt-call-seed-1",
      aiSummary: "Candidate is interested. Send two Java profiles tomorrow.",
      createdAt: daysAgo(1),
    },
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "email",
      summary: "Submitted Anil Reddy to Acme Java Developer",
      body: "Hub-first Outlook send. Submission created.",
      source: "outlook",
      externalId: "outlook-seed-sub-1",
      actorId: sarah.id,
      personId: anil.id,
      organizationId: acme.id,
      requirementId: javaReq.id,
      submissionId: submission.id,
      wrapUp: WrapUpOutcome.next_action,
      createdAt: daysAgo(6),
    },
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "email",
      summary: "Q2 hiring plan discussion",
      body: "Thread with Jennifer Lawson on Q2 headcount.",
      source: "outlook",
      actorId: james.id,
      personId: jennifer.id,
      organizationId: acme.id,
      createdAt: daysAgo(2),
    },
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "call",
      summary: "12-minute call on Q2 hiring plan",
      source: "viotalk",
      actorId: james.id,
      personId: jennifer.id,
      organizationId: acme.id,
      wrapUp: WrapUpOutcome.next_action,
      createdAt: daysAgo(3),
    },
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "internal_note",
      summary: "Positive feedback on last three Java profiles",
      body: "Jennifer wants two more seniors next week.",
      actorId: sarah.id,
      personId: jennifer.id,
      organizationId: acme.id,
      createdAt: daysAgo(4),
    },
  });

  await prisma.activityEvent.create({
    data: {
      tenantId: northstar.id,
      kind: "internal_note",
      summary: "Keep Jennifer as primary on Acme Q2",
      actorId: james.id,
      personId: jennifer.id,
      organizationId: acme.id,
      createdAt: daysAgo(5),
    },
  });

  await prisma.msaDocument.create({
    data: {
      tenantId: northstar.id,
      organizationId: acme.id,
      number: "MSA-ACME-2025",
      status: "active",
      expiresAt: daysFromNow(20),
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      tenantId: northstar.id,
      organizationId: acme.id,
      number: "PO-8891",
      status: "low",
      ceiling: 250000,
      utilized: 231000,
      expectedExhaustion: daysFromNow(12),
    },
  });

  await prisma.msaDocument.create({
    data: {
      tenantId: northstar.id,
      organizationId: apex.id,
      number: "MSA-APEX-2026",
      status: "active",
      expiresAt: daysFromNow(120),
    },
  });

  await prisma.storedFile.createMany({
    data: [
      {
        tenantId: northstar.id,
        kind: "resume",
        name: "Anil_Reddy_Java.pdf",
        source: "manual",
        personId: anil.id,
      },
      {
        tenantId: northstar.id,
        kind: "other",
        name: "Acme_Hiring_Plan_2025.pdf",
        source: "manual",
        organizationId: acme.id,
        personId: jennifer.id,
      },
      {
        tenantId: northstar.id,
        kind: "other",
        name: "Job_Requirements.pdf",
        source: "manual",
        organizationId: acme.id,
      },
    ],
  });

  await prisma.exceptionItem.createMany({
    data: [
      {
        tenantId: northstar.id,
        kind: ExceptionKind.unmatched_mail,
        title: "Outlook send with no Requirement",
        detail: "Message outlook-unmatched-001 needs review",
        payload: JSON.stringify({ messageId: "outlook-unmatched-001" }),
      },
      {
        tenantId: northstar.id,
        kind: ExceptionKind.duplicate,
        title: "Email/phone collision on JNP pull",
        detail: "Maya Chen email matches an existing row — never auto-merge",
      },
    ],
  });

  await prisma.provenance.create({
    data: {
      tenantId: northstar.id,
      entityType: "person",
      entityId: anil.id,
      field: "skills",
      sourceSystem: "JobsNProfiles",
      externalId: "JNP-104582",
      lastSyncedAt: new Date(),
      syncStatus: "ok",
      updatedBy: "system",
    },
  });

  await prisma.auditEvent.create({
    data: {
      tenantId: northstar.id,
      actorId: kim.id,
      action: "seed",
      entityType: "tenant",
      entityId: northstar.id,
      after: JSON.stringify({ users: 5 }),
    },
  });

  void priyaCandidate;
  void vendorContact;
  void dual;
  void devopsReq;
  void priya;
  void elena;

  console.log("Seeded Northstar + Ghost tenants");
  console.log("Platform users (Admin-Talent-Bridge):");
  console.log("  global_admin  global.admin@talentbridge.example / ChangeMe123!");
  console.log("  manager       manager@talentbridge.example / ChangeMe123!");
  console.log("  support       support@talentbridge.example / ChangeMe123!");
  console.log("Demo users:");
  console.log("  recruiter   sarah.mitchell@northstar.example");
  console.log("  sales       james.dalton@northstar.example");
  console.log("  operations  priya.shah@northstar.example");
  console.log("  leadership  elena.vos@northstar.example");
  console.log("  admin       kim.park@northstar.example");
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
