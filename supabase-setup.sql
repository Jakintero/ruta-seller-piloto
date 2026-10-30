-- RUTA SELLER · PILOTO DE VALIDACIÓN
-- Ejecutar en un PROYECTO NUEVO de Supabase, SQL Editor.
-- No ejecutar en la base de datos de otra aplicación.
-- Requiere Supabase Auth (Email) y Storage.
begin;

create table if not exists public.ruta_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student','teacher')),
  created_at timestamptz not null default now()
);

create table if not exists public.ruta_tasks (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved')),
  teacher_feedback text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ruta_products (
  owner_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object' and pg_column_size(data) < 8000),
  image_path text,
  updated_at timestamptz not null default now(),
  primary key(owner_id,slot),
  constraint ruta_imagepath_format check (
    image_path is null or
    image_path = owner_id::text || '/' || slot::text || '.webp'
  )
);

create or replace function public.ruta_is_teacher()
returns boolean language sql stable security definer set search_path=''
as $$select exists (select 1 from public.ruta_profiles p where p.id=(select auth.uid()) and p.role='teacher');$$;

create or replace function public.ruta_can_edit(p_owner uuid)
returns boolean language sql stable security definer set search_path=''
as $$select p_owner=(select auth.uid()) and exists(
 select 1 from public.ruta_tasks t where t.owner_id=p_owner and t.status in ('draft','changes_requested')
);$$;

-- Trigger: registro de usuario -> perfil alumno + tarea inicial.
create or replace function public.ruta_on_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.ruta_profiles(id,email,full_name)
  values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),120))
  on conflict (id) do nothing;
  insert into public.ruta_tasks(owner_id) values(new.id) on conflict(owner_id) do nothing;
  return new;
end $$;

drop trigger if exists ruta_auth_created on auth.users;
create trigger ruta_auth_created after insert on auth.users
for each row execute function public.ruta_on_new_user();

-- Si ya se probaron cuentas antes de instalar el esquema:
insert into public.ruta_profiles(id,email,full_name)
select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'full_name',''),120)
from auth.users on conflict(id) do nothing;
insert into public.ruta_tasks(owner_id)
select id from auth.users on conflict(owner_id) do nothing;

alter table public.ruta_profiles enable row level security;
alter table public.ruta_tasks enable row level security;
alter table public.ruta_products enable row level security;

drop policy if exists ruta_profiles_view on public.ruta_profiles;
create policy ruta_profiles_view on public.ruta_profiles for select to authenticated
using (id=(select auth.uid()) or (select public.ruta_is_teacher()));

drop policy if exists ruta_tasks_view on public.ruta_tasks;
create policy ruta_tasks_view on public.ruta_tasks for select to authenticated
using (owner_id=(select auth.uid()) or (select public.ruta_is_teacher()));

drop policy if exists ruta_products_view on public.ruta_products;
create policy ruta_products_view on public.ruta_products for select to authenticated
using (owner_id=(select auth.uid()) or (select public.ruta_is_teacher()));

drop policy if exists ruta_products_insert on public.ruta_products;
create policy ruta_products_insert on public.ruta_products for insert to authenticated
with check (owner_id=(select auth.uid()) and public.ruta_can_edit(owner_id));

drop policy if exists ruta_products_update on public.ruta_products;
create policy ruta_products_update on public.ruta_products for update to authenticated
using (owner_id=(select auth.uid()) and public.ruta_can_edit(owner_id))
with check (owner_id=(select auth.uid()) and public.ruta_can_edit(owner_id));

-- Sin borrado directo de productos: limpiar = guardar campos en blanco.
-- Estado, revisiones y roles cambian SOLO mediante funciones controladas.

