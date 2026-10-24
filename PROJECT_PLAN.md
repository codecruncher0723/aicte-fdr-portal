<!-- Update note: 2026-10-23. Added bounded implementation tasks for provenance/history, immutable document versions, explainable discrepancy severity, and event-based KPIs. Simulated clock and hash-chained audit remain optional. -->
# PROJECT_PLAN.md — AICTE FDR Management Portal (24-hour prototype)

## How to use this plan

- This is the persistent implementation tracker. Complete **only the next unchecked phase**; run its verification, record evidence/results, then continue.
- A phase is complete only when every **Must-have** task and its Definition of Done pass. Never check a phase based on implementation alone.
- Do not change `REQUIREMENTS_UPDATED.md` or `ARCHITECTURE.md` as part of this plan. If they exist, read them for context only; the **Requirements Completion Addendum (Authoritative)** in `REQUIREMENTS_UPDATED.md` governs conflicting requirements.
- Inspect the actual repository before choosing or changing frameworks, commands, folder layout, database, or test tools. Do not scaffold a replacement project before understanding what is already present.
- Mark optional items as deferred if the 24-hour deadline is at risk. Keep known limitations visible in the demo.
- Time estimates are planning budgets, not permission to skip verification. If a blocker threatens the deadline, simplify optional scope, not security or canonical workflow rules.

## Prototype priorities

**Must-have (M):** reproducible setup; relational persistence/migrations; demo login with backend RBAC and institution isolation; FDR CRUD/submit; private document upload and authenticated download with extension/MIME/signature/size checks and SHA-256; canonical server-side status transitions; verification/discrepancy records; initial approval; separate renewal and release/refund request records; maturity processing/reminders; role-scoped dashboards/list filters; CSV export; audit history; end-to-end demo and security regression tests.

**Priority order:** finish the core workflows, authorization, secure documents, canonical transitions, audit transactions, and end-to-end tests first. Provenance/history, immutable document versions, explainable discrepancy severity, and event-based KPIs are scoped below; implement the minimum viable form without delaying the core path. Simulated clock and hash-chained audit are enhancements only if time remains.

**Optional (O, only after must-haves pass):** polished animations; PDF/XLSX exports; real email/SMS; OCR; live bank/AICTE integrations; advanced malware scanning; production identity federation/MFA; object storage; automated backup scheduling; load testing beyond the agreed demo dataset. Never imply optional integrations are live when they are simulated.

## Authoritative workflow invariants

### FDR record statuses

`DRAFT`, `SUBMITTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `VERIFIED`, `PENDING_APPROVAL`, `ACTIVE`, `MATURING_SOON`, `MATURED`, `CLOSED`, `REJECTED`.

- `DRAFT → SUBMITTED`: owning Institution Officer via `POST /api/v1/fdrs/{fdr_id}/submit`.
- `SUBMITTED → UNDER_VERIFICATION`: Verification Officer via `POST /api/v1/fdrs/{fdr_id}/start-verification`.
- `UNDER_VERIFICATION → VERIFIED` or `CORRECTION_REQUIRED`: Verification Officer via `POST /api/v1/fdrs/{fdr_id}/verify`; successful verification automatically advances `VERIFIED → PENDING_APPROVAL` in the same transaction.
- `CORRECTION_REQUIRED → SUBMITTED`: owning Institution Officer edits permitted fields/documents and resubmits using the submit endpoint.
- `PENDING_APPROVAL → ACTIVE` or `REJECTED`: Approving Authority via `POST /api/v1/fdrs/{fdr_id}/approval`.
- The scheduled maturity job alone drives date-based `ACTIVE → MATURING_SOON → MATURED`, using configurable `TBD` thresholds and preserving protected pending workflows and closed records.

### Renewal request statuses

`REQUESTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`.

- Create renewal: `POST /api/v1/fdrs/{fdr_id}/renewals` → `REQUESTED`.
- Start verification: `POST /api/v1/requests/{request_id}/start-verification` → `UNDER_VERIFICATION`.
- Verify: `POST /api/v1/requests/{request_id}/verify` → `CORRECTION_REQUIRED` or `PENDING_APPROVAL`.
- Resubmit correction: `POST /api/v1/requests/{request_id}/resubmit` → `REQUESTED`.
- Approve/reject: `POST /api/v1/requests/{request_id}/approval` → `APPROVED` or `REJECTED`.
- Complete renewal: `POST /api/v1/requests/{request_id}/complete` only from `APPROVED`; validate renewed details/document, update FDR and history atomically, then request → `COMPLETED`.
- Cancel only from `REQUESTED` via `POST /api/v1/requests/{request_id}/cancel`, with reason.

### Release/refund request statuses

`REQUESTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `PENDING_APPROVAL`, `RELEASE_APPROVED`, `REJECTED`, `AWAITING_CONFIRMATION`, `RELEASED_REFUNDED`, `CANCELLED`.

- Create: `POST /api/v1/fdrs/{fdr_id}/release-requests` → `REQUESTED`.
- Start verification, verify, resubmit, cancel and approval use the shared request endpoints above.
- Approval → `RELEASE_APPROVED`; readiness via `POST /api/v1/requests/{request_id}/release-confirmation/ready` → `AWAITING_CONFIRMATION`; confirmation via `POST /api/v1/requests/{request_id}/release-confirmation` → `RELEASED_REFUNDED` only from `AWAITING_CONFIRMATION`.
- Confirmation records reference, actor, timestamp and audit event. It does not transfer money. Underlying FDR moves to `CLOSED` only if the configured closure policy permits it; this rule is `TBD`.

**Cross-workflow rules:** FDR, renewal, and release statuses are separate. A request rejection must not reject the underlying FDR. The submitter cannot be the sole approver. Enforce authorization and valid transitions on the backend; invalid transitions return `409 INVALID_STATUS_TRANSITION`. Status, decision/history and audit writes must commit or roll back together. Do not invent official AICTE rules or claim bank authenticity/live integrations.

