#!/usr/bin/env python3
"""Verify the generated synthetic dataset; grows with each fixture stage."""
from __future__ import annotations

import csv
import hashlib
import re
import json
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"


def read_csv(name: str) -> list[dict[str, str]]:
    with (OUT / name).open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def validity(maturity: str, ref: date) -> str:
    m = date.fromisoformat(maturity)
    if ref < m - timedelta(days=90):
        return "active"
    if m > ref:
        return "expiring"
    if ref < m + timedelta(days=30):
        return "matured"
    return "lapsed"


def verify() -> list[str]:
    errors: list[str] = []
    try:
        institutions = read_csv("institutions.csv")
        users = read_csv("users.csv")
        scopes = read_csv("user_scopes.csv")
        instruments = read_csv("instruments.csv")
        provenance = read_csv("field_provenance.csv")
        history = read_csv("field_value_history.csv")
        links = read_csv("instrument_links.csv")
        verification = read_csv("verification_events.csv")
        scenarios = json.loads((OUT / "scenarios.json").read_text(encoding="utf-8"))
    except (OSError, ValueError, csv.Error) as exc:
        return [f"unable to read generated core dataset: {exc}"]
    if len(institutions) != 12:
        errors.append(f"institutions: expected 12, found {len(institutions)}")
    if len({r["aicte_id"] for r in institutions}) != len(institutions):
        errors.append("duplicate aicte_id")
    if any(r.get("data_origin") != "synthetic" for table in [institutions, users, scopes, instruments, provenance, history, links, verification] for r in table):
        errors.append("a core row lacks data_origin=synthetic")
    inst_ids = {r["id"] for r in institutions}
    user_ids = {r["id"] for r in users}
    ins_by_id = {r["id"]: r for r in instruments}
    for row in instruments:
        if row["institution_id"] not in inst_ids:
            errors.append(f"orphan institution on {row['id']}")
        try:
            Decimal(row["amount"]).quantize(Decimal("0.01"))
        except InvalidOperation:
            errors.append(f"invalid amount on {row['id']}")
        if not re.fullmatch(r"\d+\.\d{2}", row["amount"]):
            errors.append(f"money is not a plain 2-decimal string on {row['id']}")
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}",row["ifsc"]):
            errors.append(f"malformed IFSC on {row['id']}")
        normalized=re.sub(r"[^A-Z0-9]","",row["fdr_number"].upper())
        loose="FDR"+normalized[3:].lstrip("0") if normalized.startswith("FDR") and normalized[3:].lstrip("0") else normalized
        if row["fdr_key_norm"]!=normalized or row["fdr_key_loose"]!=loose:
            errors.append(f"normalized key mismatch on {row['id']}")
    for row in scopes:
        if row["user_id"] not in user_ids:
            errors.append(f"orphan scope user {row['user_id']}")
        if row["institution_id"] and row["institution_id"] not in inst_ids:
            errors.append(f"orphan scope institution {row['institution_id']}")
    for row in provenance:
        if row["instrument_id"] not in ins_by_id:
            errors.append(f"orphan provenance {row['instrument_id']}")
    for row in history:
        if row["instrument_id"] not in ins_by_id:
            errors.append(f"orphan history {row['instrument_id']}")
        if row.get("changed_by") and row["changed_by"] not in user_ids:
            errors.append(f"orphan history actor {row['changed_by']}")
    for row in provenance:
        if row.get("recorded_by") and row["recorded_by"] not in user_ids:
            errors.append(f"orphan provenance actor {row['recorded_by']}")
    for row in links:
        if row["predecessor_id"] not in ins_by_id or row["successor_id"] not in ins_by_id:
            errors.append(f"orphan link {row['id']}")
        if row.get("accepted_by") and row["accepted_by"] not in user_ids:
            errors.append(f"orphan link actor {row['id']}")
    duplicated_keys: dict[str,list[str]]={}
    for row in instruments:
        duplicated_keys.setdefault(row["fdr_key_norm"],[]).append(row["id"])
    intentional={"FDR00123":{"FDR-A01","FDR-A02"}}
    actual_dupes={key:set(ids) for key,ids in duplicated_keys.items() if len(ids)>1}
    if actual_dupes != intentional:
        errors.append(f"normalized duplicate records differ from planted pair: {actual_dupes}")
    actual: dict[str, int] = {b: 0 for b in ("active", "expiring", "matured", "lapsed")}
    ref_str = scenarios.get("ref_date")
    if ref_str is None:
        # The CLI default is recorded into scenarios on subsequent revisions; use
        # environment-provided date for this stage's generated fixed defaults.
        ref_str = "2026-10-24"
    ref = date.fromisoformat(ref_str)
    for row in instruments:
        if row["lifecycle"] == "in_force":
            actual[validity(row["maturity_date"], ref)] += 1
    expected = {"active": 8, "expiring": 6, "matured": 4, "lapsed": 3}
    if actual != expected:
        errors.append(f"validity bucket counts expected {expected}, found {actual}")
    if len(links) != 3:
        errors.append(f"expected 3 renewal links, found {len(links)}")
    closed = [r for r in instruments if r["lifecycle"] == "closed"]
    if len(closed) != 2:
        errors.append(f"expected 2 closed instruments, found {len(closed)}")
    if any(r["role"] == "system_admin" and r["role"] == "authorized_approver" for r in users):
        errors.append("system_admin also has approval role")
    for key in ["config/rules.json", "config/checklist_template.json", "config/reminder_rules.json", "config/escalation_rules.json", "config/limits.json"]:
        if not (OUT / key).is_file():
            errors.append(f"missing {key}")
    if not (OUT / "users_demo_credentials.csv").exists():
        errors.append("missing ignored demo credentials file")
    for inst in instruments:
        if inst["bank_code"] in {"SBIN", "HDFC", "ICIC", "UTIB", "PUNB", "BARB", "CNRB", "UBIN", "IDIB"}:
            errors.append(f"real bank prefix on {inst['id']}")
    for pdf_path in (OUT/"pdfs").glob("*.pdf") if (OUT/"pdfs").exists() else []:
        if b"SYNTHETIC - DEMO ONLY" not in pdf_path.read_bytes():
            errors.append(f"synthetic footer missing from {pdf_path.name}")
    for pdf_path in (OUT/"submit_payloads").glob("*.pdf") if (OUT/"submit_payloads").exists() else []:
        if b"SYNTHETIC - DEMO ONLY" not in pdf_path.read_bytes():
            errors.append(f"synthetic footer missing from {pdf_path.name}")
    legacy_path = OUT / "legacy/legacy_fdr_register.csv"
    if legacy_path.exists():
        with legacy_path.open(newline="", encoding="utf-8") as handle:
            legacy_rows = list(csv.DictReader(handle))
        if len(legacy_rows) != 40:
            errors.append(f"legacy CSV expected 40 data rows, found {len(legacy_rows)}")
        expected_path = OUT / "legacy/expected_import_result.json"
        try:
            legacy_expected = json.loads(expected_path.read_text(encoding="utf-8"))
            counts = legacy_expected["counts"]
            if counts != {"ok": 32, "error": 6, "duplicate_flagged": 2}:
                errors.append(f"legacy expected outcomes counts wrong: {counts}")
            if len(legacy_expected["rows"]) != 40:
                errors.append("legacy expected_import_result does not list 40 rows")
            if sum(row["outcome"] == "error" for row in legacy_expected["rows"]) != 6:
                errors.append("legacy expected_import_result must contain exactly six errors")
            if sum(row["outcome"] == "duplicate_flagged" for row in legacy_expected["rows"]) != 2:
                errors.append("legacy expected_import_result must contain exactly two duplicate flags")
            def parse_legacy_day(value: str) -> date:
                try:
                    return date.fromisoformat(value)
                except ValueError:
                    return datetime.strptime(value,"%d/%m/%Y").date()
            seeded_keys={re.sub(r"[^A-Z0-9]","",r["fdr_number"].upper()) for r in instruments}
            seen_keys:set[str]=set()
            derived=[]
            for row in legacy_rows:
                reasons=[]
                try:
                    issue=parse_legacy_day(row["Start"])
                    maturity=parse_legacy_day(row["End"])
                    if maturity<=issue:
                        reasons.append("MATURITY_NOT_AFTER_ISSUE")
                except ValueError:
                    reasons.append("UNPARSEABLE_DATE")
                if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}",row["IFSC Code"]):
                    reasons.append("MALFORMED_IFSC")
                try:
                    if Decimal(row["Amt (INR)"])<=0:
                        reasons.append("NON_POSITIVE_AMOUNT")
                except InvalidOperation:
                    reasons.append("INVALID_AMOUNT")
                if not row["Bank"].strip():
                    reasons.append("MISSING_BANK_NAME")
                key=re.sub(r"[^A-Z0-9]","",row["FD No"].upper())
                duplicate=key in seeded_keys or key in seen_keys
                seen_keys.add(key)
                derived.append("error" if reasons else "duplicate_flagged" if duplicate else "ok")
            expected_outcomes=[r["outcome"] for r in legacy_expected["rows"]]
            if derived!=expected_outcomes:
                errors.append("legacy CSV actual validation outcomes do not match expected_import_result.json")
            if sum(value!="ok" for value in derived)!=8:
                errors.append("legacy CSV must have exactly eight defective rows")
        except (OSError, ValueError, KeyError) as exc:
            errors.append(f"invalid legacy expected result: {exc}")
        xlsx_path = OUT / "legacy/legacy_fdr_register.xlsx"
        try:
            with zipfile.ZipFile(xlsx_path) as archive:
                if "xl/worksheets/sheet1.xml" not in archive.namelist():
                    errors.append("legacy xlsx is missing worksheet")
                else:
                    root=ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
                    ns={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                    sheet_rows=root.findall(".//m:sheetData/m:row",ns)
                    if len(sheet_rows)!=41:
                        errors.append(f"legacy XLSX expected 41 rows including header, found {len(sheet_rows)}")
        except (OSError, zipfile.BadZipFile):
            errors.append("legacy XLSX twin is invalid")
    manifest_path = OUT / "documents_manifest.csv"
    if manifest_path.exists():
        manifest_rows=read_csv("documents_manifest.csv")
        for item in manifest_rows:
            file_path = OUT / item["path"]
            if not file_path.is_file():
                errors.append(f"manifest file missing: {item['path']}")
                continue
            digest = hashlib.sha256(file_path.read_bytes()).hexdigest()
            if digest != item["sha256"]:
                errors.append(f"manifest SHA-256 mismatch: {item['path']}")
        manifest_paths={r["path"].replace("\\","/") for r in manifest_rows}
        for pdf_path in OUT.rglob("*.pdf"):
            if pdf_path.relative_to(OUT).as_posix() not in manifest_paths:
                errors.append(f"PDF is missing from documents_manifest.csv: {pdf_path.relative_to(OUT)}")
        files = {r["path"]: r for r in read_csv("documents_manifest.csv")}
        pair_a = OUT/"pdfs/fdr-a01_fdr.pdf"
        pair_b = OUT/"pdfs/fdr-a02_fdr.pdf"
        if pair_a.exists() and pair_b.exists() and pair_a.read_bytes() != pair_b.read_bytes():
            errors.append("identical-file pair PDFs are not byte-identical")
        for required in ["pdfs/signed_valid.pdf", "pdfs/signed_then_tampered.pdf", "pdfs/modified_after_creation.pdf", "pdfs/unusual_producer.pdf", "pdfs/amount_mismatch.pdf"]:
            if required not in files:
                errors.append(f"manifest entry missing for {required}")
        if (ROOT.parent/"certs/synthetic_test_certificate.pem").exists():
            try:
                from cryptography import x509
                cert=x509.load_pem_x509_certificate((ROOT.parent/"certs/synthetic_test_certificate.pem").read_bytes())
                public_key=cert.public_key()
                for pdfname in ["signed_valid.pdf", "signed_then_tampered.pdf"]:
                    path=OUT/"pdfs"/pdfname
                    sidecar=path.with_suffix(path.suffix+".sig")
                    if not sidecar.exists():
                        errors.append(f"signature sidecar missing: {sidecar.name}")
                        continue
                    data=path.read_bytes()
                    if pdfname=="signed_then_tampered.pdf":
                        suffix=b"\n% Tampered after detached signature\n"
                        if not data.endswith(suffix):
                            errors.append("tampered signature fixture missing alteration marker")
                        data=data[:-len(suffix)]
                    try:
                        public_key.verify(sidecar.read_bytes(),data)
                    except Exception:
                        errors.append(f"detached test signature failed verification: {pdfname}")
            except Exception as exc:
                errors.append(f"could not verify test certificate/signatures: {exc}")
        if len(read_csv("extraction_results.csv")) < 100:
            errors.append("expected seeded extraction results for document fields")
    # Resolve all seeded document, verification, bank, release and metric references.
    doc_ids = {r["id"] for r in read_csv("documents.csv")} if (OUT/"documents.csv").exists() else set()
    version_ids = {r["id"] for r in read_csv("document_versions.csv")} if (OUT/"document_versions.csv").exists() else set()
    for doc in read_csv("documents.csv") if (OUT/"documents.csv").exists() else []:
        if doc["owner_type"] == "instrument" and doc["owner_id"] not in ins_by_id:
            errors.append(f"orphan instrument document: {doc['id']}")
        if doc["owner_type"] == "bank_request" and doc["owner_id"] not in {r["id"] for r in read_csv("bank_confirmation_requests.csv")}:
            errors.append(f"orphan bank-response document: {doc['id']}")
    for version in read_csv("document_versions.csv") if (OUT/"document_versions.csv").exists() else []:
        if version["document_id"] not in doc_ids:
            errors.append(f"orphan document version: {version['id']}")
        if version.get("uploaded_by") and version["uploaded_by"] not in user_ids:
            errors.append(f"orphan document uploader: {version['id']}")
    for extraction in read_csv("extraction_results.csv") if (OUT/"extraction_results.csv").exists() else []:
        if extraction["document_version_id"] not in version_ids:
            errors.append(f"orphan extraction result: {extraction['document_version_id']}")
    check_rows=read_csv("check_results.csv") if (OUT/"check_results.csv").exists() else []
    check_ids={r["id"] for r in check_rows}
    for check in check_rows:
        if check["instrument_id"] not in ins_by_id:
            errors.append(f"orphan check result: {check['id']}")
    cases=read_csv("discrepancy_cases.csv") if (OUT/"discrepancy_cases.csv").exists() else []
    for case in cases:
        if case["instrument_id"] not in ins_by_id or case["check_result_id"] not in check_ids:
            errors.append(f"orphan discrepancy case: {case['id']}")
    high_case=next((r for r in cases if r["id"]=="CASE-HIGH-01"),None)
    if not high_case or high_case["instrument_id"]!="FDR-A09" or high_case["severity"]!="high" or high_case["state"]!="open":
        errors.append("risk demo high case is missing/open/high severity conditions")
    for event in verification:
        if event["instrument_id"] not in ins_by_id or event["actor"] not in user_ids:
            errors.append(f"orphan verification event: {event['id']}")
    bank_requests = read_csv("bank_confirmation_requests.csv") if (OUT/"bank_confirmation_requests.csv").exists() else []
    accepted_by_instrument = {r["instrument_id"]: r for r in bank_requests if r["state"] == "accepted"}
    for request in bank_requests:
        if request["instrument_id"] not in ins_by_id or request["requested_by"] not in user_ids:
            errors.append(f"orphan bank request: {request['id']}")
        if request.get("assessed_by") and request["assessed_by"] not in user_ids:
            errors.append(f"orphan bank assessment actor: {request['id']}")
        if request.get("response_document_version_id") and request["response_document_version_id"] not in version_ids:
            errors.append(f"orphan bank response document: {request['id']}")
    for ins in instruments:
        if ins["verification_level"] == "bank_confirmed":
            request = accepted_by_instrument.get(ins["id"])
            if not request or not request["response_document_version_id"] or request["response_document_version_id"] not in version_ids or not request["assessed_by"] or not request["rationale"]:
                errors.append(f"bank_confirmed evidence incomplete: {ins['id']}")
    releases = read_csv("release_requests.csv") if (OUT/"release_requests.csv").exists() else []
    release_ids = {r["id"] for r in releases}
    checklist_rows=read_csv("checklist_items.csv") if (OUT/"checklist_items.csv").exists() else []
    checklist_ids={r["id"] for r in checklist_rows}
    for row in read_csv("checklist_items.csv") if (OUT/"checklist_items.csv").exists() else []:
        if row["release_request_id"] not in release_ids:
            errors.append(f"orphan checklist item: {row['id']}")
        if row.get("marked_by") and row["marked_by"] not in user_ids:
            errors.append(f"orphan checklist actor: {row['id']}")
    for request in releases:
        if request["instrument_id"] not in ins_by_id or request["requested_by"] not in user_ids or request["prepared_by"] not in user_ids:
            errors.append(f"orphan release request: {request['id']}")
    for filename in ["release_exceptions.csv", "decisions.csv", "release_confirmations.csv"]:
        if not (OUT/filename).exists():
            continue
        for row in read_csv(filename):
            key = "release_request_id" if "release_request_id" in row else ""
            if key and row[key] not in release_ids and not row[key].startswith("RR-C"):
                errors.append(f"orphan release reference in {filename}: {row[key]}")
            if filename=="release_exceptions.csv":
                if row["checklist_item_id"] not in checklist_ids or row["requested_by"] not in user_ids or row["approved_by"] not in user_ids:
                    errors.append(f"orphan release exception reference: {row['id']}")
                if row["requested_by"]==row["approved_by"]:
                    errors.append(f"exception self-approval: {row['id']}")
            if filename=="decisions.csv" and row["decided_by"] not in user_ids:
                errors.append(f"orphan release decision actor: {row['id']}")
            if filename=="release_confirmations.csv" and row["recorded_by"] not in user_ids:
                errors.append(f"orphan release confirmation actor: {row['id']}")
    confirmations=read_csv("release_confirmations.csv") if (OUT/"release_confirmations.csv").exists() else []
    confirmed_request_ids={r["release_request_id"] for r in confirmations}
    if not {"RR-C01","RR-C02"}.issubset(confirmed_request_ids):
        errors.append("closed instruments are missing release confirmations")
    for closed_id, rr_id in [("FDR-C01","RR-C01"),("FDR-C02","RR-C02")]:
        rr=next((r for r in releases if r["id"]==rr_id),None)
        if not rr or rr["instrument_id"]!=closed_id:
            errors.append(f"closed instrument {closed_id} lacks matching release request")
    decision_rows=read_csv("decisions.csv") if (OUT/"decisions.csv").exists() else []
    for rr_id in ["RR-C01","RR-C02"]:
        if not any(r["release_request_id"]==rr_id and r["decision"]=="approve" for r in decision_rows):
            errors.append(f"closed release {rr_id} lacks approved decision")
    if (OUT/"metric_events.csv").exists():
        metric_events = read_csv("metric_events.csv")
        if not 150 <= len(metric_events) <= 300:
            errors.append(f"metric_events expected roughly 150-300 rows, found {len(metric_events)}")
        if metric_events != sorted(metric_events, key=lambda r:(r["at"],r["instrument_id"],r["event"])):
            errors.append("metric_events.csv is not chronologically sorted")
        for event in metric_events:
            if event["instrument_id"] not in ins_by_id:
                errors.append(f"orphan metric event instrument: {event['instrument_id']}")
            if event["event"] == "bank_confirmed" and ins_by_id[event["instrument_id"]]["verification_level"] != "bank_confirmed":
                errors.append(f"bank_confirmed metric event for non-confirmed instrument: {event['instrument_id']}")
        grouped: dict[str,list[dict[str,str]]]={}
        for event in metric_events:
            grouped.setdefault(event["instrument_id"],[]).append(event)
        for instrument_id, timeline in grouped.items():
            submitted=[r for r in timeline if r["event"]=="submitted"]
            if submitted:
                submit_at=min(r["at"] for r in submitted)
                for event in timeline:
                    if event["at"]<submit_at:
                        errors.append(f"milestone predates submission for {instrument_id}")
                        break
            opened_cases={}
            for event in timeline:
                if event["event"]=="flag_opened":
                    opened_cases[event["case_id"]]=event["at"]
                elif event["event"]=="flag_resolved":
                    if event["case_id"] not in opened_cases or opened_cases[event["case_id"]]>event["at"]:
                        errors.append(f"flag resolution has no earlier opening: {event['case_id']}")
            for event in timeline:
                if event["event"]=="bank_confirmed" and event["instrument_id"] not in accepted_by_instrument:
                    errors.append(f"bank_confirmed event lacks accepted request: {event['instrument_id']}")
    upload_dir=OUT/"upload_tests"
    if upload_dir.exists():
        if (upload_dir/"oversized.bin").stat().st_size <= 5_242_880:
            errors.append("oversized upload fixture is not over configured limit")
        if (upload_dir/"zero_byte.pdf").stat().st_size != 0:
            errors.append("zero-byte upload fixture is not empty")
        if not (upload_dir/"valid_small.jpg").read_bytes().startswith(b"\xff\xd8\xff"):
            errors.append("valid JPEG fixture has invalid signature")
        if not (upload_dir/"valid_small.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n"):
            errors.append("valid PNG fixture has invalid signature")
        if not (upload_dir/"manifest.json").exists():
            errors.append("upload negative-test metadata is missing")
    # Optional bulk set validation.
    bulk_path=OUT/"perf/instruments_bulk.csv"
    if bulk_path.exists():
        bulk_rows=read_csv("perf/instruments_bulk.csv")
        if any(row.get("is_bulk")!="true" or row.get("data_origin")!="synthetic" for row in bulk_rows):
            errors.append("bulk records must be tagged is_bulk=true and data_origin=synthetic")
        if len({row["fdr_number"] for row in bulk_rows})!=len(bulk_rows):
            errors.append("bulk FDR numbers are not unique")
        for row in bulk_rows:
            if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}",row["ifsc"]):
                errors.append(f"malformed bulk IFSC: {row['id']}")
                break
    # Coverage and duplicate normalization outcomes are contract-critical.
    scenario_path=OUT/"scenarios.json"
    if scenario_path.exists():
        sc=json.loads(scenario_path.read_text(encoding="utf-8"))
        for probe, instrument_id in sc.get("boundary_probes",{}).get("probes",{}).items():
            actual_state=validity(ins_by_id[instrument_id]["maturity_date"],ref)
            expected_state=sc["boundary_probes"]["expected_states"][probe]
            if actual_state != expected_state:
                errors.append(f"boundary probe {probe}: expected {expected_state}, found {actual_state}")
        gap=sc.get("coverage_gap",{})
        if gap:
            pred=ins_by_id[gap["predecessor_id"]]
            succ=ins_by_id[gap["successor_id"]]
            days=(date.fromisoformat(succ["issue_date"])-date.fromisoformat(pred["maturity_date"])).days
            if days != gap["expected_gap_days"]:
                errors.append(f"coverage gap expected {gap['expected_gap_days']} days, found {days}")
        for rule_id, refs in sc.get("rule_coverage",{}).items():
            if not refs:
                errors.append(f"rule has no planted case: {rule_id}")
        rules=json.loads((OUT/"config/rules.json").read_text(encoding="utf-8"))["rules"]
        configured={r["rule_id"] for r in rules}
        if configured != set(sc.get("rule_coverage",{})):
            errors.append(f"rule coverage catalogue mismatch; missing={sorted(configured-set(sc.get('rule_coverage',{})))}, extra={sorted(set(sc.get('rule_coverage',{}))-configured)}")
        exact_ids=sc.get("duplicates",{}).get("exact",[])
        loose_ids=sc.get("duplicates",{}).get("loose",[])
        if len(exact_ids)>=2 and ins_by_id[exact_ids[0]]["fdr_key_norm"] != ins_by_id[exact_ids[1]]["fdr_key_norm"]:
            errors.append("exact duplicate normalized keys differ")
        if len(loose_ids)>=2 and ins_by_id[loose_ids[0]]["fdr_key_loose"] != ins_by_id[loose_ids[1]]["fdr_key_loose"]:
            errors.append("loose duplicate keys differ")
        low=ins_by_id["FDR-A06"]
        low_pred=ins_by_id["FDR-P02"]
        if Decimal(low["amount"]) >= Decimal(low_pred["amount"]):
            errors.append("lower amount replacement successor is not lower than predecessor")
        high=sc["risk_demo"]["case_high"]
        high_instrument=ins_by_id[high["instrument_id"]]
        if (date.fromisoformat(high_instrument["maturity_date"])-ref).days>10:
            errors.append("risk high case is not within 10 days of maturity")
        if any(row["predecessor_id"]==high["instrument_id"] for row in links):
            errors.append("risk high case unexpectedly has a successor")
        overdue=next((r for r in bank_requests if r["id"]==sc["bank_requests"]["overdue"]),None)
        if not overdue or overdue["state"]!="requested" or overdue["response_document_version_id"]:
            errors.append("risk high case lacks overdue request with missing response document")
        low_risk=ins_by_id[sc["risk_demo"]["case_low"]["instrument_id"]]
        if validity(low_risk["maturity_date"],ref)!="active" or any(r["instrument_id"]==low_risk["id"] for r in cases):
            errors.append("risk low case must be active with informational-only signals")
    forbidden=[r"\b\d{9,18}\b", r"\b[A-Z]{5}\d{4}[A-Z]\b", r"\b(?:SBIN|HDFC|ICIC|UTIB|PUNB|BARB|CNRB|UBIN|IDIB)\w*"]
    for table_name in ["institutions.csv","users.csv","instruments.csv","field_provenance.csv","field_value_history.csv","bank_confirmation_requests.csv","release_requests.csv"]:
        path=OUT/table_name
        if path.exists():
            for row in read_csv(table_name):
                joined=" ".join(row.values())
                if any(re.search(pattern,joined,re.I) for pattern in forbidden):
                    errors.append(f"possible real personal/account/bank pattern in {table_name}")
                    break
    # Every generated tabular row carries the required synthetic origin marker.
    for path in OUT.rglob("*.csv"):
        try:
            with path.open(newline="",encoding="utf-8") as handle:
                reader=csv.DictReader(handle)
                rows=list(reader)
                if rows and "data_origin" not in (reader.fieldnames or []) and path.name!="legacy_fdr_register.csv":
                    errors.append(f"missing data_origin column in {path.relative_to(OUT)}")
                for number,row in enumerate(rows,1):
                    origin=row.get("data_origin",row.get("Data Origin"))
                    if origin!="synthetic":
                        errors.append(f"row without synthetic marker in {path.relative_to(OUT)}:{number+1}")
                        break
                    for field,value in row.items():
                        if field in {"amount","maturity_value","Amt (INR)"} and value:
                            try:
                                parsed=Decimal(value)
                                if parsed.as_tuple().exponent != -2 or not re.fullmatch(r"-?\d+\.\d{2}",value):
                                    raise InvalidOperation
                            except InvalidOperation:
                                errors.append(f"invalid monetary value in {path.relative_to(OUT)}:{number+1}:{field}")
        except (OSError,csv.Error) as exc:
            errors.append(f"could not validate CSV {path.relative_to(OUT)}: {exc}")
    # The generator itself is the determinism oracle; compare all generated
    # artifacts including PDFs when the local libraries support them.
    try:
        with tempfile.TemporaryDirectory(prefix=".verify-determinism-",dir=ROOT) as temp_dir:
            generated=Path(temp_dir)/"out"
            bulk_count=len(read_csv("perf/instruments_bulk.csv")) if (OUT/"perf/instruments_bulk.csv").exists() else 0
            command=[sys.executable,str(ROOT/"generate.py"),"--seed","42","--ref-date",ref.isoformat(),"--out",str(generated)]
            if bulk_count:
                command.extend(["--bulk",str(bulk_count)])
            subprocess.run(command,check=True,capture_output=True,text=True)
            def hashes(folder: Path) -> dict[str,str]:
                return {str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob("*") if p.is_file()}
            if hashes(OUT) != hashes(generated):
                errors.append("determinism check failed: generated output hashes differ for same seed/ref-date")
            current_certs=ROOT/"certs"
            generated_certs=generated.parent/"certs"
            if current_certs.exists() and hashes(current_certs)!=hashes(generated_certs):
                errors.append("determinism check failed for certificate/signing key outputs")
    except (OSError, subprocess.CalledProcessError) as exc:
        errors.append(f"determinism check could not run: {exc}")
    return errors


def main() -> None:
    errors = verify()
    if errors:
        print("FAIL")
        for error in errors:
            print(f"- {error}")
        sys.exit(1)
    print("PASS: core institutions, users, instruments, references, buckets, links, and configuration")


if __name__ == "__main__":
    main()
