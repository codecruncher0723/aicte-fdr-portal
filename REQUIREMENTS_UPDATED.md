<!-- Update note: 2026-10-23. Added provenance/history, immutable document-version, explainable discrepancy severity, and event-based KPI requirements. Existing role/status/API/workflow contracts remain authoritative. -->
## User Roles and Permissions

The FDR Management Portal will use Role-Based Access Control (RBAC) with four main user roles:

| User Role | Permissions |
|---|---|
| **AICTE Admin** | View all institutions and FDR records, monitor maturity dates, access reports, and oversee approvals. |
| **Institution Officer** | Add FDR records, upload supporting documents, edit institution details, and submit FDRs for verification. |
| **Verification Officer** | Review submitted FDRs, verify document details, flag discrepancies, and add verification remarks. |
| **Approving Authority** | Approve or reject FDR submissions and release/refund requests. |

### Access Control Rules

1. **Role-Based Access:** Each user can access only the features permitted for their role.
2. **Institution-Level Isolation:** Institution Officers can view and manage only their institution's records.
3. **Approval Workflow:** FDRs follow the workflow: Submitted → Under Verification → Verified → Approved/Rejected.
4. **Audit Trail:** Important actions record the user's identity, timestamp, and action performed.
5. **Demo Authentication:** Predefined demo accounts will be used for each role to save development time.
6. **Secure Documents:** Uploaded FDR documents are accessible only to authorized users.

### Implementation Scope

Considering the 24-hour development limit, the prototype will use these four roles without separate System Administrator, Finance Officer, or Auditor roles. Verification and approval will be simulated where necessary, with no claims of actual bank or AICTE integration unless implemented.

## FDR Renewal Workflow

The renewal workflow ensures that Fixed Deposit Receipts approaching maturity are identified, reviewed, and renewed on time.

1. **Maturity Alert:** The system flags FDRs approaching maturity and displays alerts on the dashboard.
2. **Renewal Request:** The Institution Officer initiates a renewal request and uploads the renewed FDR document or supporting bank documents.
3. **Document Verification:** The Verification Officer checks the FDR number, deposit amount, issuing bank, maturity date, and other required details.
4. **Correction Required:** If discrepancies are found, the request is returned to the Institution Officer with remarks for correction.
5. **Approval:** The Approving Authority reviews the verified renewal request and approves or rejects it.
6. **Record Update:** Once approved, the system updates the FDR details, maturity date, and renewal status while retaining the previous record for audit purposes.
7. **Notification:** The relevant officers receive a notification about the final decision.

**Renewal Statuses:** Upcoming Maturity → Renewal Requested → Under Verification → Correction Required (if applicable) → Pending Approval → Renewed / Rejected.

## FDR Release / Refund Workflow

The release/refund workflow manages requests to release an institution's security deposit after the applicable requirements have been fulfilled.

1. **Release Request:** The Institution Officer submits a release/refund request with the reason and required supporting documents.
2. **Initial Review:** The Verification Officer checks the FDR details, institution information, supporting documents, and request eligibility.
3. **Discrepancy Handling:** If information is missing or inconsistent, the request is returned for correction with remarks.
4. **Approval Review:** The Approving Authority reviews the verified request and approves or rejects it according to the applicable rules.
5. **Release Decision:** Once approved, the system records the release authorization and updates the FDR status to **Release Approved**.
6. **Payment/Release Confirmation:** The Institution Officer or authorized officer uploads confirmation of the actual release or refund, if available.
7. **Closure and Audit:** The system marks the case as **Released/Refunded** only after confirmation is recorded and maintains the complete request and approval history.

**Release/Refund Statuses:** Request Submitted → Under Verification → Pending Approval → Release Approved → Awaiting Release Confirmation → Released/Refunded.

Requests may also be marked **Correction Required** or **Rejected** when applicable.

## Rules Common to Both Workflows

- Only authorized users can initiate, verify, or approve requests according to their assigned roles.
- The person submitting a request cannot be its sole approving authority.
- Every approval, rejection, correction, and status change must be recorded in the audit trail.
- Notifications and maturity alerts will be generated within the application.
- The prototype will simulate external bank verification and release confirmation unless actual integrations are implemented.
- All workflow decisions must follow applicable AICTE rules and institutional approval procedures; the statuses above define the proposed prototype workflow.

## FDR Lifecycle and Allowed Status Transitions

The FDR Management Portal will maintain a clearly defined lifecycle for each Fixed Deposit Receipt (FDR), from registration and verification to renewal or release/refund. Only authorized users can perform permitted status transitions.

### 1. FDR Lifecycle

1. **Draft:** The Institution Officer creates an FDR record and enters the deposit details.
2. **Submitted:** The record and supporting documents are submitted for verification.
3. **Under Verification:** The Verification Officer reviews the submitted details and documents.
4. **Correction Required:** The FDR contains missing information or discrepancies and is returned to the Institution Officer.
5. **Verified:** The Verification Officer confirms that the submitted details satisfy the configured verification checks.
6. **Pending Approval:** The verified FDR awaits a decision from the Approving Authority.
7. **Active:** The FDR is approved and is being tracked by the system.
8. **Maturing Soon:** The FDR is approaching its maturity date and requires attention.
9. **Matured:** The FDR has reached its maturity date without a recorded renewal or release completion.
10. **Renewal Requested:** A renewal request has been submitted.
11. **Release Requested:** A release/refund request has been submitted.
12. **Release Approved:** The release/refund request has been approved, but completion has not yet been confirmed.
13. **Released/Refunded:** The release or refund has been confirmed and the case is closed.
14. **Rejected:** A submission, renewal, or release/refund request has been rejected. The rejection reason must be recorded.

### 2. Allowed Status Transitions

| Current Status | Allowed Next Status | Authorized Action |
|---|---|---|
| Draft | Submitted | Institution Officer |
| Submitted | Under Verification | Verification Officer |
| Under Verification | Correction Required | Verification Officer |
| Under Verification | Verified | Verification Officer |
| Correction Required | Submitted | Institution Officer |
| Verified | Pending Approval | System / authorized workflow |
| Pending Approval | Active | Approving Authority |
| Pending Approval | Rejected | Approving Authority |
| Active | Maturing Soon | System, based on maturity date |
| Maturing Soon | Renewal Requested | Institution Officer |
| Active | Renewal Requested | Institution Officer |
| Maturing Soon | Matured | System, based on maturity date |
| Matured | Renewal Requested | Institution Officer |
| Renewal Requested | Under Verification | Verification Officer |
| Renewal Requested | Correction Required | Verification Officer |
| Renewal Requested | Pending Approval | Verification Officer, after successful verification |
| Pending Approval | Active | Approving Authority, after renewal approval |
| Active / Maturing Soon / Matured | Release Requested | Institution Officer |
| Release Requested | Under Verification | Verification Officer |
| Release Requested | Correction Required | Verification Officer |
| Release Requested | Pending Approval | Verification Officer, after successful verification |
| Pending Approval | Release Approved | Approving Authority, for a release/refund request |
| Release Approved | Released/Refunded | Authorized Officer, after recording release confirmation |

### 3. Lifecycle Rules

- **Renewal:** Once a renewal is approved, update the FDR with the new maturity date and relevant details. Preserve the previous FDR details in the history.
- **Release/Refund:** Approval does not mean the funds have actually been released. Mark the FDR as `Released/Refunded` only after confirmation is recorded.
- **Rejection:** Record the reason and retain the request history. A rejected request may be resubmitted as a new request if permitted by the applicable rules.
- **Correction:** Only the Institution Officer may correct and resubmit a returned record.
- **Maturity Alerts:** The system automatically flags FDRs approaching maturity and marks overdue records as matured based on their dates.
- **Audit Trail:** Record every status change with the acting user, timestamp, previous status, new status, and remarks.
- **Access Control:** Users cannot skip verification or approval stages or manually set statuses outside their permissions.

### 4. Implementation Scope for the 24-Hour Prototype

To keep the implementation feasible, use the following primary FDR statuses:

`Draft → Submitted → Under Verification → Verified → Pending Approval → Active`

Additional statuses:

