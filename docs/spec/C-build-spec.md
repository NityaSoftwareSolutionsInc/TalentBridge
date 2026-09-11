# C. Build specification

## C.1 Navigation modules

| Module | Primary users | Opens |
| --- | --- | --- |
| Dashboard | Leadership, operations, sales, recruiting | Today’s Risks / Opportunities first; overdue follow-ups; integration health; MSA/PO watchlist |
| Candidates | Recruiting, operations, leadership | Candidate people. Portal profile context, submissions, VioTalk, Submit Profile against a Client job. |
| Clients | Sales, operations, leadership | Client companies and client people. Sales flow: Lead → Suspect → Prospect → Customer. Jobs, submissions, MSA/PO on this record. |
| Vendors | Sales, recruiting ops, operations | Supplier companies and their people; vendor-sourced candidates; vendor MSA/PO |
| (not a module) Jobs | Not a core module | Work object on the Client (Requirements tab) and the Submit Profile picker. Do not add a fourth core menu. |
| Calendar | All working roles | Meetings, follow-ups, interviews, MSA reviews, PO renewals |
| Tasks | All working roles | Open, due, overdue, assigned — including wrap-up next actions |
| Communications | Sales, recruiting, operations, leadership | Org-wide inbox across VioTalk, WhatsApp, email, meetings |
| MSA & PO | Sales, operations, leadership (view) | Agreements and POs for Clients and Vendors |
| Reports | Leadership, operations, managers | Pipeline, activity, follow-up, call, commercial — click through to live records |
| Settings | Administrator | Users, roles, VioTalk/mailbox maps, JNP sync, retention, audit |

## C.2 Workspace behavior

- Selecting a list card opens the record in the right pane. List filters stay. Core lists are Candidates, Clients and Vendors.
- Tabs on a Candidate: Overview | Skills/Profile | Requirements | Submissions | Interviews | Placements | Communication | Tasks | Notes | Documents | Relationships | Activity. Header: Owner, Last Contact, Next Action, Current Status, Active Requirements, Submissions, Interviews, Source, Last Resume. Client people stay on the Clients module.
- Tabs on a Client company: Overview | Contacts | Requirements | Candidates Submitted | Interviews | Placements | Communication | Tasks | MSA/PO | Vendors | Documents | Reports. Overview shows the intelligence fields in A8.
- Quick Actions: Send Email, VioTalk Call, WhatsApp, Schedule Meeting, Add Note, Add Follow-up, Submit Profile (candidates only), More.
- Submit Profile compose: Requirement + Client contact + resume + message. Send via Outlook. Creates Submission ID. Wrap-up required.
- Do Not Contact disables outbound call / WhatsApp / email; UI explains why.
- Overview relationship intelligence is required on Client and Candidate — not identity fields only. See Client 360 and Candidate 360 lists. Flags come from the SLA/aging engine.

## C.3 Submission object

| Field / link | Rule |
| --- | --- |
| Submission ID | TalentBridge-generated, tenant-scoped |
| Candidate, Requirement, Client, Client contact | Required. Cannot submit “to a company” with no job. |
| Recruiter, BDM | Recruiter = sender/owner; BDM from the Requirement |
| Email message ID, resume version, sent time | Evidence; not a substitute for the object |
| Lifecycle | Submitted → Client Review → Interview → Rejected → Offer → Placement |
| Stage change | Permissioned, audited, written to timeline on candidate + client + requirement |
| Source | Hub send (preferred) or ingested Outlook mail |

## C.4 Requirement object (minimum POC)

| Field | Notes |
| --- | --- |
| Title, skills, location | Searchable |
| Client company, hiring-manager contact | Required |
| Owner (BDM), assigned recruiter(s) | Required for ownership and reporting |
| Status | Open / On hold / Filled / Cancelled |
| Opened date, target fill date | Dashboard ageing |
| Optional portal job ID | If JobsNProfiles later exposes jobs; not required in POC |

## C.5 Roles

| Role | Default landing | Notes |
| --- | --- | --- |
| Recruiting / delivery | Candidates | Submit Profile to a Client job, VioTalk, tasks |
| Sales / BDM | Clients | Create clients/requirements; MSA/PO maintain; stage permission |
| Operations | Dashboard | Queues: follow-up, unmatched calls/mail, sync exceptions, MSA/PO, submission feedback |
| Leadership | Dashboard | Risks/opportunities; read-heavy; no VioTalk seat required |
| Administrator | Settings | Maps, permissions, exceptions, audit. May have no VioTalk seat |

## C.6 Integrations

