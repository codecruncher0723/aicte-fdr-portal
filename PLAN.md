# AICTE FDR Management Portal — Project Plan

## Phase 1: Requirements and Architecture

- [x] Define user roles and permissions.
- [ ] Finalize renewal and release/refund workflows.
- [ ] Finalize the FDR lifecycle and allowed status transitions.
- [ ] Define the database entities and relationships.
- [ ] Define API contracts for the core workflows.
- [ ] Document security and document-storage requirements.
- [ ] Define the acceptance tests for each workflow.

### Definition of Done

- Every core workflow has documented states and transitions.
- Every role has explicitly defined permissions.
- The database model supports instrument history, renewals, verification, releases, and audit events.
- API contracts and test scenarios are documented.
- No external AICTE or bank API is assumed to be available.
- All decisions are recorded in the project documentation.

### Verification

Review the requirements for missing states, unauthorized transitions, and inconsistent data relationships. Do not begin Phase 2 until the Phase 1 checklist and verification are complete.

**Working rule:** Complete one phase at a time. Run the relevant tests, fix failures, update this plan, and stop after the current phase is verified.
