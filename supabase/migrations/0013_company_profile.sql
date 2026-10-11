-- PRAXA 0013 — Perfil de la empresa: rubro, país y moneda
--
-- Los carga el dueño en Configuración (`/app/configuracion`), que reemplaza al onboarding
-- como lugar donde se completa la empresa. Son opcionales: una empresa recién creada no
-- los tiene, y la aplicación muestra un aviso hasta que se completan.
--
-- Las listas de opciones viven en la aplicación y todavía no están aprobadas (son las del
-- diseño), por eso la base no las fija: solo exige texto no vacío y acotado.
--
-- PRIVILEGIOS: no cambian. `authenticated` ya tiene SELECT, INSERT y UPDATE a nivel de
-- tabla sobre `public.companies` (0004), sujetos a RLS (`companies_update_owner`: solo el
-- dueño modifica su empresa). Las columnas nuevas quedan cubiertas por esos mismos
-- privilegios y políticas; no se agrega ningún grant.
--
-- NUMERACIÓN: el plan de la ruta reservaba 0013 para `meta_insights`. Por decisión del
-- usuario, este perfil toma 0013 y la ruta corre un número (ver docs/HALLAZGOS.md).

alter table public.companies
  add column industry text,
  add column country  text,
  add column currency text,

  add constraint companies_industry_valid
    check (industry is null or char_length(btrim(industry)) between 1 and 80),
  add constraint companies_country_valid
    check (country is null or char_length(btrim(country)) between 1 and 80),
  add constraint companies_currency_valid
    check (currency is null or char_length(btrim(currency)) between 1 and 40);

comment on column public.companies.industry is 'Rubro principal declarado por el dueño. Nulo hasta que lo completa.';
comment on column public.companies.country  is 'País donde opera la empresa, declarado por el dueño. Nulo hasta que lo completa.';
comment on column public.companies.currency is 'Moneda principal declarada por el dueño. Nula hasta que la completa.';
