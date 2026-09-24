-- Preferencias compartidas entre los equipos de una iglesia.
-- No guardar aquí claves RTMP, IDs de cámara/micrófono ni rutas locales.
create table if not exists public.configuraciones_iglesia (
  iglesia_id uuid primary key references public.iglesias(id) on delete cascade,
  control jsonb not null default '{}'::jsonb,
  transmision jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid default auth.uid(),
  constraint configuracion_control_objeto check (jsonb_typeof(control) = 'object'),
  constraint configuracion_transmision_objeto check (jsonb_typeof(transmision) = 'object'),
  constraint configuracion_control_tamano check (octet_length(control::text) <= 65536),
  constraint configuracion_transmision_tamano check (octet_length(transmision::text) <= 65536)
);

alter table public.configuraciones_iglesia enable row level security;

drop policy if exists "miembros leen configuracion de su iglesia" on public.configuraciones_iglesia;
create policy "miembros leen configuracion de su iglesia"
on public.configuraciones_iglesia for select to authenticated
using (public.pertenece_a_iglesia(iglesia_id));

drop policy if exists "lideres crean configuracion de su iglesia" on public.configuraciones_iglesia;
create policy "lideres crean configuracion de su iglesia"
on public.configuraciones_iglesia for insert to authenticated
with check (public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider'));

drop policy if exists "lideres actualizan configuracion de su iglesia" on public.configuraciones_iglesia;
create policy "lideres actualizan configuracion de su iglesia"
on public.configuraciones_iglesia for update to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider'))
with check (public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider'));

grant select, insert, update on public.configuraciones_iglesia to authenticated;
