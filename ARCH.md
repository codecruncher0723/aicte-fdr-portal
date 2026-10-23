# FDR Management Portal: Product Requirements and Solution Document

| | |
|---|---|
| **Problem statement** | PS 26265: Security Deposit / FDR Management Portal for the AICTE Regulation Bureau |
| **Document type** | Product requirements (PRD) and solution design, foundational reference for the team |
| **Version** | 1.0 (based on Architecture v0.3) |
| **Date** | 23 October 2026 |
| **Audience** | All six team members: frontend, backend, testing, integration |
| **Status** | Baseline for build. Changes go through the named integrator |
| **Working product name** | FDR Management Portal ("the portal"). Rename freely; do not rename enums or APIs after freeze |

> **How to use this document.** Read sections 1 to 6 to understand what we are building and why. Sections 7 to 12 tell you how it works. Sections 13 to 16 tell you how we measure, build, test and demonstrate it. When this document and your code disagree, raise it with the integrator; do not silently diverge.

---

## Table of contents

1. Executive summary
2. Problem definition
3. Goals, non-goals and success criteria
4. Unique selling propositions (USPs)
5. Application users and tiers
6. Key features
7. Application workflow
8. Solution architecture
9. Technology stack
10. Data model
11. Business rules
12. Security and compliance
13. KPIs and metrics
14. Non-functional requirements
15. Delivery plan and team structure
16. Testing strategy
17. Demonstration plan
18. Risks and mitigations
19. Assumptions and stated defaults
20. Glossary
21. Appendices (API outline, enums, seed data, definition of done)

---

## 1. Executive summary

AICTE requires many technical institutions to keep security deposits, usually as **Fixed Deposit Receipts (FDRs)**, as part of the approval process. Today these are tracked through fragmented records, correspondence and spreadsheets. As a result, it is hard to answer basic questions quickly: which FDRs mature next month, which were never verified with the bank, which institutions have pending release requests, and who approved what.

The portal is a **secure, centralised system that manages the full life of every FDR**: submission, document storage, discrepancy detection, verification, maturity tracking, renewal and replacement, release requests, alerts, dashboards and a tamper-evident audit trail.

Its defining idea is **trust you can explain**:

- Every value shows whether it was **submitted by the institution, extracted from a document, corrected by an officer, or confirmed by the bank**.
- Every flag says **why** it was raised.
- Every decision records **who** made it, **on what evidence**, and **when**.
- Every improvement claim is backed by **measured event timestamps**, not invented percentages.

The system **flags, tracks and records**. Authorized AICTE officials **decide**. Nothing in the portal approves, verifies or releases on its own.

**Shape of the solution:** a self-hosted modular monolith (React frontend, FastAPI backend, PostgreSQL, private encrypted document storage, a small background worker), deployable with one command via Docker Compose, working with no mandatory external services.

---

## 2. Problem definition

### 2.1 Current situation

| Pain point | Consequence |
|---|---|
| Records spread across files, emails and spreadsheets | No single, current view of deposit status |
| Manual tracking of maturity and validity dates | Missed renewals; lapsed security cover |
| No structured verification trail | Hard to prove an FDR was checked, by whom, against what |
| Submitted data and confirmed data look the same | Officers cannot tell what has actually been checked |
| Release and refund requests tracked by correspondence | Slow, opaque, hard to audit |
| No consistent alerts or escalation | Overdue cases go unnoticed |
| Repeated data entry | Errors and wasted effort |

### 2.2 What the problem statement requires

The ten capabilities in the PS:

1. Centralised institution-wise and instrument-wise repository.
2. Digital document management.
3. Verification and discrepancy detection.
4. Automated validity and maturity tracking.
5. Renewal and replacement monitoring.
6. Release and refund workflow.
7. Automated alerts and escalation.
8. Dashboard and management reports.
9. Audit trail and access control.
10. System integration and data security.

Explicit requirements that are easy to miss:

- **Distinguish institution-submitted data from bank-confirmed data.**
- **Record scrutiny observations.**
- **Demonstrate measurable improvements** in record accuracy, verification turnaround, renewal timeliness, manual effort and visibility of pending cases.
- **Test six scenarios:** new FDR submission, validity tracking, approaching maturity, renewal, discrepancy identification, authorized release processing.

### 2.3 Problem statement in one line

> AICTE cannot see, trust, or act on the status of institutional security deposits in time, because the information is scattered and its reliability is unknown.

---

## 3. Goals, non-goals and success criteria

### 3.1 Goals

| ID | Goal |
|---|---|
| G1 | One authoritative register of every institution's deposits and FDRs |
| G2 | Secure, versioned storage of every supporting document |
| G3 | A visible, evidence-based distinction between submitted and confirmed information |
| G4 | Automatic detection of missing, inconsistent or suspicious data, resolved by people |
| G5 | Time-based tracking of validity and maturity with reminders and escalation |
| G6 | Complete history of renewals and replacements |
| G7 | A controlled release and refund workflow with authorized decisions |
| G8 | Dashboards and reports that show what needs attention now |
| G9 | Strict access boundaries and a tamper-evident audit trail |
| G10 | Measured proof of improvement |

### 3.2 Non-goals (this prototype)

- Moving money or sending instructions to banks.
- Declaring an FDR genuine from an upload, OCR, or a PDF signature alone.
- Automatic approval of anything: verification, release, exceptions.
- Assuming AICTE internal APIs or bank APIs exist.
- Microservices, Kubernetes, event streaming.
- LLM-based interpretation of regulations.
- Handling real institutional data.

### 3.3 Success criteria for the prototype

The prototype succeeds if, in a live demo:

1. All six PS test scenarios run end to end through the UI.
2. Every key field on screen shows its source and verification level.
3. A cross-institution access attempt is denied and audited.
4. Advancing the simulated clock produces exactly one reminder, then an escalation.
5. A release request is blocked by an open mandatory item and then approved correctly.
6. Tampering with an audit row is detected.
7. The KPI panel shows real measurements from the demo run, with sample size and period.

---

## 4. Unique selling propositions (USPs)

These are what make our solution different from a "CRUD app with a dashboard". Every team member should be able to explain them.

### USP 1: Trust levels you can see

Every FDR carries a **verification badge**: *Unverified*, *Officer-reviewed*, or *Bank-confirmed*. Every key field shows **where its value came from**. The badge rises only with recorded evidence. It **automatically drops** if someone edits a bank-confirmed field. The PS asks for this distinction explicitly; most solutions will ignore it.

### USP 2: Nothing is overwritten

When an officer corrects an amount, the institution's original claim, the document evidence, the correction, the reason and the officer are all kept. Superseded FDRs stay visible. Old document versions stay retrievable. The record tells its whole story.

### USP 3: Explainable discrepancy detection

Checks fall into three clear classes:

- **Blocking validation:** impossible or missing data; stops only the relevant step.
- **Review-required:** conflicts and duplicates; opens a case for an officer.
- **Informational:** weak signals, shown for context.

Each flag names the rule and the reason. Duplicate detection recognises formatting variants (`FDR/00123`, `fdr-00123`, `FDR 123`). The system never accuses; it asks for review.

### USP 4: Honest verification without fake integrations

We do not pretend bank APIs exist. Instead, the portal runs a **real administrative workflow**: request confirmation from the bank, record the response, and have an officer assess it. Adapters are ready for live integrations once authorized. Anything simulated is labelled **SIMULATED**.

### USP 5: Time travel for demonstration

A **simulated clock** lets us jump forward 60 days and show maturity reminders, escalations and dashboard changes live. Judges see a 90-day process in 30 seconds.

### USP 6: Tamper-evident audit trail

Every important action is written to a **hash-chained audit log** in the same transaction as the change. A verification check detects modified, deleted or reordered entries. We demonstrate tampering and its detection live.

### USP 7: Improvement measured, not claimed

The portal records milestone timestamps (submitted, flagged, resolved, verified, decided, confirmed). KPIs are computed from those events, with sample size and period, so the improvement claims are evidence, not slogans.

### USP 8: Separation of duties built in

The person who requests or prepares a release cannot approve it. A waiver needs a second, authorized person and a written reason. Administrators cannot approve decisions or edit the audit log.

### USP 9: Works offline, deploys in one command

