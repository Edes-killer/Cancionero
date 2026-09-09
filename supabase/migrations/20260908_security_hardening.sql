-- Endurecimiento multiiglesia coordinado con Selah Live.
-- Ejecutar completo: primero crea los RPC seguros y luego cierra las policies antiguas.

begin;

create or replace function public.puede_administrar_iglesia(p_iglesia_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(public.rol_usuario_en_iglesia(p_iglesia_id) in ('lider','admin'), false)
$$;

create or replace function public.cambiar_rol_miembro(p_iglesia_id uuid, p_user_id uuid, p_nuevo_rol text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_mi_rol text; v_rol_actual text; v_admins integer;
begin
  if p_nuevo_rol not in ('admin','lider','musico') then raise exception 'Rol inválido'; end if;
  v_mi_rol := public.rol_usuario_en_iglesia(p_iglesia_id);
  if v_mi_rol <> 'admin' then raise exception 'Solo un administrador puede cambiar roles'; end if;
  select ui.rol into v_rol_actual from public.usuarios_iglesia ui
  where ui.iglesia_id = p_iglesia_id and ui.user_id = p_user_id;
  if v_rol_actual is null then raise exception 'Ese usuario no pertenece a esta iglesia'; end if;
  if v_rol_actual = 'admin' and p_nuevo_rol <> 'admin' then
    select count(*) into v_admins from public.usuarios_iglesia ui
    where ui.iglesia_id = p_iglesia_id and ui.rol = 'admin' and ui.user_id <> p_user_id;
    if v_admins = 0 then raise exception 'No puedes quitar el único administrador de la iglesia'; end if;
  end if;
  update public.usuarios_iglesia set rol = p_nuevo_rol
  where iglesia_id = p_iglesia_id and user_id = p_user_id;
end $$;

create or replace function public.quitar_miembro_iglesia(p_iglesia_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_mi_rol text; v_rol_actual text; v_admins integer;
begin
  v_mi_rol := public.rol_usuario_en_iglesia(p_iglesia_id);
  if v_mi_rol <> 'admin' then raise exception 'Solo un administrador puede quitar miembros'; end if;
  select ui.rol into v_rol_actual from public.usuarios_iglesia ui
  where ui.iglesia_id = p_iglesia_id and ui.user_id = p_user_id;
  if v_rol_actual is null then raise exception 'Ese usuario no pertenece a esta iglesia'; end if;
  if v_rol_actual = 'admin' then
    select count(*) into v_admins from public.usuarios_iglesia ui
    where ui.iglesia_id = p_iglesia_id and ui.rol = 'admin' and ui.user_id <> p_user_id;
    if v_admins = 0 then raise exception 'No puedes quitar al único administrador de la iglesia'; end if;
  end if;
  delete from public.usuarios_iglesia where iglesia_id = p_iglesia_id and user_id = p_user_id;
end $$;

create or replace function public.get_miembros_iglesia(p_iglesia_id uuid)
returns table(user_id uuid, email text, rol text)
language sql stable security definer set search_path = public
as $$
  select ui.user_id, u.email::text, ui.rol
  from public.usuarios_iglesia ui join auth.users u on u.id = ui.user_id
  where ui.iglesia_id = p_iglesia_id
    and public.rol_usuario_en_iglesia(p_iglesia_id) = 'admin'
  order by case ui.rol when 'admin' then 0 when 'lider' then 1 else 2 end, u.email
$$;

create or replace function public.crear_iglesia_segura(p_nombre text, p_localidad text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  if nullif(trim(p_nombre),'') is null then raise exception 'El nombre es obligatorio'; end if;
  insert into public.iglesias(nombre, localidad)
  values (trim(p_nombre), nullif(trim(p_localidad),'')) returning id into v_id;
  insert into public.usuarios_iglesia(user_id, iglesia_id, rol)
  values (v_user, v_id, 'admin');
  return v_id;
end $$;

create or replace function public.ver_invitacion(p_codigo text)
returns table(invitacion_id uuid, iglesia_id uuid, rol text, usos_actuales integer,
  usos_max integer, expira_at timestamptz, iglesia_nombre text, iglesia_logo_url text)
language sql stable security definer set search_path = public
as $$
  select i.id, i.iglesia_id, i.rol, i.usos_actuales, i.usos_max, i.expira_at,
         g.nombre, g.logo_url
  from public.invitaciones i join public.iglesias g on g.id = i.iglesia_id
  where upper(i.codigo) = upper(trim(p_codigo)) and i.activa
    and (i.expira_at is null or i.expira_at > now())
    and coalesce(i.usos_actuales,0) < coalesce(i.usos_max,20)
  limit 1
$$;

create or replace function public.aceptar_invitacion(p_codigo text)
returns table(iglesia_id uuid, rol text)
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_inv public.invitaciones%rowtype; v_insertadas integer;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  select * into v_inv from public.invitaciones i
  where upper(i.codigo) = upper(trim(p_codigo)) for update;
  if v_inv.id is null or not coalesce(v_inv.activa,false) then raise exception 'Código no encontrado o inválido'; end if;
  if v_inv.expira_at is not null and v_inv.expira_at <= now() then raise exception 'Este código ha expirado'; end if;
  if coalesce(v_inv.usos_actuales,0) >= coalesce(v_inv.usos_max,20) then raise exception 'Este código alcanzó el límite de usos'; end if;
  if v_inv.rol not in ('admin','lider','musico') then raise exception 'Rol de invitación inválido'; end if;

  insert into public.usuarios_iglesia(user_id, iglesia_id, rol)
  values (v_user, v_inv.iglesia_id, v_inv.rol)
  on conflict (user_id, iglesia_id) do nothing;
  get diagnostics v_insertadas = row_count;
  if v_insertadas > 0 then
    update public.invitaciones i set usos_actuales = coalesce(i.usos_actuales,0) + 1 where i.id = v_inv.id;
  end if;
  return query select v_inv.iglesia_id, v_inv.rol;
end $$;

revoke all on function public.crear_iglesia_segura(text,text) from public;
revoke all on function public.aceptar_invitacion(text) from public;
revoke all on function public.ver_invitacion(text) from public;
revoke all on function public.cambiar_rol_miembro(uuid,uuid,text) from public;
revoke all on function public.quitar_miembro_iglesia(uuid,uuid) from public;
revoke all on function public.get_miembros_iglesia(uuid) from public;
grant execute on function public.crear_iglesia_segura(text,text) to authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;
grant execute on function public.ver_invitacion(text) to anon, authenticated;
grant execute on function public.cambiar_rol_miembro(uuid,uuid,text) to authenticated;
grant execute on function public.quitar_miembro_iglesia(uuid,uuid) to authenticated;
grant execute on function public.get_miembros_iglesia(uuid) to authenticated;

-- Membresías: nadie puede insertarse ni elevar su propio rol mediante REST.
drop policy if exists "usuario actualiza su propio registro" on public.usuarios_iglesia;
drop policy if exists "usuario inserta su propio registro" on public.usuarios_iglesia;
drop policy if exists usuarios_iglesia_insert_own on public.usuarios_iglesia;

-- La creación directa se reemplaza por crear_iglesia_segura(), que vincula al admin atómicamente.
drop policy if exists "usuario crea iglesia" on public.iglesias;

-- Invitaciones: el código se resuelve por RPC sin exponer la tabla completa.
drop policy if exists "Cualquiera lee invitacion" on public.invitaciones;
drop policy if exists "Miembros gestionan invitaciones" on public.invitaciones;
drop policy if exists "miembros ven invitaciones propias" on public.invitaciones;
drop policy if exists "administradores crean invitaciones" on public.invitaciones;
drop policy if exists "administradores actualizan invitaciones" on public.invitaciones;
drop policy if exists "administradores eliminan invitaciones" on public.invitaciones;
create policy "miembros ven invitaciones propias" on public.invitaciones for select to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) = 'admin');
create policy "administradores crean invitaciones" on public.invitaciones for insert to authenticated
with check (public.rol_usuario_en_iglesia(iglesia_id) = 'admin');
create policy "administradores actualizan invitaciones" on public.invitaciones for update to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) = 'admin') with check (public.rol_usuario_en_iglesia(iglesia_id) = 'admin');
create policy "administradores eliminan invitaciones" on public.invitaciones for delete to authenticated
using (public.rol_usuario_en_iglesia(iglesia_id) = 'admin');