| System | Owns | TalentBridge does |
| --- | --- | --- |
| JobsNProfiles | Portal profiles | One-way sync in; deep link; exception queue. No submission write-back. |
| VioTalk | Call placement, duration, recording ref, numbers | Click-to-call; upsert by call ID; unmatched-call queue; user↔agent map |
| WhatsApp (later slice) | Company numbers, delivery | Conversation panel on the contact if built. Not used for client submissions. |
| Outlook / Microsoft | Mailbox transport | Send as user from workspace; read sent/inbound; Submission create/update; unmatched queue |
| TalentBridge | Hub objects listed in A.3 | System of record for the operating platform |

## C.7 Event processing

1. Receive event (VioTalk webhook, Graph mail, JNP candidate webhook, user action).
2. Authenticate and tenant-scope.
3. Map durable IDs (portal candidate ID, VioTalk call ID, Outlook message ID, TalentBridge object IDs).
4. Upsert the hub object (Contact, Submission, Activity, Task). Never silent-merge people.
5. Fan out: Communication, Overview, Activity, Tasks, Calendar, search index, Dashboard tiles.
6. On failure: exception queue with retry of safe operations only.

## C.8 Privacy and security (POC, not polish)

1. Tenant isolation on every query (contacts, companies, requirements, submissions, activities, files, insights, search).
2. Candidates, clients and vendors never have logins and never see Notes, recordings, transcripts, email bodies, insights or MSA/PO files.
3. Role permissions: commercial values and download; recording/transcript/AI summary; export; ownership transfer.
4. Search snippets must not leak restricted values.
5. Call recording follows consent and retention. If unapproved, store the reference but do not play in POC.
6. Audit: who viewed/downloaded a recording or MSA/PO, who exported, who changed a role or owner.
7. Do Not Contact disables outbound call/WhatsApp/email.

Leadership review of Communication is an authorized-manager feature inside the tenant, not public monitoring.

## C.9 Minimum entity model

| Entity | Key relationships | Minimum fields |
| --- | --- | --- |
| User / Team | Owns records, tasks, mappings | Identity, role, team, status, VioTalk agent, mailbox |
| Company | Has contacts, requirements, MSA/PO | Name, type Client/Vendor, owner, industry, location |
| Contact | Belongs to company; has activities | Type/stage, identity, channels, owner, source, DNC, status |
| Requirement | Belongs to client; has submissions | Title, hiring manager, BDM, recruiters, status, dates |
| Submission | Candidate + requirement + client + email | Status lifecycle, recruiter, message ID, resume version |
| Activity | Belongs to contact / company / req / submission | Kind, summary, source, external ID, timestamps |
| Task | Belongs to contact/company/requirement | Owner, due, priority, status, source event; used for wrap-up, SLA follow-up, placement check-ins |
| Insight | Links to activity and optional task | Type, confidence, proposed/accepted/dismissed |
| Document / MSA / PO | Belongs to company | Type, versions, dates, ceiling/utilized/available, access class |
| Provenance / external reference | Links any field/object to JNP / VioTalk / Graph / TalentBridge | source_system, external_id, source_timestamp, last_synced_at, sync_status, updated_by, manual_override |
| Audit event | Any sensitive action | Actor, action, entity, before/after, timestamp |
| Title index / taxonomy | Belongs to Candidate; used by search | current_title, previous_titles[], resume_titles[], normalized_title_id, related_title_ids, skills[], last_indexed_at |

## C.10 POC delivery

| Week | Focus |
| --- | --- |
| 1 | API discovery: JNP profile API, VioTalk mapping, Graph send-as-user + mailbox read, minimum Requirement fields, recording policy, commercial permissions |
| 2 | People/companies CRUD, ownership banner, Requirements CRUD, unified timeline shell, wrap-up, Candidate Search & Discovery index (current title, previous titles, resume titles, skills) and POC filters. |
| 3 | Submit Profile send + Outlook ingest, Submission lifecycle, VioTalk click-to-call write-back, JNP one-way sync |
| 4 | Client 360 + Candidate 360 + MSA/PO snapshot, Dashboard risks/opportunities, unmatched queues, Candidate search result context (owner, last contact, prior submissions, exclude already submitted), UAT on the demonstration spine. |

| Item | Owner | Why it blocks build |
| --- | --- | --- |
| JobsNProfiles portal candidate API | Technical + recruiting | One-way profile sync only |
| Microsoft Graph send as user + read sent/inbound | Technical | Hub-first submit and outside-mail capture |
| VioTalk user/number read API | Technical | Mapping should sync, not be retyped |
| Recording consent / retention | Legal + operations | If unapproved, hide playback |
| Who may see amounts, recordings, transfer ownership | Sales + ops + leadership | Field-level matrix |
| Requirement fields for POC | Sales + recruiting | Cannot submit without a job |
| JNP title / skills / work-history fields for search index | Technical + recruiting | C.16 POC filters need current title, previous titles and skills from the one-way profile sync |