---

## Phase 1 — Repository and environment setup (budget: 1.5 hours)

**Dependencies:** None. This phase must inspect the repository before selecting tools or assuming a stack.

### Tasks
- [x] **M** Locate the actual project root and inspect tracked files, branch, current changes, README, dependency manifests, lockfiles, environment examples, migrations, existing tests, and frontend/backend entry points.
- [x] **M** Read existing `ARCHITECTURE.md` if present, without editing it; use the authoritative addendum in `REQUIREMENTS_UPDATED.md` for workflow/status/API requirements.
- [x] **M** Record the detected languages, frameworks, runtime versions, package manager, database, test/lint/build commands, current startup method, and any existing implementation that should be reused.
- [x] **M** Check Git status and preserve unrelated user changes. Do not reset, overwrite, or scaffold over existing work.
- [x] **M** Configure local environment from the repository's documented approach; create/update only ignored local secrets/environment files if necessary. Keep secrets out of source control.
- [x] **M** Start the existing app (if possible) and run its current baseline build/test/lint commands before changing code. Capture pre-existing failures separately.
- [x] **O** Add a concise setup/run note to the project README only if it is missing or inaccurate; do not alter `REQUIREMENTS_UPDATED.md` or `ARCHITECTURE.md`.

### Definition of Done
- [x] Actual repository structure and stack are documented in this plan's execution notes or a separate developer note.
- [x] Existing app starts, or baseline blockers are precisely recorded with command output.
- [x] Baseline build/test results are recorded; no existing user changes were discarded.
- [x] The selected implementation path reuses the repository's existing stack.

### Verification commands / procedures
Run from the actual repository root, adapting only paths when necessary:
```bash
pwd
git status --short --branch
git rev-parse --show-toplevel
git log -1 --oneline
```
Then inspect the files that actually exist, for example `ls -la`, `find . -maxdepth 2 -type f | sort`, and the relevant manifest/README. Run the **repository-defined** install, build, lint, and test commands from its manifest/README; do not assume `npm`, `pytest`, or any other tool until detected. Verify secrets are ignored and absent from tracked files with `git status --short` and a targeted check of `.gitignore`/tracked environment files.

### Dependencies and blockers
- Blocker: repository path/access not supplied or unavailable. Locate/open the real workspace before implementation; do not create a new stack from guesswork.
- Blocker: missing environment variables, unavailable database service, broken dependency installation, or baseline failures. Record and resolve the smallest blocker before Phase 2.

Execution notes:
- **Repository Root**: `D:\Code_Cruncher\Projects\aicte-fdr-portal` (Git branch: `main`, commit `2180771 First commit`).
- **Detected Stack**:
  - **Frontend**: Vite 6.1.0 (`vite v6.4.5`), React 19.0.0, Tailwind CSS 3.4.17 with PostCSS and Autoprefixer.
  - **Package Manager**: `npm` with `package-lock.json` in `frontend/`.
  - **Backend**: None currently present in the repository.
  - **Database & Migrations**: None currently present (no database engine, ORM schema, or migrations).
  - **Environment Variables**: None present (no `.env*` files).
- **Frontend Architecture & Routes**:
  - **Structure**: `frontend/src/` contains:
    - `components/` (`common/AicteLogo.jsx`, `layout/` (`AppLayout`, `Header`, `Sidebar`, `NotificationPopover`, `RoleSwitcherModal`), `modals/` (`FdrDetailModal`, `ScrutinyRemarksModal`, `SubmitFdrModal`)).
    - `context/` (`RoleContext.jsx` implementing four demo personas: `AICTE_ADMIN`, `INSTITUTION_OFFICER`, `VERIFICATION_OFFICER`, `APPROVING_AUTHORITY` and state routing via `activeRoute`).
    - `data/` (`mockData.js` master static data store with 14 canonical statuses and initial institutions).
    - `pages/` (13 page views: `AdminDashboard`, `MasterRegistry`, `VerificationAuditWorkspace`, `MaturityRenewalsPage`, `ReleaseRequestsPage`, `ReportsPage`, `InstitutionsPage`, `AuditLogsPage`, `SettingsPage`, `HelpManualsPage`, `InstitutionDashboard`, `ProfileTrustPage`, `NotificationsPage`).
  - **API Integration**: Currently 100% in-memory static data (`mockData.js`) and React state. Zero live network calls (`fetch`/`axios`).
- **Baseline Build & Tests**:
  - Build command: `npm --prefix "frontend" run build` succeeds cleanly in 11.87s with 0 errors (53 modules transformed).
  - Test/Lint commands: None defined in `package.json` (`scripts` only has `dev`, `build`, `preview`).
  - Dev server: Verified active and running smoothly (`npm run dev`).
