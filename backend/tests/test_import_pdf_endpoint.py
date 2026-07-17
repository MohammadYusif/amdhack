"""
POST /import-statement-pdf: the direct-PDF upload path. Builds a synthetic
Saudi-format statement PDF with fpdf2 (FAKE identities), uploads it through
the real multipart endpoint, and asserts the in-memory anonymizer holds the
same guarantees as the offline CLI — no holder name or account digits in the
response, scoring intact, garbage rejected.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from fpdf import FPDF

import main
from statement_pdf import parse_statement_pdf_bytes

FAKE_NAME = "AHMED SAAD ALQAHTANI"
FAKE_ACCOUNT = "1234567890123"

HEADER_LINES = [
    "Account Statement",
    f"Customer Name {FAKE_NAME}",
    f"Account Number {FAKE_ACCOUNT}",
    "IBAN Number SA0380000000601234567890",
    "Opening Balance 2,500.00",
    "Total Deposits 33,000.00",
    "Total Withdrawals 12,600.00",
    "On The Period 2025/01/01 - 2025/06/30",
]


def _build_pdf() -> bytes:
    pdf = FPDF()
    pdf.set_font("helvetica", size=10)
    pdf.add_page()
    for line in HEADER_LINES:
        pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")
    pdf.add_page()
    for i, m in enumerate(["01", "02", "03", "04", "05", "06"]):
        rows = [
            ("Inward IPS Credit Transfer", f"2025/{m}/05", "0.00", "4,000.00",
             f"Note: 2025{m}05SASTCJSTCJ1B2371102388221{i}/DESIGN CLIENT ONE"),
            ("Inward IPS Credit Transfer", f"2025/{m}/12", "0.00", "1,500.00",
             f"Note: 2025{m}12SASTCJSTCJ1B2371102388222{i}/MARKETING AGENCY LLC"),
            ("POS purchase Apple pay (Domestic)", f"2025/{m}/15", "1,800.00", "0.00",
             "Note:(1234567890123456-987654321012) PANDA RETAIL"),
            ("ATM Withdrawal", f"2025/{m}/20", "300.00", "0.00", "Time: 14:22"),
        ]
        for ttype, date, debit, credit, note in rows:
            pdf.cell(0, 5, ttype, new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 5, f"{date} {debit} SAR {credit} SAR", new_x="LMARGIN", new_y="NEXT")
            pdf.cell(0, 5, note, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


@pytest.fixture(scope="module")
def pdf_bytes() -> bytes:
    return _build_pdf()


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(main.app)


class TestParserBytes:
    def test_parses_in_memory(self, pdf_bytes):
        stmt = parse_statement_pdf_bytes(pdf_bytes)
        assert len(stmt.transactions) == 24
        assert stmt.period_start == "2025-01-01"
        assert stmt.period_end == "2025-06-30"

    def test_no_holder_pii_survives(self, pdf_bytes):
        stmt = parse_statement_pdf_bytes(pdf_bytes)
        blob = stmt.model_dump_json().upper()
        for token in (*FAKE_NAME.split(), FAKE_ACCOUNT):
            assert token not in blob


class TestEndpoint:
    def test_scores_uploaded_pdf(self, client, pdf_bytes):
        r = client.post(
            "/import-statement-pdf",
            files={"file": ("stmt.pdf", pdf_bytes, "application/pdf")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["score"]["tier"] in ("GREEN", "YELLOW", "BUILDING")
        assert body["integrity"]["deposits_match"] is True
        assert body["transaction_count"] == 24

    def test_returns_anonymized_statement_for_live_regen(self, client, pdf_bytes):
        r = client.post(
            "/import-statement-pdf",
            files={"file": ("stmt.pdf", pdf_bytes, "application/pdf")},
        )
        anon = r.json()["anonymized_statement"]
        assert len(anon["transactions"]) == 24
        # the returned statement must be re-submittable through the JSON path
        r2 = client.post("/import-statement", json=anon)
        assert r2.status_code == 200
        assert r2.json()["score"]["composite"] == r.json()["score"]["composite"]

    def test_response_carries_no_pii(self, client, pdf_bytes):
        r = client.post(
            "/import-statement-pdf",
            files={"file": ("stmt.pdf", pdf_bytes, "application/pdf")},
        )
        blob = r.text.upper()
        for token in (*FAKE_NAME.split(), FAKE_ACCOUNT):
            assert token not in blob

    def test_agent_chat_works_for_imported_statement(self, client, pdf_bytes):
        # importing caches the zero-PII aggregate; the officer chat must then
        # answer for profile_id "imported-statement" just like a persona
        client.post(
            "/import-statement-pdf",
            files={"file": ("stmt.pdf", pdf_bytes, "application/pdf")},
        )
        r = client.post("/agent/ask", json={
            "profile_id": "imported-statement",
            "question": "What's the affordability / DBR position?",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["answer_en"] and body["answer_ar"]

    def test_rejects_non_pdf(self, client):
        r = client.post(
            "/import-statement-pdf",
            files={"file": ("junk.pdf", b"not a pdf at all", "application/pdf")},
        )
        assert r.status_code == 422
