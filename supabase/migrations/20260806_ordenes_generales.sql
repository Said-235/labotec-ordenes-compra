-- Orden general al proveedor: consolida órdenes pagadas de las 3 categorías base.

CREATE TABLE IF NOT EXISTS public.ordenes_generales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text,
  nombre text,
  email text,
  telefono text,
  razon_social text,
  rfc text,
  direccion_fiscal text,
  correo_facturacion text,
  envio_igual_fiscal boolean NOT NULL DEFAULT true,
  direccion_envio text,
  ultima_compra_confirmada_en timestamptz,
  total_ordenes integer NOT NULL DEFAULT 0,
  total_lineas integer NOT NULL DEFAULT 0,
  total_unidades integer NOT NULL DEFAULT 0,
  pdf_url text,
  creado_por uuid REFERENCES auth.users (id),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ordenes_generales_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_general_id uuid NOT NULL REFERENCES public.ordenes_generales (id) ON DELETE CASCADE,
  producto_id uuid,
  codigo text NOT NULL,
  descripcion text,
  clase text,
  categoria text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS ordenes_generales_detalle_orden_idx
  ON public.ordenes_generales_detalle (orden_general_id);

CREATE INDEX IF NOT EXISTS ordenes_generales_creado_en_idx
  ON public.ordenes_generales (creado_en DESC);

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS incluido_en_orden_general_id uuid
    REFERENCES public.ordenes_generales (id);

CREATE INDEX IF NOT EXISTS ordenes_incluido_orden_general_idx
  ON public.ordenes (incluido_en_orden_general_id)
  WHERE incluido_en_orden_general_id IS NULL;

COMMENT ON TABLE public.ordenes_generales IS
  'Pedido consolidado al proveedor a partir de órdenes de clientes ya pagadas.';

COMMENT ON COLUMN public.ordenes.incluido_en_orden_general_id IS
  'Si no es null, la orden ya se incluyó en una orden general al proveedor.';