- **Existing User Changes**: Preserved cleanly; untracked additions (`REQUIREMENTS_UPDATED.md`, `PROJECT_PLAN .md`) noted.
- **Architecture File**: `ARCHITECTURE.md` does not exist. Requirements governed by `REQUIREMENTS_UPDATED.md`.
- **Frontend UI Simplification & Audit Progress**:
  - **Admin & Institution Dashboards**: Simplified layout with compact header, single primary action ("Register New FDR" / "+ Submit New FDR"), 4 clean KPIs, compact clickable "Action Required" counts, and responsive Recent Activity ledger.
  - **Master Registry**: Redundant dashboard duplicate metric cards removed; filter console and master table front and center.
  - **Maturity & Renewal Surveillance (`MaturityRenewalsPage.jsx`)**: Replaced 4 static decorative KPI cards with dynamic count badges integrated directly into horizon filter tabs ('All Horizons', 'Matured Overdue', '< 30 Days', '31–60 Days', '61–90 Days'). Counts dynamically update with search queries and category filters.
  - **Release & Refund Requests (`ReleaseRequestsPage.jsx`)**:
    - Implemented canonical status sequence: `REQUESTED → UNDER_VERIFICATION → CORRECTION_REQUIRED or PENDING_APPROVAL → RELEASE_APPROVED or REJECTED → AWAITING_CONFIRMATION → RELEASED_REFUNDED`.
    - Enforced invariant: Direct transition from `RELEASE_APPROVED` to `RELEASED_REFUNDED` is strictly forbidden; readiness must be confirmed first (`CONFIRM_READINESS` → `AWAITING_CONFIRMATION`). Final completion requires simulated bank UTR and credit advice voucher (`CONFIRM_RELEASE` → `RELEASED_REFUNDED`).
    - Enforced invariant: Rejection sets request to `REJECTED` while preserving the underlying FDR in `ACTIVE` state (rejection does not reject underlying FDR). Cancellation returns FDR to `ACTIVE`.
    - Connected release request state to shared master store in `App.jsx`, synchronizing `AdminDashboard` action counters, `ReleaseRequestsPage`, and underlying `fdrs`.
  - **Build Verification**: Verified `npm --prefix frontend run build` passed cleanly with exit code 0 (53 modules transformed in 3.02s).
- **Blockers for Phase 2**: None. Ready to proceed to Phase 2 (Database models and migrations).

---

## Phase 2 — Database models and migrations (budget: 2 hours)

**Dependencies:** Phase 1 stack/repository inspection complete.

### Tasks
- [x] **M** Reuse the existing relational database/ORM if present; choose SQLite only if it fits the existing stack and local demo constraints. Do not switch database technology without a concrete blocker.
- [x] **M** Model institutions, users, roles, FDR records, documents, verification records, workflow requests, approval records, audit logs, and notifications if feasible. Keep request type (`RENEWAL`, `RELEASE_REFUND`) and request status separate from FDR status.
- [x] **M** Add keys/relationships and constraints: exactly one of `fdr_id` or `request_id` per approval record; required fields; positive deposit amount; maturity date not earlier than issue date; foreign keys; timestamps.
- [x] **M** Store document metadata, relative private-storage reference, and SHA-256 hash; never store public URLs or expose raw storage paths through APIs.
- [x] **M** Add append-only verification/approval history and auditable status history sufficient to retain old FDR values/documents on renewal.
- [x] **M** Preserve provenance for critical FDR fields where practical: source category, actor, timestamp, previous/new value, and reason for changes. Never label data `BANK_CONFIRMED` without an actual authoritative bank confirmation.
- [x] **M** Model document uploads as immutable versions with SHA-256, size, detected media type, uploader, timestamp, and private storage reference; replacement creates a new version rather than overwriting old evidence.
- [ ] **M** Implement migrations using the detected migration mechanism and deterministic seed/demo data for all four roles and at least two institutions.
- [ ] **O** Add notification persistence if time permits; if deferred, document the exact limitation and ensure the core dashboard/reminder path still works.

### Definition of Done
- [ ] A fresh database can be created entirely from migrations and seed commands.
- [ ] Relationships and constraints reject invalid references/invalid amounts/dates.
- [ ] Seed data contains isolated institutions and test accounts for all four roles.
- [ ] Re-running setup is safe and does not duplicate seed records unexpectedly.
- [ ] A database test confirms approval records cannot reference both/neither FDR and request.

### Verification commands / procedures
Use the migration and seed commands discovered in Phase 1. Verify from a clean test database: drop/recreate **test DB only**, run migrations, seed, and run the model/constraint test suite. Confirm schema/table list with the detected DB CLI or ORM inspection. Create one valid FDR, attempt zero/negative amount and maturity-before-issue records, and assert they are rejected. Verify both a renewal and a release request can link to the same FDR without replacing its canonical FDR status.

### Dependencies and blockers
- Depends on the actual framework/database discovered in Phase 1.
- Blockers: no migration mechanism, missing DB driver/service, or unresolved legacy schema conflicts. Keep schema changes minimal and migration-backed; do not edit production data directly.

