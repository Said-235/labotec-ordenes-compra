-- Buzón de notificaciones para clientes (aprobación/rechazo de comprobantes).
-- Ejecutar en Supabase → SQL Editor.

create table if not exists public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  orden_id        uuid not null references public.ordenes(id) on delete cascade,
  comprobante_id  uuid references public.comprobantes(id) on delete set null,
  tipo            text not null
                  check (tipo in ('comprobante_aprobado', 'comprobante_rechazado')),
  titulo          text not null,
  mensaje         text,
  leida           boolean not null default false,
  creado_en       timestamptz not null default now()
);

create index if not exists idx_notificaciones_cliente_leida
  on public.notificaciones (cliente_id, leida, creado_en desc);

alter table public.notificaciones enable row level security;

drop policy if exists "cliente: ver notificaciones propias" on public.notificaciones;
create policy "cliente: ver notificaciones propias"
  on public.notificaciones for select
  using (auth.uid() = cliente_id);

drop policy if exists "cliente: marcar notificaciones propias" on public.notificaciones;
create policy "cliente: marcar notificaciones propias"
  on public.notificaciones for update
  using (auth.uid() = cliente_id)
  with check (auth.uid() = cliente_id);

comment on table public.notificaciones is
  'Avisos al cliente cuando un admin aprueba o rechaza su comprobante de pago.';
