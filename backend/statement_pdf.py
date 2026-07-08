"""
PDF bank-statement parser + anonymizer.

Converts a real account-statement PDF (the common Saudi retail format:
bilingual header page, then a Date / Details / Debit / Credit / Balance
table) into an AnonStatement — with all PII stripped during parsing, before
any transaction object exists. The raw PDF is read, never copied; the only
artifact this module produces is the anonymized JSON.

What is removed: account holder name, account number, IBAN, national
address, person names in transfer narrations (Latin and Arabic), card
numbers, account numbers inside FRACCT refs, and every payment reference.
What survives: dates, amounts, transaction types, scrubbed merchant labels,
and deterministic sender pseudonyms (required for the diversity HHI).

CLI (offline, before demo day):
    python statement_pdf.py "<statement.pdf>" -o anonymized.json

The output is safe to feed to POST /import-statement — and import fails
closed (assert_no_pii) if anything identifying survived.
"""
from __future__ import annotations

import json
import re
import sys

from statement_import import (
    AnonStatement,
    AnonTransaction,
    assert_no_pii,
    is_self,
    pseudonym,
    resolve_entities,
    scrub,
)

# --- line patterns -----------------------------------------------------------

_TX_ANCHOR = re.compile(r"^(\d{4}/\d{2}/\d{2})\s+(.*)$")
_AMOUNT = re.compile(r"([\d,]+\.\d{2})\s*SAR")
_HEADER_LINES = ("Ref. No", "Date Transaction Details")
_ARABIC = re.compile(r"[؀-ۿ]")

# header-page fields
_FIELD = {
    "name": re.compile(r"Customer Name\s+(.+)"),
    "account": re.compile(r"Account Number\s+(\d+)"),
    "iban": re.compile(r"IBAN Number\s+(\S+)"),
    "opening": re.compile(r"Opening Balance\s+([\d,]+\.\d{2})"),
    "deposits": re.compile(r"Total Deposits\s+([\d,]+\.\d{2})"),
    "withdrawals": re.compile(r"Total Withdrawals\s+([\d,]+\.\d{2})"),
    "period": re.compile(r"On The Period\s+(\d{4}/\d{2}/\d{2})\s*-\s*(\d{4}/\d{2}/\d{2})"),
}

# note narration patterns
_IPS_SENDER = re.compile(r"\d{8}([A-Z]{6})[A-Z0-9]+/(.+)$")          # ...SASTCJ.../SENDER NAME
_FRACCT = re.compile(r"FRACCT/(\d+)")                                 # internal transfer source acct
_FRACCT_NAME = re.compile(r"FRACCT/(\d+)FR(\S+)")                     # source acct + sender display name
_MERCHANT_NOTE = re.compile(r"Note:\(\d+-\d+\)\s*(.*)$")              # POS/online: (card-ref) Merchant
_ELEC_MERCHANT = re.compile(r"Note:.*?:\s*(.+)$")                     # Elec. credit: card : Merchant
_LPO_PAYER = re.compile(r"REM\d+[A-Z]{2}-([^-]+)")                    # payment order: REM<ref>XX-PAYER NAME-


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def _iso(d: str) -> str:
    return d.replace("/", "-")


def _extract_credit_identity(tx_type: str, note: str) -> tuple[str, str | None]:
    """Bronze→silver identity extraction for a credit: (kind, raw_identity).
    kind decides the category; raw_identity (a sender name or account
    number) feeds entity resolution and NEVER leaves the process."""
    t = tx_type.lower()

    if "PAYROLL" in note.upper():
        return "PAYROLL", None
    if "atm deposit" in t:
        return "CASH_DEPOSIT", None
    if "refund" in t or "refund" in note.lower():
        return "REFUND", None
    if "elec. credit" in t:
        return "REFUND", None

    if "local payment order" in t or "Payment-LP" in note:
        # institutional remittance (university/employer payment order):
        # payer name follows the REM ref
        m = _LPO_PAYER.search(note)
        return "NAMED_SENDER", (m.group(1).strip() if m else note)

    m = _IPS_SENDER.search(note)
    if m and ("ips" in t or "sariee" in t or "sarie" in t or "credit" in t):
        return "NAMED_SENDER", m.group(2).strip()

    m = _FRACCT_NAME.search(note)
    if m:  # internal transfer: prefer the sender display name (merges the
        # same person across accounts); fall back to the account number
        name = m.group(2).strip()
        return "P2P", (name if len(name) >= 2 else m.group(1))
    m = _FRACCT.search(note)
    if m:
        return "P2P", m.group(1)

    return "UNKNOWN", (note or tx_type)


