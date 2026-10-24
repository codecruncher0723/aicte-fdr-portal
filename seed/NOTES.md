# Seed generator notes and integrator questions

All defaults and all records are synthetic. No audit rows or hash-chain values are generated.

## Contract and schema conflict

- No `docs/`, `docs/schema/`, migrations, or `AGENTS.md` existed in the supplied repository at the start of this task. The four requested documents were present in the workspace root; their contents were used. `AGENTS.md` was added at the project root using the setup guidance in `CODEX_PROMPT.md`.
- The backend ORM currently describes an older SQLite application schema: `institutions.aicte_pid`, `fdrs` with `tenure_years` and `auto_rollover`, `workflow_requests`, `verification_records`, `approval_records`, and `document_versions.file_name`/`file_size`/`mime_type`/`sha256_hash`. It lacks the PRD's lifecycle/verification axes and many entities such as `instrument_links`, `bank_confirmation_requests`, `release_requests`/checklists, `metric_events`, and `user_scopes`.
- Since `CODEX_PROMPT.md` says to fall back to PRD Section 10.1 when the frozen schema is absent, the CSVs use the PRD entity and field names. They are canonical fixtures for the intended contract, not directly loadable into the current ORM without a backend migration/adapter. **Backend lead:** please provide the frozen schema/OpenAPI and decide whether to migrate the backend or provide a mapping loader. No invented ORM columns were added.
- The dataset spec requires `data_origin = synthetic` on rows even though this tag is not listed in the PRD's entity columns. It is included as a fixture-only tag in tabular exports for safe synthetic-data identification.

## Rule and fixture interpretations

- PRD 11.3 defines `fdr_key_loose` as normalized key without leading zeros but does not identify the segment. This generator strips leading zeros from the numeric suffix after an `FDR` prefix; for example, `FDR00123` becomes normalized `FDR00123` and loose `FDR123`. **Backend lead:** confirm this exact normalization before connecting duplicate detection.
- The four boundary probes are part of the 21 in-force bucket counts: day-before maturity is expiring; maturity day and day-after are matured; exact end-of-grace (`M = t - 30`) is lapsed because the rule uses `t >= M + G`.
- The tenure-below-minimum planted row uses six months, although the ordinary placeholder tenure set lists 12/24/36/60 months. It exists only to exercise the configured minimum-tenure review rule.
- The demo password instruction asks for a documented password in README while also forbidding plaintext in any other file. To honor the stricter secret-placement rule, README points to the ignored credentials CSV and does not repeat the password.
- The private signing key is reproducibly derived for fixture testing and is written only to the gitignored `seed/certs/*.key` path. The self-signed public certificate is retained.
- The environment has ReportLab and cryptography, but no `pyHanko` or other PDF signing library; offline package installation found no local wheel cache. The signed/altered test fixtures therefore use cryptographic detached signature sidecars, not embedded PDF signatures. The verifier validates the sidecar against the public certificate and confirms the altered PDF differs from the signed bytes. **Backend lead:** install/approve an offline PDF signing dependency to replace these with embedded PDF signatures before relying on PDF signature parsing demos.
- `legacy/legacy_fdr_register.xlsx` is written as a deterministic minimal OpenXML workbook using the standard library because `openpyxl` is not installed and no offline wheel was available. It contains the same headers/rows as the CSV.

## Dependency notes

- `reportlab`: BSD license; produces selectable-text PDF fixtures with fixed metadata.
- `cryptography`: Apache-2.0/BSD; creates the local self-signed certificate and detached signature fixtures.
- `openpyxl` and `pyHanko` are commented optional dependencies in `requirements-seed.txt`, but generation currently does not require them. The XLSX writer is standard-library-only; PDF-signing limitation is described above.

## Integration questions

1. What frozen backend schema and enum values should a loader target? Several PRD entities do not exist in the current ORM.
2. Should synthetic provenance values use lowercase Appendix B enum strings, or the uppercase legacy backend enums?
3. Confirm the `FDR` numeric-suffix loose-key rule and whether the loader should map fixture-only `data_origin` outside the database schema.
4. Should the implementation add an embedded-PDF signing dependency in the backend build, or keep signature outcomes as advisory fixture metadata?
5. Confirm the prototype minimum amount/tenure and the one demo-only waivable release checklist item against the intended handbook/config contract.
