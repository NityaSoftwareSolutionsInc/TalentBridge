# A. Product

## A.1 Product principle

> **Product principle.** TalentBridge Contact Manager is not another CRM and is not a replacement for JobsNProfiles, Outlook or VioTalk. It is the operational hub that connects them. JobsNProfiles = candidate/profile source. VioTalk = calling/recording/transcript engine. Outlook = email infrastructure. WhatsApp = messaging channel. TalentBridge = relationship + workflow + communication + action + intelligence hub. Later: other systems as connectors where technically and commercially feasible. A recruiter, BDM, operations user or manager should not have to search multiple applications to understand current state. Every important relationship has an owner, context and next action.


TalentBridge connects every candidate, client, vendor, requirement, submission, conversation, commitment and outcome—and makes sure every important relationship has an owner, context and next action.

The differentiation is not “everything is in one place.” It is that every relationship, conversation, commitment and outcome becomes connected data — and that nothing important is left without a next action. That is the industry gap and the product philosophy.

## A.1a Product boundary

JobsNProfiles is the candidate/profile source. VioTalk is the calling/recording/transcript engine. Outlook is email infrastructure. WhatsApp is the messaging channel. TalentBridge is the relationship + workflow + communication + action + intelligence hub. Later connectors attach other systems only where technically and commercially feasible.

## A.1b Priority improvements

P0 ships in the POC. P1 uses the same objects and SLA engine. P2 is intelligence on top — do not block P0 waiting for AI.

| Priority | Improvement | Why it matters |
| --- | --- | --- |
| P0 | Requirement/Job as first-class object | Connects candidate activity to actual business demand |
| P0 | Submission as business object | Enables real submission / interview / placement tracking |
| P0 | Unified communication timeline | Calls + email + WhatsApp + meetings + notes in context |
| P0 | Mandatory next action | Core “nothing falls through the cracks” capability |
| P0 | Candidate/person ownership | Prevents duplicate effort; collaboration/transfer requests |
| P0 | Client 360 + Candidate 360 | Complete relationship picture for BDM, recruiter, ops, management |
| P0 | Outlook integration | Hub-first send + outside-mail capture as connected activity |
| P0 | VioTalk integration | Calls, recordings, transcripts and outcomes become operational data |
| P0 | JobsNProfiles integration | Candidate/profile data without duplicating JNP |
| P0 | SLA / aging engine | Neglected requirements, submissions, interviews, follow-ups, MSA |
| P1 | Relationship intelligence | Last outreach, next action, health, response time |
| P1 | Vendor/supplier intelligence | Quality and performance of third parties |
| P1 | Placement follow-up | Lightweight check-ins after placement — not VMS |
| P1 | Source / data provenance | Where each field came from, sync status, manual override |
| P1 | Configurable workflows + custom fields | Stages, SLA days, ownership and alerts without code changes |
| P1 | Management action intelligence | What needs attention, not just activity totals |
| P2 | AI action intelligence | Extract commitments and recommended actions (Accept / Edit / Dismiss) |
| P2 | Natural-language / semantic search | Operational questions and recruiter queries such as “senior Java with Spring Boot, AWS, available, not submitted to this req” |
| P2 | Advanced relationship scoring | Client / candidate / vendor health scores |
| P2 | Redeployment intelligence | Re-engage placed candidates before assignments end |
| P0 | Candidate Search & Discovery (advanced filters) | Recruiter sourcing: title + skills + location + experience + owner + Last outreach; exclude already submitted; result context |
| P1 | Related-title search + title taxonomy | Java Developer also finds Java Engineer / Backend Java / Senior Java; DevOps → SRE / Platform / Cloud |

## A.2 The gap this fills

Staffing software grew up as specialist products. The recruiter’s day does not stay inside one of them: find a person, read what happened last time, call, submit to a client job, wait for a reply, schedule an interview, protect ownership, watch the PO, and not drop the follow-up.