def _classify_debit(tx_type: str, note: str) -> tuple[str, str]:
    t = tx_type.lower()
    if "charges" in t or "fees" in t or "markup" in t:
        return "BANK-FEES", "FEES"
    if "atm withdrawal" in t:
        return "CASH-WITHDRAWAL", "EXPENSE"
    if "transfer" in t:
        m = _FRACCT.search(note)
        if m:
            return pseudonym("ACCT", m.group(1)), "TRANSFER_OUT"
        m = _IPS_SENDER.search(note)
        if m:
            return pseudonym(f"PARTY-{m.group(1)}", m.group(2)), "TRANSFER_OUT"
        return "TRANSFER-OUT", "TRANSFER_OUT"
    m = _MERCHANT_NOTE.search(note)
    if m:
        merchant = scrub(_ARABIC.sub("", m.group(1)))
        return merchant or "MERCHANT", "EXPENSE"
    return "MERCHANT", "EXPENSE"


def parse_statement_text(pages_text: list[str]) -> tuple[AnonStatement, list[str]]:
    """Parse extracted page texts into an anonymized statement.
    Returns (statement, redact_terms) — the caller MUST pass redact_terms to
    assert_no_pii(); they never leave this process."""
    header = pages_text[0]
    fields = {k: rx.search(header) for k, rx in _FIELD.items()}
    holder_name = fields["name"].group(1).strip() if fields["name"] else ""
    period = fields["period"]

    redact_terms = []
    if holder_name:
        redact_terms.append(holder_name)
        redact_terms.extend(tok for tok in holder_name.split() if len(tok) >= 4)
    for key in ("account", "iban"):
        if fields[key]:
            redact_terms.append(fields[key].group(1))

    # ── BRONZE: raw parse — records exist only inside this function ──────
    bronze: list[dict] = []
    prev_line = ""
    pending: dict | None = None  # anchor waiting for its amounts / note lines

    def _finish(p: dict):
        bronze.append({
            "date": _iso(p["date"]),
            "type": p["type"],
            "debit": p["debit"],
            "credit": p["credit"],
            "note": " ".join(p["note_lines"]),
        })

    for page in pages_text[1:]:
        for raw in page.split("\n"):
            line = raw.strip()
            if not line or line.startswith(_HEADER_LINES) or line.isdigit():
                continue

            anchor = _TX_ANCHOR.match(line)
            if anchor:
                if pending:
                    _finish(pending)
                    pending = None
                rest = anchor.group(2)
                amounts = _AMOUNT.findall(rest)
                pending = {
                    "date": anchor.group(1),
                    "type": prev_line,
                    "debit": _num(amounts[0]) if len(amounts) >= 2 else 0.0,
                    "credit": _num(amounts[1]) if len(amounts) >= 2 else 0.0,
                    "note_lines": [_AMOUNT.sub("", rest)] if len(amounts) >= 2 else [],
                    "need_amounts": len(amounts) < 2,
                }
            elif pending:
                if pending["need_amounts"]:
                    amounts = _AMOUNT.findall(line)
                    if len(amounts) >= 2:
                        pending["debit"], pending["credit"] = _num(amounts[0]), _num(amounts[1])
                        pending["need_amounts"] = False
                        pending["note_lines"].append(_AMOUNT.sub("", line))
                elif not pending.get("closed"):
                    # a digit-free, comma-free line that isn't a Time/Note
                    # continuation is the NEXT transaction's type line — stop
                    # capturing so it doesn't pollute this note/merchant label
                    if (not any(c.isdigit() for c in line)
                            and "," not in line
                            and not line.startswith("Time:")):
                        pending["closed"] = True
                    else:
                        pending["note_lines"].append(line)
            prev_line = line
    if pending:
        _finish(pending)

    # ── SILVER: entity resolution + anonymization + categorization ───────
    def _redact_names(label: str) -> str:
        # merchant labels can coincidentally contain holder-name tokens
        # (e.g. a store named after a person) — over-redact rather than leak
        for term in redact_terms:
            label = re.sub(re.escape(term), "‹name›", label, flags=re.IGNORECASE)
        return label

    # pass 1 — extract every credit's raw identity, then resolve entities
    # across ALL of them so narration variants of the same counterparty
    # collapse into one pseudonym before anything is emitted
    named_idents: list[str] = []
    for r in bronze:
        if r["credit"] > 0:
            kind, ident = _extract_credit_identity(r["type"], r["note"])
            r["kind"], r["ident"] = kind, ident
            if kind in ("NAMED_SENDER", "P2P") and ident:
                named_idents.append(ident)
    entity_map = resolve_entities(named_idents)
    # Self-transfers all belong to ONE person — the account holder — even
    # across spelling variants (SALEM AL HARBI / SALIM ALHARBI). is_self uses
    # a lossy skeleton so it catches those variants; entity_map keys them
    # strictly, so the variants get DIFFERENT entity ids. Collapse every
    # self-flagged entity id here so the holder counts as a single entity and
    # is never mistaken for multiple income sources.
    self_entities = {
        entity_map[ident] for ident in named_idents if is_self(ident, holder_name)
    }

    KIND_LABELS = {
        "PAYROLL": ("PAYROLL", "INCOME"),
        "CASH_DEPOSIT": ("CASH-DEPOSIT", "CASH_DEPOSIT"),
        "REFUND": ("MERCHANT-REFUND", "REFUND"),
    }

    # pass 2 — emit anonymized transactions
    transactions: list[AnonTransaction] = []
    for r in bronze:
        if r["credit"] > 0:
            kind, ident = r["kind"], r["ident"]
            if kind in KIND_LABELS:
                counterparty, category = KIND_LABELS[kind]
            elif kind in ("NAMED_SENDER", "P2P") and ident:
                entity = entity_map[ident]
                if entity in self_entities:
                    counterparty, category = "SELF-TRANSFER", "SELF_TRANSFER"
                else:
                    counterparty = entity
                    category = "INCOME" if kind == "NAMED_SENDER" else "P2P_TRANSFER"
            else:  # UNKNOWN — distinct pseudonym per source, still income
                counterparty, category = pseudonym("UNVERIFIED", ident or r["type"]), "INCOME"
        else:
            counterparty, category = _classify_debit(r["type"], r["note"])
        transactions.append(AnonTransaction(
            date=r["date"],
            type=scrub(_ARABIC.sub("", r["type"])) or "UNKNOWN",
            debit=r["debit"],
            credit=r["credit"],
            counterparty=_redact_names(counterparty),
            category=category,
        ))

    # Count DISTINCT true entities: every self-flagged variant collapses to
    # the single account holder; income entities are the rest. Merges = raw
    # narration names seen minus true entities they resolved to.
    distinct_raws = len(set(named_idents))
    income_entities = {
        entity_map[i] for i in named_idents if entity_map[i] not in self_entities
    }
    holder_count = 1 if self_entities else 0
    true_entities = len(income_entities) + holder_count
    silver_meta = {
        "stage": "CLEANED_ANONYMIZED_ENTITY_RESOLVED",
        "raw_sender_names": distinct_raws,
        "entities_resolved": true_entities,
        "name_variants_merged": distinct_raws - true_entities,
        "self_transfer_entities": holder_count,
        "rail_fragmentation": "eliminated — entities are keyed by counterparty "
                              "identity, never by bank or payment rail",
        "pii_scan": "FAIL_CLOSED_ENFORCED",
    }

    statement = AnonStatement(
        period_start=_iso(period.group(1)) if period else (transactions[0].date if transactions else ""),
        period_end=_iso(period.group(2)) if period else (transactions[-1].date if transactions else ""),
        opening_balance=_num(fields["opening"].group(1)) if fields["opening"] else 0.0,
        reported_total_deposits=_num(fields["deposits"].group(1)) if fields["deposits"] else None,
        reported_total_withdrawals=_num(fields["withdrawals"].group(1)) if fields["withdrawals"] else None,
        transactions=transactions,
        silver_meta=silver_meta,
    )
    return statement, redact_terms