Execution notes (Phase 2 Tasks 1-3):
- **Database Selection & Setup**: Inspected repository: no existing database or ORM was present. Selected SQLite (SQLAlchemy 2.0.52 + Python 3.14.2) perfectly matching local standalone demo constraints with zero external service dependencies.
- **Engine & Configuration**: Created `backend/app/config.py` and `backend/app/database.py` with automatic `PRAGMA foreign_keys=ON` connection event listener for strict relational integrity enforcement.
- **Verification**: Created `backend/run_tests.py` and `backend/tests/test_database.py`. Ran tests via pytest: 3/3 passed in 0.58s (`test_database_connection`, `test_foreign_keys_pragma_enabled`, `test_session_lifecycle`). Frontend build remains passing (`vite build` in 2.94s, exit code 0).
- **Core Database Models**: Created modular SQLAlchemy models in `backend/app/models/`: `Institution`, `User`, `FDR`, `FieldProvenance`, `DocumentVersion`, `WorkflowRequest`, `VerificationRecord`, `ApprovalRecord`, `AuditLog`, and `Notification`.
- **Canonical Enums**: Defined `UserRole` (4 roles), `FDRStatus` (14 statuses), `RequestType` (RENEWAL, RELEASE_REFUND), `RenewalStatus` (8 statuses), `ReleaseStatus` (9 statuses), `DiscrepancySeverity`, and `ProvenanceSource`.
- **Relational Integrity & Check Constraints**: Enforced `amount > 0` (`chk_fdr_amount_positive`), `maturity_date >= issue_date` (`chk_fdr_maturity_after_issue`), `length(sha256_hash) == 64` (`chk_doc_hash_length`), `file_size > 0` (`chk_doc_size_positive`), and exclusive target check on approval records (`chk_approval_target_exclusive`). Foreign keys enforced via SQLite connection event.
- **Verification Suite**: Created `backend/tests/test_models.py`. Ran pytest: 10/10 passed in 0.83s. Verified invalid amounts, reversed maturity dates, non-existent foreign keys, invalid document hashes, and dual/null approval targets are strictly rejected. Verified renewal and release requests coexist while preserving distinct FDR status. Frontend build passes (`npm run build` exit code 0).
- **Secure Document Storage & Metadata Service**:
  - Created `backend/app/storage.py` enforcing private storage management outside public web root (`backend/storage/documents/`).
  - Enforced 10 MB file size limit and strict format whitelist: PDF, JPEG, PNG, WEBP.
  - Implemented binary magic byte signature verification (`%PDF-`, `\xFF\xD8\xFF`, PNG 8-byte header, RIFF/WEBP); rejected mismatches, empty files, and corrupted/truncated uploads.
  - Enforced safe relative storage keys (`{category}/{entity_id}/{year}/{month}/{uuid}_{safe_name}`) and blocked all path traversal attempts (absolute paths, leading slashes, drive specifiers, null bytes, parent traversal `..`).
  - Implemented SHA-256 hash calculation and constant-time integrity verification (`verify_file_integrity`).
  - Integrated immutable `DocumentVersion` database persistence with automatic version incrementing for replacement/correction uploads.
  - Implemented `format_document_response` ensuring raw filesystem paths, internal storage keys, and public file URLs are never exposed through APIs.
  - Created comprehensive test suite in `backend/tests/test_storage.py` (13 tests). All 23 backend tests passed in 0.78s. Frontend build verified clean (`vite build` in 11.99s, exit code 0).
- **Append-Only History & Separation of Duties**:
  - Implemented `backend/app/history.py` with atomic history recording, strict role checks, and separation of duties enforcement.
  - Added `StatusTransitionHistory` and `FDRRenewalHistory` models in `backend/app/models/`. Added `previous_status` and `new_status` columns to `VerificationRecord` and `ApprovalRecord`.
  - Implemented `record_status_transition`, `record_verification_decision`, and `record_approval_decision`.
  - Enforced separation of duties: submitters CANNOT approve or verify their own submissions (`SeparationOfDutiesError`). Enforced role permissions: only `VERIFICATION_OFFICER`/`AICTE_ADMIN` can verify, only `APPROVING_AUTHORITY`/`AICTE_ADMIN` can approve (`UnauthorizedRoleError`).
  - Implemented `complete_fdr_renewal`: captures historical FDR values in `FDRRenewalHistory`, records field-level audit provenance in `FieldProvenance`, leaves previous document versions intact and immutable, and preserves distinct FDR lifecycle state.
  - Enforced database-level immutability using SQLAlchemy event listeners (`before_update`, `before_delete`) on `VerificationRecord`, `ApprovalRecord`, `StatusTransitionHistory`, and `FDRRenewalHistory`, raising `ImmutableRecordError` on any attempted mutation or deletion.
  - Created `backend/tests/test_history.py` (11 test cases). All 34 backend tests pass in 1.09s. Frontend production build verified clean (`vite build` in 3.26s, exit code 0).
- **Critical Field Provenance Tracking Service**:
  - Created `backend/app/provenance.py` tracking critical FDR fields (`fdr_number`, `amount`, `bank_name`, `branch`, `ifsc`, `issue_date`, `maturity_date`, `interest_rate`, etc.) with actor, timestamp, previous/new value, source category, and mandatory change reason.
  - Implemented `validate_source_category` with strict guard preventing false bank-confirmation claims: `BANK_CONFIRMED` raises `FalseBankConfirmationError` unless verified by actual authoritative bank confirmation. Manual uploads, OCR, and simulated checks are prohibited from using that label.
  - Implemented `record_field_provenance` and atomic `update_fdr_fields`, requiring non-empty reasons when modifying existing field values (`MissingReasonError`).
  - Integrated provenance recording with renewal completion workflow (`complete_fdr_renewal` in `history.py`).
  - Enforced database-level immutability for `FieldProvenance` through SQLAlchemy event listeners (`before_update`, `before_delete`), disallowing any tampering or deletion.
  - Created `backend/tests/test_provenance.py` (10 test cases). All 43 backend tests pass in 1.22s. Frontend build verified clean (`vite build` in 3.08s, exit code 0).
- **Immutable Document-Version Tracking & Authorization**:
  - Implemented version incrementing and replacement orchestration in `backend/app/storage.py` (`replace_document_version`, `get_document_versions`, `get_latest_document_version`).
  - Replacing a document automatically creates version N+1 with a distinct SHA-256 hash and relative private storage key; old physical files and database records are never modified or deleted.
  - Implemented server-side role and institution isolation guards: `authorize_document_access` and `authorize_document_upload` (`UnauthorizedDocumentAccessError`). Institution officers cannot access or upload documents across institution boundaries; AICTE Admin, Verifiers, and Approvers have global oversight.
  - Enforced database-level immutability for `DocumentVersion` via SQLAlchemy event listeners (`before_update`, `before_delete`) in `backend/app/history.py`, blocking any in-place mutation or deletion.
  - Added focused test suite in `backend/tests/test_document_versioning.py` (9 tests) covering metadata accuracy, replacement preserving old versions, ordered retrieval, cross-institution rejection, valid role/same-institution access, unauthorized uploads, DB immutability, and rejection of invalid/oversized files without affecting existing versions.
  - All 52 backend tests pass in 1.48s. Frontend production build verified clean (`vite build` in 2.86s, exit code 0).

---

## Phase 3 — Authentication, RBAC, and institution isolation (budget: 2 hours)

**Dependencies:** Phase 2 users/roles/institutions schema.

