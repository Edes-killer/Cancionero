-- Metadatos compartidos de la biblioteca visual de cada iglesia.
-- Los archivos continúan en Storage; esta tabla solo sincroniza nombre y carpeta.
create table if not exists public.media_biblioteca (
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  url text not null,
  nombre text not null default 'Recurso',
  carpeta text not null default '',
  actualizado_en timestamptz not null default now(),
  primary key (iglesia_id, url)
);

alter table public.media_biblioteca enable row level security;

drop policy if exists "miembros leen biblioteca" on public.media_biblioteca;
create policy "miembros leen biblioteca"
on public.media_biblioteca for select to authenticated
using (public.pertenece_a_iglesia(iglesia_id));

drop policy if exists "lideres insertan biblioteca" on public.media_biblioteca;
create policy "lideres insertan biblioteca"
on public.media_biblioteca for insert to authenticated
with check (public.rol_usuario_en_iglesia(iglesia_id) in ('lider','admin'));

drop policy if exists "lideres actualizan biblioteca" on public.media_biblioteca;
create policy "lideres actualizan biblioteca"
on public.media_biblioteca for update to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) in ('lider','admin'))
with check (public.rol_usuario_en_iglesia(iglesia_id) in ('lider','admin'));

drop policy if exists "lideres eliminan biblioteca" on public.media_biblioteca;
create policy "lideres eliminan biblioteca"
on public.media_biblioteca for delete to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) in ('lider','admin'));

create index if not exists media_biblioteca_carpeta_idx
  on public.media_biblioteca (iglesia_id, carpeta);
