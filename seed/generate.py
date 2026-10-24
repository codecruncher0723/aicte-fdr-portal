#!/usr/bin/env python3
"""Deterministic synthetic FDR demo data generator; no network access."""
from __future__ import annotations

import argparse
import base64
import binascii
import csv
import json
import hashlib
import os
import random
import re
import shutil
import struct
import zipfile
import zlib
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT / "out"
BANKS = [
    ("Zenith Trust Bank", "ZTBL"),
    ("Navbharat Co-op Bank", "ZNVB"),
    ("Gramin Savings Bank", "ZGRB"),
    ("Konkan Sahakari Bank", "ZKSB"),
    ("Meridian Union Bank", "ZMHB"),
]
REGIONS = {
    "North": [("Himachal Pradesh", "Nandipur"), ("Punjab", "Suryanagar"), ("Uttarakhand", "Devgarh")],
    "South": [("Karnataka", "Navanagar"), ("Tamil Nadu", "Velur"), ("Kerala", "Malarpuram")],
    "East": [("Odisha", "Ratnapur"), ("Assam", "Nilachal"), ("West Bengal", "Shantipur")],
    "West": [("Maharashtra", "Sahyadri"), ("Gujarat", "Amaravati"), ("Goa", "Kesarwadi")],
}
INSTITUTION_PREFIXES = ["Sahyadri", "Dakshin", "Purvanchal", "Uttar", "Konkan", "Vindhya", "Nilgiri", "Satpura", "Malabar", "Aravali", "Kalinga", "Deccan"]
ROLES = ["institution_submitter", "document_reviewer", "verification_officer", "clearance_officer", "authorized_approver", "auditor", "system_admin"]


