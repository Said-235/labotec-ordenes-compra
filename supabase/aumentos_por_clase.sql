-- Aumentos de precio dinámicos por cliente × clase de producto
-- Ejecutar en Supabase → SQL Editor

-- 1) Columna en clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS aumentos_por_clase jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clientes.aumentos_por_clase IS
  'Aumento % por clase: Reactivo, Calibrador, Control, Consumible, MCC';

-- 2) Migrar el % único actual a todas las clases
UPDATE public.clientes
SET aumentos_por_clase = jsonb_build_object(
  'Reactivo',   COALESCE(porcentaje_aumento, 0),
  'Calibrador', COALESCE(porcentaje_aumento, 0),
  'Control',    COALESCE(porcentaje_aumento, 0),
  'Consumible', COALESCE(porcentaje_aumento, 0),
  'MCC',        COALESCE(porcentaje_aumento, 0)
)
WHERE aumentos_por_clase = '{}'::jsonb
   OR aumentos_por_clase IS NULL
   OR NOT (aumentos_por_clase ? 'Reactivo');

-- 3) Snapshot por orden (histórico de PDFs / detalle)
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS aumentos_aplicados jsonb;

COMMENT ON COLUMN public.ordenes.aumentos_aplicados IS
  'Copia de aumentos_por_clase del cliente al confirmar la orden';

-- 4) Órdenes previas: usar descuento_aplicado (legado) como % uniforme
UPDATE public.ordenes
SET aumentos_aplicados = jsonb_build_object(
  'Reactivo',   COALESCE(descuento_aplicado, 0),
  'Calibrador', COALESCE(descuento_aplicado, 0),
  'Control',    COALESCE(descuento_aplicado, 0),
  'Consumible', COALESCE(descuento_aplicado, 0),
  'MCC',        COALESCE(descuento_aplicado, 0)
)
WHERE aumentos_aplicados IS NULL;
