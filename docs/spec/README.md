# Contact Manager Development Specification

**TalentBridge / Contact Manager**  
Staffing relationship and operational intelligence hub — complete flow for development

Jobs N Profiles · 8 September 2026 · Single source for the development team

> **How to use this document.** This is the whole development specification in one place: product principle, architecture, complete visual flows, modules, workspace behavior, integrations, privacy, POC scope, demonstration script, then the original developer questions with decisions at the end. TalentBridge in questions is Contact Manager in the product. Do not implement a contact database with integrations.

Read in this order — the same flow as `Contact_Manager_Development_Specification 1.docx`:

| Part | Contents | File |
|------|----------|------|
| **A. Product** | Principle, industry gap, data model, connected systems, POC vs later | [A-product.md](A-product.md) |
| **B. Complete flow** | Diagrams plus the sample workspace — recruiter, sales, ops, leadership, submit, timeline, call, sync, Client 360 | [B-complete-flow.md](B-complete-flow.md) |
| **C. Build spec** | Navigation, screen behavior, roles, integrations, privacy, delivery | [C-build-spec.md](C-build-spec.md) |
| **D. Developer Q&A** | Original TalentBridge questions with decisions (Q1–Q12, A1–A11, privacy) | [D-developer-qa.md](D-developer-qa.md) |

## A. Product

| Section | Title |
|---------|--------|
| [A.1](A-product.md#a1-product-principle) | Product principle |
| [A.1a](A-product.md#a1a-product-boundary) | Product boundary |
| [A.1b](A-product.md#a1b-priority-improvements) | Priority improvements |
| [A.2](A-product.md#a2-the-gap-this-fills) | The gap this fills |
| [A.3](A-product.md#a3-core-data-model) | Core data model |
| [A.4](A-product.md#a4-poc-vs-architecture-now) | POC vs architecture now |
| [A.5](A-product.md#a5-ground-rules) | Ground rules |

## B. Complete flow (visual)

| Section | Title | Figure |
|---------|--------|--------|
| [B.1](B-complete-flow.md#b1-sample-workspace-foundation-ui) | Sample workspace | Fig 0 |
| [B.2](B-complete-flow.md#b2-hub-architecture) | Hub architecture | Fig 1 |
| [B.3](B-complete-flow.md#b3-staffing-lifecycle) | Staffing lifecycle | Fig 2 |
| [B.4](B-complete-flow.md#b4-operating-model) | Operating model | Fig 3 |
| [B.5](B-complete-flow.md#b5-recruiter--delivery-journey) | Recruiter / delivery journey | Fig 4 |
| [B.6](B-complete-flow.md#b6-sales--bdm-journey) | Sales / BDM journey | Fig 5 |
| [B.7](B-complete-flow.md#b7-operations-and-leadership) | Operations and leadership | Fig 6 |
| [B.8](B-complete-flow.md#b8-submit-profile--outlook-hub-first-and-outside-capture) | Submit Profile — Outlook hub-first | Fig 7 |
| [B.9](B-complete-flow.md#b9-unified-timeline) | Unified timeline | Fig 8 |
| [B.10](B-complete-flow.md#b10-viotalk) | VioTalk | Fig 9 |
| [B.11](B-complete-flow.md#b11-candidate-sync-and-ownership) | Candidate sync and ownership | Fig 10 |
| [B.12](B-complete-flow.md#b12-nothing-falls-through-the-cracks) | Nothing falls through the cracks | Fig 11 |
| [B.13](B-complete-flow.md#b13-client-360-and-vendor) | Client 360 and Vendor | Fig 12 |
| [B.14](B-complete-flow.md#b14-msa-and-purchase-orders) | MSA and purchase orders | Fig 13 |
| [B.15](B-complete-flow.md#b15-search-and-stay-on-page) | Search and stay-on-page | Fig 14 |
| [B.15a](B-complete-flow.md#b15a-candidate-discovery-surface) | Candidate discovery surface | Fig 22 |
| [B.16](B-complete-flow.md#b16-administrator-and-privacy) | Administrator and privacy | Fig 15 |
| [B.17](B-complete-flow.md#b17-demonstration-spine) | Demonstration spine | Fig 16 |
| [B.18](B-complete-flow.md#b18-candidate-360) | Candidate 360 | Fig 17 |
| [B.19](B-complete-flow.md#b19-data-provenance) | Data provenance | Fig 18 |
| [B.20](B-complete-flow.md#b20-product-boundary) | Product boundary | Fig 19 |
| [B.21](B-complete-flow.md#b21-requirements--module-ready-later) | Requirements — module-ready later | Fig 20 |

## C. Build specification

| Section | Title |
|---------|--------|
| [C.1](C-build-spec.md#c1-navigation-modules) | Navigation modules |
| [C.2](C-build-spec.md#c2-workspace-behavior) | Workspace behavior |
| [C.3](C-build-spec.md#c3-submission-object) | Submission object |
| [C.4](C-build-spec.md#c4-requirement-object-minimum-poc) | Requirement object |
| [C.5](C-build-spec.md#c5-roles) | Roles |
| [C.6](C-build-spec.md#c6-integrations) | Integrations |
| [C.7](C-build-spec.md#c7-event-processing) | Event processing |
| [C.8](C-build-spec.md#c8-privacy-and-security-poc-not-polish) | Privacy and security |
| [C.9](C-build-spec.md#c9-minimum-entity-model) | Minimum entity model |
| [C.10](C-build-spec.md#c10-poc-delivery) | POC delivery |
| [C.11](C-build-spec.md#c11-acceptance-poc-is-ready-when) | Acceptance |
| [C.12](C-build-spec.md#c12-sla--aging-engine-build-now) | SLA / aging engine |
| [C.13](C-build-spec.md#c13-placement-continuity-lightweight) | Placement continuity |
| [C.14](C-build-spec.md#c14-configurable-workflows-schema-now-ui-next) | Configurable workflows |
| [C.15](C-build-spec.md#c15-candidate-search--discovery) | Candidate Search & Discovery |
| [C.16](C-build-spec.md#c16-natural-language-search-p2-same-objects) | Natural-language search |

## D. Developer Q&A

| Section | Title |
|---------|--------|
| [D.1](D-developer-qa.md#d1-architecture-decisions-the-original-list-did-not-ask) | Architecture decisions A1–A11 |
| [D.2](D-developer-qa.md#d2-recruiter) | Recruiter (Q1–Q3) |
| [D.3](D-developer-qa.md#d3-sales) | Sales (Q4–Q8) |
| [D.4](D-developer-qa.md#d4-operations) | Operations (Q9–Q10) |
| [D.5](D-developer-qa.md#d5-leadership) | Leadership |
| [D.6](D-developer-qa.md#d6-administrator) | Administrator (Q11) |
| [D.7](D-developer-qa.md#d7-shared-tasks-calendar-communications-search-viotalk) | Shared: Tasks, Calendar, Communications, Search, VioTalk (Q12) |
| [D.8](D-developer-qa.md#d8-privacy--communication-as-system-of-record-may-lead-to-privacy-issues) | Privacy |
| [Next](D-developer-qa.md#recommended-next-step) | Recommended next step / build order |

Word source: `Contact_Manager_Development_Specification 1.docx` at the repo root.
