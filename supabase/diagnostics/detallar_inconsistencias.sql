-- Diagnóstico de solo lectura. No modifica ni elimina información.

select
  'CANCION_HUERFANA' as tipo,
  c.id,
  c.titulo as nombre,
  c.iglesia_id as referencia_inexistente,
  c.fecha_creacion::text as fecha,
  null::text as detalle
from public.canciones c
where c.iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = c.iglesia_id)

union all

select
  'LISTA_HUERFANA',
  l.id,
  l.nombre,
  l.iglesia_id,
  l.fecha::text,
  (select count(*)::text from public.items_lista it where it.lista_id = l.id) || ' ítems'
from public.listas_culto l
where l.iglesia_id is not null
  and not exists (select 1 from public.iglesias i where i.id = l.iglesia_id)

order by fecha nulls last, tipo, nombre;

-- Iglesias sin administrador, mostrando los roles que sí poseen.
select
  i.id,
  i.nombre,
  i.localidad,
  i.creado_en,
  coalesce(
    string_agg(ui.rol || ':' || ui.user_id::text, ', ' order by ui.rol),
    'SIN MIEMBROS'
  ) as miembros
from public.iglesias i
left join public.usuarios_iglesia ui on ui.iglesia_id = i.id
where not exists (
  select 1 from public.usuarios_iglesia administrador
  where administrador.iglesia_id = i.id and administrador.rol = 'admin'
)
group by i.id, i.nombre, i.localidad, i.creado_en
order by i.creado_en, i.nombre;
