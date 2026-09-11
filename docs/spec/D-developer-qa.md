# D. Developer questions and answers

This part answers Talent Bridge App Quetions.docx. Architecture decisions A1–A11 were not on that list; they are product decisions and are in scope. Original wording is kept in the question titles.

> **Send this to development.** TalentBridge connects every candidate, client, vendor, requirement, submission, conversation, commitment and outcome—and makes sure every important relationship has an owner, context and next action. Core modules: Candidates, Clients, Vendors. Jobs on the Client (module-ready later). Submissions are work objects. Outlook is email infrastructure. VioTalk is the calling engine. JobsNProfiles is the profile source. Do not build a template catalog or a JNP submit API.


## D.1 Architecture decisions the original list did not ask

## A1. Requirements / Jobs are a first-class object

> **Decision.** Yes as a first-class work object. Not a core left-nav module in POC (core modules stay Candidates, Clients, Vendors). Architect so Requirements can become a module later (My Requirements, Aging, No Submissions, …) without a schema rewrite.


**Build:**

Create Requirement with tenant, client, hiring-manager contact, title, skills, location, owner (BDM), assigned recruiter(s), status, dates, optional portal job ID. Not a core left-nav module in POC — core modules stay Candidates, Clients, Vendors. Open jobs from the Client (Requirements tab) and from Submit Profile. Architect the object and filters so a later module can offer My Requirements | All | New | Priority | Aging | No Submissions | Interviews | Filled | Closed. Do not store “submitted to ABC Company” with no job.

## A2. Submission is a business object, not an email event

> **Decision.** Outlook (or any channel) creates or updates a Submission record. The email is evidence. The Submission is the work object with a lifecycle.


**Build:**

Submission ID linked to Candidate + Requirement + Client + Client Contact + Recruiter + BDM + Email message ID + Resume version + Date/Time. Lifecycle: Submitted → Client Review → Interview → Rejected → Offer → Placement. Stage changes are permissioned, audited, and written to the unified timeline.

## A3. Outlook is hub-first send, plus outside-workflow capture

> **Decision.** Recruiter composes and sends from TalentBridge through the signed-in user’s Outlook account. Mail still travels on Microsoft infrastructure. Mail sent only in Outlook is still detected and associated.


**Build:**

Hub path: Candidate → Submit Profile → Select Requirement → Select Client Contact → Attach Resume → Send. Parallel path: Graph watch on sent and inbound; unmatched → review queue. No TalentBridge template catalog.

## A4. Communication is a unified timeline that understands outcomes

> **Decision.** One tenant-scoped timeline per person and per company, plus per requirement and per submission. Store what was said and what it caused.


**Build:**

Every call, WhatsApp, email, meeting, note, task, submission-stage change and insight is an event with tenant_id and object links. POC: render the timeline; attach VioTalk summary when permitted; create the suggested task from wrap-up. Later: detect “please schedule interview” from email into an insight event.

## A5. Relationship intelligence

> **Decision.** Compute and display operational facts from connected data. POC uses rules; later can score.


**Build:**

On Overview: Last Contact, Next Action, Owner, submission/interview/placement history, open requirements, communication frequency. POC flags: no contact in 21 days on an open client; candidate with three conversations and no next action.

## A6. Nothing falls through the cracks

> **Decision.** Product philosophy: nothing falls through the cracks. Every meaningful Call, Email, WhatsApp, Meeting, Interview and waiting Submission resolves to Next Action, No Action Required, or Closed.


**Build:**

This is the product heartbeat, not a call-only checkbox. Call, email, WhatsApp, meeting, interview and “submission waiting for feedback” all resolve to Next Action, No Action Required, or Closed. Next Action creates a Task (due date, owner, linked contact + requirement). SLA/aging watches anything left without a next action. VioTalk proposed follow-up pre-fills; later AI extraction uses the same Task object.

## A7. Candidate (and contact) ownership / relationship protection

> **Decision.** On match, show the existing relationship immediately, with Request Collaboration and Request Transfer. Never auto-merge.


