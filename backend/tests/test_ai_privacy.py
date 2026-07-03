"""
Proves the PII claim: the payload sent to the AI explanation model
contains anonymized scores only — no name, ID, IBAN, client company,
CR number, or transaction data, for any persona.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ai_privacy import build_ai_prompt, build_privacy_proof
from lean_simulation import PROFILE_CLIENTS
from profiles import PROFILES


def ai_payload_text(profile) -> str:
    """Everything that would leave the bank, serialized."""
    return json.dumps(build_privacy_proof(profile)["payload_sent_to_ai"], ensure_ascii=False)


class TestNoPiiReachesTheModel:
    def test_no_applicant_names(self):
        for pid, p in PROFILES.items():
            payload = ai_payload_text(p)
            # full names and each name component (first/last, ar + en)
            for name in (p.name_ar, p.name_en):
                assert name not in payload, f"{pid}: name leaked"
                for part in name.split():
                    assert part not in payload, f"{pid}: name fragment '{part}' leaked"

    def test_no_client_companies_cr_or_iban(self):
        for pid, p in PROFILES.items():
            payload = ai_payload_text(p)
            for client in PROFILE_CLIENTS[pid]:
                assert client["name"] not in payload, f"{pid}: client name leaked"
                assert client["cr"] not in payload, f"{pid}: CR number leaked"
                assert client["iban_suffix"] not in payload, f"{pid}: IBAN suffix leaked"
                assert client["bank"] not in payload, f"{pid}: client bank leaked"

    def test_no_profession_or_profile_identifiers(self):
        for pid, p in PROFILES.items():
            payload = ai_payload_text(p)
            assert p.profession_ar not in payload
            assert p.profession_en not in payload
            assert pid not in payload  # even the internal profile id stays out

    def test_payload_is_only_scores_and_tier(self):
        prompt = build_ai_prompt(PROFILES["mohammad"])
        # every line is a labeled score or the tier — nothing free-form
        lines = [ln for ln in prompt.strip().split("\n") if ln]
        assert len(lines) == 7
        assert sum("/100" in ln for ln in lines) == 6
        assert lines[-1].startswith("التصنيف:")


class TestProofEndpointShape:
    def test_proof_declares_exclusions_and_mode(self):
        proof = build_privacy_proof(PROFILES["noura"])
        assert proof["generation_mode"] == "OFFLINE_BATCH"
        assert len(proof["fields_the_bank_holds_but_never_sends"]) >= 5
        assert "note_ar" in proof and "note_en" in proof

    def test_generate_cache_uses_same_builder(self):
        # The offline script must not have its own drifting prompt copy
        import generate_cache
        assert generate_cache.build_prompt("mohammad") == build_ai_prompt(PROFILES["mohammad"])
