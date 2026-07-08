"""
Real bank-statement importer — the "your cash flow is not simulated" answer.

Takes a consented, real account statement (parsed from PDF text by
statement_pdf.py, or posted directly as anonymized JSON) and runs it through
the SAME scoring pipeline as the demo personas. Because a real statement has
both sides of the ledger, FOUR of the five factors are computed live here
(vs two for the simulated personas):

  income_stability   — CV over zero-filled monthly income buckets
                       (same calibration bands as factor_analysis.py)
  client_diversity   — HHI over pseudonymized income sender keys
  expense_discipline — expense-to-income ratio, banded
  savings_behavior   — share of months with positive net cash flow

  contract_verification stays 0 — an imported statement carries no client
  declarations, so there is nothing for Wathq to verify yet.

Privacy is enforced AT INGESTION, not after: the anonymizer strips person
names, account numbers, card numbers, and payment references before a
transaction object is ever constructed. Sender identity survives only as a
deterministic pseudonym (needed for the diversity HHI). assert_no_pii()
re-scans the final payload and raises if any digit run or redaction term
leaked through — the import fails closed.

Income classification (what counts toward underwriting income):
  INCOME        inward IPS / SARIE / payroll credits from third parties
  P2P_TRANSFER  internal transfers received from other people
  SELF_TRANSFER credits whose sender matches the account holder — EXCLUDED
                (moving your own money between banks is not income; this is
                the anti-income-inflation control)
  CASH_DEPOSIT  ATM deposits — EXCLUDED (origin unverifiable)
  REFUND        merchant refunds/reversals — EXCLUDED (not income)
"""
from __future__ import annotations

import re
import unicodedata
import zlib
from collections import defaultdict
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from factor_analysis import stability_score_from_buckets, diversity_score_from_totals
from models import FactorScores
from scoring import calculate_score_vanc

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

INCOME_CATEGORIES = {"INCOME", "P2P_TRANSFER"}
EXCLUDED_CREDIT_CATEGORIES = {"SELF_TRANSFER", "CASH_DEPOSIT", "REFUND"}


_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Underwriting needs enough history for the volatility metric to mean
# anything — one good month must not look like salary-grade stability.
MIN_STATEMENT_MONTHS = 3


class AnonTransaction(BaseModel):
    date: str                 # ISO YYYY-MM-DD
    type: str                 # bank transaction type line (no PII by nature)
    debit: float = Field(default=0.0, ge=0)
    credit: float = Field(default=0.0, ge=0)
    counterparty: str = ""    # pseudonym (SENDER-xxxx / ACCT-xxxx) or scrubbed merchant label
    category: str = "EXPENSE"

    @field_validator("date")
    @classmethod
    def _iso_date(cls, v: str) -> str:
        if not _ISO_DATE.match(v):
            raise ValueError("transaction date must be ISO YYYY-MM-DD")
        return v


class AnonStatement(BaseModel):
    period_start: str
    period_end: str
    currency: str = "SAR"
    opening_balance: float = 0.0
    # Summary figures printed on the statement itself — used as an
    # integrity check that the parser captured every transaction.
    reported_total_deposits: Optional[float] = None
    reported_total_withdrawals: Optional[float] = None
    transactions: list[AnonTransaction]
    # Silver-layer provenance from the medallion pipeline — counts only,
    # written by statement_pdf.py; never contains names or identifiers.
    silver_meta: Optional[dict] = None

    @field_validator("period_start", "period_end")
    @classmethod
    def _iso_period(cls, v: str) -> str:
        if not _ISO_DATE.match(v):
            raise ValueError("period dates must be ISO YYYY-MM-DD")
        return v

    @model_validator(mode="after")
    def _valid_window(self) -> "AnonStatement":
        if self.period_end < self.period_start:
            raise ValueError("period_end is before period_start")
        months = (
            (int(self.period_end[:4]) - int(self.period_start[:4])) * 12
            + int(self.period_end[5:7]) - int(self.period_start[5:7]) + 1
        )
        if months < MIN_STATEMENT_MONTHS:
            raise ValueError(
                f"statement window too short for underwriting: {months} month(s), "
                f"minimum {MIN_STATEMENT_MONTHS} — volatility cannot be assessed"
            )
        return self