**Build:**

Show Existing Relationship: Owner, Last Contact, Active Requirement, recent activity count, plus Request Collaboration and Request Transfer. Defaults: one primary owner; optional co-owners; team visibility by role; transfer and collaboration are permissioned requests. Duplicate review queue remains. Never auto-merge.

## A8. Client 360 workspace

> **Decision.** Opening a Client shows the whole relationship.


**Build:**

Tabs: Overview | Contacts | Requirements | Candidates Submitted | Interviews | Placements | Communication | Tasks | MSA/PO | Vendors | Documents | Reports. Overview intelligence: Relationship Owner, Last Contact, Next Action, Open Requirements, Submissions, Interviews, Placements, Average Client Response Time, Requirement Aging, Relationship Health, MSA Status, PO Risk, Recent Commitments. Unauthorized roles see that a PO exists, not amounts.

## A9. Vendor is not another company type with a different label

> **Decision.** Vendor has its own workspace and work objects.


**Build:**

Track Vendor → Contacts → Candidates → Submissions → Agreements → Rates → Compliance. POC: distinct major module, vendor MSA/PO, vendor-sourced candidate flag, submissions attributed to the vendor. Later intelligence: candidates provided/submitted, interview ratio, placement ratio, duplicate-candidate %, average response time, MSA status, rate competitiveness.

## A10. Management reporting is action intelligence

> **Decision.** Dashboard answers “what should the team do next?” not only “what did they do?”


**Build:**

Lead with Today’s Risks and Today’s Opportunities driven by an SLA/aging engine (configurable days). Examples: requirement open 3 days with no submissions; candidate submitted 5 days ago with no client feedback; interview completed yesterday with feedback pending; client not contacted in 21 days; callback promised today; MSA expires in 30 days. KPIs stay as a second block. Every tile click-throughs to the live queue.

## A11. AI is designed into the data architecture now

> **Decision.** AI is not a transcript-summary button. Events, transcripts, email references and suggested actions are first-class.


**Build:**

AI should recommend actions, not only summarize. Schema now: insight events (type, source_event_id, object links, suggested_task_id, confidence, status proposed/accepted/dismissed). Example: transcript “Send me two Java profiles tomorrow” → Suggested Action: Submit 2 Java candidates, Client ABC, Requirement Java Developer, Due tomorrow, Owner Recruiter X — Accept | Edit | Dismiss. POC uses VioTalk summary + proposed follow-up. Later on the same objects: extraction, matching, intent, NL search.

## D.2 Recruiter

Agreed from the questions file: recruiter lands on Candidates, fetches candidate data from JobsNProfiles, and can add the person to VioTalk so calling is tracked on that contact.

## Q1. If submission is done from TalentBridge, should it reflect in JobsNProfiles when the candidate came from the JNP database?

> **Decision.** No. Client submissions are TalentBridge work objects. They do not write back to JobsNProfiles. JobsNProfiles remains a job portal, not the submission database.


**Build:**

Hub-first: Candidate → Submit Profile → Select Requirement → Select Client Contact → Attach Resume → Send through the user’s Outlook. That send creates Submission ID on the timeline of candidate, client and requirement. Also ingest matching mail composed only in Outlook. Unmatched mail → review queue. Do not write submissions into JobsNProfiles.

## Q2. Approved templates — where do they come from if we send from TalentBridge?

> **Decision.** No TalentBridge template catalog. The recruiter writes the message in TalentBridge; send uses Outlook. Templates are not required for submissions.


**Build:**

Do not build a template picker or template-approval workflow. Compose is free-text plus attachments. Matching of outside-Outlook mail is by recipients, sender, attachments and message ID — not by a template. WhatsApp first-touch templates remain a later-channel topic.

## Q3. Will contact history be tracked based on tenant?

> **Decision.** Yes. History is per contact (and per company, requirement and submission), inside the signed-in tenant only.


**Build:**

