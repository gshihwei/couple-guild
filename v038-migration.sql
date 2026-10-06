-- Couple Guild V0.3.8.1 settings migration
-- Run once in Supabase SQL Editor. Safe to run repeatedly.

create or replace function public.update_my_display_name(p_guild_id uuid, p_display_name text)
returns public.guild_members
language plpgsql
security definer
set search_path=public
as $$
declare r public.guild_members;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.guild_members
     set display_name=coalesce(nullif(trim(p_display_name),''),'玩家')
   where guild_id=p_guild_id and user_id=auth.uid()
   returning * into r;
  if r is null then raise exception 'not_in_guild'; end if;
  return r;
end;
$$;
grant execute on function public.update_my_display_name(uuid,text) to authenticated, anon;

create or replace function public.update_guild_name(p_guild_id uuid, p_name text)
returns public.guilds
language plpgsql
security definer
set search_path=public
as $$
declare r public.guilds;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.guilds g
     set name=coalesce(nullif(trim(p_name),''),'星光旅團')
   where g.id=p_guild_id
     and g.owner_id=auth.uid()
     and exists (select 1 from public.guild_members gm where gm.guild_id=g.id and gm.user_id=auth.uid() and gm.role='owner')
   returning * into r;
  if r is null then raise exception 'owner_only'; end if;
  return r;
end;
$$;
grant execute on function public.update_guild_name(uuid,text) to authenticated, anon;

create or replace function public.update_account_guild_settings(p_guild_id uuid, p_display_name text, p_guild_name text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  m public.guild_members;
  g public.guilds;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  update public.guild_members
     set display_name=coalesce(nullif(trim(p_display_name),''),'玩家')
   where guild_id=p_guild_id and user_id=auth.uid()
   returning * into m;
  if m is null then raise exception 'not_in_guild'; end if;

  if m.role='owner' then
    update public.guilds
       set name=coalesce(nullif(trim(p_guild_name),''),'星光旅團')
     where id=p_guild_id and owner_id=auth.uid()
     returning * into g;
    if g is null then raise exception 'owner_only'; end if;
  else
    select * into g from public.guilds where id=p_guild_id;
    if g.id is null then raise exception 'guild_not_found'; end if;
  end if;

  return jsonb_build_object(
    'guild_id',m.guild_id,
    'user_id',m.user_id,
    'display_name',m.display_name,
    'guild_name',g.name,
    'role',m.role
  );
end;
$$;
grant execute on function public.update_account_guild_settings(uuid,text,text) to authenticated, anon;

-- Make guild name updates visible through Supabase Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime'
       and schemaname='public'
       and tablename='guilds'
  ) then
    alter publication supabase_realtime add table public.guilds;
  end if;
end
$$;