# ---------------------------------------------------------------------------
# Anonymization primitives (used by statement_pdf.py during parsing)
# ---------------------------------------------------------------------------

_DIGIT_RUN = re.compile(r"\d{7,}")
_MASKED_CARD = re.compile(r"\d{4,6}\*+\d{2,4}")


def scrub(text: str) -> str:
    """Remove anything that could identify a person or account from free text:
    long digit runs (accounts, cards, payment refs) and masked card numbers."""
    text = _MASKED_CARD.sub("‹card›", text)
    text = _DIGIT_RUN.sub("‹ref›", text)
    return text.strip()


def pseudonym(prefix: str, identifier: str) -> str:
    """Deterministic, non-reversible sender key. crc32 (not hash()) so the
    same sender maps to the same key across restarts — same reasoning as
    the simulation seeds."""
    return f"{prefix}-{zlib.crc32(identifier.strip().upper().encode()) % 100000:05d}"


_VOWELS = re.compile(r"[AEIOU]")
# keep Latin letters + the base Arabic block (0621–064A) + spaces; everything
# else (digits, punctuation, presentation-form glyphs post-fold) becomes space
_NON_ALPHA = re.compile(r"[^A-Zء-ي ]")
_TATWEEL = "ـ"  # Arabic elongation char — cosmetic, carries no identity
# Arabic diacritics (harakat) — strip so vowelled/unvowelled spellings match
_HARAKAT = re.compile(r"[ً-ْ]")
# Legal-entity form suffixes ONLY — these are corporate registration forms,
# never distinguishing (CO/COMPANY, EST/ESTABLISHMENT are the same entity).
# Descriptive words (TRADING, PAYMENTS, GROUP, HOLDING, …) are deliberately
# NOT here: they CAN distinguish real companies ("SAUDI TRADING" is not
# "SAUDI HOLDING"), so dropping them would silently over-merge.
_LEGAL_SUFFIXES = {
    "BV", "CO", "LLC", "EST", "LTD", "INC", "COMPANY", "CORP", "PJSC",
    "SPC", "ESTABLISHMENT", "LLP", "WLL",
}
_NAME_PREFIXES = {"AL", "EL", "BIN", "IBN", "ABU"}


def _fold(text: str) -> str:
    """Script-fold a raw narration name into a canonical comparison form.
    pdfplumber emits Arabic as presentation-form glyphs (U+FB50–U+FEFF);
    NFKC folds those back into the base Arabic block so Arabic names produce
    real tokens instead of being stripped to nothing. Latin is upper-cased."""
    text = unicodedata.normalize("NFKC", text).replace(_TATWEEL, "")
    text = _HARAKAT.sub("", text)
    return text.upper()


def _skeleton(token: str) -> str:
    """Consonant skeleton of a Latin name token, transliteration-tolerant:
    MOHAMMED / MOHAMMAD / MOHAMED all become 'MHMD'; the AL/EL prefix is
    dropped so ALHARBI and 'AL HARBI' collapse to the same skeleton. Used
    ONLY for self-matching against the known holder name — deliberately
    lossy, so never used for general entity clustering (see resolve_entities)."""
    token = token.upper()
    for prefix in ("AL", "EL"):
        if token.startswith(prefix) and len(token) > len(prefix) + 2:
            token = token[len(prefix):]
    skeleton = _VOWELS.sub("", token)
    # collapse doubled consonants (HASSAN/HASAN → HSN)
    return re.sub(r"(.)\1+", r"\1", skeleton)