create or replace function public.ruta_submit_task()
returns text language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := auth.uid(); v_state text;
begin
 if v_uid is null then raise exception 'Debes iniciar sesión.'; end if;
 select status into v_state from public.ruta_tasks where owner_id=v_uid for update;
 if v_state not in ('draft','changes_requested') then
   raise exception 'Esta tarea ya fue entregada o aprobada.';
 end if;
 -- Al menos un producto identificado y con 7 criterios escritos.
 if not exists (
   select 1 from public.ruta_products p
   where p.owner_id=v_uid
     and nullif(btrim(coalesce(p.data->>'name','')),'') is not null
     and p.data ?& array['price','china','different','brands','reviews','demand','profit']
     and nullif(btrim(coalesce(p.data->>'price','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'china','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'different','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'brands','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'reviews','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'demand','')),'') is not null
     and nullif(btrim(coalesce(p.data->>'profit','')),'') is not null
 ) then
   raise exception 'Completa al menos un producto antes de entregar.';
 end if;
 update public.ruta_tasks
 set status='submitted',submitted_at=now(),updated_at=now()
 where owner_id=v_uid;
 return 'submitted';
end $$;

create or replace function public.ruta_review_task(p_student uuid,p_decision text,p_feedback text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_state text;
begin
 if not public.ruta_is_teacher() then raise exception 'Solo un profesor puede revisar.'; end if;
 if p_decision not in ('changes_requested','approved') then raise exception 'Decisión inválida.'; end if;
 if length(coalesce(p_feedback,''))>2000 then raise exception 'Comentario demasiado largo.'; end if;
 if p_decision='changes_requested' and length(btrim(coalesce(p_feedback,'')))=0 then
   raise exception 'Escribe una observación para solicitar correcciones.';
 end if;
 select status into v_state from public.ruta_tasks where owner_id=p_student for update;
 if v_state is distinct from 'submitted' then raise exception 'Esta tarea no está pendiente de revisión.'; end if;
 update public.ruta_tasks
 set status=p_decision,teacher_feedback=coalesce(p_feedback,''),
     reviewed_at=now(),updated_at=now()
 where owner_id=p_student;
 return p_decision;
end $$;

revoke all on public.ruta_profiles,public.ruta_tasks,public.ruta_products from anon,authenticated;
grant select on public.ruta_profiles,public.ruta_tasks to authenticated;
grant select,insert,update on public.ruta_products to authenticated;
revoke all on function public.ruta_is_teacher() from public,anon;
revoke all on function public.ruta_can_edit(uuid) from public,anon;
revoke all on function public.ruta_submit_task() from public,anon;
revoke all on function public.ruta_review_task(uuid,text,text) from public,anon;
grant execute on function public.ruta_is_teacher() to authenticated;
grant execute on function public.ruta_can_edit(uuid) to authenticated;
grant execute on function public.ruta_submit_task() to authenticated;
grant execute on function public.ruta_review_task(uuid,text,text) to authenticated;

-- Bucket PRIVADO. Una sola imagen WEBP (200 KB máximo) por casilla.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ruta-piloto-fotos','ruta-piloto-fotos',false,204800,array['image/webp'])
on conflict(id) do update set
  public=false,file_size_limit=204800,allowed_mime_types=array['image/webp'];

drop policy if exists ruta_pilot_fotos_read on storage.objects;
create policy ruta_pilot_fotos_read on storage.objects for select to authenticated
using (bucket_id='ruta-piloto-fotos' and
  (split_part(name,'/',1)=(select auth.uid())::text or (select public.ruta_is_teacher())));

drop policy if exists ruta_pilot_fotos_insert on storage.objects;
create policy ruta_pilot_fotos_insert on storage.objects for insert to authenticated
with check (bucket_id='ruta-piloto-fotos'
  and name ~ ('^'||(select auth.uid())::text||'/[1-5]\.webp$')
  and public.ruta_can_edit((select auth.uid())));

drop policy if exists ruta_pilot_fotos_update on storage.objects;
create policy ruta_pilot_fotos_update on storage.objects for update to authenticated
using (bucket_id='ruta-piloto-fotos'
  and name ~ ('^'||(select auth.uid())::text||'/[1-5]\.webp$')
  and public.ruta_can_edit((select auth.uid())))
with check (bucket_id='ruta-piloto-fotos'
  and name ~ ('^'||(select auth.uid())::text||'/[1-5]\.webp$')
  and public.ruta_can_edit((select auth.uid())));


drop policy if exists ruta_pilot_fotos_delete on storage.objects;
create policy ruta_pilot_fotos_delete on storage.objects for delete to authenticated
using (bucket_id='ruta-piloto-fotos'
  and name ~ ('^'||(select auth.uid())::text||'/[1-5]\.webp$')
  and public.ruta_can_edit((select auth.uid())));

commit;

-- IMPORTANTE: después de crear TU cuenta docente en Authentication,
-- ejecutar ESTA instrucción por separado reemplazando el correo:
-- UPDATE public.ruta_profiles SET role='teacher'
-- WHERE lower(email)=lower('TU-CORREO-REAL@EJEMPLO.COM');
-- RECOMENDACIÓN: probar primero con 2 alumnos y 1 profesor.