def parse_statement_pdf(pdf_path: str) -> AnonStatement:
    """PDF → anonymized statement, PII-scan enforced. pdfplumber is imported
    lazily so the backend runs without it (JSON import path needs no PDF lib)."""
    import pdfplumber  # noqa: PLC0415 — optional dependency, only for PDF ingestion

    with pdfplumber.open(pdf_path) as pdf:
        pages_text = [page.extract_text() or "" for page in pdf.pages]
    statement, redact_terms = parse_statement_text(pages_text)
    assert_no_pii(statement, redact_terms)
    return statement


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Anonymize a bank-statement PDF for Mihan import")
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", default="anonymized_statement.json")
    args = ap.parse_args()

    stmt = parse_statement_pdf(args.pdf)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(stmt.model_dump(), f, ensure_ascii=False, indent=2)
    deposits = sum(t.credit for t in stmt.transactions)
    withdrawals = sum(t.debit for t in stmt.transactions)
    print(f"OK — {len(stmt.transactions)} transactions, {stmt.period_start} → {stmt.period_end}")
    print(f"parsed deposits {deposits:,.2f} (reported {stmt.reported_total_deposits}) | "
          f"withdrawals {withdrawals:,.2f} (reported {stmt.reported_total_withdrawals})")
    print(f"PII scan passed → {args.out}", file=sys.stderr)
