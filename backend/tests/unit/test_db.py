from praxa.shared.db import build_engine


def test_build_engine_selects_psycopg_for_plain_postgresql_url() -> None:
    engine = build_engine("postgresql://praxa_app:secret@localhost/praxa")
    try:
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()