def normalize_name(name: str) -> list[str]:
    """Significant name tokens: script-folded, letters-only, with legal
    suffixes and name particles dropped. Works for Latin and Arabic."""
    cleaned = _NON_ALPHA.sub(" ", _fold(name))
    return [
        tok for tok in cleaned.split()
        if len(tok) >= 2 and tok not in _LEGAL_SUFFIXES and tok not in _NAME_PREFIXES
    ]


def is_self(sender_name: str, holder_name: str) -> bool:
    """True when the credit sender is the account holder (e.g. a transfer
    from their own account at another bank, possibly under a spelling
    variant: SALIM ALHARBI vs SALEM KHALED OMAR AL HARBI). Matches on
    consonant skeletons so transliteration and concatenation differences
    don't hide a self-transfer; requires ≥2 distinct token matches so a
    shared first name alone never triggers it."""
    sender_tokens = normalize_name(sender_name)
    holder_tokens = normalize_name(holder_name)
    if len(sender_tokens) < 2 or len(holder_tokens) < 2:
        return False
    holder_skeletons = {_skeleton(t) for t in holder_tokens}
    matches = {_skeleton(t) for t in sender_tokens} & holder_skeletons
    return len(matches) >= 2


def entity_key(name: str) -> str | None:
    """Canonical identity key = the full SET of significant name tokens
    (order-independent). Returns None when nothing significant survives.

    This is the fix for silent over-projection. Keying on a single token
    (or a lossy skeleton) merged different counterparties that merely shared
    a first name — 'AHMED ALI' and 'AHMED HASSAN', or 'SAUDI TELECOM' and
    'SAUDI AIRLINES' — collapsing distinct clients into one and understating
    diversity. Requiring the WHOLE token set to match keeps them apart while
    still merging pure legal-suffix / spacing / presentation-form variants
    of the same entity ('DESIGN STUDIO CO' == 'DESIGN STUDIO COMPANY')."""
    tokens = normalize_name(name)
    return " ".join(sorted(set(tokens))) if tokens else None


def resolve_entities(raw_names: list[str]) -> dict[str, str]:
    """Silver-layer entity resolution: map every raw sender name to ONE
    canonical entity pseudonym, so narration variants of the same
    counterparty cannot masquerade as separate clients. Names that resolve
    to no significant tokens fall back to their raw string (identical raws
    still merge; distinct unknowns stay distinct — never fake-concentrated).
    Returns {raw_name: entity_pseudonym}; names never leave this process."""
    mapping: dict[str, str] = {}
    for raw in raw_names:
        key = entity_key(raw)
        anchor = key if key is not None else "RAW:" + _fold(raw).strip()
        mapping[raw] = pseudonym("ENTITY", anchor)
    return mapping


def assert_no_pii(statement: AnonStatement, redact_terms: list[str]) -> None:
    """Fail-closed re-scan of the finished payload. Raises ValueError if any
    redaction term (holder name tokens, account number, IBAN) or long digit
    run survived anonymization."""
    blob = statement.model_dump_json()
    for term in redact_terms:
        term = term.strip()
        if len(term) >= 4 and term.upper() in blob.upper():
            raise ValueError(f"PII leak blocked: redaction term found in output ({term[:2]}…)")
    for tx in statement.transactions:
        for field in (tx.type, tx.counterparty):
            if _DIGIT_RUN.search(field):
                raise ValueError("PII leak blocked: long digit run in transaction text")


# ---------------------------------------------------------------------------
# Factor derivation — four factors live from one real statement
# ---------------------------------------------------------------------------

# (expense-to-income ratio, score) anchors — piecewise-linear, same style as
# the CV bands. Spending ≤50% of income is disciplined; ≥120% is untenable.
EXPENSE_RATIO_BANDS = [(0.50, 90), (0.70, 72), (0.85, 55), (1.00, 35), (1.20, 15)]


