-- Permite notificar aprobación de pago sin un comprobante asociado.
ALTER TABLE notificaciones
  ALTER COLUMN comprobante_id DROP NOT NULL;