No mandatory cloud services. `docker compose up` starts everything. `reset-demo` reseeds clean synthetic data.

---

## 5. Application users and tiers

Users are grouped into **five tiers** by their relationship to the deposit and the authority they hold. Each tier contains one or more roles. Permissions are enforced in the backend; hiding a button is not security.

### 5.1 Tier overview

| Tier | Who | Scope of data | Authority |
|---|---|---|---|
| **Tier A: Institution** | Staff of a technical institution | Own institution only | Submit, respond, request |
| **Tier B: AICTE Operational** | Regulation Bureau staff who process records | Assigned institutions or bureau | Review, verify, mark clearances |
| **Tier C: AICTE Authority** | Officials empowered to decide | Assigned bureau | Approve decisions and exceptions |
| **Tier D: Oversight** | Internal audit, vigilance, management viewers | All, read-only | View, report, verify audit |
| **Tier E: Platform** | Technical administrators | Configuration and accounts | Manage system, not decisions |

### 5.2 Roles in detail

#### Tier A: Institution

**Institution Submitter**
- Registers FDRs for their institution and uploads documents.
- Corrects data in response to information requests.
- Raises renewal, replacement, release and refund requests.
- Sees verification badges and the status of their own requests.
- Receives reminders about maturity and pending actions.
- **Cannot:** see other institutions, change verification levels, approve anything.

#### Tier B: AICTE Operational

**Document Reviewer**
- Works the review queue; compares documents with entered values.
- Records scrutiny observations (case notes).
- Resolves Low and Medium discrepancies, or accepts them with a rationale.
- Can set **Officer-reviewed**.
- **Cannot:** set Bank-confirmed, decide releases, waive checklist items.

**Verification Officer** *(MFA required)*
- Everything a Document Reviewer can do, plus High-severity discrepancies.
- Issues bank confirmation requests, records responses, assesses them.
- The **only** role that can set **Bank-confirmed**.
- **Cannot:** decide releases.

**Clearance Officer**
- Marks release checklist items complete, with evidence.
- Can request an exception for a waivable item.
- **Cannot:** approve exceptions or decide releases.

#### Tier C: AICTE Authority

**Authorized Approver** *(MFA required)*
- Decides release and refund requests: approve, reject, return, defer, with a rationale.
- Approves checklist exceptions requested by someone else.
- **Cannot:** approve a request they raised or prepared; approve their own exception request.

#### Tier D: Oversight

**Auditor**
- Read-only access to all records, histories, documents, reports and the audit log.
- Can run audit chain verification and exports.
- **Cannot:** change anything.

#### Tier E: Platform

**System Administrator** *(MFA required)*
- Creates and disables accounts, assigns roles and scopes.
- Manages configuration: reminder windows, rules, checklist templates.
- Controls the demo clock (demo mode only).
- **Cannot:** approve decisions, edit or delete audit entries, read document contents by default.

### 5.3 Permission matrix

✅ allowed · ◐ own institution or assigned scope only · ❌ not allowed

| Action | Inst. Submitter | Doc. Reviewer | Verif. Officer | Clearance Officer | Auth. Approver | Auditor | Sys. Admin |
|---|---|---|---|---|---|---|---|
| View instruments | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ❌ (metadata only) |
| Create or edit draft FDR | ◐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Upload document | ◐ | ◐ (evidence) | ◐ | ◐ | ❌ | ❌ | ❌ |
| Download document | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ❌ |
| Correct a field (with reason) | ❌ | ◐ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Add case note | ❌ | ◐ | ◐ | ◐ | ◐ | ❌ | ❌ |
| Resolve Low/Medium discrepancy | ❌ | ◐ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Resolve High discrepancy | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Set Officer-reviewed | ❌ | ◐ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Issue or assess bank request | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Set Bank-confirmed | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ | ❌ |
| Raise release request | ◐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mark checklist item | ❌ | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ |
| Request checklist exception | ❌ | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ |
| Approve exception | ❌ | ❌ | ❌ | ❌ | ◐ (not own) | ❌ | ❌ |
| Decide release | ❌ | ❌ | ❌ | ❌ | ◐ (not own) | ❌ | ❌ |
| Record release confirmation | ❌ | ❌ | ◐ | ◐ | ❌ | ❌ | ❌ |
| Import legacy CSV | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ | ✅ |
| View dashboard and reports | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ❌ |
| Verify audit chain | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users and config | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Advance demo clock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (demo only) |

### 5.4 Separation of duties

| Rule | Enforcement |
|---|---|
| Requester ≠ approver | Backend check on every decision |
| Preparer (Clearance Officer who marked items) ≠ approver | Backend check |
| Exception requester ≠ exception approver | Backend check |
| Administrator cannot hold an approval role at the same time | Account validation |
| Nobody can edit or delete audit entries | Database permissions and trigger |

### 5.5 Personas (for UI design)

| Persona | Context | What they need from the portal |
|---|---|---|
| **Priya, accounts officer at an engineering college** | Submits FDRs once a year, forgets renewal dates | Simple upload, clear status, reminders before maturity, a plain list of what AICTE needs from her |
| **Ravi, Regulation Bureau section officer** | Handles hundreds of institutions | A prioritised review queue, side-by-side document and data view, fast note-taking, bulk filters |
| **Meera, deputy director** | Approves releases | A one-screen summary: checklist status, exceptions, verification level, history, then decide |
| **Audit team** | Periodic review | Complete history, exports, proof the log is intact |

---

## 6. Key features

Features are tagged by delivery tier: **T1** core (must work end to end), **T2** makes the demo convincing, **T3** only after T1 and T2 are stable. Each feature maps to a PS capability (C1 to C10).

### F1. Institution and FDR register (C1) · T1

- Institution master: unique ID, name, state, region, status.
- Instrument record: FDR number, bank, branch, IFSC, amount, issue date, maturity date, tenure, auto-renewal flag, lien status, lien in favour of, maturity value, holder name.
- Status axes shown on every record (see 11.1).
- Per-field provenance badge and full field history.
- Search by institution, FDR number, bank; filters on every status axis. (Full-text and saved filters: T2.)

### F2. Document management (C2) · T1, encryption T2, scanning T3

- Upload PDF/JPEG/PNG with type, size and file-signature validation.
- Each upload is an **immutable version**; nothing is replaced.
- SHA-256 hash stored for integrity.
- Download only through an authorized endpoint.
- Envelope encryption (T2). Malware scanning with quarantine (T3).

### F3. Checks engine and discrepancy management (C3) · T1

- Rules in versioned configuration; each result stores rule ID and config version.
- Three classes: blocking, review-required, informational (see 11.3).
- Discrepancy cases with severity, assignee, resolution or accept-with-rationale.
- Case notes for scrutiny observations.
- Normalized duplicate detection across institutions.

### F4. Verification ladder and bank confirmation (C3) · T1, state machine T2, signature check T3

- Levels: Unverified → Officer-reviewed → Bank-confirmed, each with defined evidence (see 11.2).
- Bank confirmation requests with channel, dispatch reference, response and officer assessment.
- Overdue requests escalate.
- Optional advisory PDF signature check with five separate results (T3).

### F5. Validity and maturity tracking (C4) · T1

- Validity **computed** from dates and the clock: active, expiring, matured, lapsed.
- Configurable reminder window and grace period.
- Simulated clock for demonstration.

### F6. Renewal and replacement (C5) · T1, renewal cases T2

- Link a renewed or replacement FDR to its predecessor.
- Predecessor becomes **superseded**, not deleted.
- Complete chain of an institution's deposits over time.

### F7. Release and refund workflow (C6) · T1

- Request with reason and documents.
- Checklist built from a versioned template; template version saved on the request.
- Mandatory items block progress; waivable items can be excepted only by a second authorized person with a reason.
- Authorized decision with rationale.
- Separate release confirmation; instrument closes only then.

### F8. Alerts and escalation (C7) · T2

- Reminder rules (example windows 90/60/30/15/7 days before maturity).
- Idempotent generation: never duplicate reminders.
- In-app and email notifications; SMS via adapter only.
- One escalation path: institution → verification officer → bureau head.

### F9. Dashboard and reports (C8) · T1 dashboard, T2 CSV and digest, T3 XLSX/PDF

