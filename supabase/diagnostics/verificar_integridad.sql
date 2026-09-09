-- Diagnóstico de solo lectura posterior a 20260908_security_hardening.sql.
-- Un resultado correcto devuelve una fila por control, todas con cantidad = 0.

select 'canciones sin iglesia' as control, count(*)::bigint as cantidad
from public.canciones c
where c.iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = c.iglesia_id)

union all
select 'listas sin iglesia', count(*)::bigint
from public.listas_culto l
where l.iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = l.iglesia_id)

union all
select 'partes sin canción', count(*)::bigint
from public.partes_cancion p
where not exists (select 1 from public.canciones c where c.id = p.cancion_id)

union all
select 'items sin lista', count(*)::bigint
from public.items_lista it
where not exists (select 1 from public.listas_culto l where l.id = it.lista_id)

union all
select 'items sin canción', count(*)::bigint
from public.items_lista it
where it.cancion_id is not null
  and not exists (select 1 from public.canciones c where c.id = it.cancion_id)

union all
select 'roles no reconocidos', count(*)::bigint
from public.usuarios_iglesia
where rol is null or rol not in ('admin', 'lider', 'musico')

union all
select 'planes no reconocidos', count(*)::bigint
from public.iglesias
where plan is null or plan not in ('gratis', 'pro', 'premium')

union all
select 'iglesias sin administrador', count(*)::bigint
from public.iglesias i
where not exists (
  select 1 from public.usuarios_iglesia ui
  where ui.iglesia_id = i.id and ui.rol = 'admin'
)

order by control;

