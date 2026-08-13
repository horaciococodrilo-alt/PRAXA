"""`app.role` no gobierna ninguna policy, y eso se verifica mecanicamente.

`app.role` es una variable de sesion: cualquier sesion con la credencial de `praxa_app` puede
fijarla al valor que quiera. Una policy que la leyera no verificaria nada; convertiria una
afirmacion de la aplicacion en una decision de la base, con apariencia de control.

La regla es facil de romper sin querer en una fase futura, asi que se afirma sobre el catalogo
en vez de confiar en la revision.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

pytestmark = pytest.mark.security

FORBIDDEN_IN_POLICIES = ("app_current_role", "app.role")


def test_no_policy_references_the_role_variable(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        policies = connection.execute(
            text(
                "SELECT schemaname, tablename, policyname, "
                "       coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check "
                "FROM pg_policies WHERE schemaname = 'public'"
            )
        ).all()

    assert policies, "no se encontro ninguna policy: el schema no esta migrado"

    offenders = [
        f"{row.tablename}.{row.policyname}"
        for row in policies
        if any(
            token in row.qual or token in row.with_check
            for token in FORBIDDEN_IN_POLICIES
        )
    ]

    assert not offenders, (
        "Estas policies derivan privilegio de una variable de sesion manipulable: "
        f"{offenders}. La autorizacion por rol vive en la capa de servicio."
    )


def test_expected_policy_inventory(app_engine: Engine) -> None:
    """El conjunto de policies es exactamente el declarado, con su tipo y su comando.

    Una policy nueva o un cambio de permissive a restrictive rompe este test.
    """
    with app_engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT tablename, policyname, permissive, cmd "
                "FROM pg_policies WHERE schemaname = 'public' "
                "ORDER BY tablename, policyname"
            )
        ).all()

    actual = {(r.tablename, r.policyname, r.permissive, r.cmd) for r in rows}

    assert actual == {
        ("permission", "permission_select_all", "PERMISSIVE", "SELECT"),
        ("principal", "principal_visible_via_membership", "PERMISSIVE", "SELECT"),
        ("role", "role_select_all", "PERMISSIVE", "SELECT"),
        ("role_permission", "role_permission_select_all", "PERMISSIVE", "SELECT"),
        ("tenant", "tenant_select_current", "PERMISSIVE", "SELECT"),
        ("tenant", "tenant_requires_active_requester_membership", "RESTRICTIVE", "ALL"),
        ("tenant_membership", "membership_select_self", "PERMISSIVE", "SELECT"),
    }


def test_no_write_policies_exist(app_engine: Engine) -> None:
    """VS-01 no define ninguna policy de escritura porque no hay escrituras de aplicacion."""
    with app_engine.connect() as connection:
        write_policies = connection.execute(
            text(
                "SELECT tablename, policyname, cmd FROM pg_policies "
                "WHERE schemaname = 'public' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')"
            )
        ).all()

    assert write_policies == []