Every activity is stored with tenant_id plus the relevant object IDs. Search, Communication, Calendar and Reports never return another tenant’s data. Sharing inside the tenant is by role permission and ownership rules (A7).

Recruiter integrations (POC): JobsNProfiles (one-way portal profile sync), Outlook (send from workspace + read/ingest), VioTalk.

## D.3 Sales

## Q4. Where do we get client data — only Create or Import, or fetch from another system?

> **Decision.** POC: Create in TalentBridge, or CSV/spreadsheet import. Do not fetch clients from JobsNProfiles. JobsNProfiles is not the client master.


**Build:**

Clients and Vendors are created in TalentBridge or imported (map columns, preview, commit). Requirements are created against a Client. No required client API in POC.

## Q5. Who marks stage Lead / Suspect / Prospect / Customer — only self, all recruiters, or all tenant users?

> **Decision.** Not all recruiters. Stage change is a permission, defaulted to the record owner and to Sales/BDM, Operations and Administrator roles that have “change relationship stage”. Flow is Lead → Suspect → Prospect → Customer.


**Build:**

Store stage on the person (and company status separately) using Lead → Suspect → Prospect → Customer. Converting stage does not create a new person and does not wipe Communication. Recruiter/delivery does not convert Customer unless granted that permission. Log every stage change on Activity. Do Not Contact blocks outbound Quick Actions. Requirement and Submission status changes are separate permissions.

## Q6. If we create a Contact in TalentBridge, do we need to sync it to JobsNProfiles?

> **Decision.** No. Do not sync TalentBridge contacts into JobsNProfiles. Client/vendor/suspect people stay in TalentBridge only. Candidates may be pulled from the portal into TalentBridge (one-way).


**Build:**

POC sync: JobsNProfiles portal profile created/updated → upsert TalentBridge Contact type=Candidate keyed by portal candidate ID. Email/phone collisions go to duplicate review with the ownership banner — do not auto-merge.

## Q7. Need clarification on Master Service Agreement and Purchase Order.

> **Decision.** MSA/PO are TalentBridge commercial records on a Client or a Vendor.


**Build:**

Metadata (number, dates, status, owner), encrypted file versions, PO ceiling / utilized / available, expiry and low-balance tasks, expected exhaustion when known. Sales and operations maintain. Leadership can view. Unauthorized roles see that an agreement exists, not amounts. Every download is audited.

## Q8. Where do we handle history? Can we link it with JobsNProfiles?

> **Decision.** Handle history in TalentBridge Communication / Activity (unified timeline). Link to JobsNProfiles by candidate ID only. Do not copy the TalentBridge timeline into JobsNProfiles.


**Build:**

Show JNP candidate ID and a deep link on candidate Contacts. Submissions, interviews and placements appear on the TalentBridge timeline with requirement_id. Managers review them here, not on the job portal.

## D.4 Operations

Agreed: landing is Dashboard. Main work includes expiry and exceptions of tenant MSA/POs created by sales/recruitment — not JobsNProfiles MSAs — plus unmatched calls, sync exceptions and submissions awaiting feedback.

## Q9. What kind of MSA/PO must Operations handle? Tenant MSA/PO created by Sales/Recruitment?

> **Decision.** Tenant Client and Vendor MSA/POs created and stored in TalentBridge by sales and operations.


**Build:**

Queue: pending review, expiring inside the notice window, low remaining PO value, exhausted PO, expected exhaustion. Click-through opens the Client or Vendor 360 on MSA/PO. There is no JNP document store to sync for POC.

## Q10. Do Operations users need Candidate, Clients and Vendor modules?

> **Decision.** Yes. Dashboard is the landing page. Click-through must open the same workspace on a Candidate, Client or Vendor. Hide Settings and hide MSA amounts if the role lacks commercial permission — do not hide the core modules that exceptions point to.


**Build:**

Operations role: Dashboard, Tasks, Calendar, Communications, Candidates, Clients, Vendors, MSA & PO (as permitted), Reports. They do not need Submit Candidate. They do need to complete tasks, link unmatched calls, open duplicate review, and work submission-feedback and PO-risk queues.

