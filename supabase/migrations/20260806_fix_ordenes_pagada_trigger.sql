-- Corrige el bloqueo que impedía marcar órdenes como pagadas.
-- Había un trigger en public.ordenes que revertía en silencio:
--   status = 'pagada', payment_method y payment_confirmed_at
-- (el UPDATE devolvía 200 pero la fila no cambiaba).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ordenes'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.ordenes', r.trigger_name);
    RAISE NOTICE 'Dropped trigger public.ordenes.%', r.trigger_name;
  END LOOP;
END $$;

-- Recrear solo el mantenimiento de actualizado_en (si la columna existe).
CREATE OR REPLACE FUNCTION public.set_ordenes_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ordenes_actualizado_en ON public.ordenes;
CREATE TRIGGER trg_ordenes_actualizado_en
  BEFORE UPDATE ON public.ordenes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ordenes_actualizado_en();

-- Reparar órdenes cuyo comprobante ya está validado pero el status nunca llegó a pagada.
UPDATE public.ordenes o
SET
  status = 'pagada',
  payment_method = COALESCE(NULLIF(o.payment_method, ''), 'manual'),
  payment_confirmed_at = COALESCE(o.payment_confirmed_at, c.validado_en, now())
FROM public.comprobantes c
WHERE c.orden_id = o.id
  AND c.validado = true
  AND COALESCE(c.rechazado, false) = false
  AND o.status IS DISTINCT FROM 'pagada';
