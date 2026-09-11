# TalentBridge database schema & ER diagram

Source of truth for the physical model: [`prisma/schema.prisma`](../prisma/schema.prisma).  
PostgreSQL schema name: **`talentbridge`** (created by [`prisma/init.sql`](../prisma/init.sql)).

This document describes the POC tables, enums, and relationships for the Contact Manager hub (Candidates, Clients, Vendors — with Requirements and Submissions as work objects).

---

## 1. Overview ER diagram

Core operational graph: tenant → people/accounts → requirements → submissions → interviews/placements, plus activity/task wrap-up.

```mermaid
erDiagram
  tenants ||--o{ users : has
  tenants ||--o| tenant_settings : has
  tenants ||--o{ accounts : has
  tenants ||--o{ contacts : has
  tenants ||--o{ requirements : has
  tenants ||--o{ submissions : has
  tenants ||--o{ activities : has
  tenants ||--o{ tasks : has

  users ||--o{ memberships : has
  users ||--o{ contacts : owns
  users ||--o{ accounts : owns
  users ||--o{ tasks : owns
  users ||--o{ requirements : "bdm"

  accounts ||--o{ account_roles : has
  accounts ||--o{ account_people : links
  contacts ||--o{ account_people : links
  contacts ||--o{ contact_co_owners : has
  users ||--o{ contact_co_owners : co_owns

  accounts ||--o{ requirements : has
  contacts ||--o{ requirements : "hiring_manager"
  requirements ||--o{ requirement_recruiters : has
  users ||--o{ requirement_recruiters : assigned

  contacts ||--o{ submissions : "candidate"
  contacts ||--o{ submissions : "client_contact"
  requirements ||--o{ submissions : has
  accounts ||--o{ submissions : has

  submissions ||--o{ interviews : has
  submissions ||--o{ placements : has
  requirements ||--o{ interviews : has
  requirements ||--o{ placements : has
  contacts ||--o{ interviews : candidate
  contacts ||--o{ placements : candidate
  accounts ||--o{ interviews : has
  accounts ||--o{ placements : has

  activities ||--o{ tasks : "source_event"
  activities ||--o{ insights : sources
```

---

## 2. Domain ER diagrams

### 2.1 Identity & tenancy

```mermaid
erDiagram
  tenants {
    uuid id PK
    text name
    timestamptz created_at
  }
  tenant_settings {
    uuid id PK
    uuid tenant_id FK
    text[] relationship_stages
    text[] submission_stages
    int sla_requirement_no_sub_days
    int sla_submission_feedback_days
    int sla_interview_feedback_days
    int sla_client_last_contact_days
    int sla_msa_expiry_days
    boolean recording_playback_allowed
  }
  users {
    uuid id PK
    uuid tenant_id FK
    text email
    text name
    text title
    boolean enabled
    text password_hash
    timestamptz created_at
  }
  memberships {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    TbRole role
    text[] permissions
  }

  tenants ||--o| tenant_settings : configures
  tenants ||--o{ users : has
  tenants ||--o{ memberships : has
  users ||--o{ memberships : has
```

### 2.2 Accounts (clients / vendors) & contacts

```mermaid
erDiagram
  accounts {
    uuid id PK
    uuid tenant_id FK
    text name
    text industry
    text location
    text status
    uuid owner_id FK
    timestamptz last_contact_at
    timestamptz created_at
  }
  account_roles {
    uuid id PK
    uuid account_id FK
    AccountRoleKind role
  }
  contacts {
    uuid id PK
    uuid tenant_id FK
    ContactKind kind
    text stage
    text status
    text name
    text email
    text phone
    uuid owner_id FK
    text next_action
    timestamptz next_action_due_at
    text portal_candidate_id
    timestamptz created_at
  }
  contact_co_owners {
    uuid id PK
    uuid contact_id FK
    uuid user_id FK
  }
  account_people {
    uuid id PK
    uuid account_id FK
    uuid contact_id FK
    text role_on_account
  }
  ownership_requests {
    uuid id PK
    uuid tenant_id FK
    uuid contact_id FK
    uuid requester_id FK
    uuid target_owner_id FK
    OwnershipRequestType type
    OwnershipRequestStatus status
  }
  title_indexes {
    uuid id PK
    uuid tenant_id FK
    uuid contact_id FK
    text current_title
    text[] previous_titles
    text[] skills
  }

  accounts ||--o{ account_roles : "client|vendor"
  accounts ||--o{ account_people : people
  contacts ||--o{ account_people : accounts
  contacts ||--o{ contact_co_owners : co_owners
  contacts ||--o| title_indexes : indexed
  contacts ||--o{ ownership_requests : ownership
```