### Tasks
- [ ] **M** Implement the repository-compatible authentication mechanism and seeded demo accounts; store only password hashes, never plaintext passwords.
- [ ] **M** Enforce the four roles: `AICTE_ADMIN`, `INSTITUTION_OFFICER`, `VERIFICATION_OFFICER`, `APPROVING_AUTHORITY`.
- [ ] **M** Enforce authorization on every protected backend endpoint, including detail reads, document access, workflow actions, dashboard aggregates, audit views, and CSV exports.
- [ ] **M** Derive an Institution Officer's `institution_id` and `created_by` from the authenticated principal; ignore/reject client attempts to select another institution.
- [ ] **M** Apply resource-level checks to prevent IDOR; a guessed FDR/request/document ID must not bypass institution/role rules.
- [ ] **M** Prevent the submitter from being the sole approving authority; record actor IDs in workflow actions.
- [ ] **O** User administration beyond predefined demo accounts is optional and out of scope unless already present.

### Definition of Done
- [ ] Demo login works for all four roles.
- [ ] Anonymous calls to protected endpoints return `401`; authenticated but unauthorized calls return `403` or non-disclosing `404` per API policy.
- [ ] Institution Officer A cannot read/write Institution B's FDRs, requests, documents, notifications, reports, or dashboard rows.
- [ ] AICTE Admin cross-institution access is explicit; other roles see only authorized scope.
- [ ] The backend, not frontend visibility, enforces permissions.

### Verification commands / procedures
Run the detected auth/API test command. Using two seeded institutions and one account per role, call `/api/v1/auth/login`, `/api/v1/auth/me`, then request an FDR belonging to another institution with each token. Assert correct status codes and no sensitive data leakage. Attempt privileged routes without a token and with the wrong role. Attempt approval by the user who submitted the record; assert it is rejected. Verify no password/hash/token appears in response bodies or logs.

### Dependencies and blockers
- Depends on Phase 2 schema and Phase 1's environment/configuration.
- Blocker: no secure secret/config setup or unclear role boundaries. Keep role scope limited to the four authoritative roles; do not invent new official roles.

---

## Phase 4 — FDR registration and secure document uploads (budget: 3 hours)

**Dependencies:** Phases 2–3.

### Tasks
- [ ] **M** Implement create/list/detail/update for permitted FDR states; institution scope is enforced server-side.
- [ ] **M** Implement `POST /api/v1/fdrs/{fdr_id}/submit`: only `DRAFT` or `CORRECTION_REQUIRED` → `SUBMITTED`, with an audit/history event.
- [ ] **M** Implement FDR field validation: required FDR number, institution, bank, amount, issue/maturity dates, and required supporting document; amount > 0; maturity ≥ issue date.
- [ ] **M** Implement configurable duplicate-candidate detection without assuming FDR number is globally unique; uniqueness scope remains `TBD`.
- [ ] **M** Implement private upload/storage for PDF, JPG/JPEG, PNG, WEBP; max 10 MB; validate extension, MIME and magic bytes; reject empty/corrupt/mismatched files; generate server-side names; block path traversal; calculate SHA-256.
- [ ] **M** Implement authenticated metadata list/detail/download endpoints with resource-level authorization. Never serve private files directly from the public web root.
- [ ] **M** Keep original filename as metadata only; avoid returning internal storage paths.
- [ ] **M** Preserve each prior submitted document version; link the version reviewed/approved to its workflow evidence where feasible.
- [ ] **O** Image dimension limits or additional PDF hardening beyond baseline validation, if compatible with available libraries.

### Definition of Done
- [ ] Institution Officer can create a draft, attach a valid document, view it through authorized APIs, edit permitted fields, and submit it.
- [ ] Invalid fields/files and over-limit files are rejected with consistent errors.
- [ ] A document's SHA-256 is persisted and the previous document remains available after a replacement/correction upload.
- [ ] Unauthorized cross-institution document download fails.
- [ ] Submission is `SUBMITTED`, not silently `UNDER_VERIFICATION`.

### Verification commands / procedures
Run backend tests and any file-security tests. Upload one valid file of each supported type if sample fixtures exist; otherwise test at least PDF and one image plus negative fixtures. Test empty, corrupt, extension/MIME/signature mismatch, unsupported type, path-traversal filename, and a file over 10 MB. Recompute SHA-256 of a stored test file and compare to metadata. Confirm the download route requires authentication and refuses cross-institution IDs. Submit a draft and assert status `SUBMITTED` and audit history; try submit from an invalid state and assert `409 INVALID_STATUS_TRANSITION`.

### Dependencies and blockers
- Depends on role checks and DB/document models.
- Blockers: private writable storage location, absent test fixtures, or unavailable file-signature library. Use minimal safe validation rather than skipping signature checks.

---

## Phase 5 — Verification, discrepancy handling, and approval (budget: 3 hours)

**Dependencies:** Phases 2–4.

