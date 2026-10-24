# AGENTS.md

## Project
FDR Management Portal (SIH PS 26265). This task builds the synthetic seed-data generator in `seed/`.

## Source of truth
1. Frozen schema / enums in `docs/schema/` (if present)
2. `docs/FDR_Portal_PRD_and_Solution_Document.md` (Sections 10, 11, Appendix B, C)
3. `docs/DATASET_SPEC.md`

If they conflict, follow this order and record the conflict in `seed/NOTES.md`. Never invent table or column names.

## Hard rules
- All data is synthetic. No real banks, IFSC prefixes, institutions, people, or identifiers.
- Deterministic output: fixed `--seed`, all dates relative to `--ref-date`.
- Do not generate audit events or hash-chain values.
- No network access at runtime. Use permissively licensed libraries and document dependencies.
- Python 3.11+. Type hints on public functions.
- Money is decimal strings with 2 places, never floats.

## Definition of done
- `python seed/generate.py --seed 42` generates the documented fixture set.
- `python seed/verify_seed.py` passes checks in DATASET_SPEC section 10.
- Running generate twice gives identical non-PDF output hashes.
- `seed/README.md` explains usage and generated files.