def iso_utc(day: date, hour: int = 9, minute: int = 30) -> str:
    return datetime.combine(day, time(hour, minute), tzinfo=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def money(value: int | Decimal) -> str:
    return f"{Decimal(value):.2f}"


def normalized_key(number: str) -> tuple[str, str]:
    key = re.sub(r"[^A-Z0-9]", "", number.upper())
    # PRD says strip leading zeros without defining a segment. Strip them from
    # numeric runs only so letters and zero-prefixed identifiers remain stable.
    loose = re.sub(r"(?<![A-Z0-9])0+(?=\d)", "", key)
    if key.startswith("FDR"):
        loose = "FDR" + key[3:].lstrip("0")
        if loose == "FDR":
            loose = key
    return key, loose


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fields is None:
        fields = list(rows[0]) if rows else []
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def build_institutions() -> list[dict[str, Any]]:
    rows = []
    region_names = list(REGIONS)
    for i in range(12):
        region = region_names[i // 3]
        state, city = REGIONS[region][i % 3]
        rows.append({
            "id": f"INST-{i+1:02d}", "aicte_id": f"1-900{i+1:04d}",
            "name": f"{INSTITUTION_PREFIXES[i]} Demo Technical Institute", "state": state,
            "region": region, "status": "active", "data_origin": "synthetic",
        })
    return rows


def build_users() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    specs = [
        ("institution_submitter","USR-SUBMITTER-01","INST-01"),
        ("document_reviewer","USR-REVIEWER-01",""),
        ("verification_officer","USR-VERIFICATION-OFFICER-01",""),
        ("clearance_officer","USR-CLEARANCE-OFFICER-01",""),
        ("authorized_approver","USR-AUTHORIZED-APPROVER-01",""),
        ("auditor","USR-AUDITOR-01",""),
        ("system_admin","USR-SYSTEM-ADMIN-01",""),
    ]
    specs += [("authorized_approver", "USR-APPROVER-02", ""), ("institution_submitter", "USR-SUBMITTER-02", "INST-02"), ("institution_submitter", "USR-SUBMITTER-03", "INST-03")]
    users, scopes, credentials = [], [], []
    for idx, (role, uid, institution) in enumerate(specs, 1):
        users.append({"id": uid, "email": f"{uid.lower()}@demo.invalid", "full_name": f"Demo User {idx:02d}", "role": role, "is_active": "true", "data_origin": "synthetic"})
        scopes.append({"id": f"SCOPE-{idx:02d}", "user_id": uid, "scope_type": "institution" if institution else "bureau", "institution_id": institution, "scope_value": "" if institution else "all", "data_origin": "synthetic"})
        totp=base64.b32encode(hashlib.sha256(uid.encode("utf-8")).digest()[:10]).decode("ascii").rstrip("=") if role in {"verification_officer", "authorized_approver", "system_admin"} else ""
        credentials.append({"user_id": uid, "demo_password": "DEMO-ONLY-ChangeMe-42", "totp_secret": totp, "data_origin": "synthetic"})
    return users, scopes, credentials


def create_instruments(ref: date, rng: random.Random) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    # Counts include successors in their validity buckets. Four specially placed
    # probes are assigned to active/expiring/matured/lapsed slots.
    buckets = ["active"] * 8 + ["expiring"] * 6 + ["matured"] * 4 + ["lapsed"] * 3
    fixed = {0: 120, 8: 1, 9: 45, 10: 20, 11: 70, 14: 0, 15: -1, 18: -30}
    rows: list[dict[str, Any]] = []
    for index, bucket in enumerate(buckets):
        n = index + 1
        iid = f"FDR-A{n:02d}"
        inst = f"INST-{(index % 12) + 1:02d}"
        if index in fixed:
            maturity_offset = fixed[index]
        elif bucket == "active":
            maturity_offset = rng.randint(120, 700)
        elif bucket == "expiring":
            maturity_offset = rng.randint(8, 85)
        elif bucket == "matured":
            maturity_offset = -rng.randint(2, 28)
        else:
            maturity_offset = -rng.randint(35, 200)
        issue = ref + timedelta(days=maturity_offset - 365)
        bank, code = BANKS[index % len(BANKS)]
        number = f"FDR{n+500:05d}"
        if n == 1:
            number, inst = "FDR/00123", "INST-01"
        elif n == 2:
            number, inst = "fdr 00123", "INST-02"
        elif n == 3:
            number, inst = "FDR-123", "INST-02"
        amount = 500_000 + ((index * 3) % 41) * 50_000
        if index == 4:
            amount = 450_000  # below configured minimum review signal
        lifecycle = "in_force"
        verification = "unverified"
        if index in (1, 5, 12, 16):
            verification = "bank_confirmed"
        rows.append({
            "id": iid, "institution_id": inst, "instrument_type": "fixed_deposit", "fdr_number": number,
            "bank_name": bank, "branch": f"{['Central','Riverside','Hillview','Market'][index % 4]} Branch",
            "ifsc": f"{code}0{451+index:06d}", "amount": money(amount), "issue_date": issue.isoformat(),
            "maturity_date": (ref + timedelta(days=maturity_offset)).isoformat(), "tenure_months": "6" if index == 7 else "12",
            "auto_renewal": "false", "lien_status": "lien_marked", "lien_in_favour_of": "All India Council for Technical Education",
            "maturity_value": money(amount + 25000), "holder_name": f"{INSTITUTION_PREFIXES[(index % 12)]} Demo Technical Institute",
            "lifecycle": lifecycle, "verification_level": verification,
            "fdr_key_norm": normalized_key(number)[0], "fdr_key_loose": normalized_key(number)[1], "bank_code": code,
            "row_version": "1", "created_at": iso_utc(issue), "updated_at": iso_utc(ref), "data_origin": "synthetic",
        })
    # Renewal chain predecessors: coverage gap, lower amount replacement, clean chain.
    for ix, (succ_index, link_id, maturity_delta, issue_delta, amount_factor, link_type) in enumerate([
        (0, "LINK-01", -40, -25, 1.0, "renewal"),
        (5, "LINK-02", -100, -100, 0.8, "replacement"),
        (7, "LINK-03", -60, -60, 1.0, "renewal"),
    ], 1):
        successor = rows[succ_index]
        pred_id = f"FDR-P{ix:02d}"
        pred_maturity = ref + timedelta(days=maturity_delta)
        pred_issue = pred_maturity - timedelta(days=365)
        pred_amount = Decimal(successor["amount"])
        if amount_factor < 1:
            successor["amount"] = money(int(pred_amount * Decimal(str(amount_factor))))
        pred_number = f"FDRPRED{ix:03d}"
        bank, code = BANKS[(succ_index + 2) % len(BANKS)]
        rows.append({
            "id": pred_id, "institution_id": successor["institution_id"], "instrument_type": "fixed_deposit",
            "fdr_number": pred_number, "bank_name": bank, "branch": "Oldtown Branch", "ifsc": f"{code}0{701+ix:06d}",
            "amount": money(pred_amount), "issue_date": pred_issue.isoformat(), "maturity_date": pred_maturity.isoformat(),
            "tenure_months": "12", "auto_renewal": "false", "lien_status": "lien_marked", "lien_in_favour_of": "All India Council for Technical Education",
            "maturity_value": money(pred_amount + 20000), "holder_name": "Synthetic Technical Institute", "lifecycle": "superseded",
            "verification_level": "officer_reviewed", "fdr_key_norm": normalized_key(pred_number)[0], "fdr_key_loose": normalized_key(pred_number)[1],
            "bank_code": code, "row_version": "1", "created_at": iso_utc(pred_issue), "updated_at": iso_utc(ref), "data_origin": "synthetic",
        })
        # Force exact pair dates to demonstrate specified outcomes.
        if ix == 1:
            successor["issue_date"] = (pred_maturity + timedelta(days=15)).isoformat()
            successor["maturity_date"] = (pred_maturity + timedelta(days=15+365)).isoformat()
        elif ix == 2:
            successor["issue_date"] = pred_maturity.isoformat()
            successor["maturity_date"] = (pred_maturity + timedelta(days=365)).isoformat()
        elif ix == 3:
            successor["issue_date"] = pred_maturity.isoformat()
            successor["maturity_date"] = (pred_maturity + timedelta(days=365)).isoformat()
    # Add two closed instruments; they are outside the bucket counts.
    for ix in (1, 2):
        n = len(rows) + 1
        inst = f"INST-{ix:02d}"
        bank, code = BANKS[ix - 1]
        issue = ref - timedelta(days=610)
        rows.append({
            "id": f"FDR-C{ix:02d}", "institution_id": inst, "instrument_type": "fixed_deposit", "fdr_number": f"FDRCLOSED{ix:02d}",
            "bank_name": bank, "branch": "Harbour Branch", "ifsc": f"{code}0{801+ix:06d}", "amount": money(1_000_000),
            "issue_date": issue.isoformat(), "maturity_date": (ref + timedelta(days=120)).isoformat(), "tenure_months": "24", "auto_renewal": "false",
            "lien_status": "released", "lien_in_favour_of": "All India Council for Technical Education", "maturity_value": money(1_100_000),
            "holder_name": f"{INSTITUTION_PREFIXES[ix-1]} Demo Technical Institute", "lifecycle": "closed", "verification_level": "officer_reviewed",
            "fdr_key_norm": f"FDRCLOSED{ix:02d}", "fdr_key_loose": f"FDRCLOSED{ix:02d}", "bank_code": code, "row_version": "2",
            "created_at": iso_utc(issue), "updated_at": iso_utc(ref), "data_origin": "synthetic",
        })
    # Draft and submitted queue records are additional rows.
    for suffix, lifecycle in [("D01", "draft"), ("S01", "submitted")]:
        n = len(rows) + 1
        issue = ref - timedelta(days=20)
        maturity = ref + timedelta(days=345)
        bank, code = BANKS[n % len(BANKS)]
        rows.append({
            "id": f"FDR-{suffix}", "institution_id": f"INST-{((n-1)%12)+1:02d}", "instrument_type": "fixed_deposit", "fdr_number": f"FDR{900+n:05d}",
            "bank_name": bank, "branch": "Civic Branch", "ifsc": f"{code}0{901+n:06d}", "amount": money(1_250_000), "issue_date": issue.isoformat(),
            "maturity_date": maturity.isoformat(), "tenure_months": "12", "auto_renewal": "false", "lien_status": "lien_marked",
            "lien_in_favour_of": "All India Council for Technical Education", "maturity_value": money(1_300_000), "holder_name": "Demo Technical Institute",
            "lifecycle": lifecycle, "verification_level": "unverified", "fdr_key_norm": normalized_key(f"FDR{900+n:05d}")[0], "fdr_key_loose": normalized_key(f"FDR{900+n:05d}")[1],
            "bank_code": code, "row_version": "1", "created_at": iso_utc(issue), "updated_at": iso_utc(ref), "data_origin": "synthetic",
        })
    buckets_map = {b: [r["id"] for r in rows if r["lifecycle"] == "in_force" and validity(r["maturity_date"], ref) == b] for b in ("active", "expiring", "matured", "lapsed")}
    probes = {"day_before": "FDR-A09", "day_of": "FDR-A15", "day_after": "FDR-A16", "grace_boundary": "FDR-A19"}
    return rows, {"validity_buckets": buckets_map, "boundary_probes": probes}


def validity(maturity_iso: str, ref: date) -> str:
    maturity = date.fromisoformat(maturity_iso)
    if ref < maturity - timedelta(days=90):
        return "active"
    if maturity > ref:
        return "expiring"
    if ref < maturity + timedelta(days=30):
        return "matured"
    return "lapsed"


def provenance_rows(instruments: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    keys = ["fdr_number", "bank_name", "branch", "ifsc", "amount", "issue_date", "maturity_date", "holder_name", "lien_in_favour_of"]
    rows = []
    for ins in instruments:
        source = "imported" if ins["id"] == "FDR-S01" else "bank_confirmed" if ins["verification_level"] == "bank_confirmed" else "institution_entered"
        for key in keys:
            source_ref="seed-import" if source == "imported" else f"BANKREQ-ACCEPTED-{['FDR-A02','FDR-A06','FDR-A13','FDR-A17'].index(ins['id'])+1:02d}" if source=="bank_confirmed" else ins["id"]
            actor="USR-VERIFICATION-OFFICER-01" if source=="bank_confirmed" else "USR-SUBMITTER-01"
            rows.append({"instrument_id": ins["id"], "field_name": key, "value": ins[key], "source": source, "source_ref": source_ref, "confidence": "1.00", "recorded_by": actor, "recorded_at": ins["created_at"], "data_origin": "synthetic"})
    hist = [{"instrument_id": "FDR-A05", "field_name": "amount", "old_value": "500000.00", "new_value": "450000.00", "source": "officer_entered", "evidence_ref": "DOC-FDR-A05-V1", "reason": "Synthetic correction preserves submitted value", "changed_by": "USR-VERIFICATION-OFFICER-01", "changed_at": iso_utc(date.fromisoformat(instruments[4]["issue_date"]) + timedelta(days=2)), "data_origin": "synthetic"}]
    return rows, hist


def make_config(out: Path) -> None:
    rules = [
        ("mandatory_field_missing", "blocking", ""), ("mandatory_document_missing", "blocking", ""),
        ("maturity_not_after_issue", "blocking", ""), ("amount_non_positive", "blocking", ""),
        ("ifsc_malformed", "blocking", ""), ("date_unparseable", "blocking", ""),
        ("entered_differs_from_extracted", "review_required", "medium"), ("holder_or_lien_inconsistent", "review_required", "high"),
        ("exact_normalized_duplicate", "review_required", "high"), ("loose_duplicate", "review_required", "medium"),
        ("amount_below_minimum", "review_required", "medium"), ("tenure_below_minimum", "review_required", "medium"),
        ("signature_integrity_invalid", "review_required", "medium"), ("identical_file_cross_institution", "review_required", "high"),
        ("pdf_modified_after_creation", "informational", ""), ("unusual_pdf_producer", "informational", ""),
        ("no_signature", "informational", ""), ("same_institution_identical_reupload", "informational", ""),
    ]
    write_json(out / "config/rules.json", {"header": "prototype defaults, not AICTE policy", "config_version": "v1", "rules": [{"rule_id": x, "class": y, "severity": z or None} for x,y,z in rules]})
    write_json(out / "config/checklist_template.json", {"header": "prototype default, confirm against AICTE handbook", "template_id": "RELEASE-DEMO", "template_version": "v1", "items": [
        {"item_code": "ORIGINAL_SURRENDERED", "label": "Original FDR surrendered", "mandatory": True, "waivable": False},
        {"item_code": "BANK_NO_DUES", "label": "Bank no-dues confirmation", "mandatory": True, "waivable": True, "demo_only": True},
        {"item_code": "INSTITUTION_REQUEST", "label": "Institution release request", "mandatory": False, "waivable": False},
        {"item_code": "NOC_CHECK", "label": "NOC status reviewed", "mandatory": False, "waivable": False},
    ]})
    write_json(out / "config/reminder_rules.json", {"header": "prototype defaults, not AICTE policy", "config_version": "v1", "windows_days": [90,60,30,15,7], "grace_days": 30})
    write_json(out / "config/escalation_rules.json", {"header": "prototype defaults, not AICTE policy", "config_version": "v1", "chain": ["institution", "verification_officer", "bureau_head"], "overdue_days": {"bank_confirmation": 7, "verification": 10, "release": 15}})
    write_json(out / "config/limits.json", {"header": "prototype defaults, not AICTE policy", "config_version": "v1", "minimum_amount": "500000.00", "minimum_tenure_months": 12, "upload_size_limit_bytes": 5242880, "allowed_mime_types": ["application/pdf", "image/jpeg", "image/png"], "noc_verification_base_url": "https://demo.invalid/noc/"})


def generate_core(out: Path, seed: int, ref: date, bulk: int = 0) -> None:
    rng = random.Random(seed)
    if out.exists():
        shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    institutions = build_institutions()
    users, scopes, creds = build_users()
    instruments, bucket_info = create_instruments(ref, rng)
    provenance, history = provenance_rows(instruments)
    links = []
    for i, succ in enumerate(("FDR-A01", "FDR-A06", "FDR-A08"), 1):
        pred = f"FDR-P{i:02d}"
        links.append({"id": f"LINK-0{i}", "predecessor_id": pred, "successor_id": succ, "link_type": "renewal" if i != 2 else "replacement", "accepted_by": "USR-VERIFICATION-OFFICER-01", "accepted_at": iso_utc(ref - timedelta(days=5-i)), "data_origin": "synthetic"})
    verification_events = []
    for ins in instruments:
        level = ins["verification_level"]
        if level != "unverified":
            request_number=(['FDR-A02','FDR-A06','FDR-A13','FDR-A17'].index(ins["id"])+1) if level=="bank_confirmed" else None
            verification_events.append({"id": f"VE-{ins['id']}", "instrument_id": ins["id"], "from_level": "unverified", "to_level": level, "method": "bank_confirmation" if level=="bank_confirmed" else "officer_review", "evidence_ref": f"DOCVER-BANK-ACCEPT-{request_number:02d}" if request_number else f"DOC-{ins['id']}-V1", "reason": "Synthetic officer assessment" if level=="bank_confirmed" else "Synthetic demo review", "actor": "USR-VERIFICATION-OFFICER-01", "at": ins["updated_at"], "data_origin": "synthetic"})
    for name, rows in [("institutions.csv",institutions),("users.csv",users),("user_scopes.csv",scopes),("instruments.csv",instruments),("field_provenance.csv",provenance),("field_value_history.csv",history),("instrument_links.csv",links),("verification_events.csv",verification_events)]:
        write_csv(out / name, rows)
    # Credentials are intentionally generated in an ignored file only.
    write_csv(out / "users_demo_credentials.csv", creds)
    make_config(out)
    scenarios = {"ref_date": ref.isoformat(), "validity_buckets": bucket_info["validity_buckets"], "boundary_probes": {"probes": bucket_info["boundary_probes"], "expected_states": {"day_before":"expiring", "day_of":"matured", "day_after":"matured", "grace_boundary":"lapsed"}, "grace_boundary_rule": "M=t-G is lapsed because t >= M+G"}, "clock_jump_demo": {"advance_days": 60, "instruments": ["FDR-A12","FDR-A10","FDR-A11"], "initial_days_to_maturity": {"FDR-A12":70,"FDR-A10":45,"FDR-A11":20}, "expected_after_advance": {"FDR-A12":"expiring, 10 days to maturity","FDR-A10":"matured, 15 days past maturity","FDR-A11":"lapsed, 40 days past maturity"}, "reminder_expectation":"one notification per instrument/rule/window; escalation for overdue actions"}, "scope_test": {"institution_a": "INST-01", "institution_b": "INST-02", "denied_record": "FDR-A02", "expected": "denied"}}
    write_json(out / "scenarios.json", scenarios)
    add_scenarios(out, instruments, ref)
    create_documents(out, instruments, ref)
    create_check_fixtures(out, ref)
    create_metric_events(out, instruments, ref, random.Random(seed ^ 0xA17E))
    if bulk:
        bulk_rows = []
        for i in range(bulk):
            offset = rng.randint(-200, 700)
            amount = 500_000 + rng.randint(0,40)*50_000
            bank, code = BANKS[i % len(BANKS)]
            bucket = "active" if offset > 90 else "expiring" if offset > 0 else "matured" if offset > -30 else "lapsed"
            bulk_rows.append({"id": f"BULK-{i+1:06d}", "institution_id": f"INST-{i%12+1:02d}", "fdr_number": f"BULK{seed:04d}{i+1:07d}", "bank_name": bank, "branch": f"Bulk Branch {i%31+1:02d}", "ifsc": f"{code}0{i%900000:06d}", "amount": money(amount), "issue_date": (ref+timedelta(days=offset-365)).isoformat(), "maturity_date": (ref+timedelta(days=offset)).isoformat(), "tenure_months": "12", "lifecycle": "in_force", "validity_bucket": bucket, "is_bulk": "true", "data_origin": "synthetic"})
        write_csv(out / "perf/instruments_bulk.csv", bulk_rows)


def add_scenarios(out: Path, instruments: list[dict[str, Any]], ref: date) -> None:
    by_id = {r["id"]: r for r in instruments}
    submitter, reviewer, officer, clearance, approver, auditor, admin = ("USR-SUBMITTER-01","USR-REVIEWER-01","USR-VERIFICATION-OFFICER-01","USR-CLEARANCE-OFFICER-01","USR-AUTHORIZED-APPROVER-01","USR-AUDITOR-01","USR-SYSTEM-ADMIN-01")
    bank_rows = [
        {"id":"BANKREQ-OVERDUE","instrument_id":"FDR-A09","state":"requested","channel":"letter","dispatch_ref":"SIMULATED-REQ-01","requested_by":officer,"requested_at":iso_utc(ref-timedelta(days=20)),"response_at":"","response_channel":"","response_document_version_id":"","assessment":"","assessed_by":"","assessed_at":"","rationale":"","source":"SIMULATED","data_origin":"synthetic"},
        {"id":"BANKREQ-PENDING-ASSESSMENT","instrument_id":"FDR-A10","state":"response_recorded","channel":"email","dispatch_ref":"SIMULATED-REQ-02","requested_by":officer,"requested_at":iso_utc(ref-timedelta(days=12)),"response_at":iso_utc(ref-timedelta(days=3)),"response_channel":"email","response_document_version_id":"DOCVER-BANK-PENDING","assessment":"","assessed_by":"","assessed_at":"","rationale":"Awaiting officer assessment","source":"SIMULATED","data_origin":"synthetic"},
    ]
    for i, insid in enumerate(("FDR-A02","FDR-A06","FDR-A13","FDR-A17"), 1):
        bank_rows.append({"id":f"BANKREQ-ACCEPTED-{i:02d}","instrument_id":insid,"state":"accepted","channel":"bank_portal","dispatch_ref":f"SIMULATED-ACCEPT-{i:02d}","requested_by":officer,"requested_at":iso_utc(ref-timedelta(days=20+i)),"response_at":iso_utc(ref-timedelta(days=10+i)),"response_channel":"bank_portal","response_document_version_id":f"DOCVER-BANK-ACCEPT-{i:02d}","assessment":"accepted","assessed_by":officer,"assessed_at":iso_utc(ref-timedelta(days=8+i)),"rationale":"Synthetic response assessed by officer","source":"SIMULATED","data_origin":"synthetic"})
    for state, suffix in [("rejected","REJECTED"),("inconclusive","INCONCLUSIVE")]:
        bank_rows.append({"id":f"BANKREQ-{suffix}","instrument_id":"FDR-A12","state":state,"channel":"letter","dispatch_ref":f"SIMULATED-{suffix}","requested_by":officer,"requested_at":iso_utc(ref-timedelta(days=10)),"response_at":iso_utc(ref-timedelta(days=2)),"response_channel":"letter","response_document_version_id":f"DOCVER-BANK-{suffix}","assessment":state,"assessed_by":officer,"assessed_at":iso_utc(ref-timedelta(days=1)),"rationale":"Synthetic response outcome","source":"SIMULATED","data_origin":"synthetic"})
    write_csv(out / "bank_confirmation_requests.csv", bank_rows)
    release = [
        {"id":"RR-01","instrument_id":"FDR-A20","request_type":"release","state":"checklist_pending","reason":"Synthetic release demo","requested_by":submitter,"prepared_by":clearance,"template_id":"RELEASE-DEMO","template_version":"v1","requested_at":iso_utc(ref-timedelta(days=8)),"updated_at":iso_utc(ref-timedelta(days=1)),"data_origin":"synthetic"},
        {"id":"RR-02","instrument_id":"FDR-A21","request_type":"release","state":"ready_for_decision","reason":"Synthetic eligible exception demo","requested_by":submitter,"prepared_by":clearance,"template_id":"RELEASE-DEMO","template_version":"v1","requested_at":iso_utc(ref-timedelta(days=12)),"updated_at":iso_utc(ref-timedelta(days=2)),"data_origin":"synthetic"},
        {"id":"RR-03","instrument_id":"FDR-A18","request_type":"refund","state":"ready_for_decision","reason":"Synthetic separation of duties demo","requested_by":submitter,"prepared_by":clearance,"template_id":"RELEASE-DEMO","template_version":"v1","requested_at":iso_utc(ref-timedelta(days=5)),"updated_at":iso_utc(ref),"data_origin":"synthetic"},
        {"id":"RR-C01","instrument_id":"FDR-C01","request_type":"release","state":"confirmed","reason":"Synthetic completed release","requested_by":submitter,"prepared_by":clearance,"template_id":"RELEASE-DEMO","template_version":"v1","requested_at":iso_utc(ref-timedelta(days=45)),"updated_at":iso_utc(ref-timedelta(days=35)),"data_origin":"synthetic"},
        {"id":"RR-C02","instrument_id":"FDR-C02","request_type":"release","state":"confirmed","reason":"Synthetic completed release","requested_by":submitter,"prepared_by":clearance,"template_id":"RELEASE-DEMO","template_version":"v1","requested_at":iso_utc(ref-timedelta(days=30)),"updated_at":iso_utc(ref-timedelta(days=20)),"data_origin":"synthetic"},
    ]
    write_csv(out / "release_requests.csv", release)
    checklist = []
    template = json.loads((out/"config/checklist_template.json").read_text(encoding="utf-8"))["items"]
    for rr in release:
        for item in template:
            state = "done"
            marked_by = clearance
            if rr["id"] == "RR-01" and item["item_code"] == "ORIGINAL_SURRENDERED":
                state, marked_by = "open", ""
            if rr["id"] == "RR-02" and item["item_code"] == "BANK_NO_DUES":
                state, marked_by = "excepted", ""
            checklist.append({"id":f"CLI-{rr['id']}-{item['item_code']}","release_request_id":rr["id"],"item_code":item["item_code"],"label":item["label"],"mandatory":str(item["mandatory"]).lower(),"waivable":str(item["waivable"]).lower(),"state":state,"evidence_ref":f"EVID-{rr['id']}-{item['item_code']}" if state=="done" else "","marked_by":marked_by,"marked_at":rr["updated_at"] if state=="done" else "","template_version":"v1","data_origin":"synthetic"})
    write_csv(out / "checklist_items.csv", checklist)
    exceptions = [{"id":"EX-02","checklist_item_id":"CLI-RR-02-BANK_NO_DUES","requested_by":clearance,"approved_by":"USR-APPROVER-02","rationale":"Demo-only waiver illustration; distinct approver","at":iso_utc(ref-timedelta(days=2)),"data_origin":"synthetic"}]
    write_csv(out / "release_exceptions.csv", exceptions)
    decisions = [{"id":"DEC-C01","release_request_id":"RR-C01","decision":"approve","rationale":"Synthetic completed release","decided_by":approver,"decided_at":iso_utc(ref-timedelta(days=40)),"exception_refs":"","data_origin":"synthetic"},{"id":"DEC-C02","release_request_id":"RR-C02","decision":"approve","rationale":"Synthetic completed release","decided_by":"USR-APPROVER-02","decided_at":iso_utc(ref-timedelta(days=25)),"exception_refs":"","data_origin":"synthetic"}]
    write_csv(out / "decisions.csv", decisions)
    confirmations = [{"id":f"CONF-{i:02d}","release_request_id":f"RR-C{i:02d}","evidence_ref":f"DOC-RELEASE-C{i:02d}","artifact_ref":f"SYNTHETIC-ARTIFACT-{i:02d}","recorded_by":clearance,"recorded_at":iso_utc(ref-timedelta(days=35 if i==1 else 20)),"data_origin":"synthetic"} for i in (1,2)]
    write_csv(out / "release_confirmations.csv", confirmations)
    create_submit_payloads(out, by_id, ref)
    create_noc_and_scenarios(out, by_id)
    create_legacy(out, by_id, ref)


def create_submit_payloads(out: Path, by_id: dict[str,dict[str,Any]], ref: date) -> None:
    target = out / "submit_payloads"
    target.mkdir(parents=True, exist_ok=True)
    base = {"institution_id":"INST-03","instrument_type":"fixed_deposit","fdr_number":"FDR-LIVE-001","bank_name":BANKS[0][0],"branch":"Civic Branch","ifsc":"ZTBL0004512","amount":"1250000.00","issue_date":ref.isoformat(),"maturity_date":(ref+timedelta(days=365)).isoformat(),"tenure_months":12,"auto_renewal":False,"lien_status":"lien_marked","lien_in_favour_of":"All India Council for Technical Education","holder_name":"Demo Technical Institute","document":"clean_submission.pdf","data_origin":"synthetic"}
    cases: dict[str,dict[str,Any]] = {}
    bad = dict(base, fdr_number="FDR-LIVE-BAD-DATE", maturity_date=(ref-timedelta(days=1)).isoformat())
    cases["bad_maturity_date"] = bad
    cases["bad_maturity_date_unparseable"] = dict(base, fdr_number="FDR-LIVE-UNPARSEABLE", maturity_date="thirty-first-ish")
    cases["bad_ifsc"] = dict(base, fdr_number="FDR-LIVE-BAD-IFSC", ifsc="INVALID")
    cases["zero_amount"] = dict(base, fdr_number="FDR-LIVE-ZERO", amount="0.00")
    cases["missing_mandatory_field"] = {k:v for k,v in base.items() if k != "holder_name"}
    cases["missing_mandatory_document"] = dict(base, fdr_number="FDR-LIVE-NO-DOC", document=None)
    cases["clean_submission"] = dict(base)
    cases["renewal_submission"] = dict(base, fdr_number="FDR-LIVE-RENEWAL", predecessor_id="FDR-P01", document="renewal_submission.pdf")
    for name, payload in cases.items():
        write_json(target/f"{name}.json", payload)
    rule_coverage = {
        "mandatory_field_missing":["submit_payloads/missing_mandatory_field.json"],
        "mandatory_document_missing":["submit_payloads/missing_mandatory_document.json"],
        "maturity_not_after_issue":["submit_payloads/bad_maturity_date.json"],
        "amount_non_positive":["submit_payloads/zero_amount.json"],
        "ifsc_malformed":["submit_payloads/bad_ifsc.json"],
        "date_unparseable":["submit_payloads/bad_maturity_date_unparseable.json"],
        "entered_differs_from_extracted":["FDR-A05"], "holder_or_lien_inconsistent":["FDR-A06","FDR-A09"],
        "exact_normalized_duplicate":["FDR-A01","FDR-A02"], "loose_duplicate":["FDR-A01","FDR-A03"],
        "amount_below_minimum":["FDR-A05"], "tenure_below_minimum":["FDR-A08"],
        "identical_file_cross_institution":["FDR-A01","FDR-A02"], "same_institution_identical_reupload":["FDR-A07","DOCVER-REUPLOAD-A07"],
        "signature_integrity_invalid":["FDR-A09"],
        "no_signature":["FDR-A01"], "pdf_modified_after_creation":["FDR-A11"], "unusual_pdf_producer":["FDR-A12"],
    }
    scenarios_path = out/"scenarios.json"
    scenarios = json.loads(scenarios_path.read_text(encoding="utf-8"))
    scenarios.update({
        "rule_coverage":rule_coverage,
        "coverage_gap":{"predecessor_id":"FDR-P01","successor_id":"FDR-A01","expected_gap_days":15},
        "duplicates":{"exact":["FDR-A01","FDR-A02"],"loose":["FDR-A01","FDR-A03"],"same_institution_reupload":["FDR-A07","FDR-A07"]},
        "bank_requests":{"overdue":"BANKREQ-OVERDUE","awaiting_assessment":"BANKREQ-PENDING-ASSESSMENT","accepted":[f"BANKREQ-ACCEPTED-{i:02d}" for i in range(1,5)],"rejected":"BANKREQ-REJECTED","inconclusive":"BANKREQ-INCONCLUSIVE"},
        "release_requests":{"blocked":"RR-01","waiver":"RR-02","ready_separation":"RR-03","closed":["RR-C01","RR-C02"]},
        "risk_demo":{"case_high":{"instrument_id":"FDR-A09","case_id":"CASE-HIGH-01","expected_rank":1,"signals":["maturity_within_10_days","no_verified_successor","open_high_discrepancy","missing_document:bank_response","overdue_bank_request"]},"case_low":{"instrument_id":"FDR-A07","expected_rank":2,"signals":["same_institution_reupload_informational_only"]}},
        "live_submit":{"blocking":["bad_maturity_date","bad_maturity_date_unparseable","bad_ifsc","zero_amount","missing_mandatory_field","missing_mandatory_document"],"happy_path":"clean_submission","renewal":"renewal_submission"},
        "signature_fixtures":{"valid_negative_control":"signed_valid.pdf","invalid_after_tampering":"signed_then_tampered.pdf"},
        "noc":{"fixture":"extensions/noc.json","valid":"NOC-VALID-01","revoked":"NOC-REVOKED-01"},
    })
    write_json(scenarios_path, scenarios)


def create_noc_and_scenarios(out: Path, by_id: dict[str,dict[str,Any]]) -> None:
    write_json(out/"extensions/noc.json", {"data_origin":"synthetic","nocs":[{"reference_id":"NOC-VALID-01","instrument_id":"FDR-A01","status":"valid","verification_url":"https://demo.invalid/noc/NOC-VALID-01","qr_payload":"https://demo.invalid/noc/NOC-VALID-01"},{"reference_id":"NOC-REVOKED-01","instrument_id":"FDR-A02","status":"revoked","verification_url":"https://demo.invalid/noc/NOC-REVOKED-01","qr_payload":"https://demo.invalid/noc/NOC-REVOKED-01"}]})


def xlsx_twin(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    """Write a minimal standards-compliant XLSX without an extra dependency."""
    def cell(col: int, row: int, value: str) -> str:
        n, letters = col, ""
        while n:
            n, rem = divmod(n-1, 26)
            letters = chr(65+rem) + letters
        safe = (value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        return f'<c r="{letters}{row}" t="inlineStr"><is><t>{safe}</t></is></c>'
    all_rows = [headers] + rows
    sheet_rows = "".join(f'<row r="{i}">{"".join(cell(j,i,v) for j,v in enumerate(row,1))}</row>' for i,row in enumerate(all_rows,1))
    sheet = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{sheet_rows}</sheetData></worksheet>'
    workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Legacy Register" sheetId="1" r:id="rId1"/></sheets></workbook>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        def write_member(name: str, contents: str) -> None:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, contents)
        write_member("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        write_member("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        write_member("xl/workbook.xml", workbook)
        write_member("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        write_member("xl/worksheets/sheet1.xml", sheet)


def create_legacy(out: Path, by_id: dict[str,dict[str,Any]], ref: date) -> None:
    folder = out / "legacy"
    folder.mkdir(parents=True, exist_ok=True)
    headers = ["FD No", "Bank", "Branch", "IFSC Code", "Amt (INR)", "Start", "End", "Institute", "Unused Note", "Data Origin"]
    rows: list[list[str]] = []
    expected: list[dict[str,Any]] = []
    seeded = by_id["FDR-A01"]
    for i in range(1, 41):
        issue = ref - timedelta(days=400-i)
        maturity = issue + timedelta(days=365)
        bank, code = BANKS[i % len(BANKS)]
        row = [f"LEGACY-{i:03d}", bank, f"Legacy Branch {i:02d}", f"{code}0{i:06d}", money(500_000 + (i%30)*50_000), issue.strftime("%d/%m/%Y"), maturity.strftime("%d/%m/%Y"), f"{INSTITUTION_PREFIXES[i%12]} Demo Institute", "not used", "synthetic"]
        outcome, reasons = "ok", []
        if i == 5:
            row[5] = "31/02/2026"; outcome, reasons = "error", ["UNPARSEABLE_ISSUE_DATE"]
        elif i == 10:
            row[6] = "2026-13-40"; outcome, reasons = "error", ["UNPARSEABLE_MATURITY_DATE"]
        elif i == 15:
            row[6] = row[5]; outcome, reasons = "error", ["MATURITY_NOT_AFTER_ISSUE"]
        elif i == 20:
            row[3] = "BADIFSC"; outcome, reasons = "error", ["MALFORMED_IFSC"]
        elif i == 25:
            row[4] = "0.00"; outcome, reasons = "error", ["NON_POSITIVE_AMOUNT"]
        elif i == 30:
            row[1] = ""; outcome, reasons = "error", ["MISSING_BANK_NAME"]
        elif i == 35:
            row[0] = "fdr 00123"; row[1] = seeded["bank_name"]; row[2] = seeded["branch"]; row[3] = seeded["ifsc"]; row[4] = seeded["amount"]; row[5] = seeded["issue_date"]; row[6] = seeded["maturity_date"]; row[7] = "Sahyadri Institute"
            outcome, reasons = "duplicate_flagged", ["DUPLICATE_OF_SEEDED_FDR:FDR-A01"]
        elif i == 40:
            row[0] = "LEGACY/040"; outcome, reasons = "ok", []
        elif i == 39:
            row[0] = "LEGACY-038"
            outcome, reasons = "duplicate_flagged", ["DUPLICATE_OF_ROW:39"]
        if i == 2:
            row[5] = issue.isoformat()
        rows.append(row)
        expected.append({"row_number":i+1,"outcome":outcome,"reason_codes":reasons})
    csv_path = folder/"legacy_fdr_register.csv"
    write_csv(csv_path, [dict(zip(headers,r)) for r in rows], headers)
    xlsx_twin(folder/"legacy_fdr_register.xlsx", headers, rows)
    write_json(folder/"expected_import_result.json", {"data_origin":"synthetic","total_data_rows":40,"total_file_rows_including_header":41,"row_numbering":"1-based; header is row 1","counts":{"ok":32,"error":6,"duplicate_flagged":2},"rows":expected})
    scenarios_path = out/"scenarios.json"
    scenarios = json.loads(scenarios_path.read_text(encoding="utf-8"))
    scenarios["legacy_import"] = {"csv":"legacy/legacy_fdr_register.csv","xlsx":"legacy/legacy_fdr_register.xlsx","expected":"legacy/expected_import_result.json","data_rows":40,"defective_rows":8}
    write_json(scenarios_path, scenarios)


def create_documents(out: Path, instruments: list[dict[str,Any]], ref: date) -> None:
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise RuntimeError("PDF generation requires reportlab; install seed/requirements-seed.txt") from exc
    pdf_dir = out/"pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    docs: list[dict[str,Any]] = []
    versions: list[dict[str,Any]] = []
    extraction: list[dict[str,Any]] = []
    manifest: list[dict[str,Any]] = []
    instrument_rows = instruments
    # Build one PDF per instrument, with a fixed layout and metadata for deterministic bytes.
    for index, ins in enumerate(instrument_rows,1):
        document_id = f"DOC-{ins['id']}"
        version_id = f"DOCVER-{ins['id']}-01"
        filename = f"{ins['id'].lower()}_fdr.pdf"
        path = pdf_dir/filename
        pdf_instrument=dict(ins,amount="950000.00") if ins["id"]=="FDR-A05" else ins
        create_fdr_pdf(path, pdf_instrument, canvas, letter, producer="Synthetic FDR Demo Generator")
        digest, size = sha256_size(path)
        docs.append({"id":document_id,"owner_type":"instrument","owner_id":ins["id"],"document_type":"fdr_receipt","review_state":"pending","data_origin":"synthetic"})
        versions.append({"id":version_id,"document_id":document_id,"storage_key":f"pdfs/{filename}","sha256":digest,"size":str(size),"mime":"application/pdf","original_filename":filename,"uploaded_by":"USR-SUBMITTER-01","uploaded_at":iso_utc(ref-timedelta(days=2)),"wrapped_data_key":"","signature_result":"unsigned","data_origin":"synthetic"})
        manifest.append({"path":f"pdfs/{filename}","sha256":digest,"size":str(size),"document_version_id":version_id,"instrument_id":ins["id"],"fixture":"ordinary","data_origin":"synthetic"})
        for field in ["fdr_number","bank_name","branch","ifsc","amount","issue_date","maturity_date","tenure_months","holder_name","lien_in_favour_of"]:
            val = ins[field]
            if ins["id"] == "FDR-A05" and field == "amount":
                val = "950000.00"
            if ins["id"] in {"FDR-A06","FDR-A09"} and field == "lien_in_favour_of":
                val = "Synthetic Ministry of Demos"
            extraction.append({"document_version_id":version_id,"field_name":field,"value":val,"page":"1","region":"body","confidence":"0.94","engine":"seeded_synthetic","engine_version":"1","data_origin":"synthetic"})
    # Identical bytes shared across institutions: same content in two document links.
    a, b = "FDR-A01", "FDR-A02"
    path_a = pdf_dir/"fdr-a01_fdr.pdf"
    path_b = pdf_dir/"fdr-a02_fdr.pdf"
    shutil.copyfile(path_a, path_b)
    ha, _ = sha256_size(path_a)
    # replace manifest entry to confirm byte identity and add cross-institution marker
    for row in manifest:
        if row["instrument_id"] == b:
            row["sha256"] = ha
            row["fixture"] = "identical-file-pair"
    for row in manifest:
        if row["instrument_id"] == a:
            row["fixture"] = "identical-file-pair"
    for row in versions:
        if row["document_id"] == f"DOC-{b}":
            row["sha256"] = ha
            row["size"] = str(path_b.stat().st_size)
    # Same-institution re-upload: a second logical document with byte-identical content.
    reupload_path=pdf_dir/"same_institution_reupload.pdf"
    shutil.copyfile(pdf_dir/"fdr-a07_fdr.pdf",reupload_path)
    reupload_hash,reupload_size=sha256_size(reupload_path)
    docs.append({"id":"DOC-REUPLOAD-A07","owner_type":"instrument","owner_id":"FDR-A07","document_type":"fdr_receipt","review_state":"pending","data_origin":"synthetic"})
    versions.append({"id":"DOCVER-REUPLOAD-A07","document_id":"DOC-REUPLOAD-A07","storage_key":"pdfs/same_institution_reupload.pdf","sha256":reupload_hash,"size":str(reupload_size),"mime":"application/pdf","original_filename":"same_institution_reupload.pdf","uploaded_by":"USR-SUBMITTER-01","uploaded_at":iso_utc(ref-timedelta(days=1)),"wrapped_data_key":"","signature_result":"unsigned","data_origin":"synthetic"})
    manifest.append({"path":"pdfs/same_institution_reupload.pdf","sha256":reupload_hash,"size":str(reupload_size),"document_version_id":"DOCVER-REUPLOAD-A07","instrument_id":"FDR-A07","fixture":"same-institution-reupload","data_origin":"synthetic"})
    # Special PDFs: signed placeholders are generated by the signing helper when pyHanko exists.
    special = [
        ("amount_mismatch.pdf", dict(byid(instruments,"FDR-A05"), amount="950000.00"), "Synthetic FDR demo generator"),
        ("modified_after_creation.pdf", byid(instruments,"FDR-A11"), "Synthetic FDR demo generator"),
        ("unusual_producer.pdf", byid(instruments,"FDR-A12"), "Odd Software 0.0 (Synthetic Test)"),
        ("signed_valid.pdf", byid(instruments,"FDR-A10"), "Synthetic FDR demo generator"),
        ("signed_then_tampered.pdf", byid(instruments,"FDR-A09"), "Synthetic FDR demo generator"),
    ]
    for filename, ins, producer in special:
        create_fdr_pdf(pdf_dir/filename, ins, canvas, letter, producer=producer)
        if filename == "modified_after_creation.pdf":
            pdf_path=pdf_dir/filename
            data=pdf_path.read_bytes()
            stamp=f"/ModDate (D:{ref.strftime('%Y%m%d')}093000+00'00')".encode("ascii")
            data=data.replace(b"/ModDate (D:20000101000000+00'00')",stamp)
            pdf_path.write_bytes(data)
        if filename == "signed_then_tampered.pdf":
            with (pdf_dir/filename).open("ab") as handle:
                handle.write(b"\n% Altered after synthetic signing fixture\n")
        if filename not in {"signed_valid.pdf", "signed_then_tampered.pdf"}:
            digest, size = sha256_size(pdf_dir/filename)
            manifest.append({"path":f"pdfs/{filename}","sha256":digest,"size":str(size),"instrument_id":ins["id"],"fixture":filename.replace(".pdf", ""),"data_origin":"synthetic"})
            docid=f"DOC-SPECIAL-{filename[:-4].upper().replace('_','-')}"
            verid=f"DOCVER-SPECIAL-{filename[:-4].upper().replace('_','-')}"
            docs.append({"id":docid,"owner_type":"instrument","owner_id":ins["id"],"document_type":"fdr_receipt","review_state":"pending","data_origin":"synthetic"})
            versions.append({"id":verid,"document_id":docid,"storage_key":f"pdfs/{filename}","sha256":digest,"size":str(size),"mime":"application/pdf","original_filename":filename,"uploaded_by":"USR-SUBMITTER-01","uploaded_at":iso_utc(ref-timedelta(days=1)),"wrapped_data_key":"","signature_result":"unsigned","data_origin":"synthetic"})
            if filename == "amount_mismatch.pdf":
                extraction.append({"document_version_id":verid,"field_name":"amount","value":"950000.00","page":"1","region":"body","confidence":"0.96","engine":"seeded_synthetic","engine_version":"1","data_origin":"synthetic"})
    signature_info = create_signature_fixtures(pdf_dir, out.parent/"certs")
    for fixture, info in signature_info.items():
        # The signature fixture is a detached CMS sidecar because no PDF signing
        # library is installed in the offline environment. Never claim a PDF
        # embedded signature when that could not be produced.
        manifest.append({"path":info["pdf_path"],"sha256":info["sha256"],"size":str(info["size"]),"instrument_id":info["instrument_id"],"fixture":fixture,"signature_sidecar":info["sidecar"],"signature_status":info["status"],"data_origin":"synthetic"})
        docid=f"DOC-SPECIAL-{fixture.upper().replace('_','-')}"
        verid=f"DOCVER-SPECIAL-{fixture.upper().replace('_','-')}"
        docs.append({"id":docid,"owner_type":"instrument","owner_id":info["instrument_id"],"document_type":"fdr_receipt","review_state":"pending","data_origin":"synthetic"})
        versions.append({"id":verid,"document_id":docid,"storage_key":info["pdf_path"],"sha256":info["sha256"],"size":str(info["size"]),"mime":"application/pdf","original_filename":Path(info["pdf_path"]).name,"uploaded_by":"USR-SUBMITTER-01","uploaded_at":iso_utc(ref-timedelta(days=1)),"wrapped_data_key":"","signature_result":"valid" if fixture=="signed_valid" else "invalid","data_origin":"synthetic"})
    bank_letters = [r for r in csv_rows(out/"bank_confirmation_requests.csv") if r["response_document_version_id"]]
    for request in bank_letters:
        path = pdf_dir/(request["id"].lower()+"_response.pdf")
        info = byid(instruments,request["instrument_id"])
        create_letter_pdf(path, request, info, canvas, letter)
        digest,size=sha256_size(path)
        document_id=f"DOC-{request['id']}"
        version_id=request["response_document_version_id"]
        docs.append({"id":document_id,"owner_type":"bank_request","owner_id":request["id"],"document_type":"bank_response","review_state":"pending","data_origin":"synthetic"})
        versions.append({"id":version_id,"document_id":document_id,"storage_key":f"pdfs/{path.name}","sha256":digest,"size":str(size),"mime":"application/pdf","original_filename":path.name,"uploaded_by":"USR-VERIFICATION-OFFICER-01","uploaded_at":request["response_at"],"wrapped_data_key":"","signature_result":"unsigned","data_origin":"synthetic"})
        manifest.append({"path":f"pdfs/{path.name}","sha256":digest,"size":str(size),"document_version_id":version_id,"request_id":request["id"],"fixture":"bank-response-letter","data_origin":"synthetic"})
    create_submit_payload_pdfs(out, canvas, letter, ref)
    for path in (out/"submit_payloads").glob("*.pdf"):
        digest,size=sha256_size(path)
        manifest.append({"path":path.relative_to(out).as_posix(),"sha256":digest,"size":str(size),"fixture":"live-submit-payload","data_origin":"synthetic"})
    write_csv(out/"documents.csv",docs)
    write_csv(out/"document_versions.csv",versions)
    write_csv(out/"extraction_results.csv",extraction)
    # Small upload fixtures, no external services or network calls.
    upload = out/"upload_tests"; upload.mkdir(parents=True,exist_ok=True)
    (upload/"spoofed_exe.pdf").write_bytes(b"MZ" + bytes(range(256))*4)
    (upload/"renamed_png.pdf").write_bytes(b"\x89PNG\r\n\x1a\n" + b"synthetic-png")
    (upload/"oversized.bin").write_bytes(b"X"*5_242_881)
    (upload/".._.._etc_passwd.pdf").write_bytes(b"%PDF-1.4\n% SYNTHETIC - DEMO ONLY\n")
    (upload/"zero_byte.pdf").write_bytes(b"")
    jpeg=base64.b64decode("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKf/2Q==")
    (upload/"valid_small.jpg").write_bytes(jpeg)
    def png_chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",binascii.crc32(kind+data)&0xffffffff)
    png=b"\x89PNG\r\n\x1a\n"+png_chunk(b"IHDR",struct.pack(">IIBBBBB",1,1,8,6,0,0,0))+png_chunk(b"IDAT",zlib.compress(b"\x00\x00\x00\x00\xff"))+png_chunk(b"IEND",b"")
    (upload/"valid_small.png").write_bytes(png)
    write_json(upload/"manifest.json",{"data_origin":"synthetic","path_traversal":{"original_filename":"../../etc/passwd.pdf","safe_fixture_path":"upload_tests/.._.._etc_passwd.pdf"},"fixtures":{"spoofed_exe.pdf":"MZ executable header","renamed_png.pdf":"PNG bytes with PDF extension","oversized.bin":"one byte over configured maximum","zero_byte.pdf":"empty file","valid_small.jpg":"valid 1x1 JPEG","valid_small.png":"valid 1x1 RGBA PNG"}})
    for path in upload.glob("*.pdf"):
        digest,size=sha256_size(path)
        manifest.append({"path":path.relative_to(out).as_posix(),"sha256":digest,"size":str(size),"fixture":"upload-negative-test","data_origin":"synthetic"})
    write_csv(out/"documents_manifest.csv",manifest)


def create_submit_payload_pdfs(out: Path, canvas_module: Any, pagesize: Any, ref: date) -> None:
    payload_dir=out/"submit_payloads"
    for payload_path in sorted(payload_dir.glob("*.json")):
        payload=json.loads(payload_path.read_text(encoding="utf-8"))
        info={
            "id":"SUBMIT-"+payload_path.stem.upper(),"fdr_number":payload.get("fdr_number") or "FDR-MISSING-NUMBER",
            "bank_name":payload.get("bank_name") or "Synthetic Bank Missing","branch":payload.get("branch") or "Synthetic Branch",
            "ifsc":payload.get("ifsc") or "BADIFSC","amount":payload.get("amount") or "0.00",
            "issue_date":payload.get("issue_date") or ref.isoformat(),"maturity_date":payload.get("maturity_date") or "unparseable-date",
            "tenure_months":str(payload.get("tenure_months") or 0),"holder_name":payload.get("holder_name") or "Synthetic Demo Holder",
            "lien_in_favour_of":payload.get("lien_in_favour_of") or "Synthetic Council Placeholder",
        }
        create_fdr_pdf(payload_dir/(payload_path.stem+".pdf"),info,canvas_module,pagesize,"Synthetic FDR Demo Generator")


def create_signature_fixtures(pdf_dir: Path, cert_dir: Path) -> dict[str,dict[str,Any]]:
    """Create local detached test signatures without claiming embedded PDF signing."""
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.x509.oid import NameOID
    except ImportError:
        return {}
    cert_dir.mkdir(parents=True,exist_ok=True)
    # A fixed derived Ed25519 demo key makes the certificate/signature fixtures
    # deterministic. It is synthetic test material and is never trusted.
    key=Ed25519PrivateKey.from_private_bytes(hashlib.sha256(b"FDR synthetic fixture signing key v1").digest())
    subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,"Synthetic FDR Demo Test Certificate")])
    now=datetime(2020,1,1,tzinfo=timezone.utc)
    cert=(x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key()).serial_number(42)
          .not_valid_before(now).not_valid_after(datetime(2040,1,1,tzinfo=timezone.utc)).add_extension(x509.BasicConstraints(ca=True,path_length=None),critical=True).sign(key,None))
    (cert_dir/"synthetic_test_certificate.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    # Private test key goes only to the ignored key path; deterministic key
    # material is unnecessary because signed fixtures are verified by outcome.
    (cert_dir/"synthetic_test_private.key").write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    result={}
    for filename,instrument_id in [("signed_valid.pdf","FDR-A10"),("signed_then_tampered.pdf","FDR-A09")]:
        path=pdf_dir/filename
        data=path.read_bytes()
        sig=key.sign(data)
        sidecar=path.with_suffix(path.suffix+".sig")
        sidecar.write_bytes(sig)
        if filename == "signed_then_tampered.pdf":
            with path.open("ab") as handle:
                handle.write(b"\n% Tampered after detached signature\n")
            status="invalid_after_tampering"
        else:
            status="valid_detached_signature"
        digest,size=sha256_size(path)
        result[filename.replace(".pdf","")]={"pdf_path":f"pdfs/{filename}","sha256":digest,"size":size,"signed_sha256":hashlib.sha256(data).hexdigest(),"instrument_id":instrument_id,"sidecar":f"pdfs/{sidecar.name}","status":status}
    return result


def byid(rows: list[dict[str,Any]], key: str) -> dict[str,Any]:
    return next(r for r in rows if r["id"] == key)


def csv_rows(path: Path) -> list[dict[str,str]]:
    with path.open(newline="",encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def sha256_size(path: Path) -> tuple[str,int]:
    data=path.read_bytes()
    return hashlib.sha256(data).hexdigest(),len(data)


def create_fdr_pdf(path: Path, ins: dict[str,Any], canvas_module: Any, pagesize: Any, producer: str) -> None:
    c=canvas_module.Canvas(str(path),pagesize=pagesize,pageCompression=0,invariant=1)
    c.setTitle("Synthetic Fixed Deposit Receipt")
    c.setAuthor("Synthetic Demo Generator")
    c.setSubject("SYNTHETIC - DEMO ONLY")
    c._doc.info.producer=producer
    width,height=pagesize
    layout=hashlib.sha256(ins["id"].encode("utf-8")).digest()[0]%3
    if layout==0:
        c.setFont("Helvetica-Bold",18); c.drawString(52,height-62,"FIXED DEPOSIT RECEIPT")
        c.setFont("Helvetica-Bold",11); c.drawString(52,height-87,ins["bank_name"])
        c.setFont("Helvetica",9); c.drawString(52,height-103,"Fictional bank instrument - no financial value")
        start_y=height-145; spacing=30
    elif layout==1:
        c.setFillColorRGB(0.88,0.92,0.96); c.rect(40,height-118,width-80,75,fill=1,stroke=0)
        c.setFillColorRGB(0,0,0); c.setFont("Helvetica-Bold",17); c.drawString(55,height-70,"DEPOSIT CERTIFICATE")
        c.setFont("Helvetica-Bold",10); c.drawString(55,height-91,ins["bank_name"])
        c.setFont("Helvetica",9); c.drawString(55,height-107,"Synthetic training document")
        start_y=height-150; spacing=28
    else:
        c.setFont("Helvetica-Bold",16); c.drawCentredString(width/2,height-62,"FIXED TERM DEPOSIT")
        c.setFont("Helvetica-Bold",11); c.drawCentredString(width/2,height-84,ins["bank_name"])
        c.setStrokeColorRGB(0.25,0.35,0.5); c.line(55,height-100,width-55,height-100)
        c.setFont("Helvetica",9); c.drawCentredString(width/2,height-116,"Fictional receipt - no financial value")
        start_y=height-154; spacing=29
    pairs=[("FDR Number",ins["fdr_number"]),("Branch",ins["branch"]),("IFSC",ins["ifsc"]),("Amount (INR)",ins["amount"]),("Issue Date",ins["issue_date"]),("Maturity Date",ins["maturity_date"]),("Tenure (months)",ins["tenure_months"]),("Holder",ins["holder_name"]),("Lien in favour of",ins["lien_in_favour_of"])]
    y=start_y
    for label,value in pairs:
        c.setFont("Helvetica-Bold",10); c.drawString(55,y,label+":")
        c.setFont("Helvetica",10); c.drawString(185,y,str(value))
        y-=spacing
    c.setFont("Helvetica-Oblique",8); c.drawString(50,30,"SYNTHETIC - DEMO ONLY | Not a bank instrument")
    c.showPage(); c.save()


def create_letter_pdf(path: Path, request: dict[str,str], ins: dict[str,Any], canvas_module: Any, pagesize: Any) -> None:
    c=canvas_module.Canvas(str(path),pagesize=pagesize,pageCompression=0,invariant=1)
    c.setTitle("SIMULATED bank response")
    c._doc.info.producer="Synthetic FDR Demo Generator"
    c.setFont("Helvetica-Bold",16); c.drawString(54,730,"SIMULATED BANK RESPONSE")
    c.setFont("Helvetica",11)
    for idx,text in enumerate([f"Reference: {request['id']}",f"Instrument: {ins['fdr_number']}",f"Bank: {ins['bank_name']}",f"Outcome: {request['state']}","This response is synthetic and is not issued by a real bank."],1):
        c.drawString(54,690-25*idx,text)
    c.setFont("Helvetica-Bold",9); c.drawString(50,30,"SYNTHETIC - DEMO ONLY | SIMULATED")
    c.showPage(); c.save()


def create_check_fixtures(out: Path, ref: date) -> None:
    """Create review/informational check results; blocking failures stay payload-only."""
    checks=[
        ("CHECK-AMOUNT-MISMATCH","FDR-A05","entered_differs_from_extracted","review_required","medium",{"entered":"450000.00","extracted":"950000.00"}),
        ("CHECK-LIEN-A06","FDR-A06","holder_or_lien_inconsistent","review_required","high",{"field":"lien_in_favour_of","extracted":"Synthetic Ministry of Demos"}),
        ("CHECK-EXACT-DUP","FDR-A02","exact_normalized_duplicate","review_required","high",{"matches":"FDR-A01"}),
        ("CHECK-LOOSE-DUP","FDR-A03","loose_duplicate","review_required","medium",{"matches":"FDR-A01"}),
        ("CHECK-LOW-AMOUNT","FDR-A05","amount_below_minimum","review_required","medium",{"minimum":"500000.00"}),
        ("CHECK-LOW-TENURE","FDR-A08","tenure_below_minimum","review_required","medium",{"minimum_months":12}),
        ("CHECK-BAD-SIGNATURE","FDR-A09","signature_integrity_invalid","review_required","medium",{"signature_fixture":"signed_then_tampered"}),
        ("CHECK-CROSS-FILE","FDR-A01","identical_file_cross_institution","review_required","high",{"matches":"FDR-A02"}),
        ("CHECK-LIEN-HIGH","FDR-A09","holder_or_lien_inconsistent","review_required","high",{"field":"lien_in_favour_of","extracted":"Synthetic Ministry of Demos"}),
        ("CHECK-MODIFIED","FDR-A11","pdf_modified_after_creation","informational","",{"document":"modified_after_creation.pdf"}),
        ("CHECK-PRODUCER","FDR-A12","unusual_pdf_producer","informational","",{"producer":"Odd Software 0.0 (Synthetic Test)"}),
        ("CHECK-NO-SIGNATURE","FDR-A01","no_signature","informational","",{"document":"unsigned"}),
        ("CHECK-REUPLOAD","FDR-A07","same_institution_identical_reupload","informational","",{"document_version":"DOCVER-REUPLOAD-A07"}),
    ]
    result_rows=[]
    case_rows=[]
    now=ref
    for check_id,instrument_id,rule_id,rule_class,severity,evidence in checks:
        result_rows.append({"id":check_id,"instrument_id":instrument_id,"rule_id":rule_id,"config_version":"v1","class":rule_class,"outcome":"flagged" if rule_class=="review_required" else "informational","severity":severity,"evidence":json.dumps(evidence,sort_keys=True),"data_origin":"synthetic"})
        if rule_class=="review_required":
            case_id="CASE-HIGH-01" if check_id=="CHECK-LIEN-HIGH" else f"CASE-{check_id.removeprefix('CHECK-')}"
            opened=now-timedelta(days=12 if case_id=="CASE-HIGH-01" else 5)
            state="open" if case_id=="CASE-HIGH-01" else "resolved"
            resolution="" if state=="open" else "synthetic review completed"
            rationale="" if state=="open" else "accepted with recorded synthetic rationale"
            case_rows.append({"id":case_id,"instrument_id":instrument_id,"check_result_id":check_id,"severity":severity,"state":state,"assignee":"USR-VERIFICATION-OFFICER-01","resolution":resolution,"rationale":rationale,"created_at":iso_utc(opened),"updated_at":iso_utc(now),"data_origin":"synthetic"})
    write_csv(out/"check_results.csv",result_rows)
    write_csv(out/"discrepancy_cases.csv",case_rows)


def create_metric_events(out: Path, instruments: list[dict[str,Any]], ref: date, rng: random.Random) -> None:
    """Backfill plausible milestone events for the 90-day synthetic period."""
    events: list[dict[str,str]]=[]
    start=ref-timedelta(days=90)
    bank_requests=csv_rows(out/"bank_confirmation_requests.csv")
    requests_by_instrument={r["instrument_id"]:r for r in bank_requests}
    links=csv_rows(out/"instrument_links.csv")
    successor_ids={r["successor_id"] for r in links}
    release=csv_rows(out/"release_requests.csv")
    releases_by_ins={r["instrument_id"]:r for r in release}
    for index,ins in enumerate(instruments):
        if ins["lifecycle"] not in {"in_force","submitted","closed"}:
            continue
        base=start+timedelta(days=(index*7)%65)
        base_ts=iso_utc(base,8+(index%8),15)
        def add(event: str, when: date, actor: str="USR-SUBMITTER-01") -> None:
            events.append({"instrument_id":ins["id"],"case_id":"","event":event,"at":iso_utc(when,9,30),"actor":actor,"data_origin":"synthetic"})
        if ins["lifecycle"] != "in_force":
            add("submitted",base, "USR-SUBMITTER-01")
            add("auto_checked",base+timedelta(days=1),"system")
            if ins["lifecycle"] == "closed":
                add("release_requested",base+timedelta(days=2),"USR-CLEARANCE-OFFICER-01")
                add("release_decided",base+timedelta(days=7),"USR-AUTHORIZED-APPROVER-01")
                add("release_confirmed",base+timedelta(days=9),"USR-CLEARANCE-OFFICER-01")
            continue
        add("submitted",base)
        add("auto_checked",base+timedelta(days=1),"system")
        add("reminder_sent",base+timedelta(days=23),"system")
        add("officer_review_started",base+timedelta(days=rng.randint(1,6)),"USR-VERIFICATION-OFFICER-01")
        level=ins["verification_level"]
        if level in {"officer_reviewed","bank_confirmed"}:
            add("officer_reviewed",base+timedelta(days=rng.randint(7,15)),"USR-VERIFICATION-OFFICER-01")
        request=requests_by_instrument.get(ins["id"])
        if request and request["state"]!="requested":
            issued=base+timedelta(days=3)
            add("bank_request_issued",issued,"USR-VERIFICATION-OFFICER-01")
            add("bank_response_recorded",issued+timedelta(days=6),"USR-VERIFICATION-OFFICER-01")
            if request["state"]=="accepted" and level=="bank_confirmed":
                add("bank_confirmed",issued+timedelta(days=9),"USR-VERIFICATION-OFFICER-01")
        elif request:
            add("bank_request_issued",base+timedelta(days=3),"USR-VERIFICATION-OFFICER-01")
        if ins["id"] in successor_ids:
            add("renewal_actioned",base+timedelta(days=20),"USR-VERIFICATION-OFFICER-01")
        if index % 2 == 0:
            add("reminder_sent",base+timedelta(days=25),"system")
        rr=releases_by_ins.get(ins["id"])
        if rr:
            add("release_requested",base+timedelta(days=2),"USR-CLEARANCE-OFFICER-01")
    # Seed a small traceable discrepancy history for planted review signals.
    submitted_by_instrument={r["instrument_id"]:date.fromisoformat(r["at"][:10]) for r in events if r["event"]=="submitted"}
    for j, (instrument_id, case_id, keep_open) in enumerate([
        ("FDR-A05","CASE-AMOUNT-MISMATCH",False),("FDR-A06","CASE-LIEN-A06",False),
        ("FDR-A02","CASE-EXACT-DUP",False),("FDR-A03","CASE-LOOSE-DUP",False),
        ("FDR-A05","CASE-LOW-AMOUNT",False),("FDR-A08","CASE-LOW-TENURE",False),
        ("FDR-A09","CASE-BAD-SIGNATURE",False),("FDR-A01","CASE-CROSS-FILE",False),
        ("FDR-A09","CASE-HIGH-01",True),
    ]):
        when=submitted_by_instrument[instrument_id]+timedelta(days=2+j%3)
        events.append({"instrument_id":instrument_id,"case_id":case_id,"event":"flag_opened","at":iso_utc(when),"actor":"system","data_origin":"synthetic"})
        if not keep_open:
            events.append({"instrument_id":instrument_id,"case_id":case_id,"event":"flag_resolved","at":iso_utc(when+timedelta(days=3+j%5)),"actor":"USR-VERIFICATION-OFFICER-01","data_origin":"synthetic"})
    for j, rr in enumerate(release):
        if rr["id"].startswith("RR-C"):
            continue
        requested=date.fromisoformat(rr["requested_at"][:10])
        events.append({"instrument_id":rr["instrument_id"],"case_id":rr["id"],"event":"release_requested","at":rr["requested_at"],"actor":rr["requested_by"],"data_origin":"synthetic"})
    events.sort(key=lambda r:(r["at"],r["instrument_id"],r["event"]))
    write_csv(out/"metric_events.csv",events)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--ref-date", type=date.fromisoformat, default=datetime.now(timezone(timedelta(hours=5,minutes=30))).date())
    parser.add_argument("--bulk", type=int, default=0)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_core(args.out, args.seed, args.ref_date, args.bulk)
    print(f"Generated core synthetic dataset at {args.out}")


if __name__ == "__main__":
    main()
