"""La aplicacion recibe una sola credencial.

`MIGRATION_DATABASE_URL` (rol owner) y `SEED_DATABASE_URL` (superusuario) pertenecen a otros
contextos. Si `AppSettings` las leyera, el proceso de API tendria en memoria credenciales que no
necesita, y la separacion declarada seria decorativa.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from praxa.config import AppSettings

VALID_URL = "postgresql+psycopg://praxa_app:app-pw@127.0.0.1:5432/praxa"
PRIVILEGED_ENV_NAMES = ("MIGRATION_DATABASE_URL", "SEED_DATABASE_URL")

SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "praxa"


def test_app_settings_declares_only_application_fields() -> None:
    assert set(AppSettings.model_fields) == {
        "app_env",
        "log_level",
        "database_url",
        "db_pool_size",
        "db_max_overflow",
        "db_assert_clean_context",
    }


def test_privileged_urls_in_environment_are_not_absorbed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", VALID_URL)
    monkeypatch.setenv(
        "MIGRATION_DATABASE_URL", "postgresql+psycopg://praxa_owner:owner-pw@h/praxa"
    )
    monkeypatch.setenv(
        "SEED_DATABASE_URL", "postgresql+psycopg://postgres:super-pw@h/praxa"
    )

    # DATABASE_URL viene del entorno; las otras dos deben quedar afuera.
    settings = AppSettings()

    dumped = repr(settings.model_dump())
    assert "owner-pw" not in dumped
    assert "super-pw" not in dumped
    for name in PRIVILEGED_ENV_NAMES:
        assert name.lower() not in settings.model_dump()


def test_application_package_never_mentions_privileged_env_names() -> None:
    """Chequeo estatico: ningun modulo de src/praxa nombra las otras dos credenciales.

    La unica excepcion es la docstring de config.py, que explica precisamente por que no las lee.
    """
    offenders: list[str] = []
    for path in SRC_ROOT.rglob("*.py"):
        if path.name == "config.py":
            continue
        text = path.read_text(encoding="utf-8")
        for name in PRIVILEGED_ENV_NAMES:
            if name in text:
                offenders.append(f"{path.relative_to(SRC_ROOT)} menciona {name}")

    assert not offenders, "; ".join(offenders)
