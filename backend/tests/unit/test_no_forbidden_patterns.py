"""Guard estatico sobre el arbol del backend.

Convierte tres reglas de este ticket en algo que falla en CI en vez de depender de la revision:

  1. nada de SQLite: no sustituye pruebas de integracion ni de seguridad;
  2. el contexto de tenant se fija con `SET LOCAL`, nunca a nivel de sesion;
  3. las variables de contexto se fijan solo desde `praxa.shared.db.session`.

Cada excepcion es una ruta concreta, no un patron amplio: si aparece un archivo nuevo que rompe
la regla, el test falla aunque el archivo se parezca a los permitidos.
"""

from __future__ import annotations

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SCANNED_ROOTS = (BACKEND_ROOT / "src", BACKEND_ROOT / "tests", BACKEND_ROOT / "scripts")

# set_config(..., false) -> variable de sesion, sobrevive al fin de la transaccion.
SESSION_SCOPED_SET_CONFIG = re.compile(
    r"set_config\s*\([^)]*,\s*false\s*\)", re.IGNORECASE
)

# El unico archivo autorizado a usarlo: construye a proposito el escenario que la capa 2
# (RESET ALL al devolver la conexion) tiene que limpiar, y su control negativo.
SESSION_SCOPED_ALLOWED = {"tests/security/test_pool_reuse_context_isolation.py"}

SQLITE = re.compile(r"sqlite", re.IGNORECASE)
# Los dos lugares que nombran SQLite son los que lo rechazan.
SQLITE_ALLOWED = {"src/praxa/config.py", "tests/unit/test_config.py"}

# `SET app.foo = ...` como sentencia suelta, en vez de pasar por el helper.
RAW_SET_APP = re.compile(r"\bSET\s+(LOCAL\s+)?app\.", re.IGNORECASE)
RAW_SET_APP_ALLOWED: set[str] = set()


# Este mismo archivo queda fuera del barrido: define las reglas, asi que necesariamente nombra
# los patrones que persigue. Incluirlo lo haria fallar siempre contra si mismo.
GUARD_FILE = "tests/unit/test_no_forbidden_patterns.py"


def _relative_paths() -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for root in SCANNED_ROOTS:
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*.py")):
            rel = path.relative_to(BACKEND_ROOT).as_posix()
            if rel == GUARD_FILE:
                continue
            found.append((rel, path.read_text(encoding="utf-8")))
    return found


def _offenders(pattern: re.Pattern[str], allowed: set[str]) -> list[str]:
    return [
        rel
        for rel, text in _relative_paths()
        if rel not in allowed and pattern.search(text)
    ]


def test_no_sqlite_anywhere() -> None:
    assert not _offenders(SQLITE, SQLITE_ALLOWED)


def test_context_is_never_set_at_session_scope() -> None:
    offenders = _offenders(SESSION_SCOPED_SET_CONFIG, SESSION_SCOPED_ALLOWED)

    assert not offenders, (
        "set_config(..., false) fija una variable de sesion que sobrevive a la transaccion "
        f"y viaja con la conexion al siguiente uso del pool: {offenders}"
    )


def test_no_raw_set_of_app_variables() -> None:
    assert not _offenders(RAW_SET_APP, RAW_SET_APP_ALLOWED)


def test_allowlists_point_at_files_that_exist() -> None:
    """Una excepcion que apunta a un archivo borrado deja de proteger sin avisar."""
    for rel in (
        SESSION_SCOPED_ALLOWED | SQLITE_ALLOWED | RAW_SET_APP_ALLOWED | {GUARD_FILE}
    ):
        assert (BACKEND_ROOT / rel).is_file(), f"la excepcion {rel} ya no existe"


def test_the_scan_actually_reaches_the_source_tree() -> None:
    """Si el barrido quedara vacio, los tres tests de arriba pasarian sin mirar nada."""
    scanned = {rel for rel, _ in _relative_paths()}

    assert "src/praxa/shared/db/session.py" in scanned
    assert len(scanned) > 10
