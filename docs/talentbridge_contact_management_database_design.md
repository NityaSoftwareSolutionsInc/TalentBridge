# TalentBridge Contact Management Database Design

> **Status vs product.** This is a **normalization reference**, not the live TalentBridge schema.
> Source of truth for the hub: [`prisma/schema.prisma`](../prisma/schema.prisma) and [`schema-er-diagram.md`](schema-er-diagram.md).
> TalentBridge **owns** Requirements, Submissions, Interviews, Placements, Tasks, MSA/PO — JobsNProfiles is one-way profiles only.
> Adopted ideas (channel DNC, normalized match fields, external entity links) are tracked in [schema-er-diagram.md §8](schema-er-diagram.md#8-adoption-from-contact-design-reference).

## Purpose

This document defines a normalized, low-redundancy database design for a contact-management portal used by a recruitment firm.

The portal manages:

- Candidate contacts
- Client contacts
- Vendor contacts
- Companies / organizations
- Calls
- Call transcripts
- Emails
- Meetings
- Calendar events
- Notes
- Tasks
- Files
- Tags
- Activity history
- Internal users
- Integration references to jobsnprofiles.com

This portal is intentionally **not** the authoritative system for jobs, resumes, submissions, interviews, placements, or recruiting pipeline data. Those remain in **jobsnprofiles.com**.

The central design principle is:

> Store each person and organization once, then represent their roles, affiliations, communications, and CRM-specific attributes through normalized related tables.

---

# 1. Core Architecture

```text
PERSON
  ├── CONTACT METHODS
  ├── CONTACT ROLES
  ├── ORGANIZATION AFFILIATIONS
  ├── CANDIDATE PROFILE         optional
  ├── CLIENT CONTACT PROFILE    optional
  └── VENDOR CONTACT PROFILE    optional

ORGANIZATION
  ├── ORGANIZATION ROLES
  ├── CLIENT PROFILE            optional
  └── VENDOR PROFILE            optional

PERSON / ORGANIZATION
  ├── COMMUNICATIONS
  ├── NOTES
  ├── TASKS
  ├── CALENDAR EVENTS
  ├── FILES
  ├── TAGS
  └── ACTIVITY HISTORY
```

Do **not** create separate candidate/client/vendor person tables containing duplicate name, email, phone, address, and profile fields.

---

# 2. people

Every human being exists once.

```sql
CREATE TABLE people (
    id                  BIGINT PRIMARY KEY,

    first_name          VARCHAR(100) NOT NULL,
    middle_name         VARCHAR(100),
    last_name           VARCHAR(100),
    preferred_name      VARCHAR(100),

    timezone            VARCHAR(60),
    linkedin_url        VARCHAR(500),

    status              VARCHAR(30) NOT NULL DEFAULT 'active',

    source              VARCHAR(100),
    owner_user_id       BIGINT,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

Do not place these directly in `people`:

```text
company_id
candidate_status
vendor_type
client_relationship
email
phone
skills
desired_rate
```

Those belong in specialized tables.

---

# 3. contact_methods

A person can have multiple email addresses, phone numbers, or other contact channels.

```sql
CREATE TABLE contact_methods (
    id                  BIGINT PRIMARY KEY,
    person_id           BIGINT NOT NULL,

    method_type         VARCHAR(20) NOT NULL,
    -- email, phone, sms, linkedin, other

    label               VARCHAR(50),
    -- work, personal, mobile, office

    value               VARCHAR(500) NOT NULL,
    normalized_value    VARCHAR(500),

    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    allow_contact       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id) REFERENCES people(id)
);
```

Example:

```text
Alex Carter
 ├─ alex@gmail.com            Personal / Email
 ├─ +1 415 555 0189           Mobile / Phone
 └─ linkedin.com/in/alex      LinkedIn
