"""
Real-statement importer tests: parsing, PII exclusion (fail-closed), income
classification, and end-to-end scoring. The fixture mimics the real Saudi
retail-statement layout — bilingual header page + Date/Details/Debit/Credit/
Balance table — with FAKE identities.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from statement_import import (
    AnonStatement,
    AnonTransaction,
    assert_no_pii,
    is_self,
    score_statement,
    scrub,
)
from statement_pdf import parse_statement_text

FAKE_NAME = "SALEM KHALED OMAR AL HARBI"
FAKE_ACCOUNT = "111222333444555"
FAKE_IBAN = "SA0380000111222333444555"

HEADER_PAGE = f"""Account Statement
Ref. No 99887766
Customer Name {FAKE_NAME}
Account Number {FAKE_ACCOUNT}
IBAN Number {FAKE_IBAN}
Opening Balance 1,000.00 SAR
Number Of Deposits 6
Number Of Withdrawals 3
Total Deposits 11,013.39 SAR
Total Withdrawals 3,026.00 SAR
On The Period 2025/01/01 - 2025/03/31
City RIYADH
"""

TX_PAGE = """Ref. No 99887766
Date Transaction Details Debit Credit Balance
POS purchase Apple pay (Domestic)
2025/01/05 26.00 SAR 0.00 SAR 974.00 SAR
Time:09:15:51**Note:(1234567890123456-987654321012) Star
Cafe, RIYADH, SA
Inward IPS Credit Transfer
2025/01/10 0.00 SAR 5,000.00 SAR 5,974.00 SAR
Time:10:24:01**Note:
20250110SASTCJSTCJ1B23711023882214/DESIGN STUDIO CO
Inward IPS Credit Transfer
2025/02/03 0.00 SAR 127.00 SAR 6,101.00 SAR
Time:10:24:01**Note:
20250203SAARNBARNB1B23711023882214/SALEM AL HARBI
Internal Transfer
2025/02/15 0.00 SAR 3,000.00 SAR 9,101.00 SAR
Time:19:44:57**Note:W-/FRACCT/67100608017048719FRCLIENT
Outward IPS Credit Transfer
2025/02/20 2,000.00 SAR 0.00 SAR 7,101.00 SAR
Time:11:00:00**Note:
20250220SASTCJSTCJ1B99911023882214/AZIZ SUPPLIER
Sariee Inward Payments
2025/03/12 Time:00:32:38**Note:PAYROLL-5205618921012547- 0.00 SAR 1,000.00 SAR 8,101.00 SAR
Inward Local Payment Order
2025/03/14 Time:14:04:24**Note:Payment-LP CPMN4PJXVIRN- 0.00 SAR 1,875.00 SAR 9,976.00 SAR
SABBREM40792400KT-GULF RESEARCH INSTITUTE-
SALEM ALHARBI
Visa Payment
2025/03/18 0.00 SAR 11.39 SAR 9,987.39 SAR
Time:23:51:00**Note:W - Visa/Mastercard : Refund -
4847831234567890 - 608
POS purchase Apple pay (Domestic)
2025/03/20 1,000.00 SAR 0.00 SAR 7,101.00 SAR
Time:12:00:00**Note:(1234567890123456-111154321012) HIGH
AMBITION EST, RIYADH, SA
"""


@pytest.fixture()
def parsed():
    return parse_statement_text([HEADER_PAGE, TX_PAGE])


class TestParsing:
    def test_all_transactions_captured(self, parsed):
        stmt, _ = parsed
        assert len(stmt.transactions) == 9

    def test_totals_match_reported_summary(self, parsed):
        stmt, _ = parsed
        assert sum(t.credit for t in stmt.transactions) == pytest.approx(11013.39)
        assert sum(t.debit for t in stmt.transactions) == pytest.approx(3026.00)

    def test_wrapped_payroll_layout_parsed(self, parsed):
        stmt, _ = parsed
        payroll = [t for t in stmt.transactions if t.counterparty == "PAYROLL"]
        assert len(payroll) == 1
        assert payroll[0].credit == pytest.approx(1000.00)
        assert payroll[0].category == "INCOME"

    def test_period_and_balances(self, parsed):
        stmt, _ = parsed
        assert stmt.period_start == "2025-01-01"
        assert stmt.period_end == "2025-03-31"
        assert stmt.opening_balance == pytest.approx(1000.00)


class TestPIIExclusion:
    def test_no_pii_scan_passes(self, parsed):
        stmt, redact_terms = parsed
        assert_no_pii(stmt, redact_terms)  # must not raise

    def test_holder_identity_absent_from_output(self, parsed):
        stmt, _ = parsed
        blob = stmt.model_dump_json().upper()
        for secret in (FAKE_NAME, "HARBI", FAKE_ACCOUNT, FAKE_IBAN,
                       "DESIGN STUDIO", "AZIZ SUPPLIER", "1234567890123456"):
            assert secret.upper() not in blob, f"leaked: {secret}"

    def test_fail_closed_on_leaked_term(self, parsed):
        stmt, redact_terms = parsed
        leaky = stmt.model_copy(deep=True)
        leaky.transactions[0].counterparty = FAKE_NAME
        with pytest.raises(ValueError, match="PII leak blocked"):
            assert_no_pii(leaky, redact_terms)

    def test_fail_closed_on_digit_run(self, parsed):
        stmt, redact_terms = parsed
        leaky = stmt.model_copy(deep=True)
        leaky.transactions[0].counterparty = "REF 12345678901"
        with pytest.raises(ValueError, match="PII leak blocked"):
            assert_no_pii(leaky, redact_terms)

    def test_scrub_removes_cards_and_refs(self):
        assert "484783" not in scrub("484783******5781 : Cars on Booking")
        assert "5205618921012547" not in scrub("PAYROLL-5205618921012547")


class TestIncomeClassification:
    def test_self_transfer_detected_and_excluded(self, parsed):
        stmt, _ = parsed
        self_txs = [t for t in stmt.transactions if t.category == "SELF_TRANSFER"]
        assert len(self_txs) == 1  # SALEM AL HARBI ⊂ SALEM KHALED OMAR AL HARBI
        assert self_txs[0].credit == pytest.approx(127.00)

    def test_is_self_token_subset(self):
        assert is_self("SALEM AL HARBI", FAKE_NAME)
        assert not is_self("AZIZ SUPPLIER", FAKE_NAME)
        assert not is_self("SALEM", FAKE_NAME)  # single token — too weak

    def test_third_party_ips_is_income_with_pseudonym(self, parsed):
        stmt, _ = parsed
        income = [t for t in stmt.transactions if t.category == "INCOME" and t.credit == 5000.00]
        assert len(income) == 1
        assert income[0].counterparty.startswith("SENDER-SASTCJ-")

    def test_internal_transfer_is_p2p(self, parsed):
        stmt, _ = parsed
        p2p = [t for t in stmt.transactions if t.category == "P2P_TRANSFER"]
        assert len(p2p) == 1
        assert p2p[0].counterparty.startswith("ACCT-")

    def test_local_payment_order_is_income_with_payer_pseudonym(self, parsed):
        stmt, _ = parsed
        lpo = [t for t in stmt.transactions if t.credit == 1875.00]
        assert len(lpo) == 1
        assert lpo[0].category == "INCOME"
        assert lpo[0].counterparty.startswith("SENDER-LPO-")
        # institutional payer name must not survive anonymization
        assert "GULF RESEARCH" not in stmt.model_dump_json().upper()

    def test_visa_refund_credit_excluded_from_income(self, parsed):
        stmt, _ = parsed
        refund = [t for t in stmt.transactions if t.credit == pytest.approx(11.39)]
        assert len(refund) == 1
        assert refund[0].category == "REFUND"

    def test_diversity_counts_only_recurring_senders(self):
        # sender R pays in two months (a client); three one-off senders pool
        tx = [
            AnonTransaction(date="2025-01-10", type="Inward IPS", credit=1000,
                            counterparty="SENDER-R", category="INCOME"),
            AnonTransaction(date="2025-02-10", type="Inward IPS", credit=1000,
                            counterparty="SENDER-R", category="INCOME"),
            AnonTransaction(date="2025-01-15", type="Inward IPS", credit=500,
                            counterparty="SENDER-A", category="INCOME"),
            AnonTransaction(date="2025-02-15", type="Inward IPS", credit=500,
                            counterparty="SENDER-B", category="INCOME"),
            AnonTransaction(date="2025-03-15", type="Inward IPS", credit=500,
                            counterparty="SENDER-C", category="INCOME"),
        ]
        stmt = AnonStatement(period_start="2025-01-01", period_end="2025-03-31",
                             transactions=tx)
        ev = score_statement(stmt)["evidence"]["client_diversity"]
        assert ev["recurring_senders"] == 1
        assert ev["one_off_senders"] == 3
        assert ev["one_off_income"] == pytest.approx(1500.00)
        assert set(ev["income_shares"]) == {"SENDER-R", "ONE_OFF_SENDERS"}


class TestScoring:
    def test_end_to_end_scoring(self, parsed):
        stmt, _ = parsed
        result = score_statement(stmt)
        assert result["score"]["tier"] in ("GREEN", "YELLOW", "BUILDING")
        assert result["integrity"]["deposits_match"]
        assert result["integrity"]["withdrawals_match"]
        # four factors live, contract_verification not available on import
        ev = result["evidence"]
        for factor in ("income_stability", "client_diversity",
                       "expense_discipline", "savings_behavior"):
            assert ev[factor]["provenance"] == "COMPUTED_FROM_IMPORTED_STATEMENT"
        assert result["effective_factors"]["contract_verification"] == 0.0

    def test_self_transfers_excluded_from_income_buckets(self, parsed):
        stmt, _ = parsed
        result = score_statement(stmt)
        # Feb income = 3000 P2P only; the 127 self-transfer must not count
        assert result["monthly_buckets"]["2025-02"]["income"] == pytest.approx(3000.00)
        assert result["evidence"]["client_diversity"]["excluded_credits"]["SELF_TRANSFER"] == pytest.approx(127.00)

    def test_zero_income_statement_is_building_no_loan(self):
        stmt = AnonStatement(
            period_start="2025-01-01", period_end="2025-03-31",
            transactions=[AnonTransaction(date="2025-01-05", type="POS purchase",
                                          debit=50.0, category="EXPENSE")],
        )
        result = score_statement(stmt)
        assert result["score"]["tier"] == "BUILDING"
        assert result["score"]["loan"] is None

    def test_empty_month_counts_as_zero_income(self, parsed):
        stmt, _ = parsed
        result = score_statement(stmt)
        assert len(result["monthly_buckets"]) == 3  # Jan, Feb, Mar all present


class TestInputValidation:
    """A judge-facing endpoint must reject malformed statements — these
    mirror the hostile inputs a live audience could produce."""

    def _base(self, **overrides):
        body = {
            "period_start": "2025-01-01", "period_end": "2025-03-31",
            "transactions": [{"date": "2025-01-05", "type": "Inward IPS",
                              "credit": 100.0, "category": "INCOME"}],
        }
        body.update(overrides)
        return body

    def test_garbage_transaction_date_rejected(self):
        with pytest.raises(ValueError):
            AnonStatement(**self._base(
                transactions=[{"date": "banana", "type": "x", "credit": 100.0}]))

    def test_negative_amounts_rejected(self):
        with pytest.raises(ValueError):
            AnonStatement(**self._base(
                transactions=[{"date": "2025-01-05", "type": "x", "credit": -500.0}]))

    def test_reversed_period_rejected(self):
        with pytest.raises(ValueError, match="before period_start"):
            AnonStatement(**self._base(period_start="2025-12-01", period_end="2025-01-31"))

    def test_too_short_window_rejected(self):
        # one good month must not score as salary-grade stability
        with pytest.raises(ValueError, match="too short"):
            AnonStatement(**self._base(period_end="2025-01-31"))

    def test_three_month_window_accepted(self):
        stmt = AnonStatement(**self._base())
        assert score_statement(stmt)["score"]["tier"] in ("GREEN", "YELLOW", "BUILDING")
