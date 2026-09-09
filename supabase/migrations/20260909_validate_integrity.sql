-- Ejecutar únicamente después de que verificar_integridad.sql entregue todo en cero.
-- Cambia restricciones NOT VALID a plenamente validadas contra datos históricos.

begin;

alter table public.canciones validate constraint canciones_iglesia_id_fkey;
alter table public.listas_culto validate constraint listas_culto_iglesia_id_fkey;
alter table public.iglesias validate constraint iglesias_plan_valido;
alter table public.usuarios_iglesia validate constraint usuarios_iglesia_rol_valido;
alter table public.invitaciones validate constraint invitaciones_rol_valido;

commit;