- Six PS categories: Active, Expiring, Matured, Renewed, Released, Pending.
- Role-specific dashboards.
- Reports: pending verifications, upcoming maturities (30/60/90), missing documents, open discrepancies by age, overdue renewals, stale releases, verification level distribution.
- Weekly digest.

### F10. Audit trail and access control (C9) · T1 audit and scoping, T2 hash chain and MFA, T3 RLS

- Every important action logged with actor, target, before/after summary, reason, correlation ID.
- Hash chain with verification and tamper detection (T2).
- Role-based access, institution scoping on every query, separation of duties.
- TOTP MFA for privileged roles (T2).

### F11. Legacy data import (C1, C10) · T2

- CSV/XLSX upload, column mapping, validation, dry run, commit.
- Duplicates imported and flagged, never dropped.
- Error report with line numbers and reasons.

### F12. KPI panel (PS improvement requirement) · T1 event capture, T2 panel

- K1 to K7 (section 13) with sample size and observation period.

### F13. Integration adapters (C10) · T1 mock

- VerificationProvider, NotificationProvider, InstitutionSystemAdapter.
- Disabled unless configured; mock implementations labelled SIMULATED.

### F14. Demo controls · T1

- Simulated clock (forward only, audited, bannered).
- One-command reset and seed with synthetic data.

---

## 7. Application workflow

### 7.1 End-to-end lifecycle

```text
 INSTITUTION                      SYSTEM                          AICTE
 ───────────                      ──────                          ─────
 Register FDR + upload  ───────►  Validate, store, hash
                                  Run checks
                                    ├─ blocking?  ── needs_info ─► (back to institution)
                                    ├─ review-required ─► open case ─────► Reviewer resolves, notes
                                    └─ informational ─► shown to reviewer
                                                                   Reviewer: Officer-reviewed
                                                                   Verif. Officer: bank request
                                                                   Bank response recorded
                                                                   Assessment accepted:
                                                                   Bank-confirmed
                                  Instrument in force
                                  Daily: compute validity
                                  Reminders before maturity ────► Institution and officer alerted
 Submit renewal FDR ───────────►  Link, supersede old           Reviewed as new FDR
          or
 Request release ──────────────►  Build checklist             Clearance Officer marks items
                                  Block if mandatory open      Approver decides (not requester)
                                                               Release confirmed separately
                                  Instrument closed
 Every step:  audit event + metric event
```

### 7.2 Workflow 1: New FDR submission

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Institution Submitter | Creates draft FDR, enters fields | Values stored with source `institution_entered`; history row written |
| 2 | Institution Submitter | Uploads FDR document | Validated, stored privately, hashed, version created |
| 3 | Institution Submitter | Submits | Blocking validation runs. Failure: stays in draft with `needs_info` and reasons. Success: lifecycle `submitted`, metric `submitted` |
| 4 | System | Runs checks | Review-required results open discrepancy cases; informational signals attached |
| 5 | System | Queues for review | Appears in officer queue with flags |

### 7.3 Workflow 2: Review and discrepancy resolution

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Document Reviewer | Opens case | Side-by-side view: entered value, extracted candidate, document page, rule and reason |
| 2 | Reviewer | Requests info, corrects value, or accepts with rationale | Correction keeps original in history with evidence and reason |
| 3 | Reviewer | Adds scrutiny note | Note stored and linked |
| 4 | Reviewer | Marks officer-reviewed | Allowed only if no open High/Medium cases and mandatory documents are present |

### 7.4 Workflow 3: Bank confirmation

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Verification Officer | Issues request (letter, email, bank portal) | State `requested`; printable request generated; metric `bank_request_issued` |
| 2 | System | Waits | If no response after configured days: overdue, escalation |
| 3 | Verification Officer | Records response, uploads it | State `response_recorded`. **Level does not change yet** |
| 4 | Verification Officer | Assesses: accepted, rejected or inconclusive, with rationale | Accepted: level becomes Bank-confirmed; metric `bank_confirmed` |
| 5 | Anyone authorized | Edits a key field later | Level automatically drops to Officer-reviewed; re-verification required |

### 7.5 Workflow 4: Maturity tracking and reminders

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Worker (daily) | Computes validity for in-force FDRs | Using maturity date, window, grace period, clock |
| 2 | Worker | Instrument enters a reminder window | One notification per rule and instrument (idempotency key) |
| 3 | Worker | Matured with no successor or release | Overdue case; escalation per rules |
| 4 | Dashboard | Always | Shows current category counts, derived live |

### 7.6 Workflow 5: Renewal or replacement

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Institution Submitter | Submits new FDR, marks it as renewal of the old one | New instrument goes through Workflows 1 to 3 |
| 2 | Verification Officer | Accepts the link | Old instrument becomes `superseded`; link recorded; renewal case closed; metric `renewal_actioned` |
| 3 | Anyone authorized | Views history | Full chain of predecessor and successor instruments |

### 7.7 Workflow 6: Release or refund

| Step | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | Institution Submitter | Raises request with reason and documents | Template version fixed on request; metric `release_requested` |
| 2 | Officer | Completeness review | May return with reasons |
| 3 | Clearance Officer | Marks checklist items with evidence | Readiness re-evaluated |
| 4 | Clearance Officer | Requests exception on a waivable item, if needed | Requires a reason |
| 5 | Authorized Approver (different person) | Approves exception | Item shown as "waived by X, reason Y" |
| 6 | System | All mandatory items done or excepted | State `ready_for_decision` |
| 7 | Authorized Approver (not requester, not preparer) | Decides with rationale | Metric `release_decided` |
| 8 | Officer | Records release confirmation evidence | Metric `release_confirmed`; instrument `closed` |

### 7.8 Workflow 7: Legacy import

Upload → map columns → validate rows → detect duplicates → dry-run preview → commit as `unverified` with source `imported` → error report download. Imported records enter the review queue like new submissions.

---

## 8. Solution architecture

### 8.1 Architectural style

A **modular monolith**: one deployable backend with clearly separated internal modules, one relational database, private document storage and one background worker. This is the simplest design that meets the PS for a six-person team, and modules can be split out later if real scale ever demands it.

### 8.2 Logical architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Browser: React + TypeScript                   │
│   Role dashboards | Records | Review queue | Release | KPIs      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS (JSON API)
┌────────────────────────────────▼─────────────────────────────────┐
│                       Backend: FastAPI                           │
│ ┌──────────────── Cross-cutting services ──────────────────────┐ │
│ │ Auth + sessions | RBAC | Scoping layer | Validation | Clock  │ │
│ │ Audit writer | Metric event writer | MFA (T2)                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────── Domain modules ─────────────────────────────────┐  │
│ │ Records:      Institutions, Instruments, Documents, Search,  │  │
│ │               Import                                         │  │
│ │ Verification: Checks, Discrepancies, Case notes,             │  │
│ │               Verification levels, Bank requests, Signature  │  │
│ │ Lifecycle:    Validity, Renewal links, Reminders, Escalation │  │
│ │ Release:      Requests, Checklist, Exceptions, Decisions,    │  │
│ │               Confirmations                                  │  │
│ │ Reporting:    Dashboard, Reports, KPIs                       │  │
│ └──────────────────────────────────────────────────────────────┘ │
└────────┬───────────────────────────────────┬─────────────────────┘
         │                                   │
┌────────▼─────────────┐          ┌──────────▼──────────────────────┐
│ PostgreSQL 16        │          │ Private document storage        │
│ records, history,    │          │ outside web root, encrypted,    │
│ cases, jobs, audit,  │          │ generated keys                  │
│ metrics, config      │          └─────────────────────────────────┘
└────────┬─────────────┘
         │
┌────────▼─────────────────────────────────────────────────────────┐
│ Background worker: validity run, reminders, escalation,          │
│ notification delivery, text extraction, digests, (OCR, scan)     │
└──────────────────────────────────────────────────────────────────┘
Adapters (off unless configured, mock in demo, labelled SIMULATED):
  VerificationProvider | NotificationProvider | InstitutionSystemAdapter