- The job portal holds public/candidate profiles. It does not hold live conversations or submit a candidate to a client.
- The dialer places the call and stores a recording. The recruiter then re-types a note somewhere else.
- WhatsApp and email sit in a phone or inbox. “Send two DevOps profiles tomorrow” does not become a task on the requirement.
- Without a Job/Requirement object you can know that a resume went to ABC Company, but not for which req, who else was submitted, how fast, whether the client replied, or why it was rejected.

Contact Manager is built for that missing middle: the operating system of the staffing relationship.

## A.3 Core data model

Keep the primary recruiting lifecycle simple: Client → Requirement → Candidate → Submission → Interview → Offer → Placement. Stop there. After Placement store only lightweight fields: Start Date, End Date, Client, Candidate, Owner, Follow-up, Placement Status. Do not create an Engagement Management or VMS module.

| Layer | Objects TalentBridge owns |
| --- | --- |
| PEOPLE | Candidates; Client people; Vendor people; Internal Users |
| COMPANIES | Clients; Vendors |
| WORK | Requirements (Jobs); Submissions; Interviews; Placements |
| COMMUNICATIONS | Calls; Email; WhatsApp; Meetings; Notes; Transcripts |
| ACTION | Tasks; Follow-ups; Reminders; Approvals; Exceptions |
| COMMERCIAL | MSA; PO; Rates; Documents; Expiry |
| INTELLIGENCE | Search; Reports; KPIs; AI Insights; Risks; Opportunities; Audit |

| Connected system | They own | Hub uses them for |
| --- | --- | --- |
| JobsNProfiles | Portal candidate profiles | One-way identity/skills in; never client submissions |
| Outlook / Microsoft | Mailbox send and receive | Compose/send from TalentBridge; also capture mail sent outside |
| VioTalk | Call placement, duration, recording ref, numbers | Click-to-call; one activity event per call ID |

## A.4 POC vs architecture now

| Build in POC | Schema now / intelligence later |
| --- | --- |
| P0 foundations: Requirement object, Submission object, unified timeline, mandatory next action on every channel, ownership banner + collaboration/transfer, Client 360 + Candidate 360, Outlook send+capture, VioTalk, one-way JNP, SLA/aging risks on the Dashboard. Core modules unchanged: Candidates, Clients, Vendors. Jobs on the Client, object ready for a later module. | P1/P2 later on the same objects: relationship scoring, vendor performance league tables, configurable SLA days/stages/custom fields, placement check-in cadence, redeployment intelligence, AI action extraction, natural-language search. |

## A.5 Ground rules

| Rule | Meaning |
| --- | --- |
| Tenant scope | Every record, timeline, search hit, file, requirement, submission and audit event belongs to one tenant. |
| Platform tenancy | Tenants are created by **Global Admin** in the separate **Admin-Talent-Bridge** app (not by tenant Administrator). Global Admin invites the first tenant Admin via SendGrid. A disabled tenant cannot sign in to TalentBridge. |
| Modules | Core modules do not change: Candidates, Clients, Vendors. Also Dashboard, Calendar, Tasks, Communications, MSA & PO, Reports, Settings. Jobs/Requirements are work objects on the Client, not a core module. Sales flow on Client people: Lead → Suspect → Prospect → Customer (not extra menus). |
| Candidate profiles | JobsNProfiles is a job portal. TalentBridge stores the CRM candidate plus work and engagement. |
| Calling | VioTalk. Send person ID + phone + signed-in user; upsert one activity event by call ID. |
| Email | Outlook. Compose/send from TalentBridge; also ingest mail sent outside. No template catalog. |
| Work master | TalentBridge owns Requirements, Submissions, Interviews, Placements, Tasks, MSA/PO and audit. |
| Communication | Internal-only unified timeline. Not visible to candidates, clients or vendors. |
| No finance role | MSA/PO on Clients and Vendors; amounts permissioned; sales/ops maintain; leadership views. |
