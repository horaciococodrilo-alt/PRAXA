"""Fixtures compartidas y datos sembrados.

Tres conexiones, con roles distintos y responsabilidades que no se mezclan:

  * `seed_engine`  -> superusuario. **Solo** siembra y limpia. Los superusuarios omiten RLS, que
    es exactamente lo que hace falta para insertar filas de dos tenants y memberships que las
    policies prohiben escribir a proposito. Existe unicamente en desarrollo y CI.
  * `owner_engine` -> praxa_owner. Migraciones, y las pruebas que verifican que `FORCE RLS`
    tambien lo somete.
  * `app_engine`   -> praxa_app. **Toda** asercion de seguridad.

Los fixtures no pueden sembrar como `praxa_owner`: `FORCE ROW LEVEL SECURITY` tambien lo somete a
las policies, y en VS-01 ninguna permite escribir. Ese es el punto de `FORCE`.

Cada engine verifica su `current_user` al construirse. Ningun test de seguridad puede pasar por
estar corriendo con el rol equivocado.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import Engine, create_engine, text

from praxa.config import AppSettings
from praxa.shared.db.engine import create_app_engine

REPO_ROOT = Path(__file__).resolve().parents[2]

APP_URL_ENV = "DATABASE_URL"
OWNER_URL_ENV = "MIGRATION_DATABASE_URL"
SEED_URL_ENV = "SEED_DATABASE_URL"


def _load_dotenv_if_present() -> None:
    """Completa el entorno desde el .env de la raiz, sin pisar lo que ya venga definido.

    En CI las variables llegan por `env:` y este archivo no existe.
    """
    dotenv = REPO_ROOT / ".env"
    if not dotenv.is_file():
        return
    for line in dotenv.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv_if_present()


def _database_urls() -> dict[str, str] | None:
    urls = {
        "app": os.environ.get(APP_URL_ENV, "").strip(),
        "owner": os.environ.get(OWNER_URL_ENV, "").strip(),
        "seed": os.environ.get(SEED_URL_ENV, "").strip(),
    }
    if not all(urls.values()):
        return None
    return urls


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Sin base disponible, integracion y seguridad hacen skip en local pero **fallan** en CI.

    Un skip silencioso en CI convertiria la suite de aislamiento en decoracion.
    """
    if _database_urls() is not None:
        return

    missing = f"Faltan {APP_URL_ENV}, {OWNER_URL_ENV} o {SEED_URL_ENV}"
    if os.environ.get("CI", "").lower() in {"1", "true"}:
        marker = pytest.mark.fail_without_database
        for item in items:
            if {"integration", "security"} & set(item.keywords):
                item.add_marker(marker)
                item.add_marker(
                    pytest.mark.xfail(reason=missing, run=False, strict=True)
                )
        return

    skip = pytest.mark.skip(
        reason=f"{missing}: `docker compose up -d postgres` y `make migrate`"
    )
    for item in items:
        if {"integration", "security"} & set(item.keywords):
            item.add_marker(skip)


def _require_urls() -> dict[str, str]:
    urls = _database_urls()
    if urls is None:
        pytest.fail(f"Se requieren {APP_URL_ENV}, {OWNER_URL_ENV} y {SEED_URL_ENV}.")
    return urls


def _assert_connects_as(engine: Engine, expected_role: str) -> None:
    with engine.connect() as connection:
        actual = connection.execute(text("SELECT current_user")).scalar_one()
    if actual != expected_role:
        pytest.fail(
            f"La conexion se abrio como {actual!r} y se esperaba {expected_role!r}. "
            "Una prueba de seguridad que corre con el rol equivocado no prueba nada."
        )


