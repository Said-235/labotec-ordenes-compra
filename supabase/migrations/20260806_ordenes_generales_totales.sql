-- Totales a precio base en órdenes generales al proveedor.

ALTER TABLE public.ordenes_generales
  ADD COLUMN IF NOT EXISTS subtotal numeric(14, 2),
  ADD COLUMN IF NOT EXISTS iva numeric(14, 2),
  ADD COLUMN IF NOT EXISTS total numeric(14, 2);

ALTER TABLE public.ordenes_generales_detalle
  ADD COLUMN IF NOT EXISTS precio_base_unitario numeric(14, 2),
  ADD COLUMN IF NOT EXISTS subtotal numeric(14, 2);

COMMENT ON COLUMN public.ordenes_generales.subtotal IS
  'Suma de cantidades × precio_base del catálogo (sin aumentos de cliente).';
COMMENT ON COLUMN public.ordenes_generales.iva IS
  'IVA 16% sobre el subtotal a precio base.';
COMMENT ON COLUMN public.ordenes_generales.total IS
  'Subtotal + IVA a precio base.';