`Correction Required`, `Rejected`, `Maturing Soon`, `Matured`, `Renewal Requested`, `Release Requested`, `Release Approved`, and `Released/Refunded`.

Implement role-based transition checks, automatic maturity alerts, and an audit log. Renewal and release/refund should use the same verification and approval stages while maintaining separate request types. External bank verification and actual fund transfers are outside the prototype unless specifically integrated.

## Database Entities and Relationships

The FDR Management Portal will use a relational database to manage institutions, user permissions, FDR records, supporting documents, verification, approvals, renewal requests, release/refund requests, and audit history.

### 1. Database Entities

#### 1. Users
Stores details of users accessing the portal.

- `user_id` — Primary Key
- `name`
- `email` — Unique
- `password_hash`
- `role_id` — Foreign Key
- `institution_id` — Foreign Key, nullable for AICTE-level users
- `is_active`
- `created_at`

#### 2. Roles
Defines the permissions assigned to each user category.

- `role_id` — Primary Key
- `role_name` — AICTE Admin, Institution Officer, Verification Officer, Approving Authority
- `description`

#### 3. Institutions
Stores registered institution details.

- `institution_id` — Primary Key
- `institution_name`
- `aicte_approval_id`
- `address`
- `state`
- `contact_email`
- `created_at`

#### 4. FDR Records
Stores the main information about each Fixed Deposit Receipt.

- `fdr_id` — Primary Key
- `institution_id` — Foreign Key
- `fdr_number`
- `issuing_bank`
- `branch_name`
- `deposit_amount`
- `issue_date`
- `maturity_date`
- `interest_rate` — Optional
- `status`
- `created_by` — Foreign Key to Users
- `created_at`
- `updated_at`

#### 5. FDR Documents
Stores metadata and storage references for uploaded FDR documents.

- `document_id` — Primary Key
- `fdr_id` — Foreign Key
- `file_name`
- `file_path`
- `document_type`
- `uploaded_by` — Foreign Key to Users
- `uploaded_at`

#### 6. Verification Records
Stores verification decisions and remarks.

- `verification_id` — Primary Key
- `fdr_id` — Foreign Key
- `verified_by` — Foreign Key to Users
- `verification_status`
- `remarks`
- `verified_at`

#### 7. Workflow Requests
Stores renewal and release/refund requests linked to an FDR.

- `request_id` — Primary Key
- `fdr_id` — Foreign Key
- `request_type` — Renewal or Release/Refund
- `requested_by` — Foreign Key to Users
- `request_status`
- `reason`
- `supporting_document_id` — Optional Foreign Key to FDR Documents
- `submitted_at`
- `updated_at`

#### 8. Approval Records
Stores approval or rejection decisions for FDR submissions and workflow requests.

- `approval_id` — Primary Key
- `fdr_id` — Foreign Key, nullable when the approval relates to a workflow request
- `request_id` — Foreign Key, nullable when the approval relates to the initial FDR submission
- `approved_by` — Foreign Key to Users
- `decision` — Approved or Rejected
- `remarks`
- `decided_at`

Exactly one of `fdr_id` or `request_id` must be populated for each approval record.

#### 9. Audit Logs
Maintains a history of important actions performed in the system.

- `log_id` — Primary Key
- `user_id` — Foreign Key
- `entity_type`
- `entity_id`
- `action`
- `old_value` — Optional
- `new_value` — Optional
- `timestamp`

#### 10. Notifications
Stores alerts and workflow notifications for users.

- `notification_id` — Primary Key
- `user_id` — Foreign Key
- `fdr_id` — Optional Foreign Key
- `request_id` — Optional Foreign Key
- `message`
- `notification_type`
- `is_read`
- `created_at`

### 2. Entity Relationships

| Relationship | Cardinality | Description |
|---|---|---|
| Roles → Users | One-to-Many | One role can be assigned to multiple users. |
| Institutions → Users | One-to-Many | One institution can have multiple associated users. |
| Institutions → FDR Records | One-to-Many | An institution can maintain multiple FDRs. |
| Users → FDR Records | One-to-Many | A user can create multiple FDR records. |
| FDR Records → FDR Documents | One-to-Many | An FDR can have multiple supporting documents. |
| FDR Records → Verification Records | One-to-Many | An FDR can have multiple verification attempts over time. |
| FDR Records → Workflow Requests | One-to-Many | An FDR can have multiple renewal or release/refund requests over its lifecycle. |
| FDR Records / Workflow Requests → Approval Records | One-to-Many | Each FDR submission or request can have an approval history. |
| Users → Audit Logs | One-to-Many | Each user can generate multiple audit log entries. |
| Users → Notifications | One-to-Many | A user can receive multiple notifications. |
| FDR Records → Notifications | One-to-Many | An FDR can trigger multiple notifications. |

### 3. Important Database Rules

1. Use primary keys and foreign keys to maintain referential integrity.
2. Restrict access to FDR records according to the user's role and institution.
3. Store uploaded files in controlled file storage and keep their metadata and storage paths in the database.
4. Preserve verification, approval, renewal, and release/refund history rather than overwriting previous decisions.
5. Validate deposit amounts and dates; the maturity date must not precede the issue date.
6. Generate maturity alerts automatically based on the FDR maturity date.
7. Use database transactions for important status changes and record them in the audit log.
8. Enforce valid status transitions in the backend rather than relying only on frontend controls.

### 4. Recommended Scope for the 24-Hour Build

Implement these core entities first:

- Users
- Roles
- Institutions
- FDR Records
- FDR Documents
- Workflow Requests
- Verification Records
- Approval Records
- Audit Logs

Add Notifications if time permits. Use a relational database such as PostgreSQL or SQLite for the prototype, with SQLite suitable for a quick local demo.

**Design principle:** Keep the main FDR record separate from renewal and release/refund requests. This allows an FDR to have a complete history without losing previous details whenever it is renewed or released.

# API Contracts for Core Workflows

The FDR Management Portal will expose REST APIs using JSON for communication between the frontend and backend. The APIs will support authentication, FDR management, document uploads, verification, approvals, renewal, release/refund, and audit history.

## 1. API Standards

