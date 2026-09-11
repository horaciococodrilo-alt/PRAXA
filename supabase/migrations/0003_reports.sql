-- PRAXA 0003 — Reportes (contrato persistido, sin generación)
--
-- Esta fase NO genera reportes. La tabla existe para dos cosas concretas:
--   1. que la pantalla de Reportes muestre un estado vacío honesto respaldado por una
--      consulta real y no por un cartel fijo;
--   2. anclar las tres versiones que un reporte debe conservar para ser auditable: la
--      del esquema del reporte, la de la metodología y la del contexto con el que se
--      generó.
--
-- Por eso, en esta fase `authenticated` solo tiene SELECT: la escritura llegará con el
-- worker de generación, que deberá verificar el contexto de empresa por su cuenta
-- (ver docs/SECURITY.md).

create table public.reports (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,

  -- Referencia al contexto exacto usado para generarlo. La FK compuesta impide que un
  -- reporte de una empresa apunte al contexto de otra.
  context_version_id     uuid not null,

  status                 text not null default 'pending',
  report_schema_version  text not null,
  methodology_version    text not null,
  payload                jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  generated_at           timestamptz,

  constraint reports_context_fkey
    foreign key (company_id, context_version_id)
    references public.company_context_versions (company_id, id) on delete restrict,

  constraint reports_status_check
    check (status in ('pending', 'generating', 'ready', 'failed')),

  -- Un reporte listo tiene contenido; uno que no lo está, no lo finge.
  constraint reports_ready_has_payload
    check (status <> 'ready' or (payload is not null and generated_at is not null))
);

create index reports_company_created_idx
  on public.reports (company_id, created_at desc);

create trigger reports_touch
  before update on public.reports
  for each row execute function private.touch_updated_at();

alter table public.reports enable row level security;

create policy reports_select_member
  on public.reports for select to authenticated
  using (private.is_company_member(company_id));

-- Sin políticas de INSERT/UPDATE/DELETE en esta fase.
