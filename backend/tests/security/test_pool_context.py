import pytest
from sqlalchemy import Engine, text

from praxa.shared.db import build_engine
from tests.conftest import TENANT_A

pytestmark = pytest.mark.security


def _set_session_context(engine: Engine) -> int:
    with engine.connect() as connection:
        backend_pid = connection.execute(text("SELECT pg_backend_pid()")).scalar_one()
        connection.execute(text(f"SET app.tenant_id = '{TENANT_A}'"))
        connection.commit()
    return int(backend_pid)


def test_pool_listener_resets_session_context(app_dsn: str) -> None:
    engine = build_engine(app_dsn, reset_on_checkin=True)
    try:
        backend_pid = _set_session_context(engine)
        with engine.connect() as connection:
            assert (
                connection.execute(text("SELECT pg_backend_pid()")).scalar_one()
                == backend_pid
            )
            value = connection.execute(
                text("SELECT current_setting('app.tenant_id', true)")
            ).scalar_one()
        assert value in (None, "")
    finally:
        engine.dispose()


def test_negative_control_context_survives_without_listener(app_dsn: str) -> None:
    engine = build_engine(app_dsn, reset_on_checkin=False)
    try:
        backend_pid = _set_session_context(engine)
        with engine.connect() as connection:
            assert (
                connection.execute(text("SELECT pg_backend_pid()")).scalar_one()
                == backend_pid
            )
            value = connection.execute(
                text("SELECT current_setting('app.tenant_id', true)")
            ).scalar_one()
        assert value == str(TENANT_A)
    finally:
        engine.dispose()