- **Base URL:** `/api/v1`
- **Protocol:** HTTPS in production
- **Data Format:** JSON, except multipart file uploads
- **Authentication:** JWT access token or secure session-based authentication
- **Authorization:** Role-Based Access Control (RBAC)
- **Date Format:** ISO 8601 (`YYYY-MM-DD`)
- **Currency:** INR (Indian Rupees)
- **Error Format:** Consistent JSON error responses

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "This action is not allowed for the current FDR status."
  }
}
```

# Document Security and Document-Storage Requirements

The FDR Management Portal will securely store and manage Fixed Deposit Receipt (FDR) documents, bank-issued certificates, renewal documents, and release/refund supporting documents. The system must protect documents from unauthorized access, tampering, accidental loss, and malicious uploads.

## 1. Supported Documents

- **Allowed formats:** PDF, JPG, JPEG, PNG, and WEBP.
- **Maximum file size:** 10 MB per file.
- **Document categories:** Original FDR, renewal document, and release/refund supporting document.
- **Required metadata:** Document ID, associated FDR ID, original filename, document type, uploader, upload timestamp, and storage reference.

## 2. Document Upload Security

1. Validate the file extension, MIME type, and actual file signature (magic bytes).
2. Reject unsupported, corrupted, empty, or oversized files.
3. Generate a unique server-side filename instead of trusting the uploaded filename.
4. Sanitize filenames and prevent path traversal attacks.
5. Store files outside the publicly accessible web root.
6. Prevent executable files and malicious content from being uploaded.
7. Apply configurable limits to image dimensions and PDF processing where applicable.
8. Return clear validation errors without exposing internal server paths or implementation details.

## 3. Access Control and Authorization

- Require authentication before accessing protected documents.
- Enforce Role-Based Access Control (RBAC) for uploads, viewing, and downloads.
- Institution Officers can access only documents belonging to their institution.
- Verification Officers can access documents assigned or available for verification.
- AICTE Admins and Approving Authorities can access documents according to their responsibilities.
- Every document request must verify authorization on the backend; hiding links in the frontend is insufficient.
- Use authenticated download endpoints rather than public file URLs.

## 4. Storage Requirements

### Prototype Storage

For the 24-hour build, store uploaded files in a dedicated private directory, such as `storage/fdr_documents/`, outside the public frontend directory.

The database should store document metadata and a relative storage reference, not the complete file contents.

### Production-Ready Design

The storage layer should be replaceable with private object storage, such as an appropriately configured cloud storage bucket, without changing the core workflow APIs.

Production storage should support:
- Private access by default.
- Encryption at rest and in transit.
- Restricted service permissions.
- Backup and recovery.
- Retention and deletion policies.
- Versioning or immutable evidence storage where required.

## 5. Document Integrity and Audit Trail

1. Calculate a SHA-256 hash for each uploaded document to help detect unexpected changes.
2. Preserve previously submitted documents when a renewal or corrected document is uploaded.
3. Record who uploaded, viewed, downloaded, replaced, or verified a document where required.
4. Maintain timestamps and document-to-FDR relationships.
5. Prevent ordinary users from modifying or deleting documents associated with approved decisions.
6. Record verification and approval decisions separately from the document itself.
7. Do not treat a matching hash or successful file upload as proof that an FDR is authentic.

## 6. Privacy and Data Protection

- Collect and retain only information necessary for FDR management.
- Do not expose documents through public URLs, search indexing, or frontend static assets.
- Avoid logging document contents, passwords, authentication tokens, or sensitive financial information.
- Apply retention and deletion rules based on applicable AICTE and institutional requirements.
- Restrict access to production files and database backups to authorized personnel.
- Use secure configuration and environment variables for storage credentials and encryption keys.

## 7. Error Handling

The API should return consistent errors for invalid or unauthorized document operations.

| HTTP Status | Error Code | Description |
|---|---|---|
| 400 | `INVALID_FILE` | File is corrupted, empty, or invalid. |
| 401 | `UNAUTHENTICATED` | Authentication is required. |
| 403 | `DOCUMENT_ACCESS_DENIED` | User is not authorized to access the document. |
| 404 | `DOCUMENT_NOT_FOUND` | Document does not exist or is unavailable. |
| 413 | `FILE_TOO_LARGE` | File exceeds the configured size limit. |
| 415 | `UNSUPPORTED_FILE_TYPE` | File format is not allowed. |
| 500 | `DOCUMENT_STORAGE_ERROR` | File could not be stored or retrieved. |

## 8. Acceptance Criteria

- Valid PDF and image files within the size limit can be uploaded successfully.
- Invalid, corrupted, oversized, and unsupported files are rejected.
- Uploaded files cannot be accessed directly through public URLs.
- Users cannot access documents belonging to unauthorized institutions.
- Files receive unique storage names and are linked to the correct FDR record.
- Document metadata and audit events are recorded successfully.
- Previous documents remain available to authorized users after renewal or correction.
- Document hashes can be used to check whether stored files have changed.
- Failed uploads do not leave incomplete or orphaned records.

## 9. Implementation Scope for the 24-Hour Build

**Must implement:**
- Private local file storage.
- PDF and image file validation.
- Configurable 10 MB upload limit.
- Unique filenames and safe storage paths.
- Backend authorization for document access.
- Document metadata in the database.
- SHA-256 integrity hashes.
- Basic audit logging.

**Can be deferred:**
- Cloud object storage.
- Automated malware scanning.
- Advanced OCR-based extraction.
- Digital signatures and external bank verification.
- Enterprise key management and immutable storage infrastructure.

The prototype must demonstrate secure document handling without claiming that uploaded FDRs have been authenticated by a bank or AICTE.

# Acceptance Tests for Each Workflow

The FDR Management Portal will be tested against the following acceptance criteria to ensure that its core workflows function correctly within the 24-hour development timeline.

## 1. Authentication and Role-Based Access Control

- [ ] Valid users can log in with the correct credentials.
- [ ] Invalid credentials are rejected with an appropriate error message.
- [ ] Users are redirected to dashboards appropriate to their roles.
- [ ] Institution Officers cannot view or modify another institution's FDR records.
- [ ] Unauthorized users cannot access verification, approval, or release-confirmation endpoints.
- [ ] Users cannot approve their own submissions where separation of duties is required.

## 2. FDR Registration and Management Workflow

- [ ] Institution Officers can create an FDR record with all required fields.
- [ ] The system rejects missing required fields, negative deposit amounts, and invalid dates.
- [ ] The maturity date cannot be earlier than the issue date.
- [ ] Duplicate FDR numbers are detected within the configured uniqueness scope.
- [ ] FDR records can be saved as drafts and submitted for verification.
- [ ] Authorized users can view FDR details and their current status.
- [ ] Unauthorized users cannot edit approved records directly.
- [ ] Every important status change is recorded in the audit log.

## 3. Document Upload and Security Workflow

- [ ] Valid PDF, JPG, JPEG, PNG, and WEBP files within the 10 MB limit can be uploaded.
- [ ] Unsupported, corrupted, empty, and oversized files are rejected.
- [ ] Uploaded files receive unique server-generated filenames.
- [ ] Files are stored outside the publicly accessible frontend directory.
- [ ] Only authorized users can view or download uploaded documents.
- [ ] Uploaded documents are associated with the correct FDR record.
- [ ] SHA-256 hashes are generated and stored for uploaded documents.
- [ ] Previous documents remain available after corrections or renewals.
- [ ] Failed uploads do not leave incomplete database records or orphaned files.

## 4. FDR Verification Workflow

- [ ] Submitted FDRs appear in the Verification Officer's pending queue.
- [ ] Verification Officers can review FDR details and supporting documents.
- [ ] An FDR can be marked as `VERIFIED` when the required checks pass.
- [ ] An FDR can be returned as `CORRECTION_REQUIRED` with remarks.
- [ ] Institution Officers can correct returned records and resubmit them.
- [ ] Verification decisions and remarks are saved with the officer's identity and timestamp.
- [ ] Unverified FDRs cannot proceed to approval.
- [ ] Invalid status transitions are rejected by the backend.

## 5. FDR Approval Workflow

- [ ] Verified FDRs appear in the Approving Authority's pending queue.
- [ ] The Approving Authority can approve or reject a verified FDR.
- [ ] Approval changes the FDR status to `ACTIVE`.
- [ ] Rejection records the decision and reason.
- [ ] Rejected FDRs do not become active automatically.
- [ ] Unauthorized users cannot approve or reject FDRs.
- [ ] Repeated approval requests do not create duplicate approval decisions.
- [ ] Approval decisions are recorded in the audit history.

## 6. FDR Maturity and Alert Workflow

- [ ] FDRs approaching their configured maturity threshold appear in the `MATURING_SOON` category.
- [ ] FDRs that reach their maturity date without renewal or release completion are marked `MATURED`.
- [ ] FDRs with later maturity dates are not incorrectly marked as matured.
- [ ] Maturity alerts display the correct FDR number and maturity date.
- [ ] Renewed FDRs use the updated maturity date for future alerts.
- [ ] Re-running the alert process does not create duplicate alerts unnecessarily.

## 7. FDR Renewal Workflow

- [ ] Institution Officers can initiate renewal requests for eligible FDRs.
- [ ] Renewal requests require the relevant details and supporting documents.
- [ ] Renewal requests appear in the Verification Officer's pending queue.
- [ ] Verification Officers can verify a renewal or return it for correction.
- [ ] Only verified renewal requests can proceed to approval.
- [ ] The Approving Authority can approve or reject renewal requests.
- [ ] Approved renewals update the FDR's maturity date and relevant details.
- [ ] Previous FDR details and renewal decisions remain available in the history.
- [ ] Rejected renewals do not modify the existing FDR details.
- [ ] Renewal requests cannot bypass verification or approval.

## 8. Release/Refund Workflow

- [ ] Institution Officers can submit release/refund requests for eligible FDRs.
- [ ] Release/refund requests include a reason and required supporting documents.
- [ ] Verification Officers can verify requests or return them for correction.
- [ ] Only verified requests can proceed to the Approving Authority.
- [ ] The Approving Authority can approve or reject release/refund requests.
- [ ] Approval changes the request status to `RELEASE_APPROVED`.
- [ ] An approved request is not marked `RELEASED_REFUNDED` until confirmation is recorded.
- [ ] Only authorized officers can record release/refund confirmation.
- [ ] Confirmation details and timestamps are stored in the audit history.
- [ ] Rejected requests do not mark the FDR as released or refunded.

## 9. Dashboard and Reporting Workflow

- [ ] The dashboard displays the correct total number of FDRs.
- [ ] Active, maturing, matured, pending verification, and pending approval counts match database records.
- [ ] Dashboard data is filtered according to the user's role and institution.
- [ ] Authorized users can filter FDRs by status and maturity date.
- [ ] Reports display accurate institution, deposit amount, maturity date, and status information.
- [ ] Dashboard counts update after relevant workflow actions.

## 10. Audit Trail and Notifications

- [ ] Important actions record the user, timestamp, action, and related FDR or request.
- [ ] Status changes record the previous and new statuses.
- [ ] Verification and approval remarks are preserved.
- [ ] Unauthorized users cannot modify audit records.
- [ ] Relevant users receive in-application notifications for submission, correction, approval, rejection, and maturity events.
- [ ] Notifications link to the correct FDR or workflow request.

## 11. API and Error-Handling Tests

- [ ] API endpoints return the expected HTTP status codes and response formats.
- [ ] Invalid request data returns a clear validation error.
- [ ] Missing or invalid authentication returns `401 Unauthorized`.
- [ ] Insufficient permissions return `403 Forbidden`.
- [ ] Invalid workflow transitions return `409 Conflict`.
- [ ] Missing resources return `404 Not Found`.
- [ ] Server errors do not expose stack traces, credentials, or internal storage paths.
- [ ] Database updates and associated history records remain consistent when a transaction fails.

## 12. Final End-to-End Acceptance Test

- [ ] An Institution Officer creates an FDR and uploads its document.
- [ ] The FDR is submitted and verified by a Verification Officer.
- [ ] The Approving Authority approves the FDR, making it active.
- [ ] The system identifies the FDR as approaching maturity using its maturity date.
- [ ] The Institution Officer submits a renewal request and completes verification and approval.
- [ ] The updated maturity date is saved while the previous details remain available.
- [ ] A release/refund request can be submitted, verified, approved, and confirmed separately.
- [ ] The dashboard reflects the final FDR and request statuses.
- [ ] The audit history contains the complete sequence of actions.
- [ ] All critical tests pass, and no unresolved critical errors remain.

## Definition of Done

The prototype is accepted when all critical authentication, FDR registration, document security, verification, approval, renewal, and release/refund tests pass. Dashboard accuracy and audit history must also be demonstrated. External bank verification and actual fund transfers are excluded unless explicitly implemented.


---

# Requirements Completion Addendum (Authoritative)

This addendum fills gaps in the existing requirements. Where earlier shorthand or examples conflict with this consolidated section, **the consolidated rules in this addendum are authoritative**. Existing requirements not contradicted here remain valid. This document describes a prototype and does not assert unverified AICTE policy or live external integrations.

## 1. Project Scope and Exclusions

### 1.1 In scope for the 24-hour prototype

- Four roles only: `AICTE_ADMIN`, `INSTITUTION_OFFICER`, `VERIFICATION_OFFICER`, and `APPROVING_AUTHORITY`.
- Demo authentication and backend-enforced RBAC; institution officers are restricted to their own institution.
- Create, view, edit eligible drafts/returned records, submit, verify, request corrections, approve, and reject FDR records.
- Secure document upload, private storage, document metadata, and SHA-256 integrity hashes.
- Separate renewal and release/refund requests linked to an FDR.
- Date-based maturity flags/reminders, dashboard metrics, filters, CSV report export, audit history, and in-app notifications where time permits.
- Seeded demonstration data and clearly labelled simulated integrations.

### 1.2 Excluded unless explicitly implemented and verified

- Live AICTE, bank, core banking, or government-system integration.
- Bank-side authenticity confirmation, digital signatures, actual fund transfer, or automated legal/financial eligibility decisions.
- Claims that OCR, a hash, a file signature, or a successful upload proves an FDR is genuine.
- Production-grade multi-factor authentication, enterprise identity federation, advanced malware scanning, high availability, or immutable/WORM storage.
- Any official AICTE-specific deposit, maturity, renewal, release, retention, or approval rule not supplied in the problem statement. Such rules are `TBD` and must be configurable rather than invented.

## 2. Verification Rules and Discrepancy Detection

Verification is a human review supported by deterministic validation. It is not bank authentication.

### 2.1 Required field and consistency checks

The backend must validate at minimum:

- Required FDR number, institution, issuing bank, deposit amount, issue date, maturity date, and required supporting document.
- Deposit amount is greater than zero; issue date and maturity date are valid dates; maturity date is not earlier than issue date.
- Uploaded document exists, is permitted, passes file validation, and is associated with the correct FDR/request.
- The submitting user is authorized for the institution and the requested operation.
- Duplicate FDR number detection within a configurable uniqueness scope. Exact uniqueness scope (for example, issuer + FDR number + institution) is `TBD`; do not assume the FDR number is globally unique.
- For renewal, compare the submitted renewed FDR fields against the current record and retain old values in history.
- For release/refund, require a reason and configured supporting documents; the actual eligibility rules are `TBD`.

### 2.2 Discrepancy categories

The system should flag, with a human-readable reason:

- `MISSING_REQUIRED_FIELD`
- `INVALID_AMOUNT_OR_DATE`
- `DUPLICATE_FDR_CANDIDATE`
- `DOCUMENT_MISSING_OR_INVALID`
- `DOCUMENT_METADATA_MISMATCH`
- `RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD`
- `RELEASE_REQUEST_MISSING_SUPPORT`
- `MANUAL_REVIEW_REQUIRED`

A discrepancy flag is not itself a rejection. A Verification Officer must decide whether to mark the item `CORRECTION_REQUIRED` or `VERIFIED`, and record remarks. The prototype must not claim that it verifies bank issuance or document authenticity unless a real authoritative integration exists.

### 2.3 Verification result schema

```json
{
  "decision": "VERIFIED",
  "checks": [
    {
      "code": "INVALID_AMOUNT_OR_DATE",
      "passed": true,
      "message": "Required amount and date checks passed."
    }
  ],
  "remarks": "Reviewed against the submitted information."
}
```

`decision` is `VERIFIED` or `CORRECTION_REQUIRED`. The `checks` array reports system checks and must not represent a real bank lookup unless one was performed.

## 3. Canonical Status Model and Allowed Transitions

**FDR status, workflow-request status, verification decision, and approval decision are separate concepts.** Do not reuse one `PENDING_APPROVAL` value to ambiguously represent both an FDR and a renewal/release request.

### 3.1 FDR record statuses

`DRAFT`, `SUBMITTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `VERIFIED`, `PENDING_APPROVAL`, `ACTIVE`, `MATURING_SOON`, `MATURED`, `CLOSED`, `REJECTED`.

