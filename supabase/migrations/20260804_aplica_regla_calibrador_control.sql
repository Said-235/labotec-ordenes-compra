-- Regla de negocio Calibrador/Control ×2 sin Reactivo suficiente.
-- true (default): se aplica la regla actual.
-- false: el cliente compra Calibrador/Control a tarifa habitual sin esa restricción.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS aplica_regla_calibrador_control boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clientes.aplica_regla_calibrador_control IS
  'Si true, Calibrador/Control sin Reactivo suficiente se cobran ×2 y la cobertura limita unidades a precio base.';
