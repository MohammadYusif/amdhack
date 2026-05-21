import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "mihan.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp       TEXT    NOT NULL,
                profile_id      TEXT    NOT NULL,
                profile_name    TEXT    NOT NULL,
                composite_score REAL    NOT NULL,
                tier            TEXT    NOT NULL,
                event           TEXT    NOT NULL,
                details         TEXT    NOT NULL DEFAULT ''
            )
        """)
        conn.commit()


def append_audit_log(
    profile_id: str,
    profile_name: str,
    composite_score: float,
    tier: str,
    event: str,
    details: str = "",
) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO audit_log (timestamp, profile_id, profile_name, composite_score, tier, event, details) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ts, profile_id, profile_name, composite_score, tier, event, details),
        )
        conn.commit()


def get_audit_log() -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY id DESC LIMIT 200"
        ).fetchall()
    return [dict(row) for row in rows]