def _banded(value: float, bands: list[tuple[float, float]]) -> float:
    if value <= bands[0][0]:
        return bands[0][1]
    for (x1, y1), (x2, y2) in zip(bands, bands[1:]):
        if value <= x2:
            return y1 + (y2 - y1) * (value - x1) / (x2 - x1)
    return bands[-1][1]


def _month_key(iso_date: str) -> str:
    return iso_date[:7]


def monthly_buckets(statement: AnonStatement) -> dict[str, dict[str, float]]:
    """Per-month {income, expenses} over the statement period, zero-filled
    so income gaps stay visible to the volatility metric."""
    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})
    for tx in statement.transactions:
        m = _month_key(tx.date)
        if tx.credit > 0 and tx.category in INCOME_CATEGORIES:
            buckets[m]["income"] += tx.credit
        if tx.debit > 0:
            buckets[m]["expenses"] += tx.debit

    # zero-fill every month in the period
    start, end = statement.period_start[:7], statement.period_end[:7]
    y, mo = int(start[:4]), int(start[5:7])
    while f"{y:04d}-{mo:02d}" <= end:
        buckets.setdefault(f"{y:04d}-{mo:02d}", {"income": 0.0, "expenses": 0.0})
        mo += 1
        if mo > 12:
            mo, y = 1, y + 1
    return dict(sorted(buckets.items()))


def derive_statement_factors(statement: AnonStatement) -> tuple[FactorScores, dict]:
    """Factor set + per-factor evidence, mirroring factor_analysis.derive_factors
    but sourced entirely from the imported statement."""
    buckets = monthly_buckets(statement)
    income_by_month = [int(v["income"]) for v in buckets.values()]

    stability_score, stability_ev = stability_score_from_buckets(income_by_month)

    per_sender: dict[str, float] = defaultdict(float)
    sender_months: dict[str, set] = defaultdict(set)
    excluded: dict[str, float] = defaultdict(float)
    for tx in statement.transactions:
        if tx.credit > 0:
            if tx.category in INCOME_CATEGORIES:
                key = tx.counterparty or "UNKNOWN"
                per_sender[key] += tx.credit
                sender_months[key].add(_month_key(tx.date))
            else:
                excluded[tx.category] += tx.credit

    # A "client" is a RECURRING payment relationship (income in ≥2 distinct
    # months). One-off senders are real income but not client relationships —
    # they pool into a single bucket so 40 small transfers can't masquerade
    # as 40 clients and inflate the diversity score.
    recurring: dict[str, float] = {}
    one_off_total = 0.0
    for key, amount in per_sender.items():
        if len(sender_months[key]) >= 2:
            recurring[key] = amount
        else:
            one_off_total += amount
    hhi_input = dict(recurring)
    if one_off_total > 0:
        hhi_input["ONE_OFF_SENDERS"] = one_off_total
    diversity_score, diversity_ev = diversity_score_from_totals(hhi_input)
    diversity_ev = {
        "entity_resolution": "senders are entity-resolved in the silver layer — "
                             "narration variants and multi-rail payments of the "
                             "same counterparty count as ONE client",
        "recurrence_rule": "a client = income from the same sender in ≥2 distinct "
                           "months; one-off senders pooled into ONE_OFF_SENDERS",
        "recurring_senders": len(recurring),
        "one_off_senders": sum(1 for k in per_sender if k not in recurring),
        "one_off_income": round(one_off_total, 2),
        **diversity_ev,
    }

    total_income = sum(v["income"] for v in buckets.values())
    total_expenses = sum(v["expenses"] for v in buckets.values())
    if total_income > 0:
        expense_ratio = total_expenses / total_income
        expense_score = round(_banded(expense_ratio, EXPENSE_RATIO_BANDS), 1)
    else:
        expense_ratio = None
        expense_score = 0.0

    months = list(buckets.values())
    positive_months = sum(1 for v in months if v["income"] - v["expenses"] > 0)
    savings_score = round(15 + 80 * positive_months / len(months), 1) if months else 0.0

    factors = FactorScores(
        expense_discipline=expense_score,
        income_stability=stability_score,
        client_diversity=diversity_score,
        savings_behavior=savings_score,
        contract_verification=0.0,
    )
    evidence = {
        "income_stability": {"provenance": "COMPUTED_FROM_IMPORTED_STATEMENT", **stability_ev},
        "client_diversity": {
            "provenance": "COMPUTED_FROM_IMPORTED_STATEMENT",
            "excluded_credits": {k: round(v, 2) for k, v in excluded.items()},
            "exclusion_note": "Self-transfers, cash deposits, and refunds are "
                              "excluded from income — anti-income-inflation control.",
            **diversity_ev,
        },
        "expense_discipline": {
            "provenance": "COMPUTED_FROM_IMPORTED_STATEMENT",
            "method": "expense_to_income_ratio",
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "ratio": round(expense_ratio, 3) if expense_ratio is not None else None,
            "score": expense_score,
        },
        "savings_behavior": {
            "provenance": "COMPUTED_FROM_IMPORTED_STATEMENT",
            "method": "positive_net_cashflow_months",
            "positive_months": positive_months,
            "window_months": len(months),
            "score": savings_score,
        },
        "contract_verification": {
            "provenance": "NOT_AVAILABLE_FOR_IMPORT",
            "score": 0.0,
            "note": "Imported statement carries no client declarations — "
                    "Wathq CR verification happens at onboarding.",
        },
    }
    return factors, evidence