```

### 8.3 Module responsibilities

| Module | Responsibility | Owns tables |
|---|---|---|
| Identity and access | Login, sessions, roles, scopes, MFA | `users`, `roles`, `permissions`, `user_scopes` |
| Institutions | Institution master | `institutions` |
| Instruments | FDR records, provenance, field history, duplicate keys | `instruments`, `field_provenance`, `field_value_history` |
| Documents | Upload, versions, storage, download authorization | `documents`, `document_versions` |
| Import | Legacy CSV/XLSX import | `import_batches`, `import_errors` |
| Checks | Rule execution and results | `check_results`, `config_versions` (rules) |
| Discrepancies | Cases, resolution, notes | `discrepancy_cases`, `case_notes` |
| Verification | Levels, events, bank requests, signature results | `verification_events`, `bank_confirmation_requests` |
| Lifecycle | Validity computation, links, renewal cases | `instrument_links`, `renewal_cases` |
| Notifications | Reminder rules, outbox, delivery | `reminder_rules`, `notifications` |
| Escalation | Escalation rules and overdue cases | `escalation_rules` |
| Release | Requests, checklists, exceptions, decisions, confirmations | `release_requests`, `checklist_items`, `release_exceptions`, `decisions`, `release_confirmations` |
| Reporting | Dashboards, reports, KPIs | reads only; `metric_events` |
| Audit | Hash-chained log and verification | `audit_events`, `audit_chain_head` |
| Jobs | Background task queue | `jobs` |
| Clock | The single source of "now" | demo offset in config |

**Rules for modules:** communicate through service functions, never reach into another module's tables directly; no business logic in route handlers; no circular imports.

### 8.4 Key architectural mechanisms

**Clock service.** The only place code reads the current time. In demo mode an admin can move it forward (never back); every move is audited and a banner is always visible.

**Scoping layer.** One shared function adds the institution or bureau filter to every query. No endpoint writes its own scope filter. Every endpoint, download, export and job goes through it.

**Job interface.** Business code uses only four operations: `enqueue_job`, `claim_job`, `complete_job`, `retry_job`. PostgreSQL implements claiming with `SELECT … FOR UPDATE SKIP LOCKED`. Jobs are idempotent and their failures are visible.

**Transactions.** A state change, its audit event and its metric event commit together or not at all. A failed notification never rolls back a workflow change.

**Adapters.** External systems sit behind small interfaces. Each adapter result is labelled authoritative, advisory or informational.

### 8.5 Deployment

**Prototype:** one host, Docker Compose with four services: `frontend` (static build served by a reverse proxy), `api` (FastAPI), `worker`, `db` (PostgreSQL). Documents on a mounted private volume. Master key from an environment variable or mounted secret.

**Pilot or production direction:** separate app and database hosts, TLS, firewall, managed backups, monitoring, managed key service, documented patching and incident response, formal security review before any real data.

---

## 9. Technology stack

### 9.1 Decided stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | **React 18 + TypeScript** | Multi-screen admin UI, type safety, team familiarity |
| Styling and components | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible components |
| Data fetching | **TanStack Query** | Caching, loading and error states |
| Forms and validation | **React Hook Form + Zod** | Schema validation shared in spirit with backend |
| Routing | **React Router** | Standard |
| Charts | **Recharts** | Simple dashboard and KPI charts |
| API client | Generated from OpenAPI (for example `openapi-typescript`) | Frontend and backend cannot drift |
| Backend framework | **FastAPI (Python 3.11+)** | Fast to build, automatic OpenAPI, strong for document processing |
| Data validation | **Pydantic v2** | Request and response schemas |
| ORM and migrations | **SQLAlchemy 2.0 + Alembic** | Mature, explicit transactions |
| Database | **PostgreSQL 16** | Integrity, transactions, full-text and trigram search, row locking |
| Authentication | **fastapi-users** (or Authlib) | Do not write password handling ourselves |
| MFA | **pyotp** (TOTP) | Simple, offline |
| Encryption | **cryptography** (AES-256-GCM) | Envelope encryption for documents |
| Scheduling | **APScheduler** + `jobs` table | No separate queue service needed |
| PDF text | **pypdf** or **pdfplumber** | Permissive licences (PyMuPDF is AGPL; avoid unless decided) |
| PDF signatures | **pyHanko** | Advisory signature check (T3) |
| OCR | **Tesseract** via pytesseract | Optional (T3) |
| Malware scanning | **ClamAV** | Offline (T3) |
| Reports | csv (T2), **openpyxl** and **WeasyPrint/ReportLab** (T3) | Exports |
| Testing (backend) | **pytest**, httpx test client | Unit and API tests |
| Testing (frontend) | **Vitest**, React Testing Library | Component tests |
| End-to-end | **Playwright** | Demo scenarios as automated tests |
| Code quality | ruff, black, mypy; ESLint, Prettier | Consistent code |
| Containers | **Docker + Docker Compose** | One-command setup |
| Reverse proxy | **Caddy** or Nginx | TLS and static frontend |
| Version control | Git, GitHub, protected main branch | Pull requests reviewed by integrator |

### 9.2 Rules

- **One backend language.** Switch to Node/TypeScript only if the team is clearly stronger there, decided in Phase 0, never mixed.
- **No new dependency without a reason** recorded in the pull request.
- **No external cloud service** in the core workflow.
- **Check licences** of any new library before adding it.

---

## 10. Data model

### 10.1 Core entities

| Entity | Purpose | Key fields |
|---|---|---|
| `institutions` | Institution master | `id`, `aicte_id` (unique), `name`, `state`, `region`, `status` |
| `instruments` | One FDR or deposit | `id`, `institution_id`, `instrument_type`, `fdr_number`, `bank_name`, `branch`, `ifsc`, `amount NUMERIC(14,2)`, `issue_date`, `maturity_date`, `tenure_months`, `auto_renewal`, `lien_status`, `lien_in_favour_of`, `maturity_value`, `holder_name`, `lifecycle`, `verification_level`, `fdr_key_norm`, `fdr_key_loose`, `bank_code`, `row_version`, timestamps |
| `field_provenance` | Current value and its source per key field | `instrument_id`, `field_name`, `value`, `source`, `source_ref`, `confidence`, `recorded_by`, `recorded_at` |
| `field_value_history` | Every change, append only | `instrument_id`, `field_name`, `old_value`, `new_value`, `source`, `evidence_ref`, `reason`, `changed_by`, `changed_at` |
| `documents` | Logical document | `id`, `owner_type`, `owner_id`, `document_type`, `review_state` |
| `document_versions` | Immutable upload | `id`, `document_id`, `storage_key`, `sha256`, `size`, `mime`, `original_filename`, `uploaded_by`, `uploaded_at`, `wrapped_data_key`, `signature_result` |
| `extraction_results` | Candidate values from documents | `document_version_id`, `field_name`, `value`, `page`, `region`, `confidence`, `engine`, `engine_version` |
| `check_results` | Output of each rule | `instrument_id`, `rule_id`, `config_version`, `class`, `outcome`, `severity`, `evidence` |
| `discrepancy_cases` | Review-required issues | `id`, `instrument_id`, `check_result_id`, `severity`, `state`, `assignee`, `resolution`, `rationale`, timestamps |
| `case_notes` | Scrutiny observations | `id`, `target_type`, `target_id`, `author`, `text`, `created_at` |
| `verification_events` | Each level change | `instrument_id`, `from_level`, `to_level`, `method`, `evidence_ref`, `reason`, `actor`, `at` |
| `bank_confirmation_requests` | Bank verification process | `id`, `instrument_id`, `state`, `channel`, `dispatch_ref`, `requested_by/at`, `response_at`, `response_channel`, `response_document_version_id`, `assessment`, `assessed_by/at`, `rationale` |
| `instrument_links` | Renewal and replacement | `predecessor_id`, `successor_id`, `link_type`, `accepted_by`, `accepted_at` |
| `renewal_cases` | Renewal tracking | `instrument_id`, `state`, `due_date`, `outcome` |
| `release_requests` | Release or refund | `id`, `instrument_id`, `request_type`, `state`, `reason`, `requested_by`, `template_id`, `template_version`, timestamps |
| `checklist_items` | Items per request | `release_request_id`, `item_code`, `label`, `mandatory`, `waivable`, `state`, `evidence_ref`, `marked_by`, `marked_at` |
| `release_exceptions` | Waivers | `checklist_item_id`, `requested_by`, `approved_by`, `rationale`, `at` |
| `decisions` | Authorized decisions | `release_request_id`, `decision`, `rationale`, `decided_by`, `decided_at`, `exception_refs` |
| `release_confirmations` | Evidence of completion | `release_request_id`, `evidence_ref`, `artifact_ref`, `recorded_by`, `recorded_at` |
| `reminder_rules`, `escalation_rules` | Configuration | windows, triggers, recipients, days overdue |
| `notifications` | Outbox | `recipient`, `event`, `idempotency_key` (unique), `due_at`, `state`, `attempts`, `last_error` |
| `jobs` | Background work | `type`, `payload`, `idempotency_key`, `state`, `run_at`, `attempts`, `error` |
| `metric_events` | KPI milestones | `instrument_id`, `case_id`, `event`, `at`, `actor` |
| `audit_events` | Hash-chained log | `seq`, `actor`, `action`, `target_type`, `target_id`, `correlation_id`, `summary`, `reason`, `evidence_ref`, `prev_hash`, `hash`, `at` |
| `audit_chain_head` | Single row: last `seq` and `hash` | |
| `import_batches`, `import_errors` | Import tracking | counts, file ref, row number, reason |
| `config_versions` | Rules, templates, windows | `kind`, `version`, `content JSON`, `active` |
| `users`, `roles`, `permissions`, `user_scopes` | Access | MFA secret encrypted, scope to institution or bureau |

### 10.2 Relationships

```text
institutions 1──* instruments 1──* documents 1──* document_versions
instruments 1──* field_provenance, field_value_history, check_results
check_results 1──0..1 discrepancy_cases 1──* case_notes
instruments 1──* verification_events, bank_confirmation_requests
instruments *──* instruments  (through instrument_links)
instruments 1──* release_requests 1──* checklist_items 1──* release_exceptions
release_requests 1──* decisions ; 1──0..1 release_confirmations
users 1──* user_scopes
```

### 10.3 Integrity rules

- Foreign keys everywhere. Unique constraints only where truly unique (`aicte_id`, `notifications.idempotency_key`, `jobs.idempotency_key`). **Never unique on FDR number.**
- Money is `NUMERIC(14,2)`. Never float.
- Timestamps in UTC; user-facing times and notification schedules in IST.
- State change, audit event and metric event commit in one transaction.
- Optimistic concurrency with `row_version` on editable records.
- Original document versions and original submitted values are never deleted or overwritten.
- No passwords, tokens or document contents in logs.

---

## 11. Business rules

### 11.1 Status axes

An instrument is described by independent axes, never one status field.

| Axis | Stored or computed | Values | Meaning |
|---|---|---|---|
| `verification_level` | Stored, changes only through events | `unverified`, `officer_reviewed`, `bank_confirmed` | How far can we trust this record? |
| `lifecycle` | Stored | `draft`, `submitted`, `in_force`, `superseded`, `closed` | Where is it administratively? |
| `validity_state` | **Computed** | `active`, `expiring`, `matured`, `lapsed` | Is it time-sensitive? |
| `review_flag` | **Derived** from open cases | `clear`, `needs_info`, `discrepancy_open` | Is something blocking? |

**Validity computation** with maturity date `M`, reminder window `W`, grace period `G`, clock time `t`:

| State | Condition |
|---|---|
| `active` | `t < M − W` |
| `expiring` | `M − W ≤ t < M` |
| `matured` | `M ≤ t < M + G`, no successor, not released |
| `lapsed` | `t ≥ M + G`, no successor, not released |

**Dashboard categories (derived, never stored as counters):**

| Category | Rule |
|---|---|
| Active | `in_force` and `active` |
| Expiring | `in_force` and `expiring` |
| Matured | `in_force`, `matured` or `lapsed`, no successor |
| Renewed | has a successor link |
| Released | `closed` with a release confirmation |
| Pending | any open discrepancy, verification, bank request, renewal or release case |

An instrument may be in two categories (for example Active and Pending); the dashboard says so. A released instrument is never Active.

### 11.2 Verification levels and evidence

| Level | Required evidence | Who can set |
|---|---|---|
| `unverified` | None | System |
| `officer_reviewed` | Review event with notes; no open High or Medium case (or accepted with rationale); mandatory documents present | Document Reviewer, Verification Officer |
| `bank_confirmed` | Accepted bank confirmation: response recorded, response document stored, officer assessment with rationale | Verification Officer only |

**Supporting evidence, never sufficient alone:** PDF signature result, extraction match, document hash.

**Automatic downgrade to `officer_reviewed`** when a bank-confirmed key field (FDR number, bank, amount, issue date, maturity date, lien details) is edited, a new High case opens, or the underlying document version is superseded. Downgrades are audited.

### 11.3 Check catalogue

| Rule | Class | Severity |
|---|---|---|
| Mandatory field missing | Blocking | — |
| Mandatory document missing | Blocking | — |
| Maturity date not after issue date | Blocking | — |
| Amount zero or negative | Blocking | — |
| IFSC malformed (expected 4 letters, `0`, 6 alphanumerics) | Blocking | — |
| Unparseable date | Blocking | — |
| Entered value differs from extracted value | Review-required | Medium or High |
| Holder or lien-in-favour-of name inconsistent | Review-required | High |
| Exact normalized duplicate key on another record | Review-required | High |
| Loose duplicate key (leading zeros ignored) | Review-required | Medium |
| Amount below configured minimum | Review-required | Medium |
| Tenure below configured minimum | Review-required | Medium |
| Signature present but integrity invalid | Review-required | Medium |
| Identical instrument-document file under another institution | Review-required | High |
| PDF modified after creation | Informational | — |
| Unusual PDF producer software | Informational | — |
| No signature present | Informational | — |
| Same-institution re-upload of identical file | Informational | — |

**Behaviour:** blocking stops only the specific transition and marks `needs_info`; review-required opens a case; informational is shown only. No rule deletes, rejects or accuses. UI wording: "Needs review: <reason>".

**Duplicate key normalization:**
- `bank_code` = first 4 characters of IFSC, else normalized bank name.
- `fdr_key_norm` = uppercase, strip everything except letters and digits, keep leading zeros.
- `fdr_key_loose` = `fdr_key_norm` without leading zeros.
- Both indexed, **non-unique**.

### 11.4 Release rules

- Checklist template is versioned; the request stores the version it used.
- Open mandatory item blocks `ready_for_decision`.
- Non-waivable items can never be bypassed.
- Waivable item exception: requested with reason, approved by a **different** Authorized Approver.
- Decision only by Authorized Approver who is neither requester nor preparer.
- Approval is not release. The instrument closes only when a release confirmation is recorded.
- Elapsed time never implies approval.

### 11.5 Notification rules

- Reminder windows and grace period are configuration (demo defaults: 90/60/30/15/7 days, 30-day grace; labelled as examples).
- One notification per instrument, rule and window (idempotency key).
- Failed delivery retries with backoff, stays visible, never rolls back workflow.

---

## 12. Security and compliance

### 12.1 Access control

- Authorization on every route, download, export and job.
- Single scoping layer for institution and bureau boundaries.
- Separation of duties (5.4) enforced in backend.
- Sessions: secure, HTTP-only cookies; CSRF protection; expiry and revocation; login rate limiting.
- TOTP MFA for Verification Officer, Authorized Approver, System Administrator (T2), with recovery codes and audited admin reset.
- Row-level security in PostgreSQL is **optional (T3)** and only if all of: application role is not table owner and has no `BYPASSRLS`; `FORCE ROW LEVEL SECURITY`; scope set with `SET LOCAL` per transaction; separate worker and migration roles; full cross-institution test suite passes. Never claim database-enforced scoping without this.

### 12.2 Document protection

- Allow-list types; size limit; file signature (magic bytes) check.
- Generated storage keys; never use user filenames as paths; storage outside web root.
- Envelope encryption (T2): random per-file data key, AES-256-GCM; data key wrapped with master key; master key from environment or mounted secret, **never in database or backups**.
- A separate, secured copy of the master key is kept; restore tests prove decryption.
- ClamAV quarantine before reviewers can open a file (T3; required before real data).
- Filenames, extracted text and contents treated as untrusted input.

**Honest limit:** the prototype key arrangement is a convenience. Production needs a hardware security module or managed key service, rotation and a recovery procedure.

### 12.3 Audit trail

- Events: actor, action, target, correlation ID, safe before/after summary, reason, evidence reference, timestamp, `seq`, `prev_hash`, `hash`.
- Canonical JSON (sorted keys, UTF-8, fixed timestamp format); `hash = SHA-256(prev_hash ‖ payload)`.
- Append inside the business transaction while holding a row lock on `audit_chain_head`, giving a gapless, ordered chain.
- Application database role has INSERT and SELECT only; a trigger blocks UPDATE and DELETE.
- Verification reports the first broken link, any sequence gap and any head mismatch.
- **Tamper-evident, not tamper-proof:** someone able to rewrite the whole table could recompute it. Optional checkpoint export to separately controlled storage (T3).

### 12.4 Application security checklist

- Parameterized queries only (ORM).
- Input validation on every endpoint (Pydantic).
- Security headers via reverse proxy.
- Dependencies scanned before release.
- No secrets in source control; `.env.example` only.
- Synthetic data only in development and demos.
- No documents sent to external OCR, AI or analytics services.

### 12.5 Compliance considerations (roadmap, not prototype claims)

- Digital Personal Data Protection Act 2023.
- CERT-In logging and incident-reporting directions.
- GIGW accessibility guidelines for government websites.
- Hindi and regional language support.
- Digital Signature Certificates or eSign for approvals.
- Formal security audit before real data.

---

## 13. KPIs and metrics

### 13.1 Why metrics matter here

The PS requires the prototype to **demonstrate measurable improvements**. We meet this honestly: the portal records milestone events from day one and computes KPIs from them. We never present invented percentages.

### 13.2 Milestone events

| Event | Written when |
|---|---|
| `submitted` | Institution submits and blocking validation passes |
| `auto_checked` | Checks engine completes |
| `flag_opened` | Discrepancy case opens |
| `flag_resolved` | Case resolved or accepted with rationale |
| `officer_review_started` | Reviewer opens the record for review |
| `officer_reviewed` | Level becomes officer_reviewed |
| `bank_request_issued` | Bank confirmation request issued |
| `bank_response_recorded` | Response recorded |
| `bank_confirmed` | Level becomes bank_confirmed |
| `reminder_sent` | Reminder delivered |
| `renewal_actioned` | Successor link accepted |
| `release_requested` | Release request submitted |
| `release_decided` | Authorized decision recorded |
| `release_confirmed` | Release confirmation recorded |

### 13.3 Product KPIs (mapped to PS improvement areas)

| ID | KPI | PS area | Definition | Start → End | Exclusions and notes | Direction |
|---|---|---|---|---|---|---|
| K1 | Record completeness | Record accuracy | % of in-scope instruments with all mandatory fields and documents and no open High/Medium case | Snapshot | Superseded and closed excluded; show numerator and denominator | ↑ |
| K2a | Initial review time | Verification turnaround | Median and p90 time | `submitted` → `officer_review_started` | Clock restarts after `needs_info` resubmission | ↓ |
| K2b | Officer verification time | Verification turnaround | Median and p90 | `submitted` → `officer_reviewed` | Open cases reported separately | ↓ |
| K2c | Bank confirmation time | Verification turnaround | Median and p90 | `bank_request_issued` → `bank_confirmed` | Unanswered requests listed, not averaged | ↓ |
| K3 | Discrepancy resolution time | Record accuracy | Median and p90 | `flag_opened` → `flag_resolved` | Open cases reported with age | ↓ |
| K4 | Renewal timeliness | Timely renewal monitoring | % actioned before maturity | Enters reminder window → `renewal_actioned` | Denominator: instruments entering window in period | ↑ |
| K5 | Release decision time | Pending case visibility | Median and p90 | `release_requested` → `release_decided` | Decision is not release; confirmation time shown separately | ↓ |
| K6 | Overdue backlog | Pending case visibility | Count and age of overdue verifications, discrepancies, renewals, releases | Snapshot | Broken down by type and age band | ↓ |
| K7 | Manual effort comparison | Manual tracking effort | Time and steps for fixed tasks: spreadsheet vs portal | Scripted | **Illustrative only** | ↓ |

### 13.4 Operational and quality metrics (internal)

| Metric | Purpose |
|---|---|
| Verification level distribution | Share of portfolio at each trust level |
| Discrepancy rate by rule | Which rules fire most; tune thresholds |
| False-positive rate (cases accepted with rationale) | Rule quality |
| Import rejection rate and top reasons | Data quality of legacy records |
| Notification delivery success and retries | Reliability |
| Failed and retried jobs | Worker health |
| Audit chain verification status | Integrity |
| API p95 latency, error rate | Performance |

### 13.5 Presentation rules

- Every KPI shows **sample size (n)** and **observation period**.
- n = 0 shows **"no data"**, never 0%.
- Demo results are labelled "measured from the demonstration run". No extrapolation to institutional outcomes.
- K7 baseline is stated as an assumption or a scripted timing unless AICTE provides real data.

### 13.6 Target for the demo

Not a numeric target, because demo numbers are generated by us. The target is that **every KPI is computable, shown with n and period, and traceable to its events**. Judges should be able to click a KPI and see the underlying records.

---

## 14. Non-functional requirements

| Category | Requirement (prototype) |
|---|---|
| Performance | Dashboard loads in under 2 seconds with 5,000 instruments; list APIs paginated; p95 API under 500 ms for ordinary reads |
| Scalability | Designed for tens of thousands of instruments on one host; modules separable later |
| Availability | Best effort on one host; documented recovery steps |
| Reliability | Idempotent jobs; worker restart safe; failed tasks visible and retryable |
| Data integrity | Transactions for state, audit and metrics; no float money; history preserved |
| Backup and restore | Daily encrypted backup of database and documents together; restore test verifies counts, hashes, decryption and audit chain |
| Security | Section 12 |
| Usability | Each role sees a focused home screen; any record's status understandable without training; clear badges and reasons |
| Accessibility | Keyboard navigation, readable contrast, form labels; GIGW alignment in roadmap |
| Localisation | English for prototype; strings externalised for Hindi later |
| Browser support | Current Chrome, Edge, Firefox; layout usable on a laptop and tablet |
| Observability | Structured logs with correlation IDs; health endpoint; operations panel for jobs and notifications |
| Portability | Runs offline via Docker Compose; no mandatory external services |
| Maintainability | Modular boundaries, typed code, linting, tests in CI |

---

## 15. Delivery plan and team structure

### 15.1 Phases

| Phase | Content | Exit gate |
|---|---|---|
| **Phase 0: Contract freeze** | Enums, transition tables, OpenAPI contract, role-permission matrix, error format, event names, seed data spec, demo script, owners, definition of done | Contract frozen; changes only via integrator |
| **Phase 1: Tier 1 core** | Foundation, records, checks and review, verification, lifecycle and clock, release, dashboard and metrics, seed and reset | Submit-to-release works end to end; cross-institution access denied; provenance and history visible; clock jump changes dashboard; every action writes audit and metric events |
| **Phase 2: Tier 2 convincing** | Jobs, reminders, escalation; bank request state machine; import; hash chain; MFA; encryption; KPI panel; CSV reports; full search; security tests | One reminder then escalation on clock jump; import error report; tamper detected; KPI with n and period; restore test passes |
| **Phase 3: Tier 3 optional** | Signature advisory, OCR, ClamAV, XLSX/PDF, RLS, audit checkpoints, multi-level escalation | Each item independent; pick by value |

### 15.2 Phase 1 build order

```text
Foundation (repo, compose, migrations, auth, roles, scoping, audit, metrics, clock)
   └─► Records (institutions, instruments, provenance, history, duplicate keys, documents)
          ├─► Checks and review (rules, cases, notes)
          │      └─► Verification (levels, evidence, manual bank record, revocation)
          │             └─► Release (checklist, exceptions, decision, confirmation)
          └─► Lifecycle (computed validity, links, supersession)
                         └─► Dashboard and metrics ─► Seed and reset
