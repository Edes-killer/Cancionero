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
using (exists (
  select 1 from public.usuarios_iglesia ui
  where ui.iglesia_id = media_biblioteca.iglesia_id
    and ui.user_id = auth.uid()
));

drop policy if exists "miembros administran biblioteca" on public.media_biblioteca;
create policy "miembros administran biblioteca"
on public.media_biblioteca for all to authenticated
using (exists (
  select 1 from public.usuarios_iglesia ui
  where ui.iglesia_id = media_biblioteca.iglesia_id
    and ui.user_id = auth.uid()
))
with check (exists (
  select 1 from public.usuarios_iglesia ui
  where ui.iglesia_id = media_biblioteca.iglesia_id
    and ui.user_id = auth.uid()
));

create index if not exists media_biblioteca_carpeta_idx
  on public.media_biblioteca (iglesia_id, carpeta);