- Initial submission: `DRAFT → SUBMITTED` by `POST /fdrs/{fdr_id}/submit`; then `SUBMITTED → UNDER_VERIFICATION` by a Verification Officer using `POST /fdrs/{fdr_id}/start-verification` when taking ownership of the review. Both transitions create audit/history records.
- Verification: `UNDER_VERIFICATION → VERIFIED` or `CORRECTION_REQUIRED`.
- Correction: `CORRECTION_REQUIRED → SUBMITTED` by the Institution Officer using `POST /fdrs/{fdr_id}/submit` after updating permitted fields/documents.
- Initial approval: successful verification automatically transitions `VERIFIED → PENDING_APPROVAL` in the same transaction as the verification decision; the Approving Authority then uses `POST /fdrs/{fdr_id}/approval` for `PENDING_APPROVAL → ACTIVE` or `REJECTED`.
- Maturity flags: a scheduled maturity job transitions `ACTIVE → MATURING_SOON` when a configured reminder threshold is reached, then `MATURING_SOON → MATURED` on/after the maturity date if no renewal/release completion or protected pending workflow applies. The job records each transition and audit event; it must not overwrite a record that is in a pending workflow or already closed.
- `CLOSED` is used only when the FDR lifecycle is ended according to the approved release/closure policy. `RELEASED_REFUNDED` is a release-request status, not an FDR status.
- `REJECTED` on the FDR record means the initial FDR submission was rejected. Renewal/release rejections belong to the individual request and must not automatically reject the underlying FDR.