```

### 15.3 Cut order if time runs short

1. All Tier 3 items.
2. From Tier 2: full-text search, weekly digest, multi-step escalation, envelope encryption (keep disk encryption and say so), TOTP.

**Never cut:** provenance and history, discrepancy flow, verification evidence rules, simulated clock, release blocking, audit events, scoping tests, KPI event capture.

### 15.4 Team structure (six members)

| Workstream | Owner | Responsibilities | Pairs with |
|---|---|---|---|
| **A. Backend and domain lead (integrator)** | Member 1 | Data model, migrations, state machines, transactions, API contract, code review, merges | Everyone |
| **B. Backend security and platform** | Member 2 | Auth, roles, scoping layer, audit chain, documents and encryption, MFA, worker and jobs | A |
| **C. Frontend: records and review** | Member 3 | Instrument and document screens, provenance badges, review queue, discrepancy view, case notes | A |
| **D. Frontend: workflows** | Member 4 | Verification and bank request screens, renewal linking, release and checklist screens, exceptions, decisions | A |
| **E. Frontend: dashboard and reporting** | Member 5 | Dashboards, KPI panel, reports and exports, audit timeline, import wizard, shared components | B |
| **F. Quality, data and demo** | Member 6 | Seed data and reset, Playwright scenarios, security tests, mock adapters, setup docs, demo script and rehearsal | All |

Adjust names to actual skills. **One integrator owns the contract.** Nobody changes an enum, endpoint or table without them.

### 15.5 Ways of working

- Main branch protected; pull requests reviewed by the integrator (or delegate).
- Daily integration build that runs the end-to-end scenarios.
- Short daily sync: what is merged, what is blocked, contract change requests.
- Definition of done (Appendix D) applies to every feature.

### 15.6 Suggested repository layout

```text
fdr-portal/
├── backend/
│   ├── app/
│   │   ├── core/          # config, clock, security, scoping, db session
│   │   ├── modules/
│   │   │   ├── identity/  institutions/  instruments/  documents/
│   │   │   ├── checks/    discrepancies/ verification/ lifecycle/
│   │   │   ├── release/   notifications/ escalation/   reporting/
│   │   │   ├── audit/     jobs/          imports/      adapters/
│   │   │   └── each: models.py, schemas.py, service.py, routes.py
│   │   └── main.py
│   ├── migrations/        # Alembic
│   ├── worker/            # scheduler entry point
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── api/           # generated client
│   │   ├── components/    # shared UI, badges, tables
│   │   ├── features/      # records, review, verification, release, dashboard, admin
│   │   └── routes/
│   └── tests/
├── e2e/                   # Playwright scenarios
├── seed/                  # synthetic data, legacy CSV with planted defects
├── config/                # rules, checklist templates, reminder windows
├── docs/                  # this document, contract, ADRs
├── docker-compose.yml
├── .env.example
└── Makefile               # up, reset-demo, test, lint
```

---

## 16. Testing strategy

### 16.1 Levels

| Level | Tool | Covers |
|---|---|---|
| Unit | pytest, Vitest | Rules, normalization, validity computation, state transitions, hashing |
| API | pytest + httpx | Every endpoint: success, validation failure, authorization failure |
| End-to-end | Playwright | The six PS scenarios and the demo script |
| Security | pytest + Playwright | Scope, roles, separation of duties, uploads, audit |
| Reliability | scripted | Worker restarts, retries, restore |

### 16.2 PS test scenarios (mandatory)

| Scenario | Pass criteria |
|---|---|
| New FDR submission | Record `unverified`; document stored and hashed; provenance and history written; audit and metric events written; appears in queue |
| Validity tracking | Correct bucket for every seeded FDR; correct on day before, day of, day after maturity and at end of grace |
| Approaching maturity | Clock advance produces exactly one reminder per rule; repeat advance or job retry creates none |
| Renewal | Old instrument `superseded`, not deleted; both in history; counted as Renewed |
| Discrepancy identification | Bad date blocks with `needs_info`; amount mismatch and duplicate open cases; resolution with note; original values preserved |
| Authorized release | Blocked with open mandatory item; non-waivable cannot be waived; exception needs a different approver; only Authorized Approver decides; confirmation separate; instrument closes only after confirmation |

### 16.3 Critical functional tests

- Formatting variants of an FDR number produce the same normalized key.
- Duplicate never rejects a record; it opens a case.
- Officer correction preserves the original value and reason.
- `officer_reviewed` blocked while High or Medium cases are open.
- `bank_confirmed` impossible from an uploaded response alone.
- Editing a bank-confirmed key field downgrades the level.
- Blocking validation never deletes a submission.
- Released instrument with future maturity is not counted as Active.
- Dashboard counts equal direct query counts.
- KPI with n = 0 shows "no data".

### 16.4 Security tests

- Institution A cannot read Institution B's records, documents, exports or reports.
- Guessed IDs return denied and are audited.
- Read-only roles cannot modify.
- Self-approval and preparer-approval rejected.
- Path traversal and spoofed MIME rejected.
- Expired or revoked session denied.
- Audit chain detects modified, deleted and reordered rows.
- 50 concurrent writers produce a gapless valid chain.
- Application role cannot update or delete audit rows.
- Encrypted files unreadable without the key; key absent from database and backups.
- Administrator cannot approve or read documents by default.
- Logs contain no secrets or document contents.

### 16.5 Reliability tests

- Failed extraction keeps the original file.
- Worker restart resumes without duplicates.
- Notification failure does not roll back workflow.
- Restore into a clean environment: counts, hashes, decryption and audit chain all verify.
- Clock only moves forward; reset restores real time.

---

## 17. Demonstration plan

### 17.1 Setup

- `make reset-demo` loads synthetic data: institutions, FDRs in every validity bucket, a legacy CSV with defects (bad dates, bad IFSC, formatting-variant duplicates, a cross-institution duplicate), an amount mismatch, a pending bank request, a release request with an open mandatory item, and one with a waivable item.
- Demo mode banner visible. Mock elements labelled SIMULATED.

### 17.2 Script (about 12 minutes)

| # | Step | What judges see | PS link |
|---|---|---|---|
| 1 | Institution submits FDR with PDF | Upload, hash, Unverified badge | New submission |
| 2 | Bad maturity date | Blocked with reason; correction preserves history | Discrepancy |
| 3 | Amount mismatch and duplicate | Cases open; officer resolves with scrutiny note | Discrepancy |
| 4 | Bank confirmation | Request, response, assessment; badge turns Bank-confirmed; edit amount and watch it drop | Verification |
| 5 | Dashboard | Six categories, overlaps explained | Validity tracking |
| 6 | Advance clock 60 days | One reminder, then escalation | Approaching maturity |
| 7 | Renewal | Replacement linked, old superseded, history chain | Renewal |
| 8 | Release | Blocked, exception by second approver, decision, separate confirmation | Authorized release |
| 9 | Legacy import | Error report with line numbers; duplicates flagged | Repository |
| 10 | Audit | Timeline; chain verified; tamper one row; detection | Audit |
| 11 | Security | Institution B denied access to A's record and file, audited | Access control |
| 12 | KPIs | Measured times with n and period | Measurable improvement |

### 17.3 Assumptions slide (always shown)

1. Workflow states, checklist items, waivable items and roles are prototype defaults pending AICTE confirmation.
2. All data is synthetic; reminder windows are examples.
3. Bank verification is a recorded manual workflow plus a labelled mock adapter.
4. KPIs are measured from the demo run; the manual-effort comparison is illustrative.
5. The encryption key arrangement is a prototype convenience.

---

## 18. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Real AICTE workflow differs from our defaults | Rework | Everything configurable; defaults stated openly; confirm with handbook |
| Scope too large for the time available | Incomplete demo | Tiers, cut order, contract freeze |
| Team integration conflicts | Broken builds | One integrator, frozen contract, daily integration build |
| Signature or metadata checks read as proof | Credibility loss | Advisory outputs, informational class, evidence rules |
| False confidence from row-level security | Data exposure | Optional, all-or-nothing with tests |
| Audit described as stronger than it is | Credibility loss | Call it tamper-evident; state limits |
| Lost encryption key | Documents unrecoverable | Separate key copy; restore tests decrypt |
| Duplicate flags seen as accusations | User distrust | Neutral wording; human resolution |
| KPIs seen as invented | Credibility loss | Event-derived; n and period; labelled |
| Demo mistaken for production | Misunderstanding | Synthetic data, SIMULATED labels, assumptions slide |
| Licence issues (AGPL) | Legal | Use pypdf/pdfplumber; check new libraries |

---

## 19. Assumptions and stated defaults

| Topic | Default until confirmed |
|---|---|
| Deployment | Docker Compose on one host; access over localhost or LAN |
| Backend language | Python with FastAPI |
| Users | Multi-user, concurrent |
| Roles | As in section 5 |
| Required documents | Versioned checklist template |
| Waivable items | None in real policy until AICTE says so; one demo item marked waivable for illustration |
| Bank verification | Manual confirmation workflow plus mock adapter |
| Reminder windows | 90/60/30/15/7 days before maturity; 30-day grace |
| Lien requirement | FDR lien-marked in favour of AICTE (configurable rule; confirm with handbook) |
| Minimum tenure and amount | Configurable; placeholder values in demo config |
| Retention | Owner decision; nothing deleted in prototype |
| OCR | Optional; seeded extraction allowed if labelled |
| Availability | Best effort |
| Before real data | MFA, real key management, scanning, audit chain, access tests, formal review |

---

## 20. Glossary

| Term | Meaning |
|---|---|
| AICTE | All India Council for Technical Education |
| FDR | Fixed Deposit Receipt held as a security deposit |
| Instrument | Any FDR or deposit tracked by the portal |
| Lien | A bank's mark that the deposit is held in favour of a named party (here, AICTE) |
| Maturity date | Date the FDR matures |
| Reminder window | Period before maturity in which reminders are sent |
| Grace period | Period after maturity before an instrument counts as lapsed |
| Provenance | Where a value came from |
| Verification level | Trust level of an instrument: unverified, officer-reviewed, bank-confirmed |
| Discrepancy case | An issue that an officer must review |
| Scrutiny observation | A reviewer's recorded note |
| Supersede | Replace an instrument with a successor while keeping the old record |
| Checklist exception | An authorized waiver of a waivable checklist item |
| Release confirmation | Evidence that funds were actually released |
| Envelope encryption | Encrypting each file with its own key, which is itself encrypted with a master key |
| Hash chain | Audit entries linked by hashes so changes become detectable |
| Idempotency key | Unique key that prevents the same action being performed twice |
| Modular monolith | One deployable application with clearly separated internal modules |
| SIMULATED | Label on any mock component in the demo |

---

## 21. Appendices

### Appendix A: API outline

All endpoints under `/api/v1`. JSON. Every endpoint authorized and scoped. Full OpenAPI generated by FastAPI and frozen in Phase 0.

| Area | Method and path | Purpose |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `POST /auth/mfa/verify` | Session handling |
| Me | `GET /me` | Current user, role, scope |
| Institutions | `GET /institutions`, `GET /institutions/{id}` | List and detail |
| Instruments | `GET /instruments`, `POST /instruments`, `GET /instruments/{id}`, `PATCH /instruments/{id}` | Register (PATCH requires reason for corrections) |
| Submission | `POST /instruments/{id}/submit` | Run blocking validation and submit |
| Field history | `GET /instruments/{id}/history` | Provenance and changes |
| Documents | `POST /instruments/{id}/documents`, `GET /documents/{id}/versions`, `GET /document-versions/{id}/download` | Upload and authorized download |
| Checks | `GET /instruments/{id}/checks` | Check results |
| Discrepancies | `GET /discrepancies`, `POST /discrepancies/{id}/resolve`, `POST /discrepancies/{id}/accept` | Review work |
| Notes | `POST /notes`, `GET /notes?target=…` | Scrutiny observations |
| Verification | `POST /instruments/{id}/verification/officer-reviewed` | Set level with evidence |
| Bank requests | `POST /instruments/{id}/bank-requests`, `POST /bank-requests/{id}/response`, `POST /bank-requests/{id}/assess`, `POST /bank-requests/{id}/cancel` | Bank confirmation process |
| Links | `POST /instruments/{id}/links` | Renewal or replacement |
| Release | `POST /release-requests`, `GET /release-requests/{id}`, `POST /checklist-items/{id}/mark`, `POST /checklist-items/{id}/exception`, `POST /exceptions/{id}/approve`, `POST /release-requests/{id}/decide`, `POST /release-requests/{id}/confirm` | Release workflow |
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/category/{name}` | Derived counts and lists |
| Reports | `GET /reports/{type}?format=csv` | Exports |
| KPIs | `GET /kpis`, `GET /kpis/{id}/records` | Values with n, period and drill-down |
| Import | `POST /imports`, `POST /imports/{id}/commit`, `GET /imports/{id}/errors` | Legacy import |
| Audit | `GET /audit`, `POST /audit/verify` | Timeline and chain check |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read` | In-app alerts |
| Admin | `/admin/users`, `/admin/config`, `POST /admin/clock/advance`, `POST /admin/demo/reset` | Platform (clock and reset demo-only) |
| Health | `GET /health` | Liveness and readiness |

**Error format:**

```json
{
  "error": {
    "code": "TRANSITION_BLOCKED",
    "message": "Mandatory checklist item open: original FDR surrendered",
    "details": { "item_code": "ORIGINAL_SURRENDERED" },
    "correlation_id": "c0a8-..."
  }
}
```

### Appendix B: Enumerations (freeze in Phase 0)

```text
verification_level:   unverified | officer_reviewed | bank_confirmed
lifecycle:            draft | submitted | in_force | superseded | closed
validity_state:       active | expiring | matured | lapsed            (computed)
review_flag:          clear | needs_info | discrepancy_open           (derived)
value_source:         institution_entered | imported | extracted | officer_entered | bank_confirmed
check_class:          blocking | review_required | informational
severity:             low | medium | high
discrepancy_state:    open | assigned | needs_information | resolved | accepted_with_rationale
bank_request_state:   requested | response_recorded | accepted | rejected | inconclusive | cancelled
bank_channel:         letter | email | bank_portal | other
link_type:            renewal | replacement
release_type:         release | refund | discharge
release_state:        draft | submitted | completeness_review | checklist_pending | ready_for_decision
                      | approved | rejected | returned | deferred | release_pending | confirmed
