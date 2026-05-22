"""
Lean AIS transaction data simulator.
Returns realistic synthetic cross-bank transaction history per profile.
In production this would be replaced by a real Lean Technologies AIS API call.
"""
from datetime import date, timedelta
import random
from typing import TypedDict


class Transaction(TypedDict):
    date: str
    amount: int
    narration: str           # Unstructured bank narration string (realistic)
    sender_iban: str         # Partial IBAN (last 4 digits shown)
    bank: str                # Sending bank name


PROFILE_CLIENTS = {
    "mohammad": [
        {"name": "Takamol Holding",     "cr": "1010456789", "iban_suffix": "4521", "bank": "Al Rajhi Bank",    "monthly_avg": 4200},
        {"name": "STC Solutions",       "cr": "1010234567", "iban_suffix": "7832", "bank": "SNB",              "monthly_avg": 3100},
        {"name": "Riyadh Digital Hub",  "cr": "1010891234", "iban_suffix": "2241", "bank": "Riyad Bank",       "monthly_avg": 2800},
    ],
    "noura": [
        {"name": "Noon Academy",        "cr": "1010567891", "iban_suffix": "6612", "bank": "Al Rajhi Bank",    "monthly_avg": 4500},
        {"name": "Tamatem Games",       "cr": "1010345678", "iban_suffix": "9923", "bank": "SABB",             "monthly_avg": 2100},
    ],
    "fahad": [
        {"name": "Elite Events Est",    "cr": "1010123456", "iban_suffix": "3317", "bank": "ANB",              "monthly_avg": 5200},
    ],
}

NARRATION_TEMPLATES = [
    "SARIE: INBOUND FROM {short_name}",
    "FT FROM {short_name}",
    "TRF/{short_name}/INV-{inv_num}",
    "CREDIT: {short_name} SERVICES",
    "PAYMENT {short_name} REF{inv_num}",
]


def _short_name(full_name: str) -> str:
    """Simulate truncated bank narration text."""
    words = full_name.upper().split()
    return " ".join(words[:2]) + (" EST" if "EST" in full_name.upper() else "")


def generate_transactions(profile_id: str, months: int = 18) -> list[Transaction]:
    clients = PROFILE_CLIENTS.get(profile_id, [])
    if not clients:
        return []

    # Deterministic seed from profile_id so the same profile
    # always returns the same transaction history across all API calls.
    rng = random.Random(hash(profile_id) & 0xFFFFFFFF)

    transactions: list[Transaction] = []
    today = date.today()

    for month_offset in range(months):
        month_start = today.replace(day=1) - timedelta(days=30 * month_offset)
        for client in clients:
            # Simulate occasional missing months (income gaps)
            if profile_id == "fahad" and rng.random() < 0.25:
                continue  # 25% chance of no payment this month for Fahad
            if profile_id == "noura" and rng.random() < 0.10:
                continue  # 10% chance of gap for Noura

            # Vary the amount ±15%
            variance = rng.uniform(0.85, 1.15)
            amount = int(client["monthly_avg"] * variance / 100) * 100  # round to nearest 100

            payment_day = rng.randint(1, 28)
            payment_date = month_start.replace(day=payment_day)

            template = rng.choice(NARRATION_TEMPLATES)
            narration = template.format(
                short_name=_short_name(client["name"]),
                inv_num=rng.randint(1000, 9999),
            )

            transactions.append({
                "date": payment_date.isoformat(),
                "amount": amount,
                "narration": narration,
                "sender_iban": f"SA** **** **** **** *{client['iban_suffix']}",
                "bank": client["bank"],
            })

    # Sort by date descending
    return sorted(transactions, key=lambda x: x["date"], reverse=True)


def get_declared_clients(profile_id: str) -> list[dict]:
    """Returns the client declarations made during onboarding."""
    return [
        {
            "name": c["name"],
            "cr": c["cr"],
            "iban_suffix": c["iban_suffix"],
            "bank": c["bank"],
        }
        for c in PROFILE_CLIENTS.get(profile_id, [])
    ]
