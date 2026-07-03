"""
One-shot script to generate Arabic Claude explanations.
Run once when ANTHROPIC_API_KEY is available.
Writes Arabic text to explanations.json without changing English fallbacks.

Usage:
    $env:ANTHROPIC_API_KEY = "sk-ant-..."
    python generate_cache.py
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from profiles import PROFILES, PROFILE_ORDER
# Shared with the live /ai-privacy-proof endpoint — the payload shown on
# stage is built by the exact same code that talks to the API here.
from ai_privacy import SYSTEM_PROMPT as SYSTEM, build_ai_prompt

EXPLANATIONS_PATH = Path(__file__).parent / "explanations.json"
MODEL = "claude-sonnet-4-6"


def build_prompt(profile_id: str) -> str:
    return build_ai_prompt(PROFILES[profile_id])


def main():
    # Imported here, not at module level: tests import this module to
    # verify prompt parity without needing the anthropic SDK installed.
    try:
        import anthropic
    except ImportError:
        print("Run: pip install anthropic")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Set ANTHROPIC_API_KEY environment variable first.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    existing = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8")) if EXPLANATIONS_PATH.exists() else {}

    for profile_id in PROFILE_ORDER:
        print(f"Generating explanation for {profile_id}...")
        message = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(profile_id)}],
        )
        arabic_text = message.content[0].text.strip()
        if profile_id not in existing:
            existing[profile_id] = {}
        existing[profile_id]["ar"] = arabic_text
        print(f"  Done: {arabic_text[:60]}...")

    EXPLANATIONS_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved to {EXPLANATIONS_PATH}")


if __name__ == "__main__":
    main()
