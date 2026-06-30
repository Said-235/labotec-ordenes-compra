-- Permite la categoría "inmuno" en productos (y tablas relacionadas).
-- Ejecutar en Supabase → SQL Editor si la carga ODS a Inmuno falla con:
--   productos_categoria_check
-- Seguro ejecutar más de una vez.

alter table public.productos
  drop constraint if exists productos_categoria_check;

alter table public.productos
  add constraint productos_categoria_check
  check (categoria in ('banco_sangre', 'inmuno', 'quimica_clinica'));

alter table public.ordenes
  drop constraint if exists ordenes_categoria_check;

alter table public.ordenes
  add constraint ordenes_categoria_check
  check (categoria in ('banco_sangre', 'inmuno', 'quimica_clinica'));

alter table public.log_cargas
  drop constraint if exists log_cargas_categoria_check;

alter table public.log_cargas
  add constraint log_cargas_categoria_check
  check (categoria in ('banco_sangre', 'inmuno', 'quimica_clinica'));