-- Datos operativos: músicos leen; líderes y administradores escriben.
drop policy if exists "usuario actualiza su iglesia" on public.iglesias;
drop policy if exists "administradores actualizan su iglesia" on public.iglesias;
create policy "administradores actualizan su iglesia" on public.iglesias for update to authenticated
using (public.rol_usuario_en_iglesia(id) = 'admin') with check (public.rol_usuario_en_iglesia(id) = 'admin');

drop policy if exists "usuario inserta canciones en su iglesia" on public.canciones;
drop policy if exists "usuario actualiza canciones de su iglesia" on public.canciones;
drop policy if exists "lideres insertan canciones" on public.canciones;
drop policy if exists "lideres actualizan canciones" on public.canciones;
create policy "lideres insertan canciones" on public.canciones for insert to authenticated
with check (public.puede_administrar_iglesia(iglesia_id));
create policy "lideres actualizan canciones" on public.canciones for update to authenticated
using (public.puede_administrar_iglesia(iglesia_id)) with check (public.puede_administrar_iglesia(iglesia_id));

drop policy if exists "partes insertar (membresia)" on public.partes_cancion;
drop policy if exists "partes actualizar (membresia)" on public.partes_cancion;
drop policy if exists "partes borrar (membresia)" on public.partes_cancion;
drop policy if exists "lideres insertan partes" on public.partes_cancion;
drop policy if exists "lideres actualizan partes" on public.partes_cancion;
drop policy if exists "lideres eliminan partes" on public.partes_cancion;
create policy "lideres insertan partes" on public.partes_cancion for insert to authenticated with check (exists (
  select 1 from public.canciones c where c.id = cancion_id and public.puede_administrar_iglesia(c.iglesia_id)));
