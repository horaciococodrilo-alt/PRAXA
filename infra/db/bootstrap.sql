-- Praxa VS-01 — bootstrap estructural del cluster.
--
-- Este archivo NO crea la base y NO contiene contrasenas.
--
--   * La base la crea el entrypoint de la imagen a partir de POSTGRES_DB, y los scripts de
--     initdb corren ya conectados a ella. En CI ocurre lo mismo con el service.
--   * Las contrasenas las fija cada runner por separado: 01-bootstrap.sh via \getenv, y
--     backend/scripts/bootstrap_db.py via psycopg.sql.Literal. Asi no viajan en argumentos
--     de proceso ni quedan versionadas.
--
-- Vive fuera de /docker-entrypoint-initdb.d a proposito: si estuviera adentro, el entrypoint
-- lo ejecutaria por su cuenta ademas de la invocacion explicita del .sh.
--
-- Es idempotente: se puede reejecutar sobre una base ya inicializada.
-- Requiere superusuario, unicamente por CREATE EXTENSION (vector no es una extension trusted).
--
-- Solo SQL: sin meta-comandos de psql, para que los dos runners puedan ejecutar el mismo
-- archivo. El corte ante error lo aporta cada runner (-v ON_ERROR_STOP=1 en psql).

-- 1. La base debe existir y ser la correcta. No se crea aca.
DO $$
BEGIN
  IF current_database() <> 'praxa' THEN
    RAISE EXCEPTION
      'bootstrap.sql debe ejecutarse conectado a la base "praxa", no a "%". '
      'La base la crea el entrypoint de la imagen a partir de POSTGRES_DB.',
      current_database();
  END IF;
END $$;

-- 2. Roles. Sin PASSWORD: las contrasenas las fija el runner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'praxa_owner') THEN
    CREATE ROLE praxa_owner LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'praxa_app') THEN
    CREATE ROLE praxa_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

-- 3. Atributos reafirmados en cada corrida. Corrige un rol preexistente que hubiera quedado,
--    por ejemplo, con BYPASSRLS. Es la linea que sostiene el criterio de aceptacion 1.
ALTER ROLE praxa_owner WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE praxa_app   WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;

-- praxa_app no debe heredar privilegios de praxa_owner por pertenencia.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid
    JOIN pg_roles g ON g.oid = m.member
    WHERE r.rolname = 'praxa_owner' AND g.rolname = 'praxa_app'
  ) THEN
    REVOKE praxa_owner FROM praxa_app;
  END IF;
END $$;

-- 4. Ownership de base y esquema.
ALTER DATABASE praxa OWNER TO praxa_owner;
ALTER SCHEMA public OWNER TO praxa_owner;

-- 5. Cerrar PUBLIC y abrir solo lo necesario.
REVOKE ALL ON DATABASE praxa FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE praxa TO praxa_owner;
GRANT CONNECT ON DATABASE praxa TO praxa_app;
GRANT USAGE ON SCHEMA public TO praxa_app;

-- praxa_app nunca crea objetos.
REVOKE CREATE ON SCHEMA public FROM praxa_app;

-- 6. Extensiones. Requiere superusuario, por eso vive aca y no en Alembic:
--    el rol de migracion no es superusuario, por criterio de aceptacion.
--    pg_trgm NO se instala en VS-01: no hay ninguna columna de texto buscable todavia.
CREATE EXTENSION IF NOT EXISTS vector;

-- 7. Ninguna tabla futura queda accesible por omision.
ALTER DEFAULT PRIVILEGES FOR ROLE praxa_owner IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE praxa_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE praxa_owner IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