@pytest.fixture(scope="session")
def seed_engine() -> Iterator[Engine]:
    engine = create_engine(_require_urls()["seed"], poolclass=None)
    _assert_connects_as(engine, "postgres")
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def owner_engine() -> Iterator[Engine]:
    engine = create_engine(_require_urls()["owner"])
    _assert_connects_as(engine, "praxa_owner")
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def app_settings() -> AppSettings:
    return AppSettings(database_url=SecretStr(_require_urls()["app"]))


@pytest.fixture(scope="session")
def app_engine(app_settings: AppSettings) -> Iterator[Engine]:
    engine = create_app_engine(app_settings)
    _assert_connects_as(engine, "praxa_app")
    yield engine
    engine.dispose()


@dataclass(frozen=True)
class Fixtures:
    """Identificadores del escenario sembrado."""

    tenant_a: uuid.UUID
    tenant_b: uuid.UUID
    # Principals de A
    a_member: uuid.UUID
    a_other_member: uuid.UUID
    a_owner: uuid.UUID
    a_inactive: uuid.UUID
    # Principal de B
    b_member: uuid.UUID
    # Pertenece a A y a B con el mismo id
    multi: uuid.UUID
    # Sin ninguna membership
    orphan: uuid.UUID


def seed_fixture_data(seed_engine: Engine, data: Fixtures) -> None:
    """Escribe el escenario. Idempotente: trunca antes de insertar.

    Es una funcion y no solo el cuerpo del fixture porque el test que reconstruye el schema
    (tests/integration/test_migrations.py) necesita volver a sembrar despues del `upgrade`, sin
    depender del orden en que pytest ejecute los archivos.
    """
    principals = [
        (data.a_member, "a-member"),
        (data.a_other_member, "a-other-member"),
        (data.a_owner, "a-owner"),
        (data.a_inactive, "a-inactive"),
        (data.b_member, "b-member"),
        (data.multi, "multi-tenant"),
        (data.orphan, "orphan"),
    ]

    memberships = [
        (data.tenant_a, data.a_member, "member", "active"),
        (data.tenant_a, data.a_other_member, "member", "active"),
        (data.tenant_a, data.a_owner, "owner", "active"),
        (data.tenant_a, data.a_inactive, "member", "inactive"),
        (data.tenant_a, data.multi, "member", "active"),
        (data.tenant_b, data.b_member, "member", "active"),
        (data.tenant_b, data.multi, "reviewer", "active"),
    ]

    with seed_engine.begin() as connection:
        connection.execute(
            text("TRUNCATE tenant_membership, tenant, principal CASCADE")
        )
        connection.execute(
            text("INSERT INTO tenant (id, slug, name) VALUES (:id, :slug, :name)"),
            [
                {"id": data.tenant_a, "slug": "tenant-a", "name": "Tenant A"},
                {"id": data.tenant_b, "slug": "tenant-b", "name": "Tenant B"},
            ],
        )
        connection.execute(
            text(
                "INSERT INTO principal (id, kind, display_name) VALUES (:id, 'human', :display_name)"
            ),
            [{"id": pid, "display_name": name} for pid, name in principals],
        )
        connection.execute(
            text(
                "INSERT INTO tenant_membership (tenant_id, principal_id, role_key, status) "
                "VALUES (:tenant_id, :principal_id, :role_key, :status)"
            ),
            [
                {
                    "tenant_id": tenant,
                    "principal_id": principal,
                    "role_key": role,
                    "status": status,
                }
                for tenant, principal, role, status in memberships
            ],
        )


@pytest.fixture(scope="session")
def fixtures(seed_engine: Engine) -> Fixtures:
    data = Fixtures(
        tenant_a=uuid.uuid4(),
        tenant_b=uuid.uuid4(),
        a_member=uuid.uuid4(),
        a_other_member=uuid.uuid4(),
        a_owner=uuid.uuid4(),
        a_inactive=uuid.uuid4(),
        b_member=uuid.uuid4(),
        multi=uuid.uuid4(),
        orphan=uuid.uuid4(),
    )
    seed_fixture_data(seed_engine, data)
    return data