```

---

# 4. organizations

Every company exists once.

This includes:

- Client companies
- Vendor companies
- Your own staffing company
- Candidate-owned corporations
- Payroll companies

```sql
CREATE TABLE organizations (
    id                  BIGINT PRIMARY KEY,

    name                VARCHAR(250) NOT NULL,
    legal_name          VARCHAR(250),

    website             VARCHAR(500),
    domain              VARCHAR(250),

    main_phone          VARCHAR(50),

    industry            VARCHAR(150),
    employee_count      INTEGER,

    status              VARCHAR(30) NOT NULL DEFAULT 'active',

    owner_user_id       BIGINT,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

Avoid duplicate organization tables such as:

```text
clients
vendors
candidate_companies
```

when those tables would repeat the same company identity fields.

---

# 5. organization_roles

A company may be a client, vendor, internal company, payroll partner, or more than one.

```sql
CREATE TABLE organization_roles (
    id                  BIGINT PRIMARY KEY,
    organization_id     BIGINT NOT NULL,

    role_type           VARCHAR(30) NOT NULL,
    -- client
    -- vendor
    -- internal
    -- payroll_partner
    -- other

    status              VARCHAR(30) NOT NULL DEFAULT 'active',

    start_date          DATE,
    end_date            DATE,

    created_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (organization_id)
        REFERENCES organizations(id),

    UNIQUE (organization_id, role_type)
);
```

Example:

```text
Acme Technologies
    CLIENT

TechStaff Solutions
    VENDOR

TalentBridge
    INTERNAL

ABC Consulting
    CLIENT
    VENDOR
```

---

# 6. contact_roles

This describes why a person exists in the CRM.

```sql
CREATE TABLE contact_roles (
    id          SMALLINT PRIMARY KEY,
    code        VARCHAR(40) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL
);
```

Suggested values:

```text
CANDIDATE
CLIENT_CONTACT
VENDOR_CONTACT
OTHER
```

Relationship table:

```sql
CREATE TABLE person_contact_roles (
    id                  BIGINT PRIMARY KEY,

    person_id           BIGINT NOT NULL,
    contact_role_id     SMALLINT NOT NULL,

    status              VARCHAR(30) NOT NULL DEFAULT 'active',

    start_date          DATE,
    end_date            DATE,

    created_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id)
        REFERENCES people(id),

    FOREIGN KEY (contact_role_id)
        REFERENCES contact_roles(id),

    UNIQUE (person_id, contact_role_id)
);
```

A person can evolve or hold more than one role without duplicating their identity.

---

# 7. person_organization_affiliations

This is one of the most important tables.

It answers:

> Who does this person actually belong to or represent?

```sql
CREATE TABLE person_organization_affiliations (
    id                  BIGINT PRIMARY KEY,

    person_id           BIGINT NOT NULL,
    organization_id     BIGINT NOT NULL,

    affiliation_type    VARCHAR(40) NOT NULL,

    /*
      employee
      internal_employee
      vendor_employee
      vendor_subcontractor
      owner
      payroll_employee
      contractor
      other
    */

    employment_type     VARCHAR(20),

    /*
      W2
      C2C
      1099
      OTHER
    */

    title               VARCHAR(150),
    department          VARCHAR(150),

    start_date          DATE,
    end_date            DATE,

    is_current          BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,

    notes               TEXT,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id)
        REFERENCES people(id),

    FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
);
```

Candidate scenarios:

```text
Independent candidate
    Candidate role
    No organization affiliation

Own W-2
    Candidate role
    TalentBridge
    internal_employee
    W2

Vendor W-2
    Candidate role
    TechStaff Solutions
    vendor_employee
    W2

Candidate-owned corporation
    Candidate role
    RajTech LLC
    owner
    C2C
```

Important rule:

```text
Candidate -> Client
```

must **not** be used to represent submission, interview, or placement relationships in this database.

Those belong in jobsnprofiles.com.

---

# 8. candidate_profiles

Only candidate-specific CRM information belongs here.

```sql
CREATE TABLE candidate_profiles (
    person_id                   BIGINT PRIMARY KEY,

    candidate_status            VARCHAR(40),

    current_title               VARCHAR(150),
    skills_summary              TEXT,

    years_experience            DECIMAL(4,1),

    availability_status         VARCHAR(40),
    available_from              DATE,

    preferred_location          VARCHAR(150),
    remote_preference           VARCHAR(30),

    willing_to_relocate         BOOLEAN,
    willing_to_travel           BOOLEAN,

    work_authorization          VARCHAR(80),

    preferred_engagement_type   VARCHAR(30),

    desired_salary_min          DECIMAL(12,2),
    desired_salary_max          DECIMAL(12,2),

    desired_rate_min            DECIMAL(12,2),
    desired_rate_max            DECIMAL(12,2),
    rate_unit                   VARCHAR(20),

    last_contacted_at           TIMESTAMP,
    next_followup_at            TIMESTAMP,

    do_not_contact              BOOLEAN DEFAULT FALSE,
    do_not_email                BOOLEAN DEFAULT FALSE,
    do_not_sms                  BOOLEAN DEFAULT FALSE,

    created_at                  TIMESTAMP NOT NULL,
    updated_at                  TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id)
        REFERENCES people(id)
);
```

Do not store resumes, submissions, jobs, or recruiting pipeline here.

---

# 9. client_profiles

Describes the relationship with the client company.

```sql
CREATE TABLE client_profiles (
    organization_id         BIGINT PRIMARY KEY,

    client_status           VARCHAR(40),

    relationship_tier       VARCHAR(40),
    relationship_health     VARCHAR(40),

    client_since            DATE,

    strategic_account       BOOLEAN DEFAULT FALSE,
    priority_account        BOOLEAN DEFAULT FALSE,

    account_owner_user_id   BIGINT,

    preferred_meeting_frequency VARCHAR(50),

    notes                   TEXT,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    FOREIGN KEY (organization_id)
        REFERENCES organizations(id),

    FOREIGN KEY (account_owner_user_id)
        REFERENCES users(id)
);
```

---

# 10. client_contact_profiles

Information specific to an individual client stakeholder.

```sql
CREATE TABLE client_contact_profiles (
    person_id               BIGINT PRIMARY KEY,

    relationship_tier       VARCHAR(40),

    influence_level         VARCHAR(40),
    decision_maker_level    VARCHAR(40),

    relationship_health     VARCHAR(40),

    preferred_contact_method VARCHAR(30),
    preferred_contact_time   VARCHAR(80),

    first_contact_date      DATE,
    last_contacted_at       TIMESTAMP,
    next_followup_at        TIMESTAMP,

    notes                   TEXT,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id)
        REFERENCES people(id)
);
```

The person's company is resolved through `person_organization_affiliations`.

---

# 11. vendor_profiles

Vendor-company-specific information.

```sql
CREATE TABLE vendor_profiles (
    organization_id         BIGINT PRIMARY KEY,

    vendor_status           VARCHAR(40),
    vendor_type             VARCHAR(40),

    preferred_vendor        BOOLEAN DEFAULT FALSE,

    relationship_tier       VARCHAR(40),
    relationship_health     VARCHAR(40),

    msa_status              VARCHAR(40),
    msa_signed_date         DATE,
    msa_expiration_date     DATE,

    insurance_status        VARCHAR(40),
    insurance_expiration_date DATE,

    w9_status               VARCHAR(40),

    payment_terms_days      INTEGER,

    specialties_summary     TEXT,

    account_owner_user_id   BIGINT,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    FOREIGN KEY (organization_id)
        REFERENCES organizations(id),

    FOREIGN KEY (account_owner_user_id)
        REFERENCES users(id)
);
```

No resume submission or job pipeline data belongs here.

---

# 12. vendor_contact_profiles

Individual vendor representative information.

```sql
CREATE TABLE vendor_contact_profiles (
    person_id                   BIGINT PRIMARY KEY,

    relationship_tier           VARCHAR(40),
    relationship_health         VARCHAR(40),

    preferred_contact_method    VARCHAR(30),

    specialties_summary         TEXT,

    first_contact_date          DATE,
    last_contacted_at           TIMESTAMP,
    next_followup_at            TIMESTAMP,

    notes                       TEXT,

    created_at                  TIMESTAMP NOT NULL,
    updated_at                  TIMESTAMP NOT NULL,

    FOREIGN KEY (person_id)
        REFERENCES people(id)
);
```

The vendor company relationship is stored only in `person_organization_affiliations`.

---

# 13. addresses

```sql
CREATE TABLE addresses (
    id              BIGINT PRIMARY KEY,

    line1           VARCHAR(250),
    line2           VARCHAR(250),

    city            VARCHAR(120),
    state_region    VARCHAR(120),
    postal_code     VARCHAR(30),
    country_code    CHAR(2),

    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);
```

Generic links:

```sql
CREATE TABLE address_links (
    id              BIGINT PRIMARY KEY,

    address_id      BIGINT NOT NULL,

    entity_type     VARCHAR(30) NOT NULL,
    entity_id       BIGINT NOT NULL,

    address_type    VARCHAR(30),
    is_primary      BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (address_id)
        REFERENCES addresses(id)
);
```

---

# 14. communications

Use one communication model for candidate, client, and vendor contacts.

Do not create:

```text
candidate_calls
client_calls
vendor_calls
candidate_emails
client_emails
vendor_emails
```

Use:

```sql
CREATE TABLE communications (
    id                      BIGINT PRIMARY KEY,

    communication_type      VARCHAR(30) NOT NULL,
    -- call, email, meeting, sms, linkedin, other

    direction               VARCHAR(20),
    -- inbound, outbound, internal

    subject                 VARCHAR(500),
    summary                 TEXT,
    outcome                 TEXT,

    started_at              TIMESTAMP,
    ended_at                TIMESTAMP,

    owner_user_id           BIGINT,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
);
```

Participants:

```sql
CREATE TABLE communication_participants (
    id                  BIGINT PRIMARY KEY,

    communication_id    BIGINT NOT NULL,

    person_id           BIGINT,
    user_id             BIGINT,

    participant_role    VARCHAR(30),

    FOREIGN KEY (communication_id)
        REFERENCES communications(id),

    FOREIGN KEY (person_id)
        REFERENCES people(id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
);
```

---

# 15. call_details

```sql
CREATE TABLE call_details (
    communication_id        BIGINT PRIMARY KEY,

    provider                VARCHAR(50),
    external_call_id        VARCHAR(255),

    from_number             VARCHAR(50),
    to_number               VARCHAR(50),

    duration_seconds        INTEGER,

    recording_url           VARCHAR(1000),

    transcription_status    VARCHAR(30),

    FOREIGN KEY (communication_id)
        REFERENCES communications(id)
);
```

---

# 16. call_transcripts

```sql
CREATE TABLE call_transcripts (
    id                  BIGINT PRIMARY KEY,

    communication_id    BIGINT NOT NULL,

    language_code       VARCHAR(20),
    full_text           TEXT,

    generated_at        TIMESTAMP,

    FOREIGN KEY (communication_id)
        REFERENCES communications(id)
);
```

Transcript speaker segments:

```sql
CREATE TABLE call_transcript_segments (
    id                  BIGINT PRIMARY KEY,

    transcript_id       BIGINT NOT NULL,

    person_id           BIGINT,
    user_id             BIGINT,

    speaker_label       VARCHAR(100),

    start_ms            INTEGER,
    end_ms              INTEGER,

    text                TEXT NOT NULL,

    FOREIGN KEY (transcript_id)
        REFERENCES call_transcripts(id)
);
```

This supports conversation-style transcript rendering.

---

# 17. email_threads

```sql
CREATE TABLE email_threads (
    id                  BIGINT PRIMARY KEY,

    provider            VARCHAR(30),
    external_thread_id  VARCHAR(255),

    subject             VARCHAR(500),

    first_message_at    TIMESTAMP,
    last_message_at     TIMESTAMP
);
```

---

# 18. email_messages

```sql
CREATE TABLE email_messages (
    id                  BIGINT PRIMARY KEY,

    thread_id           BIGINT NOT NULL,
    communication_id    BIGINT,

    external_message_id VARCHAR(255),

    from_address        VARCHAR(320),

    subject             VARCHAR(500),

    body_text           TEXT,
    body_html           TEXT,

    sent_at             TIMESTAMP,
    received_at         TIMESTAMP,

    is_inbound          BOOLEAN,

    FOREIGN KEY (thread_id)
        REFERENCES email_threads(id),

    FOREIGN KEY (communication_id)
        REFERENCES communications(id)
);
```

Recipients:

```sql
CREATE TABLE email_recipients (
    id                  BIGINT PRIMARY KEY,

    email_message_id    BIGINT NOT NULL,

    recipient_type      VARCHAR(10),
    -- to, cc, bcc

    email_address       VARCHAR(320),

    person_id           BIGINT,

    FOREIGN KEY (email_message_id)
        REFERENCES email_messages(id),

    FOREIGN KEY (person_id)
        REFERENCES people(id)
);
```

---

# 19. notes

```sql
CREATE TABLE notes (
    id                  BIGINT PRIMARY KEY,

    body                TEXT NOT NULL,

    note_type           VARCHAR(40),

    is_private          BOOLEAN DEFAULT FALSE,

    created_by_user_id  BIGINT NOT NULL,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
);
```

Links:

```sql
CREATE TABLE note_links (
    note_id             BIGINT NOT NULL,

    entity_type         VARCHAR(30) NOT NULL,
    entity_id           BIGINT NOT NULL,

    PRIMARY KEY (note_id, entity_type, entity_id),

    FOREIGN KEY (note_id)
        REFERENCES notes(id)
);
```

One note may relate to both a person and an organization without duplication.

---

# 20. tasks

```sql
CREATE TABLE tasks (
    id                  BIGINT PRIMARY KEY,

    title               VARCHAR(300) NOT NULL,
    description         TEXT,

    status              VARCHAR(30) NOT NULL,
    priority            VARCHAR(20),

    due_at              TIMESTAMP,
    completed_at        TIMESTAMP,

    assigned_to_user_id BIGINT,
    created_by_user_id  BIGINT,

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (assigned_to_user_id)
        REFERENCES users(id),

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
);
```

Links:

```sql
CREATE TABLE task_links (
    task_id             BIGINT NOT NULL,
    entity_type         VARCHAR(30) NOT NULL,
    entity_id           BIGINT NOT NULL,

    PRIMARY KEY (task_id, entity_type, entity_id),

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
);
```

---

# 21. calendar_events

```sql
CREATE TABLE calendar_events (
    id                  BIGINT PRIMARY KEY,

    title               VARCHAR(300) NOT NULL,
    description         TEXT,

    event_type          VARCHAR(40),

    starts_at           TIMESTAMP NOT NULL,
    ends_at             TIMESTAMP,

    timezone            VARCHAR(60),

    location            VARCHAR(300),
    meeting_url         VARCHAR(1000),

    organizer_user_id   BIGINT,

    external_provider   VARCHAR(30),
    external_event_id   VARCHAR(255),

    status              VARCHAR(30),

    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,

    FOREIGN KEY (organizer_user_id)
        REFERENCES users(id)
);
```

Participants:

```sql
CREATE TABLE calendar_event_participants (
    id                  BIGINT PRIMARY KEY,

    event_id            BIGINT NOT NULL,

    person_id           BIGINT,
    user_id             BIGINT,

    response_status     VARCHAR(30),

    FOREIGN KEY (event_id)
        REFERENCES calendar_events(id)
);
```

---

# 22. files

```sql
CREATE TABLE files (
    id                  BIGINT PRIMARY KEY,

    file_name           VARCHAR(500) NOT NULL,
    mime_type           VARCHAR(150),

    size_bytes          BIGINT,

    storage_provider    VARCHAR(50),
    storage_key         VARCHAR(1000),

    uploaded_by_user_id BIGINT,

    uploaded_at         TIMESTAMP NOT NULL,

    FOREIGN KEY (uploaded_by_user_id)
        REFERENCES users(id)
);
```

Links:

```sql
CREATE TABLE file_links (
    file_id             BIGINT NOT NULL,

    entity_type         VARCHAR(30) NOT NULL,
    entity_id           BIGINT NOT NULL,

    file_category       VARCHAR(50),

    PRIMARY KEY (file_id, entity_type, entity_id),

    FOREIGN KEY (file_id)
        REFERENCES files(id)
);
```

Typical vendor files:

```text
MSA
W9
Insurance Certificate
Rate Card
```

Typical client files:

```text
NDA
Company brochure
Meeting notes
Account plan
```

Candidate resumes remain in jobsnprofiles.com.

---

# 23. tags

```sql
CREATE TABLE tags (
    id              BIGINT PRIMARY KEY,

    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    color           VARCHAR(30),

    is_active       BOOLEAN DEFAULT TRUE,

    UNIQUE(name, category)
);
```

Generic links:

```sql
CREATE TABLE entity_tags (
    tag_id          BIGINT NOT NULL,

    entity_type     VARCHAR(30) NOT NULL,
    entity_id       BIGINT NOT NULL,

    PRIMARY KEY (tag_id, entity_type, entity_id),

    FOREIGN KEY (tag_id)
        REFERENCES tags(id)
);
```

Examples:

```text
Candidate
    Java
    AWS
    Hot Candidate

Vendor
    Preferred
    C2C
    Java Staffing

Client
    Strategic
    Fortune 500
    Healthcare
```

---

# 24. external_entity_links

Use this to reference jobsnprofiles.com without duplicating ATS data.

```sql
CREATE TABLE external_entity_links (
    id                   BIGINT PRIMARY KEY,

    entity_type          VARCHAR(30) NOT NULL,
    entity_id            BIGINT NOT NULL,

    external_system      VARCHAR(50) NOT NULL,
    external_entity_type VARCHAR(50),

    external_id          VARCHAR(255),
    external_url         VARCHAR(1000),

    last_synced_at       TIMESTAMP,

    UNIQUE (
        entity_type,
        entity_id,
        external_system,
        external_entity_type
    )
);
```

Examples:

```text
Alex Carter
→ JOBSNPROFILES
→ candidate/83481

Acme Technologies
→ JOBSNPROFILES
→ client/1912
```

---

# 25. users

Internal users/recruiters are separate from external CRM contacts.

```sql
CREATE TABLE users (
    id              BIGINT PRIMARY KEY,

    first_name      VARCHAR(100),
    last_name       VARCHAR(100),

    email           VARCHAR(320) UNIQUE NOT NULL,

    role            VARCHAR(50),

    is_active       BOOLEAN DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);
```

Do not automatically store recruiters in `people` unless the product explicitly needs them as CRM contacts.

---

# 26. activity_events

Use this as a read-optimized activity stream.

```sql
CREATE TABLE activity_events (
    id                  BIGINT PRIMARY KEY,

    event_type          VARCHAR(50) NOT NULL,

    person_id           BIGINT,
    organization_id     BIGINT,

    user_id             BIGINT,

    communication_id    BIGINT,
    task_id             BIGINT,
    calendar_event_id   BIGINT,
    note_id             BIGINT,
    file_id             BIGINT,

    occurred_at         TIMESTAMP NOT NULL,

    title               VARCHAR(300),
    description         TEXT,

    metadata_json       JSON,

    created_at          TIMESTAMP NOT NULL
);
```

This table is not the authoritative source of communication or task data. It is an activity index that makes timeline screens fast.

---

# 27. Final Relationship Model

```text
USERS
  │
  ├──────── owns / creates ───────────────┐
  │                                       │
  ▼                                       ▼
PEOPLE                              ORGANIZATIONS
  │                                       │
  │                                       │
  ├─ CONTACT_METHODS                      ├─ ORGANIZATION_ROLES
  │                                       │
  ├─ PERSON_CONTACT_ROLES                 ├─ CLIENT_PROFILE
  │                                       │
  ├─ CANDIDATE_PROFILE                    └─ VENDOR_PROFILE
  │
  ├─ CLIENT_CONTACT_PROFILE
  │
  ├─ VENDOR_CONTACT_PROFILE
  │
  └──────────┐
             │
             ▼
 PERSON_ORGANIZATION_AFFILIATIONS
             │
       actual employment /
       representation /
       ownership history


PEOPLE / ORGANIZATIONS
          │
          ├──────── COMMUNICATIONS
          │              ├─ EMAIL
          │              ├─ CALL
          │              └─ TRANSCRIPT
          │
          ├──────── NOTES
          ├──────── TASKS
          ├──────── CALENDAR EVENTS
          ├──────── FILES
          ├──────── TAGS
          └──────── ACTIVITY EVENTS
```

---

# 28. Candidate Relationship Rules

These should be explicit business rules.

```text
Candidate without company
    VALID

Candidate linked to vendor
    VALID

Candidate linked to candidate-owned company
    VALID

Candidate linked to your company as W-2
    VALID

Candidate linked to payroll company
    VALID

Candidate linked to client because submitted/interviewing/placed
    NOT VALID IN THIS DATABASE
```

The last relationship belongs in jobsnprofiles.com.

---

# 29. What jobsnprofiles.com Owns

The contact-management database should not become an ATS clone.

Keep these authoritative in jobsnprofiles.com:

```text
Jobs
Job descriptions
Resume versions
Candidate submissions
Candidate-to-job relationships
Candidate-to-client submissions
Interview pipeline
Submission status
Placement records
Bill rates per placement
Pay rates per placement
Client job requirements
Recruiter submission pipeline
Offer details
Assignment details
```

The contact portal may display external counts, summaries, or deep links, but should not own those records.

---

# 30. Why This Design Avoids Redundancy

With this model:

- Jennifer Lawson exists once in `people`.
- Ravi Patel exists once in `people`.
- Alex Carter exists once in `people`.
- Acme Technologies exists once in `organizations`.
- TechStaff Solutions exists once in `organizations`.
- Candidate, client-contact, and vendor-contact behavior is represented through roles and profile extension tables.
- Company relationships are stored once through affiliations.
- Calls, emails, meetings, notes, tasks, tags, and files use shared generic models.
- Candidate-to-client recruiting relationships do not leak into this contact database.
- ATS-specific data remains isolated in jobsnprofiles.com.
- Historical employment and representation changes are preserved through dated affiliation records.

This is the recommended normalized foundation for the TalentBridge contact-management screens.

---

# 31. Linking Candidates to jobsnprofiles.com

## 31.1 Ownership Boundary

The contact-management portal and jobsnprofiles.com should have a strict ownership boundary.

**Contact-management portal owns:**

```text
Candidate identity / person record
Phone numbers
Email addresses
LinkedIn/contact channels
Contact roles
Organization affiliations
Candidate CRM preferences
Availability
Communication history
Calls
Call recordings/references
Call transcripts
Emails
Meetings
Calendar events
Notes
Tasks
Follow-ups
Tags
Contact-management files
Relationship/activity history
```

**jobsnprofiles.com owns:**

```text
Candidate ATS profile
Resume files
Resume versions
Professional resume/profile details
Jobs
Job descriptions
Candidate-to-job relationships
Candidate submissions
Candidate-to-client submissions
Interview pipeline
Submission statuses
Placements
Offers
Assignment details
Bill rates per placement
Pay rates per placement
Client job requirements
Recruiting pipeline
```

The contact portal should **reference** jobsnprofiles.com data rather than duplicate it.

---

## 31.2 Candidate Profile Mapping

A candidate in TalentBridge is fundamentally a `people` record plus a `CANDIDATE` contact role and, where applicable, a `candidate_profiles` extension.

Example:

```text
TalentBridge
people.id = 12345
Name = Alex Carter
Role = CANDIDATE
```

The same candidate may have an ATS profile in jobsnprofiles.com:

```text
jobsnprofiles.com
candidate_id = 83481
```

The systems should be linked using `external_entity_links`.

Conceptually:

```text
TalentBridge
people.id = 12345
      │
      │ external mapping
      ▼
jobsnprofiles.com
candidate_id = 83481
```

Do not use name, email, or phone as the permanent cross-system key. Those values can change and are not guaranteed to be unique.

---

## 31.3 Recommended `external_entity_links` Table

Use a generic integration mapping table instead of adding integration-specific columns such as:

```text
candidate_profiles.jobsnprofiles_id
candidate_profiles.linkedin_id
candidate_profiles.other_ats_id
```

Recommended structure:

```sql
CREATE TABLE external_entity_links (
    id                      BIGINT PRIMARY KEY,

    local_entity_type       VARCHAR(30) NOT NULL,
    local_entity_id         BIGINT NOT NULL,

    external_system         VARCHAR(50) NOT NULL,
    external_entity_type    VARCHAR(50) NOT NULL,

    external_id             VARCHAR(255) NOT NULL,
    external_url            VARCHAR(1000),

    is_primary              BOOLEAN NOT NULL DEFAULT TRUE,

    last_verified_at        TIMESTAMP,
    last_synced_at          TIMESTAMP,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    UNIQUE (
        local_entity_type,
        local_entity_id,
        external_system,
        external_entity_type,
        external_id
    )
);
```

For Alex Carter:

```text
local_entity_type    = PERSON
local_entity_id      = 12345

external_system      = JOBSNPROFILES
external_entity_type = CANDIDATE_PROFILE

external_id          = 83481
external_url         = jobsnprofiles candidate deep link
is_primary           = true
```

Conceptually:

```text
PERSON / 12345
      │
      ▼
JOBSNPROFILES / CANDIDATE_PROFILE / 83481
```

The actual jobsnprofiles.com URL format should be generated from its real routing/API contract rather than hard-coded from an assumed example.

---

## 31.4 Candidate Profile Deep Link

The Candidate Contact screen can expose an action such as:

```text
Alex Carter

Contact Management
------------------
Phone
Email
Notes
Calls
Transcripts
Emails
Meetings
Tasks
Availability
Affiliations

Jobs & Profiles
---------------
[ Open Candidate Profile in jobsnprofiles.com ]
```

When the user clicks the button:

1. TalentBridge looks up the person's `external_entity_links` row.
2. It finds:
   - `external_system = JOBSNPROFILES`
   - `external_entity_type = CANDIDATE_PROFILE`
3. It uses the verified `external_url`, or constructs a route using the stable `external_id` according to the jobsnprofiles.com integration contract.
4. The browser opens the corresponding candidate record in jobsnprofiles.com.

TalentBridge should not need to know the candidate's jobs, submissions, or resume structure merely to navigate to the ATS profile.

---

## 31.5 Resume Linking

A candidate may have more than one resume.

Do not design:

```text
candidate_profiles.resume_url
```

as the long-term model.

That assumes:

- only one resume exists;
- the resume never changes;
- the contact system owns the resume;
- resume versioning does not matter.

Those assumptions are unsafe for a recruiting platform.

Instead, resume resources should remain owned by jobsnprofiles.com.

There are two reasonable integration patterns.

### Pattern A — Link Only to Candidate Profile

The simplest approach is:

```text
TalentBridge Candidate
      │
      ▼
jobsnprofiles.com Candidate Profile
      │
      ├── Resume A
      ├── Resume B
      ├── Jobs
      ├── Submissions
      ├── Interviews
      └── Placements
```

TalentBridge stores only the candidate-profile mapping.

The user clicks:

```text
[ Open in jobsnprofiles.com ]
```

and manages resumes there.

This provides the cleanest system boundary.

### Pattern B — Expose Read-Only Resume Links

If jobsnprofiles.com provides stable resume IDs/API resources and the contact portal needs convenient resume access, TalentBridge can keep lightweight external resource references.

---

# 32. External Candidate Resources

A dedicated table may be used when TalentBridge needs links to multiple external resources belonging to the same person.

```sql
CREATE TABLE external_resources (
    id                      BIGINT PRIMARY KEY,

    local_entity_type       VARCHAR(30) NOT NULL,
    local_entity_id         BIGINT NOT NULL,

    external_system         VARCHAR(50) NOT NULL,

    resource_type           VARCHAR(50) NOT NULL,
    -- RESUME
    -- CANDIDATE_PROFILE
    -- PORTFOLIO
    -- OTHER

    external_id             VARCHAR(255) NOT NULL,
    external_url            VARCHAR(1000),

    label                   VARCHAR(250),

    is_primary              BOOLEAN NOT NULL DEFAULT FALSE,

    external_updated_at     TIMESTAMP,
    last_verified_at        TIMESTAMP,
    last_synced_at          TIMESTAMP,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,

    UNIQUE (
        local_entity_type,
        local_entity_id,
        external_system,
        resource_type,
        external_id
    )
);
```

Example:

```text
local_entity_type = PERSON
local_entity_id   = 12345
external_system   = JOBSNPROFILES

resource_type     = RESUME
external_id       = RESUME_9912
label             = Java / AWS Resume
is_primary        = true
```

Another version:

```text
local_entity_type = PERSON
local_entity_id   = 12345
external_system   = JOBSNPROFILES

resource_type     = RESUME
external_id       = RESUME_9913
label             = Leadership Resume
is_primary        = false
```

The Candidate Contact UI could display:

```text
Jobs & Profiles

Candidate Profile
[ Open in jobsnprofiles.com ]

Primary Resume
Java / AWS Resume
[ View Resume ]

Other Resume
Leadership Resume
[ View Resume ]
```

The links are convenience references only. jobsnprofiles.com remains the authoritative owner.

---

# 33. Do Not Copy Resume Content Into the Contact Database

Avoid copying these fields from jobsnprofiles.com into TalentBridge merely to support the contact screen:

```text
resume_blob
resume_html
resume_text
resume_pdf
full_employment_history
full_education_history
job_application_history
submission_history
interview_history
placement_history
```

Doing so creates:

- synchronization problems;
- stale data;
- conflicting sources of truth;
- additional storage requirements;
- duplicate search indexes;
- unclear update ownership;
- more complex deletion/privacy handling.

The contact portal should fetch ATS information when needed or send the user to jobsnprofiles.com.

---

# 34. Optional Read-Only ATS Summary

It can still be useful for the Contact screen to display a small amount of jobsnprofiles.com information.

For example:

```text
Jobs & Profiles

Profile: Linked
Primary Resume: Updated Aug 28
Active Submissions: 3
Upcoming Interviews: 1

[ Open in jobsnprofiles.com ]
```

These values should ideally be retrieved from jobsnprofiles.com through an API.

They should not become authoritative TalentBridge business records.

If caching is needed for performance, use a clearly non-authoritative cache such as:

```sql
CREATE TABLE external_entity_snapshots (
    id                  BIGINT PRIMARY KEY,

    external_link_id    BIGINT NOT NULL,

    snapshot_type       VARCHAR(50) NOT NULL,

    payload_json        JSON NOT NULL,

    fetched_at          TIMESTAMP NOT NULL,
    expires_at          TIMESTAMP,

    FOREIGN KEY (external_link_id)
        REFERENCES external_entity_links(id)
);
```

Example cached payload:

```json
{
  "primary_resume_updated_at": "2026-08-28T14:32:00Z",
  "active_submission_count": 3,
  "upcoming_interview_count": 1
}
```

This is a cache only.

jobsnprofiles.com remains the source of truth.

---

# 35. Candidate Creation and Linking Workflow

When a recruiter creates a candidate contact in TalentBridge:

```text
1. Create/find PERSON
2. Assign CANDIDATE contact role
3. Create candidate_profiles row
4. Add contact methods
5. Add organization affiliation if applicable
6. Search jobsnprofiles.com for an existing candidate
7. If found, link the records
8. If not found, optionally create the ATS profile through an approved integration
9. Store returned jobsnprofiles candidate ID
10. Display "Open in jobsnprofiles.com"
```

Example:

```text
TalentBridge
Alex Carter
people.id = 12345

        │
        │ API lookup / controlled matching
        ▼

jobsnprofiles.com
Alex Carter
candidate_id = 83481

        │
        ▼

external_entity_links

PERSON
12345
JOBSNPROFILES
CANDIDATE_PROFILE
83481
```

---

# 36. Existing Candidate Matching

When connecting existing records across the two systems, matching should be careful.

Possible matching signals:

```text
Verified email
Normalized mobile phone
Existing external ID
LinkedIn URL
Name + email
Name + phone
```

Do not automatically merge records solely because names match.

For example:

```text
John Smith
```

is not sufficient evidence that two records represent the same person.

Recommended matching flow:

```text
Exact external ID
    ↓
Verified email
    ↓
Normalized phone
    ↓
Strong multi-field match
    ↓
Human confirmation when ambiguous
```

Once confirmed, save the stable jobsnprofiles candidate ID so repeated fuzzy matching is unnecessary.

---

# 37. jobsnprofiles.com API Integration

If jobsnprofiles.com exposes an API, TalentBridge should ideally integrate through stable API identifiers rather than scraping pages.

Useful conceptual operations are:

```text
Find candidate
Get candidate summary
Get resume list
Get primary resume
Get candidate profile URL
Get lightweight activity counts
Create candidate profile, if permitted
```

TalentBridge should authenticate server-to-server using the integration mechanism supported by jobsnprofiles.com.

The exact endpoints, authentication scheme, and payloads must follow the real jobsnprofiles.com API contract.

Do not invent endpoint paths in application code.

---

# 38. Security of External Resume Links

Resume URLs can contain sensitive personal information.

Prefer:

```text
stable resource ID
+
authenticated application request
```

over permanently storing public resume URLs.

If jobsnprofiles.com uses temporary signed URLs:

```text
TalentBridge
   │
   │ request resume
   ▼
Backend
   │
   │ asks jobsnprofiles.com
   ▼
Temporary authenticated/signed URL
   │
   ▼
User views resume
```

Do not treat expiring signed URLs as permanent database identifiers.

Store:

```text
external_id = RESUME_9912
```

and request a fresh access URL when necessary.

---

# 39. Integration Failure Behavior

The Contact screen should continue working even if jobsnprofiles.com is temporarily unavailable.

For example:

```text
Alex Carter

Phone          available
Email          available
Calls          available
Notes          available
Tasks          available
Calendar       available

Jobs & Profiles
Temporarily unavailable
[ Retry ]
```

The contact-management portal should not become dependent on the ATS for basic CRM operations.

---

# 40. Deletion and Unlinking

Deleting or unlinking an external mapping must not automatically delete the candidate from either system.

Recommended semantics:

```text
Unlink
    Removes relationship between the two records.

Delete Contact
    Follows TalentBridge's own deletion/archive policy.

Delete ATS Candidate
    Must be performed through jobsnprofiles.com or an explicitly authorized ATS operation.
```

The mapping can also have a lifecycle status if needed:

```sql
ALTER TABLE external_entity_links
ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active';
```

Suggested values:

```text
active
unlinked
invalid
pending_verification
```

---

# 41. Final Cross-System Candidate Architecture

```text
                     TALENTBRIDGE
                  Contact Management

                     PEOPLE
                       │
                       ├── Contact Methods
                       ├── Candidate Role
                       ├── Candidate CRM Profile
                       ├── Vendor/Internal Affiliation
                       ├── Calls
                       ├── Transcripts
                       ├── Emails
                       ├── Meetings
                       ├── Notes
                       ├── Tasks
                       ├── Tags
                       └── Activity
                       │
                       │
              EXTERNAL_ENTITY_LINK
                       │
                       │ stable candidate ID
                       ▼
                JOBSNPROFILES.COM
                       │
                       ├── ATS Candidate Profile
                       ├── Resume Version 1
                       ├── Resume Version 2
                       ├── Jobs
                       ├── Submissions
                       ├── Interviews
                       ├── Offers
                       ├── Placements
                       └── Assignments
```

The integration rule is:

> TalentBridge owns contact relationships and everyday communication. jobsnprofiles.com owns recruiting execution and resume/profile data. Stable external IDs and authenticated deep links/API calls connect the two systems.

---

# 42. Final Table Inventory

The resulting contact-management design consists of the following primary tables.

## Identity and Organizations

```text
people
contact_methods
addresses
address_links

organizations
organization_roles
person_organization_affiliations
```

## Contact Classification and Specialized Profiles

```text
contact_roles
person_contact_roles

candidate_profiles

client_profiles
client_contact_profiles

vendor_profiles
vendor_contact_profiles
```

## Communication

```text
communications
communication_participants

call_details
call_transcripts
call_transcript_segments

email_threads
email_messages
email_recipients
```

## Everyday CRM Work

```text
notes
note_links

tasks
task_links

calendar_events
calendar_event_participants

files
file_links

tags
entity_tags

activity_events
```

## Internal Users and External Integrations

```text
users

external_entity_links
external_resources            -- optional when direct resume/resource links are needed
external_entity_snapshots     -- optional read-only integration cache
```

## Explicitly Outside This Database

```text
jobs
job descriptions
resumes as authoritative files
resume versions as authoritative records
candidate submissions
candidate-to-job relationships
candidate-to-client recruiting relationships
interview pipeline
placements
offers
assignment records
bill/pay rates tied to placements
recruiting pipeline
```

Those remain in jobsnprofiles.com.

---

# 43. Final Design Principles

1. **One person, one identity record.** Candidate, client-contact, and vendor-contact status is modeled through roles and extensions.

2. **One organization, one organization record.** Client/vendor/internal behavior is modeled through organization roles and specialized profiles.

3. **Candidate-to-company affiliation is optional.** Independent candidates require no organization.

4. **Candidate affiliations may point to vendors, the firm's own company, payroll entities, or candidate-owned companies.**

5. **Do not use client affiliations to represent candidate submissions, interviews, or placements.** Those are ATS relationships.

6. **Affiliations are time-bound.** Do not overwrite history when a candidate changes vendor/employer.

7. **Communication is universal.** Calls, email, meetings, SMS, notes, and tasks should not have separate candidate/client/vendor implementations.

8. **jobsnprofiles.com is the ATS source of truth.** TalentBridge stores stable mappings, not duplicated ATS records.

9. **Resume access should use external resource IDs or the ATS profile.** Do not assume one permanent resume URL.

10. **External summaries are read-only or cached.** They never become the authoritative recruiting records.

11. **Integrations must fail gracefully.** Contact management should remain operational when the ATS is unavailable.

12. **Stable IDs connect systems.** Names, emails, and phones may assist initial matching but should not remain the permanent cross-system key.

13. **Avoid redundancy before optimizing reads.** Read-optimized tables such as `activity_events` and integration snapshots must be explicitly treated as indexes/caches rather than sources of truth.

14. **Keep system boundaries clear.** TalentBridge answers: “Who should I contact, what happened, and what do I need to do today?” jobsnprofiles.com answers: “What job, resume, submission, interview, or placement is this candidate involved in?”