`Contact.kind`: `candidate` | `client_person` | `vendor_person`  
`AccountRole.role`: `client` | `vendor` (same account can hold both roles)

### 2.3 Requirements, submissions, interviews, placements

```mermaid
erDiagram
  requirements {
    uuid id PK
    uuid tenant_id FK
    uuid account_id FK
    text title
    text[] skills
    uuid hiring_manager_id FK
    uuid bdm_id FK
    RequirementStatus status
    timestamptz opened_at
    text portal_job_id
  }
  requirement_recruiters {
    uuid id PK
    uuid requirement_id FK
    uuid user_id FK
  }
  submissions {
    uuid id PK
    uuid tenant_id FK
    uuid candidate_id FK
    uuid requirement_id FK
    uuid account_id FK
    uuid client_contact_id FK
    uuid recruiter_id
    uuid bdm_id
    text stage
    text email_message_id
    boolean vendor_sourced
    timestamptz sent_at
  }
  interviews {
    uuid id PK
    uuid tenant_id FK
    uuid candidate_id FK
    uuid account_id FK
    uuid requirement_id FK
    uuid submission_id FK
    timestamptz scheduled_at
    text outcome
  }
  placements {
    uuid id PK
    uuid tenant_id FK
    uuid candidate_id FK
    uuid account_id FK
    uuid requirement_id FK
    uuid submission_id FK
    uuid owner_id
    date start_date
    text status
  }

  accounts ||--o{ requirements : owns
  requirements ||--o{ requirement_recruiters : assigned
  requirements ||--o{ submissions : receives
  contacts ||--o{ submissions : "as candidate"
  contacts ||--o{ submissions : "as client contact"
  submissions ||--o{ interviews : advances
  submissions ||--o{ placements : results_in
```

Product rule: **Submissions are TalentBridge work objects** (not emails, not JobsNProfiles ATS records). Requirements live on the Client account — not a fourth left-nav module in POC.

### 2.4 Activity, tasks, insights (next action)

```mermaid
erDiagram
  activities {
    uuid id PK
    uuid tenant_id FK
    text kind
    text summary
    text source
    uuid actor_id FK
    uuid contact_id FK
    uuid account_id FK
    uuid requirement_id FK
    uuid submission_id FK
    WrapUpOutcome wrap_up
    text recording_ref
    text transcript_ref
    text ai_summary
    timestamptz created_at
  }
  tasks {
    uuid id PK
    uuid tenant_id FK
    text title
    text status
    text priority
    timestamptz due_at
    uuid owner_id FK
    uuid contact_id FK
    uuid account_id FK
    uuid requirement_id FK
    uuid submission_id FK
    uuid source_event_id FK
  }
  insights {
    uuid id PK
    uuid tenant_id FK
    text type
    uuid source_event_id FK
    uuid suggested_task_id
    float confidence
    InsightStatus status
    text payload
  }

  activities ||--o{ tasks : causes
  activities ||--o{ insights : proposes
```

`WrapUpOutcome`: `next_action` | `no_action_required` | `closed` — every important touch should land in one of these.

### 2.5 Documents, commercial, integrations, audit

