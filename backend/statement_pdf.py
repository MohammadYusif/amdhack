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

from statement_import import AnonStatement, AnonTransaction, assert_no_pii, is_self, pseudonym, scrub

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
_MERCHANT_NOTE = re.compile(r"Note:\(\d+-\d+\)\s*(.*)$")              # POS/online: (card-ref) Merchant
_ELEC_MERCHANT = re.compile(r"Note:.*?:\s*(.+)$")                     # Elec. credit: card : Merchant
_LPO_PAYER = re.compile(r"REM\d+[A-Z]{2}-([^-]+)")                    # payment order: REM<ref>XX-PAYER NAME-


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def _iso(d: str) -> str:
    return d.replace("/", "-")


def _classify_credit(tx_type: str, note: str, holder_name: str) -> tuple[str, str]:
    """(counterparty_pseudonym_or_label, category) for a credit — built ONLY
    from derived values, never from raw note text."""
    t = tx_type.lower()

    if "PAYROLL" in note.upper():
        return "PAYROLL", "INCOME"

    if "atm deposit" in t:
        return "CASH-DEPOSIT", "CASH_DEPOSIT"

    if "refund" in t or "refund" in note.lower():
        return "MERCHANT-REFUND", "REFUND"

    if "local payment order" in t or "Payment-LP" in note:
        # institutional remittance (e.g. university/employer payment order):
        # payer name follows the REM ref — pseudonymize like any sender
        m = _LPO_PAYER.search(note)
        payer = m.group(1).strip() if m else note
        if is_self(payer, holder_name):
            return "SELF-LPO", "SELF_TRANSFER"
        return pseudonym("SENDER-LPO", payer), "INCOME"

    m = _IPS_SENDER.search(note)
    if m and ("ips" in t or "sariee" in t or "sarie" in t or "credit" in t):
        bank_code, sender = m.group(1), m.group(2).strip()
        if is_self(sender, holder_name):
            return f"SELF-{bank_code}", "SELF_TRANSFER"
        return pseudonym(f"SENDER-{bank_code}", sender), "INCOME"

    m = _FRACCT.search(note)
    if m:  # internal transfer received from another account at the same bank
        return pseudonym("ACCT", m.group(1)), "P2P_TRANSFER"

    if "elec. credit" in t:
        m = _ELEC_MERCHANT.search(note)
        return scrub(m.group(1)) if m else "MERCHANT", "REFUND"

    # unclassified credit: keep as income but give each distinct source its
    # own pseudonym so it can't merge into one fake "sender" in the HHI
    return pseudonym("UNVERIFIED", note or tx_type), "INCOME"


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

    transactions: list[AnonTransaction] = []
    prev_line = ""
    pending: dict | None = None  # anchor waiting for its amounts / note lines

    def _redact_names(label: str) -> str:
        # merchant labels can coincidentally contain holder-name tokens
        # (e.g. a store named after a person) — over-redact rather than leak
        for term in redact_terms:
            label = re.sub(re.escape(term), "‹name›", label, flags=re.IGNORECASE)
        return label

    def _finish(p: dict):
        note = " ".join(p["note_lines"])
        tx_type = scrub(_ARABIC.sub("", p["type"])) or "UNKNOWN"
        if p["credit"] > 0:
            counterparty, category = _classify_credit(p["type"], note, holder_name)
        else:
            counterparty, category = _classify_debit(p["type"], note)
        counterparty = _redact_names(counterparty)
        transactions.append(AnonTransaction(
            date=_iso(p["date"]),
            type=tx_type,
            debit=p["debit"],
            credit=p["credit"],
            counterparty=counterparty,
            category=category,
        ))

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

    statement = AnonStatement(
        period_start=_iso(period.group(1)) if period else (transactions[0].date if transactions else ""),
        period_end=_iso(period.group(2)) if period else (transactions[-1].date if transactions else ""),
        opening_balance=_num(fields["opening"].group(1)) if fields["opening"] else 0.0,
        reported_total_deposits=_num(fields["deposits"].group(1)) if fields["deposits"] else None,
        reported_total_withdrawals=_num(fields["withdrawals"].group(1)) if fields["withdrawals"] else None,
        transactions=transactions,
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
