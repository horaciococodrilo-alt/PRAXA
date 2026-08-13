#!/usr/bin/env bash
# Praxa VS-01 — unico archivo montado en /docker-entrypoint-initdb.d.
#
# El entrypoint de la imagen ejecuta *todos* los .sh y .sql que encuentre en esa carpeta.
# Por eso bootstrap.sql vive en /opt/praxa/db y no aca: si estuviera adentro, se ejecutaria
# dos veces, una por este script y otra por el entrypoint.
#
# Corre una sola vez, en la inicializacion de un volumen vacio. Para reaplicar el bootstrap
# sobre una base ya creada, usar `uv run python scripts/bootstrap_db.py` desde backend/.

set -euo pipefail

: "${PRAXA_OWNER_PASSWORD:?falta PRAXA_OWNER_PASSWORD en el entorno del contenedor}"
: "${PRAXA_APP_PASSWORD:?falta PRAXA_APP_PASSWORD en el entorno del contenedor}"

if [ -z "${PRAXA_OWNER_PASSWORD//[[:space:]]/}" ] || [ -z "${PRAXA_APP_PASSWORD//[[:space:]]/}" ]; then
  echo "01-bootstrap.sh: las contrasenas de praxa_owner y praxa_app no pueden estar vacias" >&2
  exit 1
fi

BOOTSTRAP_SQL=/opt/praxa/db/bootstrap.sql
if [ ! -f "$BOOTSTRAP_SQL" ]; then
  echo "01-bootstrap.sh: no se encontro $BOOTSTRAP_SQL. Falta montar ./infra/db en /opt/praxa/db." >&2
  exit 1
fi

echo "01-bootstrap.sh: aplicando DDL estructural"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$BOOTSTRAP_SQL"

# Las contrasenas se fijan por separado y por entrada estandar.
#
# No se usa `-v pw=... -c "... :'pw'"` por dos razones:
#   1. el argumento de -c se envia al servidor como SQL; psql no interpola variables ahi,
#      asi que :'pw' viajaria literal y la sentencia fallaria;
#   2. pasar la contrasena como argumento la deja visible en la tabla de procesos.
#
# \getenv la toma del entorno del propio psql y :'...' la escapa como literal SQL.
# El delimitador va entre comillas para que el shell no expanda nada dentro del bloque.
echo "01-bootstrap.sh: fijando contrasenas de praxa_owner y praxa_app"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv owner_pw PRAXA_OWNER_PASSWORD
\getenv app_pw   PRAXA_APP_PASSWORD
ALTER ROLE praxa_owner WITH PASSWORD :'owner_pw';
ALTER ROLE praxa_app   WITH PASSWORD :'app_pw';
SQL

echo "01-bootstrap.sh: bootstrap completo"
