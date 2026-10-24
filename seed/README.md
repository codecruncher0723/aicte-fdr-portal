# Synthetic FDR demo dataset

Everything under `out/` is fabricated demo data. It is not AICTE policy, a bank record, or an operational KPI result. PDFs are labeled `SYNTHETIC - DEMO ONLY`; simulated bank responses are marked `SIMULATED`.

## Generate

From the repository root, run:

```powershell
python seed/generate.py --seed 42
```

Choose a fixed reference date for repeatable validity buckets, and optionally request a bulk performance set:

```powershell
python seed/generate.py --seed 42 --ref-date 2026-10-24 --bulk 5000
```

Use `--out PATH` to select a different output directory. CSV and JSON generation uses only the Python standard library. PDF fixtures use ReportLab; the XLSX twin is written as a small standard-library OpenXML package. Cryptography creates a deterministic, self-signed test certificate and detached signature sidecars. No network calls are made.

## Verify

```powershell
python seed/verify_seed.py
```

The verifier checks row counts, foreign-key references, validity buckets and boundary probes, planted coverage and duplicate cases, document hashes, the legacy import outcomes, signature sidecars, money formats, event ordering, and reproducibility for the same seed and reference date. When a bulk file exists, it also checks its tags and key formats.

KPI milestones are measured from synthetic demo data and are not real operational results.

## Demo credentials

**DEMO ONLY.** The generated login password and fixed per-user TOTP secrets are in `out/users_demo_credentials.csv`. That file is gitignored and must stay local to the demo. The fixture users use `example.invalid` email addresses and do not authenticate against a live service. The backend must hash passwords and protect MFA secrets when loading users.

## Output map

- Root CSVs hold institutions, users/scopes, instruments, provenance/history, links, verification events, bank requests, release workflows, documents, extraction values, and KPI milestone events.
- `config/` contains prototype rules, checklist, reminder, escalation, and upload defaults.
- `scenarios.json` maps demo steps to fixture IDs and expected outcomes.
- `submit_payloads/` contains clean and blocking submission examples.
- `legacy/` contains a 40-row import CSV/XLSX pair and expected row results; row numbers count the header as row 1.
- `pdfs/` contains selectable-text synthetic FDRs, response letters, and special document fixtures.
- `upload_tests/` contains malformed, oversized, empty, and valid image fixtures.
- `extensions/noc.json` contains valid and revoked synthetic NOC examples.
- `perf/instruments_bulk.csv` is written only when `--bulk N` is greater than zero.
- `certs/` contains the public test certificate; the matching private test key is ignored by Git.

Audit events and hash-chain values are deliberately omitted. The application must write audit records through its own audit service.