### 3.2 Renewal request statuses

`REQUESTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`.

Allowed transitions:

- `REQUESTED → UNDER_VERIFICATION` by a Verification Officer using `POST /requests/{request_id}/start-verification` when taking ownership of the review.
- `UNDER_VERIFICATION → CORRECTION_REQUIRED` or `PENDING_APPROVAL`
- `CORRECTION_REQUIRED → REQUESTED` by the Institution Officer using `POST /requests/{request_id}/resubmit` after updating the request and attaching/referencing any required documents.
- `PENDING_APPROVAL → APPROVED` or `REJECTED`
- `APPROVED → COMPLETED` by an authorized Institution Officer using `POST /requests/{request_id}/complete` after renewed FDR details and the renewal document are recorded and checked; this operation updates the FDR transactionally.
- `REQUESTED → CANCELLED` only before verification starts, through `POST /requests/{request_id}/cancel` by the owning Institution Officer with a reason; broader cancellation rules are `TBD`.

On `COMPLETED`, update the current FDR fields transactionally and preserve prior values and documents in history. Approval alone does not complete the renewal.

### 3.3 Release/refund request statuses

`REQUESTED`, `UNDER_VERIFICATION`, `CORRECTION_REQUIRED`, `PENDING_APPROVAL`, `RELEASE_APPROVED`, `REJECTED`, `AWAITING_CONFIRMATION`, `RELEASED_REFUNDED`, `CANCELLED`.

Allowed transitions:

- `REQUESTED → UNDER_VERIFICATION` by a Verification Officer using `POST /requests/{request_id}/start-verification` when taking ownership of the review.
- `UNDER_VERIFICATION → CORRECTION_REQUIRED` or `PENDING_APPROVAL`
- `CORRECTION_REQUIRED → REQUESTED` by the Institution Officer using `POST /requests/{request_id}/resubmit` after updating the request and attaching/referencing any required documents.
- `PENDING_APPROVAL → RELEASE_APPROVED` or `REJECTED`
- `RELEASE_APPROVED → AWAITING_CONFIRMATION` by a designated authorized officer using `POST /requests/{request_id}/release-confirmation/ready`; this explicitly records that the request is ready for confirmation, not that funds moved.
- `AWAITING_CONFIRMATION → RELEASED_REFUNDED` by a designated authorized officer using `POST /requests/{request_id}/release-confirmation` to record a confirmation reference and timestamp.
- `REQUESTED → CANCELLED` only before verification starts, through `POST /requests/{request_id}/cancel` by the owning Institution Officer with a reason; broader cancellation rules are `TBD`.

`RELEASE_APPROVED` means authorization was granted; it does not mean money moved. The prototype records confirmation only and does not transfer funds. After confirmed release, the FDR may move to `CLOSED` only if the configured closure policy permits it; that policy is `TBD`.

### 3.4 Approval and transition invariants

- Initial FDR approval is stored against the FDR submission; renewal/release decisions are stored against their `request_id`.
- Only an Approving Authority can make approval decisions.
- The submitting user cannot be the sole approver of their own submission/request.
- Verification must precede approval. The backend rejects invalid transitions with `409 INVALID_STATUS_TRANSITION`.
- Each decision is append-only history; do not overwrite a prior decision.
- Status updates, decision records, and audit records must be committed in one database transaction.
- A rejected request remains in history; a new attempt, if allowed, is a new request. Whether a new request is permitted in every rejected case is `TBD`.

## 4. Maturity Reminder Thresholds and Escalation

No official AICTE reminder schedule is supplied. Therefore, thresholds are configurable and marked `TBD` until agreed.

- `REMINDER_DAYS_PRIMARY = TBD` — first reminder threshold before maturity.
- `REMINDER_DAYS_ESCALATION = TBD` — escalation threshold before maturity.
- `REMINDER_DAYS_OVERDUE = TBD` — overdue follow-up interval.
- Time zone for date comparisons: `Asia/Kolkata` for the prototype, unless deployment configuration specifies otherwise.
- Reminder job frequency: once daily; exact execution time is `TBD`.

Behavior:

1. A daily job selects eligible active FDRs and calculates days remaining until maturity.
2. When the primary threshold is reached, create an in-app reminder for the Institution Officer and a visible dashboard alert.
3. At the escalation threshold, notify the Institution Officer and surface the item to the AICTE Admin dashboard. Do not invent email/SMS delivery.
4. On or after maturity, flag the FDR as `MATURED` only if it has not been renewed, closed, or placed in a workflow state that must be preserved.
5. Do not create duplicate reminders for the same FDR, threshold, and maturity date. A changed maturity date starts a new reminder cycle.
6. Keep reminder events in notification/audit history. Repeated overdue escalation cadence and additional recipients are `TBD`.

Acceptance tests must use configurable test thresholds (for example, a test-only value) rather than treating an example number as an official rule.

## 5. Dashboard Metrics, Filters, and Report Exports

### 5.1 Required metrics

The dashboard must calculate counts from persisted records, not hard-coded values:

- Total FDR records.
- FDRs by canonical FDR status.
- Total deposit amount and active deposit amount, with INR displayed.
- FDRs maturing within the configured primary reminder window.
- Matured FDRs.
- FDR submissions pending verification.
- Initial FDR submissions pending approval.
- Renewal requests pending verification and pending approval.
- Release/refund requests pending verification, pending approval, awaiting confirmation, and confirmed released/refunded.
- Correction-required and rejected counts.

Role-based visibility applies to all metrics. Institution Officers see only their institution; AICTE Admins may see cross-institution aggregates; other roles see the minimum data needed for their responsibilities. Exact aggregate visibility for Verification Officers and Approving Authorities is `TBD` if not required for their queues.

### 5.2 Filters

Provide applicable filters for:

- Institution (AICTE Admin and other explicitly authorized cross-institution roles only).
- FDR status.
- Request type (`RENEWAL`, `RELEASE_REFUND`) and request status.
- Issuing bank.
- Maturity date range and maturity category.
- Deposit amount range.
- Created/submitted date range.
- Search by FDR number or institution name, restricted by authorization.

Filters must be applied on the backend for paginated API results. Institution-level restrictions must never rely solely on frontend filtering.

### 5.3 Exports

- Provide CSV export for authorized FDR lists and workflow-request reports.
- Export must respect the same role, institution, and filter restrictions as the on-screen results.
- Include only necessary columns: FDR/request identifier, institution, bank, amount, issue/maturity dates, status, relevant submission/decision timestamps, and decision remarks where authorized.
- Do not export passwords, tokens, private storage paths, document contents, or unrelated sensitive data.
- PDF/XLSX export is optional and `TBD`; CSV is the required prototype format.
- Record who exported a report, when, and the applied filter summary in the audit log if feasible; if not implemented, mark this as a known prototype limitation.

## 6. Simulated and Optional Real Integrations

### 6.1 Simulated in the prototype

- Demo users/credentials and seeded institutions/FDR records.
- Verification based on local validation rules and officer review.
- Maturity reminders generated by an application job or demonstrable manual trigger.
- In-app notifications.
- Release/refund confirmation recorded as a reference and remarks; no transfer is initiated.
- Any bank/API result shown in the UI must be labelled `SIMULATED` or `DEMO` if it did not come from a real integration.

### 6.2 Optional future integrations

- Bank FDR verification API.
- AICTE or institution identity/records APIs.
- Email/SMS notification provider.
- Object storage and managed key services.
- OCR or document extraction service.

For every optional integration, use an adapter/interface with configuration and timeout/error handling. In the absence of credentials, approval, and a working endpoint, the integration remains disabled and the application must continue using the documented demo path. Availability, API contracts, credentials, approval, cost, and test environment for each real integration are `TBD`. Do not present a simulated response as a verified external response.

## 7. Non-Functional Requirements

### 7.1 Security

