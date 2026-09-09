-- Limpieza autorizada de residuos históricos detectados el 2026-09-09.
-- Las condiciones coinciden con los controles de diagnóstico ya revisados.

begin;

-- items_lista no posee ON DELETE CASCADE desde listas_culto.
delete from public.items_lista
where lista_id in (
  select l.id from public.listas_culto l
  where l.iglesia_id is not null
    and not exists (select 1 from public.iglesias i where i.id = l.iglesia_id)
);

delete from public.listas_culto
where iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = listas_culto.iglesia_id);

-- partes_cancion e items_lista asociados se eliminan por sus FK CASCADE.
delete from public.canciones
where iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = canciones.iglesia_id);

-- Iglesia abandonada, únicamente si continúa sin miembros.
delete from public.iglesias i
where i.nombre = 'IEP Moradora de Sion San Pedro de Melipilla'
  and not exists (
    select 1 from public.usuarios_iglesia ui where ui.iglesia_id = i.id
  );

-- No validamos silenciosamente una base que todavía tenga huérfanos.
do $$
begin
  if exists (
    select 1 from public.canciones c
    where c.iglesia_id is not null
      and not exists (select 1 from public.iglesias i where i.id = c.iglesia_id)
  ) then raise exception 'Aún existen canciones sin iglesia'; end if;

  if exists (
    select 1 from public.listas_culto l
    where l.iglesia_id is not null
      and not exists (select 1 from public.iglesias i where i.id = l.iglesia_id)
  ) then raise exception 'Aún existen listas sin iglesia'; end if;
end $$;

commit;