```mermaid
erDiagram
  documents {
    uuid id PK
    uuid tenant_id FK
    text kind
    text name
    int version
    uuid account_id FK
    uuid contact_id FK
  }
  msa_documents {
    uuid id PK
    uuid tenant_id FK
    uuid account_id FK
    text number
    text status
    timestamptz expires_at
  }
  purchase_orders {
    uuid id PK
    uuid tenant_id FK
    uuid account_id FK
    text number
    text status
    decimal ceiling
    decimal utilized
  }
  provenance {
    uuid id PK
    uuid tenant_id FK
    text entity_type
    text entity_id
    text field
    text source_system
    text external_id
    boolean manual_override
  }
  audit_events {
    uuid id PK
    uuid tenant_id FK
    text actor_id
    text action
    text entity_type
    text entity_id
    timestamptz created_at
  }
  exception_items {
    uuid id PK
    uuid tenant_id FK
    ExceptionKind kind
    text title
    text status
  }
  viotalk_agent_maps {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    text viotalk_user_id
    text assigned_number
  }
  mailbox_maps {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    text mailbox
  }

  accounts ||--o{ msa_documents : has
  accounts ||--o{ purchase_orders : has
  accounts ||--o{ documents : has
  contacts ||--o{ documents : has
  users ||--o| viotalk_agent_maps : maps
  users ||--o| mailbox_maps : maps
```

---

## 3. Table catalog

All tables live in schema `talentbridge`. IDs are UUIDs unless noted.

| Table | Purpose |
|-------|---------|
| `tenants` | Workspace / org root |
| `tenant_settings` | Stages + SLA defaults per tenant |
| `users` | People who log into the hub |
| `memberships` | Role (`TbRole`) + permissions per user |
| `accounts` | Client / vendor company records |
| `account_roles` | `client` and/or `vendor` on an account |
| `contacts` | Candidates, client people, vendor people |
| `contact_co_owners` | Collaboration owners on a contact |
| `account_people` | Contact ↔ account link + role on account |
| `requirements` | Jobs / reqs on a client account |
| `requirement_recruiters` | Recruiters assigned to a req |
| `submissions` | Hub submission work object |
| `interviews` | Interview events on a submission/req |
| `placements` | Placement continuity after hire |
| `activities` | Unified timeline events (mail, call, note, …) |
| `tasks` | Next actions / follow-ups |
| `insights` | AI-proposed actions (accept / dismiss) |
| `documents` | Generic docs on account or contact |
| `msa_documents` | MSA tracking on account |
| `purchase_orders` | PO ceiling / utilization |
| `provenance` | Field-level source system lineage |
| `audit_events` | Mutable-action audit trail |
| `title_indexes` | Candidate title / skills search index |
| `ownership_requests` | Collaboration or transfer requests |
| `exception_items` | Unmatched mail/call, duplicates, sync failures |
| `viotalk_agent_maps` | User ↔ VioTalk agent / number |
| `mailbox_maps` | User ↔ Outlook mailbox |
| `external_entity_links` | Stable external system ids (e.g. JobsNProfiles candidate) |

---

## 4. Enums

| Enum | Values |
|------|--------|
| `TbRole` | `recruiter`, `sales`, `operations`, `leadership`, `admin` |
| `ContactKind` | `candidate`, `client_person`, `vendor_person` |
| `AccountRoleKind` | `client`, `vendor` |
| `RequirementStatus` | `open`, `on_hold`, `filled`, `cancelled` |
| `WrapUpOutcome` | `next_action`, `no_action_required`, `closed` |
| `OwnershipRequestType` | `collaboration`, `transfer` |
| `OwnershipRequestStatus` | `pending`, `accepted`, `dismissed` |
| `ExceptionKind` | `unmatched_mail`, `unmatched_call`, `duplicate`, `failed_sync` |
| `InsightStatus` | `proposed`, `accepted`, `dismissed` |

Configurable stage lists (relationship / submission) live as string arrays on `tenant_settings`, not as Postgres enums.

---

## 5. Key relationships (quick reference)