checklist_item_state: open | done | excepted
decision:             approve | reject | return | defer
notification_state:   pending | sent | failed
job_state:            queued | running | done | failed
role:                 institution_submitter | document_reviewer | verification_officer
                      | clearance_officer | authorized_approver | auditor | system_admin
```

### Appendix C: Seed data specification

| Item | Quantity | Purpose |
|---|---|---|
| Institutions | 12 fictional, across 4 regions | Scope tests and realistic lists |
| FDRs per validity bucket | 8 active, 6 expiring, 4 matured, 3 lapsed | Dashboard |
| Superseded with successor | 3 chains | Renewal history |
| Closed after release | 2 | Released category |
| Amount mismatch | 1 | Discrepancy demo |
| Bad date | 1 (submitted live) | Blocking validation demo |
| Duplicate variants | `FDR/00123`, `fdr 00123`, `FDR-123` across 2 institutions | Duplicate detection |
| Pending bank request | 1 overdue | Escalation |
| Release requests | 1 with open mandatory item, 1 with waivable item | Release demo |
| Legacy CSV | 40 rows, 8 defective | Import demo |
| Users | One per role, plus a second approver and two institution users | Separation of duties |
| Documents | Synthetic PDFs, one signed with a test certificate | Upload, extraction, signature |

All names, numbers and banks are fictional.

### Appendix D: Definition of done

A feature is done only when all of these are true:

1. It works through the UI for the intended role.
2. Backend has unit and API tests, including an authorization-failure test.
3. It writes the correct audit event and metric event.
4. It respects institution scope and separation of duties.
5. It handles errors with the standard error format.
6. It follows the frozen enums and API contract.
7. Seed data exercises it, and the demo script step (if any) passes in Playwright.
8. The pull request is reviewed and merged by the integrator.

---

*This document describes a prototype design. It is not a statement of AICTE policy. Workflow states, checklist contents, roles, retention rules and decision authority must be confirmed against current AICTE requirements before any production use.*
