"""
Imported-statement explanation + roadmap tests: the AI payload stays
zero-PII, the template fallback is deterministic, and roadmap actions are
grounded in the statement's own evidence.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from ai_privacy import build_ai_prompt, build_ai_prompt_from_score
from factor_analysis import derive_factors
from improvement_roadmap import generate_roadmap
from models import FactorScores
from profiles import PROFILES
from scoring import calculate_score, calculate_score_vanc
from statement_explain import explain_import


@pytest.fixture()
def building_score():
    factors = FactorScores(
        expense_discipline=15.0, income_stability=15.0, client_diversity=88.8,
        savings_behavior=15.0, contract_verification=0.0,
    )
    return factors, calculate_score_vanc(factors, [1300, 1500, 370, 1880, 1440, 1560])


IMPORT_EVIDENCE = {
    "client_diversity": {
        "provenance": "COMPUTED_FROM_IMPORTED_STATEMENT",
        "excluded_credits": {"SELF_TRANSFER": 3010.86, "CASH_DEPOSIT": 4800.0},
    },
    "contract_verification": {"provenance": "NOT_AVAILABLE_FOR_IMPORT", "score": 0.0},
}


class TestAIPayloadParity:
    def test_persona_prompt_uses_shared_builder(self):
        """The persona payload and the generic builder must never drift —
        the on-stage privacy proof depends on there being ONE path."""
        profile = PROFILES["mohammad"]
        factors, _ = derive_factors(profile)
        score = calculate_score(factors, profile.worst_month_income)
        assert build_ai_prompt(profile) == build_ai_prompt_from_score(
            score.factors, score.composite, score.tier
        )

    def test_import_payload_is_scores_only(self, building_score):
        factors, score = building_score
        result = explain_import(factors, score)
        payload = result["ai_privacy"]["payload_sent_to_ai"]["user_message"]
        # exactly 7 lines: five factors + composite + tier
        assert len(payload.strip().splitlines()) == 7
        # nothing transaction-shaped may appear
        for forbidden in ("SENDER-", "ACCT-", "SAR", "IBAN", "tx"):
            assert forbidden not in payload


class TestExplanation:
    def test_template_is_deterministic_and_bilingual(self, building_score):
        factors, score = building_score
        a = explain_import(factors, score)
        b = explain_import(factors, score)
        assert a["ar"] == b["ar"] and a["en"] == b["en"]
        assert a["source"] == "template"
        assert len(a["ar"]) > 40 and len(a["en"]) > 40

    def test_building_tier_is_not_worded_as_rejection(self, building_score):
        factors, score = building_score
        result = explain_import(factors, score)
        assert "rejection" not in result["en"].lower() or "not a rejection" in result["en"].lower()
        assert "roadmap" in result["en"].lower()

    def test_contract_verification_never_named_weakest(self, building_score):
        """Imports always have contract_verification=0 (nothing declared) —
        calling it the applicant's weakness would be wrong and confusing."""
        factors, score = building_score
        result = explain_import(factors, score)
        assert "contract verification" not in result["en"].split("opportunity")[0].split("strength")[-1]

    def test_allow_live_without_key_falls_back(self, building_score, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        factors, score = building_score
        assert explain_import(factors, score, allow_live=True)["source"] == "template"


class TestImportRoadmap:
    def test_import_gets_declare_clients_not_signit(self, building_score):
        _, score = building_score
        roadmap = generate_roadmap("imported-statement", score, import_evidence=IMPORT_EVIDENCE)
        actions_en = [a["action_en"] for a in roadmap["actions"]]
        assert any("Declare your clients" in a for a in actions_en)
        assert not any("Signit" in a for a in actions_en)

    def test_cash_deposit_action_grounded_in_evidence(self, building_score):
        _, score = building_score
        roadmap = generate_roadmap("imported-statement", score, import_evidence=IMPORT_EVIDENCE)
        cash_actions = [a for a in roadmap["actions"] if "cash deposits" in a["detail_en"]]
        assert len(cash_actions) == 1
        assert "4,800" in cash_actions[0]["detail_en"]

    def test_no_cash_action_below_threshold(self, building_score):
        _, score = building_score
        ev = {"client_diversity": {"excluded_credits": {"CASH_DEPOSIT": 200.0}}}
        roadmap = generate_roadmap("imported-statement", score, import_evidence=ev)
        assert not any("cash deposits" in a["detail_en"] for a in roadmap["actions"])

    def test_persona_roadmap_unchanged(self):
        """The scripted demo must not move: personas still get Signit."""
        profile = PROFILES["fahad"]
        factors, _ = derive_factors(profile)
        score = calculate_score(factors, profile.worst_month_income)
        roadmap = generate_roadmap("fahad", score)
        actions_en = [a["action_en"] for a in roadmap["actions"]]
        assert any("Signit" in a for a in actions_en)
        assert not any("Declare your clients" in a for a in actions_en)
        assert not any("cash deposits" in a.get("detail_en", "") for a in roadmap["actions"])