create policy "lideres actualizan partes" on public.partes_cancion for update to authenticated using (exists (
  select 1 from public.canciones c where c.id = cancion_id and public.puede_administrar_iglesia(c.iglesia_id))) with check (exists (
  select 1 from public.canciones c where c.id = cancion_id and public.puede_administrar_iglesia(c.iglesia_id)));
create policy "lideres eliminan partes" on public.partes_cancion for delete to authenticated using (exists (
  select 1 from public.canciones c where c.id = cancion_id and public.puede_administrar_iglesia(c.iglesia_id)));

drop policy if exists "usuario inserta listas en su iglesia" on public.listas_culto;
drop policy if exists "usuario actualiza listas de su iglesia" on public.listas_culto;
drop policy if exists "usuario elimina listas de su iglesia" on public.listas_culto;
drop policy if exists "lideres insertan listas" on public.listas_culto;
drop policy if exists "lideres actualizan listas" on public.listas_culto;
drop policy if exists "lideres eliminan listas" on public.listas_culto;
create policy "lideres insertan listas" on public.listas_culto for insert to authenticated with check (public.puede_administrar_iglesia(iglesia_id));
create policy "lideres actualizan listas" on public.listas_culto for update to authenticated using (public.puede_administrar_iglesia(iglesia_id)) with check (public.puede_administrar_iglesia(iglesia_id));
create policy "lideres eliminan listas" on public.listas_culto for delete to authenticated using (public.puede_administrar_iglesia(iglesia_id));

drop policy if exists "usuario inserta items en su iglesia" on public.items_lista;
drop policy if exists "usuario actualiza items de su iglesia" on public.items_lista;
drop policy if exists "usuario elimina items de su iglesia" on public.items_lista;
drop policy if exists "lideres insertan items" on public.items_lista;
drop policy if exists "lideres actualizan items" on public.items_lista;
drop policy if exists "lideres eliminan items" on public.items_lista;
create policy "lideres insertan items" on public.items_lista for insert to authenticated with check (exists (
  select 1 from public.listas_culto l where l.id = lista_id and public.puede_administrar_iglesia(l.iglesia_id)));
create policy "lideres actualizan items" on public.items_lista for update to authenticated using (exists (
  select 1 from public.listas_culto l where l.id = lista_id and public.puede_administrar_iglesia(l.iglesia_id))) with check (exists (
  select 1 from public.listas_culto l where l.id = lista_id and public.puede_administrar_iglesia(l.iglesia_id)));
create policy "lideres eliminan items" on public.items_lista for delete to authenticated using (exists (
  select 1 from public.listas_culto l where l.id = lista_id and public.puede_administrar_iglesia(l.iglesia_id)));

drop policy if exists "usuario inserta en historial de su iglesia" on public.historial_proyecciones;
drop policy if exists "lideres insertan historial" on public.historial_proyecciones;
create policy "lideres insertan historial" on public.historial_proyecciones for insert to authenticated
with check (public.puede_administrar_iglesia(iglesia_id));