- Enforce authentication and RBAC on every protected API.
- Enforce institution isolation server-side for FDRs, requests, documents, exports, and dashboard queries.
- Use password hashing for stored passwords; never store plaintext passwords.
- Use HTTPS in production and secure, environment-based secrets.
- Validate input server-side; use parameterized database operations.
- Use private document storage, safe generated filenames, file-signature checks, and authenticated downloads.
- Prevent direct object reference/IDOR access by checking authorization for every requested resource.
- Avoid logging passwords, tokens, document contents, or sensitive secrets.
- Audit status changes, decisions, document operations, and privileged exports where implemented.
- Session/token lifetime, password policy, rate limits, malware scanning, encryption key rotation, and formal retention periods are `TBD` unless specified by deployment policy.

### 7.2 Performance

The 24-hour prototype target is:
- For a seeded demo dataset of up to `TBD` FDR records and `TBD` concurrent users, common dashboard/list/detail API requests should complete within 2 seconds at the 95th percentile, excluding file transfer and cold start.
- Paginate list APIs; avoid loading all FDRs or audit records in one request.
- Upload limit is 10 MB per file; validate before persisting metadata where possible.
- Reminder processing must be repeatable and idempotent.
- Final production capacity and load-test targets are `TBD`.

### 7.3 Backup and Recovery

- The prototype must document the database and private document-storage locations and provide a repeatable manual backup procedure.
- A consistent backup must include the database and document files/references needed to restore the same state.
- Backups must be restricted to authorized operators and must not be placed in public web directories.
- Perform at least one restore test before declaring recovery verified.
- Automated backup frequency, retention duration, recovery point objective (RPO), recovery time objective (RTO), off-site replication, and production disaster-recovery design are `TBD`.
- If automated backup is not implemented within 24 hours, record it as a limitation rather than claiming automated recovery.

### 7.4 Reliability and Maintainability

- Use database transactions for state transitions and corresponding approval/audit records.
- Return consistent API errors without exposing stack traces.
- Keep workflow rules in backend services, not only frontend code.
- Provide seed/demo data and setup instructions for reproducible evaluation.
- Build/test commands and supported runtime versions must be documented in the project README; exact stack/runtime is based on the existing repository and is `TBD` until inspected.

## 8. Complete REST API Contract

Base path: `/api/v1`. Protected routes require the configured authentication mechanism. All JSON examples are illustrative. For file upload, use `multipart/form-data`. Every route must enforce resource-level authorization and status-transition rules server-side.

### 8.1 Authentication and identity

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Authenticate demo/registered user. |
| `POST` | `/auth/logout` | Authenticated user | End session/invalidate token where supported. |
| `GET` | `/auth/me` | Authenticated user | Return current user ID, role, and institution scope. |

Login request:
```json
{"email":"officer@example.com","password":"<password>"}
```
Success `200`:
```json
{"access_token":"<token>","token_type":"Bearer","user":{"user_id":1,"name":"Demo Officer","role":"INSTITUTION_OFFICER","institution_id":101}}
```
Invalid credentials: `401 UNAUTHENTICATED`. Do not return password hashes.

### 8.2 Institutions and users

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/institutions` | AICTE Admin; other roles only if explicitly permitted | List authorized institutions. |
| `GET` | `/institutions/{institution_id}` | AICTE Admin or same-institution officer | View institution details. |
| `GET` | `/users` | AICTE Admin, if user management is enabled | List users; otherwise this endpoint is out of prototype scope. |

Creating user accounts and changing roles are not required for the demo if predefined accounts are used. If implemented, user/role administration permissions are `TBD`; users must not self-assign privileged roles.

### 8.3 FDR records

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/fdrs` | Institution Officer | Create draft FDR. |
| `GET` | `/fdrs` | Authenticated; results scoped by role | List/search/filter/paginate FDRs. |
| `GET` | `/fdrs/{fdr_id}` | Authorized users for that FDR | View FDR detail. |
| `PATCH` | `/fdrs/{fdr_id}` | Owning Institution Officer; only editable states/fields | Update draft or correction-required record. |
| `POST` | `/fdrs/{fdr_id}/submit` | Owning Institution Officer; FDR `DRAFT` or `CORRECTION_REQUIRED` | Submit/resubmit; result is `SUBMITTED`. |
| `POST` | `/fdrs/{fdr_id}/start-verification` | Verification Officer; FDR `SUBMITTED` | Claim/take the submitted FDR into review; result is `UNDER_VERIFICATION`. |
| `GET` | `/verifications/pending` | Verification Officer | Get FDR and request verification queue, with optional `type` filter. |
| `POST` | `/fdrs/{fdr_id}/verify` | Verification Officer; FDR `UNDER_VERIFICATION` | Record initial FDR verification. |
| `POST` | `/fdrs/{fdr_id}/approval` | Approving Authority; FDR `PENDING_APPROVAL` | Approve/reject initial FDR submission. |

Create FDR request:
```json
{
  "fdr_number":"FDR123456",
  "issuing_bank":"Demo Bank",
  "branch_name":"Mumbai Branch",
  "deposit_amount":500000,
  "issue_date":"2026-01-01",
  "maturity_date":"2027-01-01",
  "interest_rate":6.5
}
```
`institution_id` and `created_by` are derived from the authenticated user, not trusted from the request body. Success `201`:
```json
{"fdr_id":1001,"status":"DRAFT"}
```

List query parameters: `status`, `institution_id` (authorized cross-institution roles only), `issuing_bank`, `maturity_from`, `maturity_to`, `amount_min`, `amount_max`, `search`, `page`, `limit`. Success `200`:
```json
{"items":[{"fdr_id":1001,"fdr_number":"FDR123456","institution_id":101,"deposit_amount":500000,"issue_date":"2026-01-01","maturity_date":"2027-01-01","status":"ACTIVE"}],"page":1,"limit":20,"total":1}
```

Submit request:
```json
{"remarks":"Submitted for verification."}
```
Success `200`: `{"fdr_id":1001,"status":"SUBMITTED"}`. A Verification Officer then calls `POST /fdrs/{fdr_id}/start-verification` with `{"remarks":"Taking this item into review."}`; success `200` returns `{"fdr_id":1001,"status":"UNDER_VERIFICATION"}`. Do not silently skip either status/history event.

Verification request:
```json
{"decision":"VERIFIED","checks":[{"code":"INVALID_AMOUNT_OR_DATE","passed":true,"message":"Amount/date checks passed."}],"remarks":"Reviewed submitted information."}
```
`decision` is `VERIFIED` or `CORRECTION_REQUIRED`. Success `200` returns `verification_id`, `fdr_id`, and resulting status. On `VERIFIED`, the next FDR state is `VERIFIED`, then `PENDING_APPROVAL` via the defined workflow transition.

Initial approval request:
```json
{"decision":"APPROVED","remarks":"Approved after review."}
```
`decision` is `APPROVED` or `REJECTED`; rejection requires a reason. Success `200` returns `approval_id`, `fdr_id`, and resulting status (`ACTIVE` or `REJECTED`).

