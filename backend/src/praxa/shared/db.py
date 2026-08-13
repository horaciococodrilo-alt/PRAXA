from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

import psycopg
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session


def _reset_connection(
    dbapi_connection: psycopg.Connection[tuple[object, ...]], _connection_record: object
) -> None:
    dbapi_connection.rollback()
    with dbapi_connection.cursor() as cursor:
        cursor.execute("RESET ALL")
    dbapi_connection.commit()


def build_engine(database_url: str, *, reset_on_checkin: bool = True) -> Engine:
    engine = create_engine(database_url, pool_pre_ping=True)
    if reset_on_checkin:
        event.listen(engine.pool, "checkin", _reset_connection)
    return engine


@contextmanager
def transactional_session(
    engine: Engine,
    *,
    tenant_id: UUID,
    principal_id: UUID,
) -> Iterator[Session]:
    with Session(engine) as session, session.begin():
        session.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"),
            {"value": str(tenant_id)},
        )
        session.execute(
            text("SELECT set_config('app.principal_id', :value, true)"),
            {"value": str(principal_id)},
        )
        yield session