### Tasks
- [ ] **M** Implement `POST /api/v1/fdrs/{fdr_id}/start-verification`: Verification Officer only, `SUBMITTED` → `UNDER_VERIFICATION`.
- [ ] **M** Implement verification for FDR and shared request verification. Record actor, timestamp, checks, remarks, decision, and append-only history.
- [ ] **M** Implement discrepancy codes: `MISSING_REQUIRED_FIELD`, `INVALID_AMOUNT_OR_DATE`, `DUPLICATE_FDR_CANDIDATE`, `DOCUMENT_MISSING_OR_INVALID`, `DOCUMENT_METADATA_MISMATCH`, `RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD`, `RELEASE_REQUEST_MISSING_SUPPORT`, `MANUAL_REVIEW_REQUIRED`.
- [ ] **M** Return a human-readable explanation and source/check for each discrepancy. Add `BLOCKING`, `REVIEW_REQUIRED`, or `INFORMATIONAL` severity where feasible without changing canonical status transitions or introducing automatic rejection.
- [ ] **M** A discrepancy is a review signal, not automatic fraud/rejection. Verification Officer explicitly chooses `VERIFIED` or `CORRECTION_REQUIRED` and records remarks.
- [ ] **M** Successful initial FDR verification performs `UNDER_VERIFICATION → VERIFIED → PENDING_APPROVAL` transactionally; correction decision leaves it `CORRECTION_REQUIRED`.
- [ ] **M** Implement `POST /api/v1/fdrs/{fdr_id}/approval`: Approving Authority only, `PENDING_APPROVAL` → `ACTIVE` or `REJECTED`; rejection requires a reason.
- [ ] **M** Store initial approval against the FDR; store renewal/release decisions against `request_id`. Status + decision + audit event must commit/rollback together.
- [ ] **M** Reject invalid transitions with `409 INVALID_STATUS_TRANSITION` and preserve the underlying FDR when a renewal/release request is rejected.
- [ ] **O** Add richer verification UI explanations or assignment queues if core flows are stable.

### Definition of Done
- [ ] FDR workflow completes draft → submitted → under verification → verified/pending approval → active, with history for each transition.
- [ ] Correction and rejection branches work and preserve remarks/history.
- [ ] Every discrepancy code can be returned by the appropriate deterministic check or a clearly documented manual-review rule.
- [ ] No approval can bypass verification or be performed by an unauthorized/self-approving user.
- [ ] Tests prove status/decision/audit transaction atomicity.

### Verification commands / procedures
Run the full backend test suite. Test the successful path and each correction/rejection branch using API calls or integration tests. Confirm `SUBMITTED` does not become `UNDER_VERIFICATION` until the start-verification action. Assert successful verification moves to `PENDING_APPROVAL` in the same transaction; inject/force an audit-write failure in a test and assert the status/decision also rolls back. Test wrong-role and invalid-state actions, and assert `409` for invalid transitions. Verify the UI/API never describes a hash, OCR, upload, or deterministic check as proof of bank authenticity.

### Dependencies and blockers
- Depends on stable FDR models, authentication, audit table and API error conventions.
- Blockers: ambiguous approval permission or audit model. Keep the four-role model and separate FDR/request approval records; do not invent AICTE hierarchy rules.

---

## Phase 6 — Maturity monitoring and reminders (budget: 1.5 hours)

**Dependencies:** Phases 2, 5; FDR dates/statuses and notification/audit mechanism.

### Tasks
- [ ] **M** Implement a repeatable daily maturity job or a demonstrable protected manual trigger for the prototype.
- [ ] **M** Read `REMINDER_DAYS_PRIMARY`, `REMINDER_DAYS_ESCALATION`, and `REMINDER_DAYS_OVERDUE` from configuration; leave official values `TBD` and use test-only values in automated tests.
- [ ] **M** Drive date transitions only through the scheduled/job action: `ACTIVE → MATURING_SOON → MATURED`, while preserving closed records and protected pending workflows.
- [ ] **M** Create in-app reminders and dashboard alerts; escalation surfaces items to the AICTE Admin dashboard. Do not imply email/SMS was sent.
- [ ] **M** Make reminder creation idempotent per FDR + threshold + maturity date; a changed maturity date begins a new reminder cycle.
- [ ] **M** Audit automatic transitions and reminder creation; use `Asia/Kolkata` unless deployment configuration overrides it.
- [ ] **O** Configure an OS/host scheduler if reliable in the demo environment; otherwise provide the protected manual trigger.

### Definition of Done
- [ ] A test FDR near maturity is flagged using configuration, and an overdue FDR becomes `MATURED` only when allowed.
- [ ] Re-running the job creates no duplicate reminder for the same threshold/maturity date.
- [ ] A renewed, closed, or protected pending-workflow FDR is not incorrectly advanced.
- [ ] Reminder recipients and labels are clear and no live external notification is claimed.

### Verification commands / procedures
Set test-only thresholds in the test environment and use fixed dates/frozen clock if supported. Run the maturity job twice; assert one reminder per FDR/threshold/maturity date and one audit event per actual transition. Test active, maturing, matured, renewed, closed, and pending-workflow records. Call the manual trigger without permission and assert `403`. Verify a changed maturity date starts a distinct reminder cycle.

### Dependencies and blockers
- Depends on timezone/date handling, notification or reminder persistence, and audit history.
- Blockers: no scheduler package or persistent notification model. Use the documented protected manual trigger rather than omitting the workflow.

---

## Phase 7 — Renewal workflow (budget: 2 hours)

**Dependencies:** Phases 2–6, shared request verification/approval infrastructure.

### Tasks
- [ ] **M** Implement renewal creation `POST /api/v1/fdrs/{fdr_id}/renewals` → request `REQUESTED`; enforce owning institution and configured eligible FDR states.
- [ ] **M** Implement request start-verification, shared verification, correction resubmission, cancellation (only while `REQUESTED`), and approval/rejection endpoints.
- [ ] **M** Compare proposed renewal fields with the current FDR and emit `RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD` when applicable; keep exact policy-dependent rules configurable/TBD.
- [ ] **M** Implement `POST /api/v1/requests/{request_id}/complete` only for an `APPROVED` renewal. Validate renewed details and accessible renewal document; update FDR fields, preserve old values/documents in history, and set request `COMPLETED` in one transaction.
- [ ] **M** Keep renewal status independent of FDR status. Approval alone must not update the FDR; rejected renewal must not mark the FDR `REJECTED`.
- [ ] **O** Add richer renewal comparison UI if time permits.