### 8.4 Documents

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/fdrs/{fdr_id}/documents` | Institution Officer authorized for the FDR | Upload FDR document (`multipart/form-data`: `file`, `document_type`). |
| `GET` | `/fdrs/{fdr_id}/documents` | Authorized users for the FDR | List document metadata. |
| `GET` | `/documents/{document_id}/download` | Authorized users for associated FDR/request | Authenticated download/stream; never public file path. |
| `GET` | `/documents/{document_id}` | Authorized users | View metadata and integrity hash; not raw storage path. |

Allowed `document_type`: `ORIGINAL_FDR`, `RENEWAL_DOCUMENT`, `RELEASE_SUPPORTING_DOCUMENT`, `SUPPORTING_DOCUMENT`. Upload success `201`:
```json
{"document_id":501,"fdr_id":1001,"file_name":"fdr_document.pdf","document_type":"ORIGINAL_FDR","sha256":"<hex-digest>","uploaded_at":"2026-10-23T12:00:00Z"}
```
Reject unsupported/corrupt/empty files, actual file type mismatch, and files larger than 10 MB. Errors include `400 INVALID_FILE`, `403 DOCUMENT_ACCESS_DENIED`, `413 FILE_TOO_LARGE`, and `415 UNSUPPORTED_FILE_TYPE`.

### 8.5 Renewal requests

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/fdrs/{fdr_id}/renewals` | Institution Officer for the FDR; eligible FDR only | Create renewal request. |
| `GET` | `/requests` | Authenticated; scoped by role/institution | List requests with `type`, `status`, date, and pagination filters. |
| `GET` | `/requests/{request_id}` | Authorized users for request | View request and history. |
| `POST` | `/requests/{request_id}/start-verification` | Verification Officer; request `REQUESTED` | Take a request into review; result is `UNDER_VERIFICATION`. |
| `POST` | `/requests/{request_id}/resubmit` | Owning Institution Officer; request `CORRECTION_REQUIRED` | Resubmit corrected request; result is `REQUESTED`. |
| `POST` | `/requests/{request_id}/cancel` | Owning Institution Officer; request `REQUESTED` | Cancel before verification starts; reason required; result is `CANCELLED`. |
| `POST` | `/requests/{request_id}/verify` | Verification Officer; request `UNDER_VERIFICATION` | Verify renewal/release request or return for correction. A `VERIFIED` decision moves directly to `PENDING_APPROVAL` in the same transaction. |
| `POST` | `/requests/{request_id}/approval` | Approving Authority; request `PENDING_APPROVAL` | Approve/reject renewal/release request. |
| `POST` | `/requests/{request_id}/complete` | Institution Officer authorized for the FDR; renewal request `APPROVED` | Complete renewal, record checked renewed details/document, update FDR transactionally; renewal requests only. |

Renewal creation request:
```json
{"reason":"FDR approaching maturity.","proposed_maturity_date":"2028-01-01","supporting_document_id":502}
```
Success `201`:
```json
{"request_id":801,"fdr_id":1001,"request_type":"RENEWAL","status":"REQUESTED"}
```
Request verification:
```json
{"decision":"VERIFIED","remarks":"Renewal details checked."}
```
`decision` is `VERIFIED` or `CORRECTION_REQUIRED`. A successful `VERIFIED` decision moves the request to `PENDING_APPROVAL` in the same transaction; `CORRECTION_REQUIRED` returns it to the submitter. Approval request:
```json
{"decision":"APPROVED","remarks":"Renewal approved."}
```
`decision` is `APPROVED` or `REJECTED`. After approval, the request becomes `APPROVED`; the FDR is updated only when `POST /requests/{request_id}/complete` records the renewed details and document and the request reaches `COMPLETED`. Completion request schema: `{"proposed_maturity_date":"2028-01-01","renewed_fdr_number":"FDR123456-R1","renewal_document_id":504,"remarks":"Renewed details checked."}`. Validate required configured fields and document access/type; preserve previous values/documents in history. Success `200`: `{"request_id":801,"request_type":"RENEWAL","status":"COMPLETED","fdr_id":1001}`. This is a prototype record update, not an external bank operation. Success responses for other renewal actions include `request_id`, `request_type`, `status`, and decision/history identifiers as applicable.

### 8.6 Release/refund requests

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/fdrs/{fdr_id}/release-requests` | Institution Officer for FDR; eligibility configured | Create release/refund request. |
| `POST` | `/requests/{request_id}/verify` | Verification Officer; request `UNDER_VERIFICATION` | Shared verification contract. |
| `POST` | `/requests/{request_id}/approval` | Approving Authority; request `PENDING_APPROVAL` | Shared approval contract. |
| `POST` | `/requests/{request_id}/release-confirmation/ready` | Designated authorized officer; request `RELEASE_APPROVED` | Mark confirmation workflow ready; result is `AWAITING_CONFIRMATION`, not confirmation of funds movement. |
| `POST` | `/requests/{request_id}/release-confirmation` | Designated authorized officer; request `AWAITING_CONFIRMATION` | Record confirmation; no fund transfer. |

Creation request:
```json
{"reason":"Security deposit release requested.","supporting_document_id":503}
```
Success `201`:
```json
{"request_id":901,"fdr_id":1001,"request_type":"RELEASE_REFUND","status":"REQUESTED"}
```
After approval, status becomes `RELEASE_APPROVED`. A designated authorized officer calls `POST /requests/{request_id}/release-confirmation/ready` with `{"remarks":"Supporting confirmation details are ready for recording."}` to move it to `AWAITING_CONFIRMATION`; success `200`: `{"request_id":901,"status":"AWAITING_CONFIRMATION"}`. This readiness action does not claim that funds moved. Confirmation request:
```json
{"confirmation_reference":"DEMO-RELEASE-001","remarks":"Demo confirmation recorded."}
```
Success `200`:
```json
{"request_id":901,"status":"RELEASED_REFUNDED","confirmed_by":12,"confirmed_at":"2026-10-23T12:00:00Z"}
```
The reference is a demo record unless backed by a real external integration.

### 8.7 Dashboard, reminders, reports, audit, and notifications

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/dashboard/summary` | Authenticated; role-scoped | Counts and amount aggregates. |
| `GET` | `/dashboard/maturity` | Authenticated; role-scoped | Upcoming and matured FDRs. |
| `POST` | `/jobs/maturity-reminders/run` | AICTE Admin or protected operator in demo only | Manually trigger idempotent reminder job; disable or restrict in production. |
| `GET` | `/reports/fdrs.csv` | Authorized report users | Export filtered FDR data as CSV. |
| `GET` | `/reports/requests.csv` | Authorized report users | Export filtered renewal/release requests as CSV. |
| `GET` | `/fdrs/{fdr_id}/audit-logs` | AICTE Admin and explicitly authorized roles | Read FDR audit history. |
| `GET` | `/notifications` | Authenticated user; own notifications | List notifications. |
| `PATCH` | `/notifications/{notification_id}` | Notification owner | Mark notification read/unread. |

Dashboard response example:
```json
{
  "total_fdrs":120,
  "by_status":{"ACTIVE":85,"MATURING_SOON":12,"MATURED":8},
  "pending_fdr_verification":10,
  "pending_fdr_approval":5,
  "renewals_pending_verification":2,
  "renewals_pending_approval":3,
  "release_requests_awaiting_confirmation":1,
  "total_deposit_amount_inr":60000000
}
```
All values are examples; compute from authorized database records. The maturity job endpoint is optional for the 24-hour build; if present, protect it against unauthorized invocation and repeated duplicate notifications.

### 8.8 Common response and error rules

- `200 OK`: successful read or action.
- `201 Created`: resource created.
- `400 Bad Request`: validation failure (`VALIDATION_ERROR`, `INVALID_FILE`).
- `401 Unauthorized`: missing/invalid authentication (`UNAUTHENTICATED`).
- `403 Forbidden`: authenticated user lacks permission (`FORBIDDEN`, `DOCUMENT_ACCESS_DENIED`).
- `404 Not Found`: resource missing or not accessible (`RESOURCE_NOT_FOUND`).
- `409 Conflict`: invalid status transition or duplicate record (`INVALID_STATUS_TRANSITION`, `DUPLICATE_FDR`).
- `413 Payload Too Large`: `FILE_TOO_LARGE`.
- `415 Unsupported Media Type`: `UNSUPPORTED_FILE_TYPE`.
- `500 Internal Server Error`: generic `INTERNAL_SERVER_ERROR` without stack trace.

Standard error:
```json
{"error":{"code":"INVALID_STATUS_TRANSITION","message":"This action is not allowed from the current status."}}
```

## 9. Acceptance Test Additions and Consistency Checks

Add these tests to the existing acceptance-test checklist:

### Verification and discrepancies
- [ ] Required-field, amount, date, missing-document, invalid-file, and duplicate-candidate checks produce the expected discrepancy codes.
- [ ] A discrepancy does not automatically claim fraud or bank inauthenticity.
- [ ] Verification Officer can record `VERIFIED` or `CORRECTION_REQUIRED` with remarks and a timestamp.
- [ ] Only a verified item can reach the relevant approval queue.
- [ ] Renewal field changes are compared with the prior FDR details and the prior values remain retrievable.

