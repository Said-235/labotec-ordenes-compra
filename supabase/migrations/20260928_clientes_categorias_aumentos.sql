-- Catálogo por cliente y aumentos por clase dentro de cada categoría.
-- Hay que ejecutar este archivo en el SQL editor de Supabase.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS categorias_visibles text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.clientes.categorias_visibles IS
  'Claves de categorías del catálogo que el cliente puede ver y comprar.';

-- Quienes ya existen siguen viendo las categorías activas de hoy.
UPDATE public.clientes
SET categorias_visibles = COALESCE(
  (
    SELECT array_agg(c.clave ORDER BY c.orden, c.nombre)
    FROM public.categorias c
    WHERE c.activo IS TRUE
  ),
  ARRAY[]::text[]
)
WHERE COALESCE(cardinality(categorias_visibles), 0) = 0;

-- El mapa plano { Reactivo: n, ... } se copia igual a cada categoría activa.
-- Así los precios no cambian hasta que el admin edite la matriz.
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT c.data_type
    INTO col_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'clientes'
    AND c.column_name = 'aumentos_por_clase';

  IF col_type IS NULL THEN
    RAISE EXCEPTION 'Falta la columna clientes.aumentos_por_clase';
  END IF;

  IF col_type NOT IN ('json', 'jsonb') THEN
    RAISE EXCEPTION 'clientes.aumentos_por_clase debe ser json o jsonb (es %)', col_type;
  END IF;

  EXECUTE format($sql$
    UPDATE public.clientes AS cli
    SET aumentos_por_clase = expanded.mapa::%s
    FROM (
      SELECT
        cli2.id,
        COALESCE(
          (
            SELECT jsonb_object_agg(
              cat.clave,
              CASE
                WHEN cli2.aumentos_por_clase IS NOT NULL
                  AND jsonb_typeof((cli2.aumentos_por_clase)::jsonb -> 'Reactivo') = 'number'
                  THEN (cli2.aumentos_por_clase)::jsonb
                ELSE jsonb_build_object(
                  'Reactivo', COALESCE(cli2.porcentaje_aumento, 0),
                  'Calibrador', COALESCE(cli2.porcentaje_aumento, 0),
                  'Control', COALESCE(cli2.porcentaje_aumento, 0),
                  'Consumible', COALESCE(cli2.porcentaje_aumento, 0),
                  'MCC', COALESCE(cli2.porcentaje_aumento, 0)
                )
              END
            )
            FROM public.categorias cat
            WHERE cat.activo IS TRUE
          ),
          '{}'::jsonb
        ) AS mapa
      FROM public.clientes cli2
      WHERE cli2.aumentos_por_clase IS NULL
         OR jsonb_typeof((cli2.aumentos_por_clase)::jsonb -> 'Reactivo') = 'number'
    ) AS expanded
    WHERE cli.id = expanded.id
  $sql$, col_type);
END $$;

-- El cliente autenticado solo lee productos de sus categorías, los de sus
-- órdenes ya creadas, o todos si es admin. La service role no pasa por aquí.
DROP POLICY IF EXISTS productos_solo_categorias_del_cliente ON public.productos;

CREATE POLICY productos_solo_categorias_del_cliente
  ON public.productos
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id = auth.uid()
        AND (
          c.es_admin IS TRUE
          OR productos.categoria = ANY (c.categorias_visibles)
          OR EXISTS (
            SELECT 1
            FROM public.detalle_orden d
            JOIN public.ordenes o ON o.id = d.orden_id
            WHERE d.producto_id = productos.id
              AND o.cliente_id = auth.uid()
          )
        )
    )
  );