drop policy if exists "miembros publican el estado en vivo de su iglesia" on public.estado_culto;
drop policy if exists "miembros actualizan el estado en vivo de su iglesia" on public.estado_culto;
drop policy if exists "lideres publican estado" on public.estado_culto;
drop policy if exists "lideres actualizan estado" on public.estado_culto;
create policy "lideres publican estado" on public.estado_culto for insert to authenticated with check (public.puede_administrar_iglesia(iglesia_id));
create policy "lideres actualizan estado" on public.estado_culto for update to authenticated using (public.puede_administrar_iglesia(iglesia_id)) with check (public.puede_administrar_iglesia(iglesia_id));

-- Los registros pueden contener datos técnicos sensibles. Cada usuario ve los
-- suyos y solo el administrador de la iglesia puede auditar o limpiar el resto.
drop policy if exists "errores ver (iglesia)" on public.errores_log;
drop policy if exists "errores borrar (iglesia)" on public.errores_log;
drop policy if exists "errores ver propios o admin" on public.errores_log;
drop policy if exists "admin elimina errores" on public.errores_log;
create policy "errores ver propios o admin" on public.errores_log for select to authenticated
using (user_id = auth.uid() or (iglesia_id is not null and public.rol_usuario_en_iglesia(iglesia_id) = 'admin'));
create policy "admin elimina errores" on public.errores_log for delete to authenticated
using (iglesia_id is not null and public.rol_usuario_en_iglesia(iglesia_id) = 'admin');

-- Extrae la iglesia de {iglesiaId}/... o logos/{iglesiaId}/...
create or replace function public.iglesia_de_ruta_storage(p_name text)
returns uuid language plpgsql immutable set search_path = public
as $$
declare segmento text;
begin
  segmento := case when split_part(p_name,'/',1) = 'logos' then split_part(p_name,'/',2) else split_part(p_name,'/',1) end;
  if segmento !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return segmento::uuid;
end $$;

drop policy if exists "Permitir actualizar imagenes autenticado" on storage.objects;
drop policy if exists "Permitir borrar imagenes autenticado" on storage.objects;
drop policy if exists "Permitir subir imagenes autenticado" on storage.objects;
drop policy if exists "Permitir ver imagenes publicas" on storage.objects;
drop policy if exists "miembros ven multimedia de su iglesia" on storage.objects;
drop policy if exists "lideres suben multimedia de su iglesia" on storage.objects;
drop policy if exists "lideres actualizan multimedia de su iglesia" on storage.objects;
drop policy if exists "lideres borran multimedia de su iglesia" on storage.objects;
create policy "miembros ven multimedia de su iglesia" on storage.objects for select to authenticated
using (bucket_id = 'imagenes-culto' and public.pertenece_a_iglesia(public.iglesia_de_ruta_storage(name)));
create policy "lideres suben multimedia de su iglesia" on storage.objects for insert to authenticated
with check (bucket_id = 'imagenes-culto' and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name)));
create policy "lideres actualizan multimedia de su iglesia" on storage.objects for update to authenticated
using (bucket_id = 'imagenes-culto' and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name)))
with check (bucket_id = 'imagenes-culto' and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name)));
create policy "lideres borran multimedia de su iglesia" on storage.objects for delete to authenticated
using (bucket_id = 'imagenes-culto' and public.puede_administrar_iglesia(public.iglesia_de_ruta_storage(name)));

-- Integridad: estas relaciones nunca deben inventar UUID al omitir la FK.
alter table public.canciones alter column iglesia_id drop default;
alter table public.partes_cancion alter column cancion_id drop default;
alter table public.items_lista alter column lista_id drop default;
alter table public.items_lista alter column cancion_id drop default;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'canciones_iglesia_id_fkey') then
    alter table public.canciones add constraint canciones_iglesia_id_fkey
      foreign key (iglesia_id) references public.iglesias(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listas_culto_iglesia_id_fkey') then
    alter table public.listas_culto add constraint listas_culto_iglesia_id_fkey
      foreign key (iglesia_id) references public.iglesias(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'iglesias_plan_valido') then
    alter table public.iglesias add constraint iglesias_plan_valido
      check (plan in ('gratis','pro','premium')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_iglesia_rol_valido') then
    alter table public.usuarios_iglesia add constraint usuarios_iglesia_rol_valido
      check (rol in ('admin','lider','musico')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invitaciones_rol_valido') then
    alter table public.invitaciones add constraint invitaciones_rol_valido
      check (rol in ('admin','lider','musico')) not valid;
  end if;
end $$;

create index if not exists idx_usuarios_iglesia_iglesia_user
  on public.usuarios_iglesia(iglesia_id, user_id);

commit;