### Definition of Done
- [ ] Renewal request can complete `REQUESTED → UNDER_VERIFICATION → PENDING_APPROVAL → APPROVED → COMPLETED`.
- [ ] Correction branch returns to `REQUESTED` only via the documented resubmit endpoint; cancel is accepted only from `REQUESTED`.
- [ ] FDR update and request completion are atomic; old details/documents remain retrievable.
- [ ] Invalid completion states and missing/wrong documents are rejected without partial updates.

### Verification commands / procedures
Run integration tests for create, start verification, correction/resubmit, approve/reject, cancel, and completion. Assert the request begins `REQUESTED`; approval leaves it `APPROVED` and FDR fields unchanged; completion atomically updates FDR and request to `COMPLETED`. Attempt completion before approval, wrong document type/access, and repeated completion; assert errors and no partial mutation. Reject a renewal and confirm underlying FDR status remains unchanged.

### Dependencies and blockers
- Depends on shared request status/action implementation from Phase 5, document checks from Phase 4, and history/transaction support.
- Blockers: renewal fields/official eligibility are not fully specified. Implement required configured fields and label policy-specific criteria `TBD`; do not invent them.

---

## Phase 8 — Release/refund workflow (budget: 1.5 hours)

**Dependencies:** Phases 2–7, shared request verification/approval and secure document handling.

### Tasks
- [ ] **M** Implement release request creation `POST /api/v1/fdrs/{fdr_id}/release-requests` → `REQUESTED`, requiring reason and configured supporting document(s).
- [ ] **M** Reuse shared start-verification, verification/correction/resubmit/cancel and approval actions; enforce request-type-specific validation.
- [ ] **M** Approval moves request to `RELEASE_APPROVED`, never directly to `RELEASED_REFUNDED`.
- [ ] **M** Implement `POST /api/v1/requests/{request_id}/release-confirmation/ready`: `RELEASE_APPROVED → AWAITING_CONFIRMATION`.
- [ ] **M** Implement `POST /api/v1/requests/{request_id}/release-confirmation`: only from `AWAITING_CONFIRMATION`; record reference, actor, timestamp, remarks, audit event, and `RELEASED_REFUNDED` atomically.
- [ ] **M** Do not transfer funds or imply bank confirmation. Label demo confirmation as `DEMO`/`SIMULATED`; only close underlying FDR if an explicitly configured closure policy permits it, otherwise leave as not closed and document the TBD rule.
- [ ] **O** Add an optional evidence attachment to the confirmation record if existing document architecture supports it safely.

### Definition of Done
- [ ] Release workflow reaches `RELEASED_REFUNDED` only after readiness and explicit confirmation actions.
- [ ] Confirmation cannot be recorded from `RELEASE_APPROVED` or any other invalid state.
- [ ] Approval alone does not imply funds moved; request rejection leaves underlying FDR status unchanged.
- [ ] Confirmation and audit history are atomic and confirmation is visibly simulated unless a real integration is proven.

### Verification commands / procedures
Run API/integration tests through request creation, verification, approval, readiness, and confirmation. Assert status sequence `REQUESTED → UNDER_VERIFICATION → PENDING_APPROVAL → RELEASE_APPROVED → AWAITING_CONFIRMATION → RELEASED_REFUNDED`. Attempt confirmation before readiness and repeat confirmation; assert `409` and no duplicate/partial audit state. Verify reference, actor and timestamp are saved. Confirm no payment/bank API call is made by the demo path.

### Dependencies and blockers
- Depends on shared workflow actions and secure supporting-document association.
- Blockers: actual eligibility and FDR closure rule are `TBD`. Do not invent them; make configuration explicit and label demo behavior.

---

## Phase 9 — Dashboards, filters, reports, and audit logs (budget: 2 hours)

**Dependencies:** Phases 2–8; persisted workflow/status data and RBAC.

### Tasks
- [ ] **M** Implement database-derived dashboard metrics: total FDRs, counts by canonical status, total/active deposit amount in INR, maturing/matured counts, pending FDR verification/approval, renewal/release queue counts, correction-required and rejected counts.
- [ ] **M** Enforce role-scoped metrics; Institution Officers see their own institution only. AICTE Admin may see cross-institution aggregates; other role visibility stays limited to assigned responsibilities.
- [ ] **M** Implement backend filters and pagination for institution (authorized roles only), FDR status, request type/status, bank, maturity range/category, amount range, created/submitted date range, and FDR/institution search.
- [ ] **M** Implement authorized CSV exports for FDRs and requests using the same authorization and filters as list views.
- [ ] **M** Audit status transitions, verification/approval decisions, document operations, release confirmation, and privileged export where feasible. Include critical field changes with actor, timestamp, old/new value, and reason where available.
- [ ] **M** Add event-based operational KPIs only from real persisted events (for example, review/verification duration, discrepancy resolution duration, renewal timeliness, release decision duration, overdue queue). Display period/sample size or an insufficient-data state; do not hard-code results. Never export passwords, tokens, document contents, private storage paths, or unauthorized institution data.
- [ ] **M** Provide in-app notifications for workflow decisions/reminders if not completed earlier; notification list/read-state is user-scoped.
- [ ] **O** PDF/XLSX export, advanced charts, and export audit details beyond the required CSV path.
- [ ] **O** Simulated clock/date override for repeatable maturity demos, only after core tests pass; label clearly as demo behavior.
- [ ] **O** Hash-chained audit log with a verification test, only after ordinary append-only transactional audit logging works.

### Definition of Done
- [ ] Dashboard counts/totals match database queries and change when workflows change.
- [ ] Filters and pagination operate server-side and produce consistent list and CSV results.
- [ ] Institution isolation is preserved across metrics, searches, exports, notifications and audit views.
- [ ] Audit history shows actor, timestamp, entity, action, old/new status or value where applicable, and remarks where supplied.
- [ ] CSV files contain only authorized, necessary columns and escape values safely for CSV consumers.