## C.11 Acceptance (POC is ready when)

1. A user can search and open Candidates, Clients and Vendors in the three-pane workspace without losing list filters. On Candidates, POC advanced filters work: current title, skills, location, experience, source, owner, availability, last contact, and exclude already submitted to the open requirement. Result cards show owner, last contact and previous submissions.
2. Submit Profile selects a Requirement and client contact, sends through Outlook with no template catalog, and creates a Submission ID on candidate, job and client.
3. An email sent only in Outlook is either linked to a Submission or sits in unmatched review.
4. A VioTalk call writes one activity by call ID; wrap-up requires Next Action, No Action Required, or Closed.
5. A JNP candidate upserts by portal ID; a collision shows the ownership banner and never auto-merges.
6. Client 360 shows requirements, submissions and MSA/PO snapshot; amounts hide without permission.
7. Dashboard Today’s Risks / Opportunities click through to live records.
8. Tenant isolation and RBAC hold on search snippets, recordings and MSA files.
9. The demonstration spine (Figure 16) completes without manual database edits.

## C.12 SLA / aging engine (build now)

Configurable SLA days (defaults below). The Dashboard Today’s Risks tiles are queries over these rules, not a separate reporting product. Defaults: requirement with no submission in 3 days; submission with no client feedback in 5 days; interview with no feedback the next business day; client last-contact > 21 days; promised callback due today; MSA expiry inside 30 days. Admin can change the day counts later without a code change — store them as tenant settings now.

## C.13 Placement continuity (lightweight)

When Placement is created, store Start Date, End Date, Client, Candidate, Owner, Follow-up, Placement Status. Auto-create Tasks: 7-day candidate check-in, 30-day client check-in, 60/90-day relationship follow-up, assignment-end approaching. Redeployment intelligence is P2. This is not timesheets, payroll, or onboarding.

## C.14 Configurable workflows (schema now, UI next)

Do not hard-code stage lists or SLA days. Tenant settings must be able to hold: relationship stages (default Lead → Suspect → Prospect → Customer), submission stages, required fields, SLA days, ownership rules, follow-up rules, role permissions, custom fields, dashboard alert rules. POC ships the defaults. Admin UI for editing them is P1.

## C.15 Candidate Search & Discovery

Candidate discovery is a core recruiter workflow and must be in the architecture now, not an afterthought. Global search (Q12) is the jump-to-record bar. Candidate Search & Discovery is the sourcing surface on the Candidates module (and can be opened from a Requirement as “find candidates for this job”). Index titles and skills during the one-way JobsNProfiles sync so MVP related-title search and later semantic search reuse the same index.

Index, for every candidate: current title; previous titles from work history; titles extracted from the resume/profile text; skills; location; experience; availability; source; owner; last contact; next action; submissions (requirement IDs). Tenant-scoped. Unauthorized roles never see restricted snippets.

When opened from a Requirement, the search is pre-scoped: exclude already submitted is on by default; result actions include Submit Profile to this job. When opened from the Candidates module, the recruiter may optionally pick a requirement to apply that exclusion. Ownership banner still applies if Recruiter B opens a result owned by Recruiter A.

| Level | Depends on | What to build |
| --- | --- | --- |
| POC — Advanced filters (build now) | Exact/contains filters, no taxonomy required yet | Title (current) + Skills + Location + Experience + Source + Owner + Availability + Last Contact. Also search previous titles and titles appearing in the resume/profile as additional title fields. Combined Title + Skills. Exclude candidates already submitted to the open requirement. Result card: name, current title, skills snippet, location, owner, last contact, next action, previous submissions (client + job + stage). Optional simple rank: recency of contact + skill overlap. |
| MVP — Related-title search | Same index + title taxonomy | Normalize titles onto a taxonomy. Query “Java Developer” also returns Java Engineer, Backend Java Developer, Senior Java Developer. “DevOps Engineer” also returns SRE, Platform Engineer, Cloud Engineer. Recruiter can toggle Related titles on/off. Show why it matched (current / previous / resume / related). Match score on the card. |
| Later AI — Semantic search | Same objects, no second stack | Natural language: “Find senior Java developers with Spring Boot, AWS and microservices who are available and haven’t already been submitted to this requirement.” Uses title index, skills, availability, last contact and submission exclusions already stored. Management NL questions stay in C.15 and share this index. |

## C.16 Natural-language search (P2, same objects)

Management NL search is C.16 (P2) on the same objects, for example: clients with open requirements but no submissions; recruiters with overdue follow-ups. Recruiter semantic discovery is specified in C.15 Later AI and must reuse the title/skills/submission index built in POC — do not add a second search stack.