## D.5 Leadership

No open product question on the original list. Track internal team activity and, more importantly, what needs attention. Leadership is read-heavy: Dashboard (action intelligence first), Reports, Communication as review surface, Calendar. Drill into a live record. Do not re-key.

- Today’s Risks and Today’s Opportunities are the first Dashboard blocks. Activity KPIs are the second block.
- Overdue actions appear for both Operations (work the queue) and Leadership (see risk). Same objects, different job.
- Audit is view/search of audit events, not a second Communications tab. Recording and MSA/PO download remain permissioned.

No requirement that a leadership user has a VioTalk calling number.

## D.6 Administrator

## Q11. If TalentBridge users must already have VioTalk accounts, why map caller numbers and WhatsApp numbers in TalentBridge Settings? Isn’t that VioTalk Admin?

> **Decision.** Not every TalentBridge role needs a VioTalk account. Number inventory stays in VioTalk. TalentBridge only stores which TalentBridge user is which VioTalk agent / assigned number so click-to-call and WhatsApp send as the right person.


**Build:**

Do not rebuild VioTalk’s number admin. Map TalentBridge user_id → VioTalk user/agent ID and assigned caller number (and WhatsApp company number if exposed). Prefer read/sync from VioTalk. Users with no mapping cannot use VioTalk Call or WhatsApp; the UI states why. Also map the mailbox used for Outlook send. Credentials stay in the secrets vault.

Administrator also: users and roles; module/field permissions; ownership transfer; JobsNProfiles sync; Outlook/Graph consent; exception queues (unmatched calls, unmatched emails, failed syncs, duplicates); audit search.

## D.7 Shared: Tasks, Calendar, Communications, Search, VioTalk

Yes — Tasks, Calendar, Communications and global search are available to every signed-in role, with field-level permissions on snippets and recordings.

## Q12. Global search list: candidates / clients / contacts / company / conversations — confirm?

> **Decision.** Yes, grouped results matching the core modules: Candidates, Clients, Vendors, plus Conversations and Documents.


**Build:**

Global search groups, omit empty: Candidates, Clients, Vendors, Conversations, Documents. Conversation hits land on the Communication tab at that event. Jobs/submissions open on the Client or Candidate. Candidate sourcing is not only global search — the Candidates module has Candidate Search & Discovery (C.15): POC filters on title + skills + location + experience + source + owner + availability + last contact, with exclude-already-submitted and relationship context on each result. Related-title search is MVP. Semantic queries are later AI. Strip PO amounts, recordings and internal-note bodies from snippets for unauthorized roles.

VioTalk workflow as restated by development is correct: send contact ID + phone + signed-in user; call on assigned number; profile stays visible; disposition required; recording / transcript / AI summary / proposed follow-up; one card keyed by VioTalk call ID. Wrap-up still requires Next Action | No Action Required | Closed. Communications in the sidebar is the org-wide inbox; the same card pattern appears on the contact Communication tab.

Call card example: VioTalk call – 12 minutes. September 6, 2026, 2:32 PM. Called by Sarah Mitchell. Outcome: Interested – follow-up required. Recording | Transcript | AI Summary | Create Task.

## D.8 Privacy — “Communication as system of record may lead to privacy issues?”

> **Decision.** Treat this as an internal, tenant-scoped system with role permissions. It is not a privacy hole if those controls are real. It is a privacy hole if recordings, notes, email bodies, insights or MSA values leak across tenants, to candidates/clients, or to roles that should not see them.


Build the controls in section C.8 in POC. They are not optional polish.

## Recommended next step

> **Build order.** Implement tenant isolation and RBAC first. Then Candidates, Clients, Vendors, jobs-on-client, unified timeline and wrap-up. Then Outlook send + ingest and the Submission object. Then VioTalk write-back and JNP one-way sync. Then Client 360 / MSA/PO and Dashboard risks. Do not add a fourth core module. Do not start a JobsNProfiles client or submission API.

