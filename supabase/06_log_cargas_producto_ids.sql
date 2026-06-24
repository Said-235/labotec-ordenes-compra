-- Registra qué productos pertenecen a cada carga ODS (para eliminación por lote)
-- Ejecutar en Supabase SQL Editor

alter table public.log_cargas
  add column if not exists producto_ids jsonb default '[]'::jsonb;

comment on column public.log_cargas.producto_ids is
  'UUIDs de productos insertados o actualizados en esta carga ODS.';
