# AICTE FDR Management Portal — Frontend Implementation Plan

## Phase 1: Requirements, Routing & Architecture
- [x] Define user roles and permissions (AICTE Admin, Institution Officer, Verification Officer, Approving Authority).
- [x] Design token foundation and Tailwind CSS system setup.
- [x] Fix routing so every sidebar item opens a distinct, purpose-built page.
- [x] Fix broken AICTE seal logo with a high-fidelity vector emblem component.

## Phase 2: Central Administrative Pages (AICTE Admin & Approving Authority)
- [x] Central Executive Monitoring Dashboard (`dashboard`) with KPI arc gauges, SVG maturity chart, compliance alerts, and verification queue ledger.
- [x] FDR Master Statutory Registry (`registry`) with full-text search, multi-faceted filters (Region, Bank, Status), sorting, bulk selection, CSV export, and pagination.
- [x] Maturity & Renewals Management (`maturity_renewals`) with 30/60/90-day maturity horizons and statutory notice dispatch.
- [x] Release / Refund Requests (`release_requests`) with approval and separate release confirmation tracking.
- [x] Compliance & Financial Reports (`reports`) with portfolio analytics and export.
- [x] Institutions Directory (`institutions`) with PID lookup, regional filtering, and standing.
- [x] Tamper-Evident Audit Logs (`audit_logs`) with event filtering and actor tracking.
- [x] System Governance Settings (`settings`) and APH Guidelines / Templates (`help_manuals`).

## Phase 3: Verification & Adjudication Workspace (Verification Officer & Approving Authority)
- [x] Tripartite Verification & Telemetry Cross-Audit (`verification_audit`) comparing Institute entry vs OCR parse vs Bank API.
- [x] Digital Security Bond Viewer with zoom, rotate, and OCR bounding boxes.
- [x] Reviewer Adjudication Console with pre-approved snippets, statutory compliance checkboxes, and digital DSC sign-off.

## Phase 4: Institution Portal Pages (Institution Officer)
- [x] Institution Dashboard (`institution_dashboard`) with WRO scrutiny notice, portfolio KPI cards, My FDRs table, and statutory reserve progress bars.
- [x] My Pledged FDRs (`my_fdrs`) with detailed certificate cards.
- [x] Submit New FDR modal / wizard (`submit_new_fdr`) with form validation and file upload.
- [x] Scrutiny Remarks & Deficiencies Modal with correction resubmission.
- [x] Renewals and Release/Refund submission interfaces.
- [x] College Profile & Trust Details (`profile_trust_details`).

## Phase 5: Verification, Polish & Build
- [x] Test every sidebar route across all four demo personas.
- [x] Verify responsive layout across mobile, tablet, and desktop viewports.
- [x] Run production build (`npm run build`) and verify 0 errors.