### Verification commands / procedures
Run backend and frontend tests. Compare dashboard totals to direct test-database queries. For each role, apply each filter and compare list results to CSV rows; include cross-institution data to test isolation. Inspect CSV headers/content for secrets, private paths and unauthorized institutions. Perform several workflow actions and verify ordered audit events and actor/timestamps. Confirm no fabricated hard-coded dashboard counts.

### Dependencies and blockers
- Depends on stable entities/statuses and backend authorization.
- Blockers: unclear aggregate visibility for Verification Officers/Approving Authorities remains `TBD`; expose only their relevant queues. CSV is required; defer PDF/XLSX.

---

## Phase 10 — Testing, security checks, and demo preparation (budget: 5.5 hours)

**Dependencies:** All prior phases. The final budget includes integration, bug fixes, backup/restore check, and rehearsal. If behind schedule, defer optional features before reducing this phase.

### Tasks
- [ ] **M** Run the repository's full build, lint, unit, integration and existing regression commands; record exact commands/results after stack discovery.
- [ ] **M** Run acceptance coverage for authentication/RBAC/institution isolation, FDR CRUD, secure documents, discrepancy handling, approval, maturity reminders, renewal, release/refund, dashboard/CSV, audit/notifications and API errors.
- [ ] **M** Run a full demo scenario: log in as Institution Officer → create FDR → upload document → submit → verifier starts verification → verify → Approving Authority approves → FDR becomes active → maturity reminder via test date/config → renewal request and completion → separate release request through confirmation path (use separate seeded FDR if lifecycle state makes this clearer).
- [ ] **M** Verify invalid transitions return `409`; unauthenticated requests return `401`; forbidden access returns `403`/non-disclosing `404`; file errors return documented `400`/`413`/`415` responses; generic server errors do not expose stack traces.
- [ ] **M** Test database transaction rollback for status + approval/verification + audit, and renewal completion/release confirmation atomicity.
- [ ] **M** Test a manual database + private document-storage backup and restore in a test location; if impossible within the deadline, record it as a known limitation and do not claim recovery verified.
- [ ] **M** Measure common dashboard/list/detail endpoints against the seeded demo dataset; target p95 under 2 seconds, while recording that official record volume/concurrency are `TBD`.
- [ ] **M** Verify all simulated bank/AICTE/release results are clearly labelled `DEMO` or `SIMULATED`; no real integration is claimed unless tested with authoritative credentials/endpoints.
- [ ] **M** Prepare seeded demo accounts/instructions, a short demo script, environment setup steps, known limitations, and a clean restart procedure.
- [ ] **O** Add additional load tests, automated backup schedule, or extra visual polish only if all must-have checks pass.

### Definition of Done
- [ ] Build/lint/test commands pass, or every pre-existing/new failure is documented with severity and the demo-blocking issues are resolved.
- [ ] End-to-end demo succeeds from a clean restart using documented setup/seed instructions.
- [ ] No critical authorization, cross-institution leakage, public document access, invalid status transition, or false integration claim remains.
- [ ] Backup/restore is tested or explicitly listed as unverified limitation.
- [ ] README/run instructions and demo limitations match actual behavior.

### Verification commands / procedures
From repository root, run the exact commands recorded in Phase 1 (for example, the detected package manager's install/build/test/lint commands; do not copy generic commands that do not fit the stack). Run API integration tests and frontend build. Repeat the end-to-end scenario against a fresh seeded test database. Inspect Git diff/status to ensure only intended files changed and `REQUIREMENTS_UPDATED.md` and `ARCHITECTURE.md` remain untouched. Capture test output and any unresolved limitations in the final demo notes.

### Dependencies and blockers
- Depends on all previous phases and a stable demo environment.
- Blockers: failing build, cross-institution leakage, unsafe document access, broken canonical transitions, or incomplete end-to-end path. Fix these before polishing UI or adding optional integrations.

---

## Cross-phase consistency checklist

- [ ] Repository was inspected before stack, commands, or architecture assumptions were made.
- [ ] Database supports all canonical FDR/request statuses and keeps FDR and request status separate.
- [ ] Every documented transition has a backend action or an explicitly defined automatic job; no frontend-only status changes.
- [ ] `SUBMITTED → UNDER_VERIFICATION` and `REQUESTED → UNDER_VERIFICATION` require explicit verifier start actions.
- [ ] FDR correction resubmission uses the submit action; request correction resubmission uses the request resubmit action.
- [ ] Successful verification transitions to `PENDING_APPROVAL` transactionally; correction transitions to `CORRECTION_REQUIRED`.
- [ ] Renewal approval does not update the FDR until explicit completion.
- [ ] Release approval does not imply confirmation; readiness and confirmation are separate actions.
- [ ] Rejected renewal/release requests do not set the underlying FDR to `REJECTED`.
- [ ] Maturity job is idempotent, records audit history, and preserves protected workflow/closed states.
- [ ] Backend authorization covers records, documents, dashboards, reports, notifications, and audit history.
- [ ] Documents remain private, validated, hashed, versioned, and downloadable only through authorized routes.
- [ ] Critical field provenance/history and discrepancy explanations do not claim bank authenticity without an authoritative integration.
- [ ] Operational KPIs use persisted events and clearly disclose sample size/period or insufficient data.
- [ ] Simulated clock and hash-chained audit remain optional and cannot delay core workflow/security acceptance.
- [ ] Dashboard and CSV use the same backend scope/filters; no sensitive data is exported.
- [ ] Official AICTE policy values and live integrations are not invented; unresolved policy remains configurable/TBD.
- [ ] Must-have acceptance tests pass before any optional enhancements are considered complete.

## Final stop condition

Stop after Phase 10 verification and demo preparation. Do not implement unrequested features, do not edit `REQUIREMENTS_UPDATED.md` or `ARCHITECTURE.md`, and do not mark any phase complete without recorded passing verification.