| From | To | Cardinality | Notes |
|------|----|-------------|-------|
| `Tenant` | almost everything | 1 → N | Soft multi-tenant root |
| `User` | `Contact` / `Account` | 1 → N | Ownership |
| `Account` | `Requirement` | 1 → N | Jobs on the client |
| `Requirement` | `Submission` | 1 → N | Hub work objects |
| `Contact` (candidate) | `Submission` | 1 → N | Who was submitted |
| `Contact` (client person) | `Submission` | 1 → N | Who received it |
| `Submission` | `Interview` / `Placement` | 1 → N | Optional FK |
| `Activity` | `Task` / `Insight` | 1 → N | Wrap-up → next action |
| `User` | `VioTalkAgentMap` / `MailboxMap` | 1 → 0..1 | Channel identity maps |

External systems are **not** cloned into this schema:

- **JobsNProfiles** → inbound candidate/job ids (`portal_candidate_id`, `portal_job_id`); never write client submissions back
- **Outlook** → `mailbox_maps` + activity/email refs
- **VioTalk** → `viotalk_agent_maps` + recording/transcript refs on `activities`

---

## 6. Indexes & uniqueness (from Prisma)

| Constraint | Columns |
|------------|---------|
| Unique | `users (tenant_id, email)` |
| Unique | `memberships (tenant_id, user_id)` |
| Unique | `account_roles (account_id, role)` |
| Unique | `contact_co_owners (contact_id, user_id)` |
| Unique | `account_people (account_id, contact_id)` |
| Unique | `requirement_recruiters (requirement_id, user_id)` |
| Unique | `contacts.portal_candidate_id` |
| Unique | `title_indexes.contact_id` |
| Unique | `viotalk_agent_maps.user_id`, `mailbox_maps.user_id` |
| Unique | `tenant_settings.tenant_id` |
| Index | `contacts (tenant_id, kind)` |
| Index | `requirements (tenant_id, status)` |
| Index | `submissions (tenant_id, stage)` |
| Index | `activities (tenant_id, created_at)` |
| Index | `tasks (tenant_id, status, due_at)` |
| Index | `provenance (tenant_id, entity_type, entity_id)` |
| Index | `audit_events (tenant_id, created_at)` |

---

## 7. How to keep this doc in sync

1. Change models in `prisma/schema.prisma`
2. Run migrations as usual
3. Update this file’s diagrams / catalog when tables, enums, or FKs change

Render Mermaid in GitHub, VS Code Markdown preview, or [mermaid.live](https://mermaid.live).

---

## 8. Adoption from contact-design reference

Selective ideas from [`talentbridge_contact_management_database_design.md`](talentbridge_contact_management_database_design.md).  
**Do not** adopt that doc’s boundary that pushes Requirements/Submissions/Interviews/Placements to JobsNProfiles.

### Soon (in schema / product now)

| Item | Status |
|------|--------|
| Channel DNC (`do_not_email`, `do_not_sms` + master `do_not_contact`) | Done on `contacts` |
| Normalized match fields (`email_normalized`, `phone_normalized`) | Done on `contacts` |
| JNP match cascade: portal ID → normalized email → normalized phone → human confirm; never auto-merge | Done in `syncJnp` |
| `external_entity_links` for stable cross-system IDs | Done (`ExternalEntityLink`) |
| Resume as resource/label only — not file content or public URL | Product rule (`last_resume` comment) |
| Hub stays up when JNP is down; collisions → `exception_items` | Existing product rule |
| Internal `users` are not CRM `contacts` | Keep |

### Later (P1+)

| Item | Notes |
|------|--------|
| Multiple `contact_methods` | When one email/phone is not enough |
| Time-bound affiliations (employment / vendor / C2C) | Enrich `account_people`; never use client affiliation as submission |
| Client tier / health / strategic flags | On `accounts` for relationship intelligence |
| Preferred contact method/time, influence level | Client-person relationship fields |
| Typed call detail extension | Keep `activities` as timeline; optional detail when VioTalk needs more |
| Tags | Discovery aid, not P0 |

### Never (for this product)

- Moving Requirements / Submissions / Interviews / Placements out of TalentBridge
- Replacing wrap-up `activities` + `tasks` with a CRM-only communications stack
- Rewriting to `people` + many profile tables for POC