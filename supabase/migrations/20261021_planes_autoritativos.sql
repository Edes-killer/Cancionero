-- Planes y cupos autoritativos.
-- La interfaz conserva validaciones rápidas, pero esta migración hace que la
-- base de datos sea la última palabra incluso con varios equipos simultáneos.
begin;

-- Un administrador de iglesia puede editar nombre, logo, localidad y PIN, pero
-- no puede ascender su propio plan. SQL Editor y procesos con service_role no
-- tienen auth.uid(), por lo que el futuro webhook de cobros sí podrá cambiarlo.
create or replace function public.proteger_plan_iglesia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan and auth.uid() is not null then
    raise exception 'El plan solo puede cambiarse desde el sistema de suscripciones'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_plan_iglesia() from public;
drop trigger if exists trg_proteger_plan_iglesia on public.iglesias;
create trigger trg_proteger_plan_iglesia
before update of plan on public.iglesias
for each row execute function public.proteger_plan_iglesia();

-- Canciones propias: Gratis admite 200 activas. El bloqueo de la fila de la
-- iglesia serializa dos inserciones concurrentes para que ambas no consuman el
-- último cupo. Himnos globales y canciones en papelera no cuentan.
create or replace function public.aplicar_limite_canciones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_total integer;
  v_excluir_id uuid;
begin
  if new.iglesia_id is null or new.eliminado_en is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.iglesia_id is not distinct from new.iglesia_id
       and old.eliminado_en is null then
      return new;
    end if;
  end if;

  select coalesce(i.plan, 'gratis')
    into v_plan
    from public.iglesias i
   where i.id = new.iglesia_id
   for update;

  if not found then
    raise exception 'La iglesia de la canción no existe' using errcode = '23503';
  end if;

  if v_plan = 'gratis' then
    if tg_op = 'UPDATE' then v_excluir_id := old.id; end if;
    select count(*)::integer
      into v_total
      from public.canciones c
     where c.iglesia_id = new.iglesia_id
       and c.eliminado_en is null
       and (v_excluir_id is null or c.id <> v_excluir_id);

    if v_total >= 200 then
      raise exception 'Límite de 200 canciones del plan Gratis alcanzado'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.aplicar_limite_canciones() from public;
drop trigger if exists trg_limite_canciones on public.canciones;
create trigger trg_limite_canciones
before insert or update of iglesia_id, eliminado_en on public.canciones
for each row execute function public.aplicar_limite_canciones();

-- Miembros: redefine la función histórica con bloqueo contra carreras. El
-- trigger ya existía en producción, pero se recrea para que la migración sea
-- repetible en proyectos nuevos y antiguos.
create or replace function public.check_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_total integer;
begin
  select coalesce(i.plan, 'gratis')
    into v_plan
    from public.iglesias i
   where i.id = new.iglesia_id
   for update;

  if not found then
    raise exception 'La iglesia del usuario no existe' using errcode = '23503';
  end if;

  if v_plan = 'gratis' then
    select count(*)::integer
      into v_total
      from public.usuarios_iglesia u
     where u.iglesia_id = new.iglesia_id;

    if v_total >= 15 then
      raise exception 'Límite de 15 usuarios del plan Gratis alcanzado'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.check_limite_usuarios() from public;
drop trigger if exists trg_limite_usuarios on public.usuarios_iglesia;
create trigger trg_limite_usuarios
before insert on public.usuarios_iglesia
for each row execute function public.check_limite_usuarios();

-- La sincronización de apariencia es Pro/Premium. La lectura sigue disponible
-- al bajar de plan para no romper equipos que ya tengan una configuración; solo
-- se impiden nuevas escrituras.
create or replace function public.plan_permite_configuracion_nube(p_iglesia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.iglesias i
     where i.id = p_iglesia_id
       and i.plan in ('pro', 'premium')
  );
$$;

revoke all on function public.plan_permite_configuracion_nube(uuid) from public;
grant execute on function public.plan_permite_configuracion_nube(uuid) to authenticated;

