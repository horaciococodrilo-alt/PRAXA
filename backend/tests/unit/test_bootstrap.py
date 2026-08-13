import os
import subprocess
import sys
from pathlib import Path


def test_bootstrap_rejects_missing_app_env_before_connecting() -> None:
    script = Path(__file__).parents[3] / "scripts" / "bootstrap_db.py"
    environment = os.environ.copy()
    environment.pop("APP_ENV", None)
    environment["SEED_DATABASE_URL"] = "postgresql+psycopg://postgres:secret@invalid/db"
    environment["MIGRATION_DATABASE_URL"] = (
        "postgresql+psycopg://praxa_owner:secret@invalid/db"
    )
    environment["DATABASE_URL"] = "postgresql+psycopg://praxa_app:secret@invalid/db"

    result = subprocess.run(
        [sys.executable, str(script)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert "APP_ENV must be explicitly set" in result.stderr
    assert "secret" not in result.stderr