def score_statement(statement: AnonStatement) -> dict:
    """Full assessment of an imported statement: 4 live factors + VANC score
    + integrity check against the statement's own printed summary."""
    factors, evidence = derive_statement_factors(statement)
    buckets = monthly_buckets(statement)
    income_by_month = [int(v["income"]) for v in buckets.values()]
    score = calculate_score_vanc(factors, income_by_month)

    parsed_deposits = round(sum(t.credit for t in statement.transactions), 2)
    parsed_withdrawals = round(sum(t.debit for t in statement.transactions), 2)
    integrity = {
        "parsed_total_deposits": parsed_deposits,
        "reported_total_deposits": statement.reported_total_deposits,
        "parsed_total_withdrawals": parsed_withdrawals,
        "reported_total_withdrawals": statement.reported_total_withdrawals,
        "deposits_match": (
            statement.reported_total_deposits is not None
            and abs(parsed_deposits - statement.reported_total_deposits) < 1.0
        ),
        "withdrawals_match": (
            statement.reported_total_withdrawals is not None
            and abs(parsed_withdrawals - statement.reported_total_withdrawals) < 1.0
        ),
    }

    return {
        "source": "IMPORTED_REAL_STATEMENT",
        "anonymization": "PII stripped at ingestion — names, accounts, cards, refs. "
                         "Senders survive only as deterministic pseudonyms.",
        # Medallion pipeline provenance: bronze (raw, in-memory only) →
        # silver (anonymized + entity-resolved) → gold (factor derivation).
        "pipeline": {
            "bronze": {
                "stage": "RAW_PARSE",
                "persisted": False,
                "note": "Raw PDF text parsed in-memory; PII never written anywhere.",
            },
            "silver": statement.silver_meta or {
                "stage": "CLEANED_ANONYMIZED",
                "note": "Statement was posted pre-anonymized; silver metadata "
                        "available when ingested via statement_pdf.py.",
            },
            "gold": {
                "stage": "SCORED",
                "factors_computed_live": 4,
                "engine": "VANC",
            },
        },
        "period": {"start": statement.period_start, "end": statement.period_end},
        "transaction_count": len(statement.transactions),
        "monthly_buckets": {
            k: {"income": round(v["income"], 2), "expenses": round(v["expenses"], 2)}
            for k, v in buckets.items()
        },
        "effective_factors": factors.model_dump(),
        "evidence": evidence,
        "score": score.model_dump(),
        "integrity": integrity,
    }
