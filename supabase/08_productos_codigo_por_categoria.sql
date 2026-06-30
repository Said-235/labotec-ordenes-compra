-- Permite el mismo código de producto en distintas categorías
-- (p. ej. un reactivo listado en Inmuno y en Química clínica).
-- Ejecutar en Supabase → SQL Editor (seguro ejecutar más de una vez)

-- 1) Quitar UNIQUE antiguo solo en codigo (nombres habituales en Supabase)
alter table public.productos drop constraint if exists productos_codigo_key;
alter table public.productos drop constraint if exists productos_codigo_unique;

-- 2) Recrear UNIQUE compuesto (codigo + categoria)
--    Usar DROP CONSTRAINT, no DROP INDEX (Postgres crea el índice ligado a la constraint)
alter table public.productos drop constraint if exists productos_codigo_categoria_key;

alter table public.productos
  add constraint productos_codigo_categoria_key
  unique (codigo, categoria);