### Canonical statuses and requests
- [ ] FDR, renewal request, and release/refund request statuses are stored independently.
- [ ] Approving a renewal changes the request to `APPROVED`, but does not update the FDR until completion requirements are satisfied.
- [ ] Approving a release/refund changes the request to `RELEASE_APPROVED`, not `RELEASED_REFUNDED`.
- [ ] Release confirmation changes the request to `RELEASED_REFUNDED`; it does not claim that the application transferred funds.
- [ ] Rejecting a renewal or release request does not set the underlying FDR to `REJECTED`.
- [ ] A confirmed release closes the FDR only if the configured closure rule permits it.
- [ ] Every transition is checked server-side and invalid transitions return `409`.
- [ ] Submitting an FDR produces `SUBMITTED`; only the explicit verifier start action changes it to `UNDER_VERIFICATION`, with audit history for both transitions.
- [ ] Creating a renewal/release request produces `REQUESTED`; only the explicit verifier start action changes it to `UNDER_VERIFICATION`.
- [ ] A correction-required FDR can be resubmitted through the FDR submit action; a correction-required renewal/release request can be resubmitted through the request resubmit action, each returning to its canonical resubmission status.
- [ ] A request can be cancelled only while `REQUESTED` via the documented cancel action; cancellation after verification starts is rejected unless future policy explicitly changes this rule.
- [ ] Successful request verification transitions to `PENDING_APPROVAL` in the same transaction; correction decisions transition to `CORRECTION_REQUIRED`.
- [ ] An approved renewal remains `APPROVED` until the explicit completion endpoint validates renewed details/document, then atomically changes the request to `COMPLETED` and updates the FDR/history.
- [ ] An approved release remains `RELEASE_APPROVED` until the explicit readiness action changes it to `AWAITING_CONFIRMATION`; readiness is not recorded as a completed release.
- [ ] Release confirmation is accepted only from `AWAITING_CONFIRMATION` and records reference, actor, timestamp, audit event, and `RELEASED_REFUNDED` status atomically.
- [ ] The scheduled maturity job is the only defined actor for date-driven `MATURING_SOON` and `MATURED` transitions, and it preserves protected workflow/closed states.

### Maturity, dashboard, and exports
- [ ] Reminder thresholds are read from configuration and can be set to test values.
- [ ] A reminder is created once per FDR, threshold, and maturity date; repeated job runs do not duplicate it.
- [ ] Escalation surfaces the item to the configured role without implying email/SMS delivery.
- [ ] Dashboard counts and totals match the database and respect role/institution scopes.
- [ ] Filters affect API results and CSV exports consistently.
- [ ] CSV exports do not expose private storage paths, credentials, or unauthorized institution records.

### Integrations and non-functional requirements
- [ ] Simulated bank/AICTE results are visibly labelled `DEMO` or `SIMULATED`.
- [ ] Disabled or unavailable integrations fail safely and do not block the local demo path.
- [ ] Common API response-time target is measured against the seeded dataset; final dataset size/concurrency remain `TBD`.
- [ ] A documented database-and-document backup can be restored in a test environment, or the unimplemented recovery step is explicitly recorded as a limitation.
- [ ] Protected endpoints enforce authentication, role permission, and resource-level authorization.
- [ ] Status changes and audit entries either both commit or both roll back.


## 11. Evidence Provenance, Document Versioning, and Explainable Metrics (Approved Addendum)

This section adds traceability requirements without replacing the four-role model, canonical status enums, existing API contracts, or workflow rules above. Implement the minimum viable version first.

### 11.1 Field provenance and history

- For key FDR fields, preserve who supplied or changed the value and when. Where practical, distinguish `INSTITUTION_ENTERED`, `SYSTEM_EXTRACTED`, `OFFICER_CORRECTED`, and `BANK_CONFIRMED`.
- `BANK_CONFIRMED` may be used only when an actual authoritative bank confirmation occurred. Uploaded files, hashes, OCR, and manual checks alone must not receive that label.
- Preserve prior values for important changes rather than silently overwriting the evidence trail. Record actor, timestamp, field, previous value, new value, and reason when available.
- Do not store unnecessary sensitive data in history or logs. Apply the same authorization and institution-isolation rules to history views as to the parent FDR.
- If a full field-level history table is too costly for the prototype, implement an auditable change-history representation for the critical FDR fields and document the limitation.

### 11.2 Immutable document versions

- Treat each uploaded replacement/correction as a new document version; do not overwrite the bytes of a previously submitted document.
- Store the generated storage key, SHA-256 hash, size, detected media type, uploader, upload timestamp, and relationship to the FDR/request. Keep original filename as metadata only.
- Preserve the submitted version associated with a verification or approval decision. Access to prior versions must be authenticated, authorized, and institution-scoped.
- Hashes support integrity checking; they do not prove that a document was issued by a bank or is authentic.

### 11.3 Explainable discrepancy severity

Keep the existing discrepancy codes and human-verification workflow. Add a severity/classification field where feasible: `BLOCKING`, `REVIEW_REQUIRED`, or `INFORMATIONAL`. Each discrepancy must include its code, human-readable reason, and source/check that raised it.

- `BLOCKING`: a required field/document or deterministic validity rule prevents submission or progression until corrected.
- `REVIEW_REQUIRED`: conflicting, duplicate-candidate, or uncertain information requires an authorized officer's decision.
- `INFORMATIONAL`: useful context that does not by itself prevent progression.
- A duplicate candidate opens a review signal; it is not automatically rejected and must not assume global FDR-number uniqueness.
- Severity must not create a new automatic rejection path. The Verification Officer remains responsible for the documented `VERIFIED` or `CORRECTION_REQUIRED` decision.
- If classification rules are not fully implemented, clearly mark the severity as provisional and retain the existing deterministic codes and decision rules.

### 11.4 Event-based operational KPIs

Where practical, calculate operational metrics from persisted records and event timestamps, not hard-coded demo values. Candidate metrics include time to first review, verification duration, discrepancy resolution duration, renewal completion timeliness, release decision duration, and overdue queue size.

- Show the metric period and sample size alongside time-based averages/medians when available.
- Use only events actually recorded by the application; do not fabricate historical events or claim measured time savings without a valid baseline.
- Preserve role and institution scoping for metrics. Keep the required baseline dashboard metrics and CSV export as the priority.
- If there is insufficient event data, show an explicit empty/insufficient-data state rather than a fabricated KPI.

### 11.5 Deadline-prioritized enhancements

A controllable simulated clock/date override may be added for repeatable maturity-reminder demos only after the core workflows and tests pass. It must be clearly labelled as demo functionality and must not alter real system timestamps or silently bypass authorization.

A hash-chained audit log is an optional enhancement, not a prerequisite for the MVP. First ensure ordinary audit entries are append-only at the application level and that status/decision writes and audit events are transactional. If hash chaining is implemented, include a verification check and document that it is a tamper-evidence mechanism, not a guarantee against a privileged attacker.

### 11.6 Conflict boundaries

The supplementary PRD describes a seven-role model, `/instruments` endpoints, and a different status vocabulary. These are not adopted by this addendum. The authoritative four roles, `/fdrs` API contracts, and canonical FDR/renewal/release status models above remain in force unless the team explicitly reviews and approves a versioned change. New reminder windows are configurable demo defaults only, not official AICTE policy. Do not assume PostgreSQL, Docker, a background worker, OCR, MFA, malware scanning, or live integrations until repository inspection and the architecture decision confirm them.

## 10. Open Decisions (`TBD`)

The following are intentionally undecided because neither the provided problem statement nor the existing requirements establishes an authoritative value:

- Official AICTE maturity reminder thresholds, escalation cadence, and recipients.
- Official eligibility criteria for FDR renewal and release/refund.
- FDR number uniqueness scope.
- Release closure rule for the underlying FDR record.
- Exact institution-level approval hierarchy and whether additional approvals are required.
- External AICTE/bank API availability, contracts, credentials, approvals, and sandbox access.
- Production retention/deletion schedule and backup retention.
- Production RPO/RTO, load targets, expected record volume, and concurrency.
- Whether PDF/XLSX exports are required beyond prototype CSV.
- Final technology stack/runtime details if not yet established by the repository.

Do not resolve these items by inventing official policy. Use configurable prototype behavior and label assumptions clearly.
