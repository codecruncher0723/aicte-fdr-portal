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