drop policy if exists "lideres crean configuracion de su iglesia" on public.configuraciones_iglesia;
create policy "lideres crean configuracion de su iglesia"
on public.configuraciones_iglesia for insert to authenticated
with check (
  public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider')
  and public.plan_permite_configuracion_nube(iglesia_id)
);

drop policy if exists "lideres actualizan configuracion de su iglesia" on public.configuraciones_iglesia;
create policy "lideres actualizan configuracion de su iglesia"
on public.configuraciones_iglesia for update to authenticated
using (
  public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider')
  and public.plan_permite_configuracion_nube(iglesia_id)
)
with check (
  public.rol_usuario_en_iglesia(iglesia_id) in ('admin', 'lider')
  and public.plan_permite_configuracion_nube(iglesia_id)
);

-- Galería en nube: Gratis admite 10 imágenes y 1 video. Las rutas de logo no
-- pertenecen a la galería y no consumen ese cupo. Pro/Premium conservan cupo
-- ilimitado por cantidad; el límite físico lo define el bucket.
create or replace function public.puede_guardar_media_segun_plan(
  p_name text,
  p_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, storage
as $$
declare
  v_iglesia uuid;
  v_plan text;
  v_extension text;
  v_es_video boolean;
  v_total integer;
  v_limite integer;
begin
  if split_part(p_name, '/', 1) = 'logos' then
    return true;
  end if;

  v_iglesia := public.iglesia_de_ruta_storage(p_name);
  if v_iglesia is null then return false; end if;

  v_extension := lower(substring(p_name from '\.([a-zA-Z0-9]+)$'));
  if v_extension is null or v_extension not in ('jpg','jpeg','png','webp','gif','bmp','avif','mp4','webm','mov','m4v','ogg') then
    return false;
  end if;
  v_es_video := v_extension in ('mp4','webm','mov','m4v','ogg');

  -- Un candado distinto por iglesia evita exceder el cupo con subidas paralelas.
  perform pg_advisory_xact_lock(hashtextextended('media:' || v_iglesia::text, 0));
  select coalesce(i.plan, 'gratis') into v_plan
    from public.iglesias i where i.id = v_iglesia;
  if not found then return false; end if;
  if v_plan in ('pro', 'premium') then return true; end if;

  v_limite := case when v_es_video then 1 else 10 end;
  select count(*)::integer into v_total
    from storage.objects o
   where o.bucket_id = 'imagenes-culto'
     and o.name like v_iglesia::text || '/%'
     and (p_id is null or o.id <> p_id)
     and o.archived_at is null
     and case when v_es_video
       then lower(o.name) ~ '\.(mp4|webm|mov|m4v|ogg)$'
       else lower(o.name) ~ '\.(jpg|jpeg|png|webp|gif|bmp|avif)$'
     end;

  if v_total >= v_limite then
    raise exception '%', case when v_es_video
      then 'Límite de 1 video en nube del plan Gratis alcanzado'
      else 'Límite de 10 imágenes en nube del plan Gratis alcanzado'
    end using errcode = 'P0001';
  end if;
  return true;
end;
$$;

revoke all on function public.puede_guardar_media_segun_plan(text, uuid) from public;
grant execute on function public.puede_guardar_media_segun_plan(text, uuid) to authenticated;

drop policy if exists "lideres suben multimedia de su iglesia" on storage.objects;
create policy "lideres suben multimedia de su iglesia" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'imagenes-culto'
  and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name))
  and public.puede_guardar_media_segun_plan(name, id)
);

drop policy if exists "lideres actualizan multimedia de su iglesia" on storage.objects;
create policy "lideres actualizan multimedia de su iglesia" on storage.objects
for update to authenticated
using (
  bucket_id = 'imagenes-culto'
  and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name))
)
with check (
  bucket_id = 'imagenes-culto'
  and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name))
  and public.puede_guardar_media_segun_plan(name, id)
);

commit;
