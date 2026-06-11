create extension if not exists pgcrypto;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create table public.hub_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  color text,
  added_by text not null default public.current_user_email(),
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint hub_members_email_lowercase check (email = lower(email)),
  constraint hub_members_color_allowed check (
    color is null or color in (
      'red',
      'orange',
      'yellow',
      'green',
      'mint',
      'cyan',
      'blue',
      'indigo',
      'purple',
      'pink',
      'gray',
      'black'
    )
  )
);

create unique index hub_members_active_color_unique
on public.hub_members (color)
where color is not null and removed_at is null;

create or replace function public.is_hub_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_members
    where email = public.current_user_email()
      and removed_at is null
  )
$$;

create or replace function public.is_hub_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_email() = 'jmoncadamo@unal.edu.co'
$$;

create table public.member_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null default public.current_user_email(),
  target_email text not null references public.hub_members(email) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_aliases_owner_lowercase check (owner_email = lower(owner_email)),
  constraint member_aliases_target_lowercase check (target_email = lower(target_email)),
  constraint member_aliases_no_self_alias check (owner_email <> target_email),
  constraint member_aliases_alias_not_empty check (length(trim(alias)) > 0),
  unique (owner_email, target_email)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by text not null default public.current_user_email(),
  created_at timestamptz not null default now(),
  updated_by text not null default public.current_user_email(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workspaces_name_not_empty check (length(trim(name)) > 0)
);

create table public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  url text not null,
  type text not null default 'Otro',
  note text not null default '',
  created_by text not null default public.current_user_email(),
  created_at timestamptz not null default now(),
  updated_by text not null default public.current_user_email(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workspace_links_title_not_empty check (length(trim(title)) > 0),
  constraint workspace_links_url_not_empty check (length(trim(url)) > 0),
  constraint workspace_links_type_allowed check (
    type in (
      'Drive',
      'Docs',
      'Sheets',
      'Slides',
      'Draw.io',
      'PDF',
      'GitHub',
      'Otro'
    )
  )
);

create table public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null,
  created_by text not null default public.current_user_email(),
  created_at timestamptz not null default now(),
  updated_by text not null default public.current_user_email(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workspace_notes_content_not_empty check (length(trim(content)) > 0)
);

create table public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null default '',
  created_by text not null default public.current_user_email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_email text not null default public.current_user_email(),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_entity_type_allowed check (entity_type in ('workspace', 'link')),
  constraint activity_log_action_allowed check (
    action in (
      'workspace_created',
      'workspace_updated',
      'workspace_deleted',
      'link_created',
      'link_updated',
      'link_deleted'
    )
  )
);

create index member_aliases_owner_email_idx on public.member_aliases(owner_email);
create index member_aliases_target_email_idx on public.member_aliases(target_email);
create index workspaces_deleted_at_idx on public.workspaces(deleted_at);
create index workspace_links_workspace_id_idx on public.workspace_links(workspace_id);
create index workspace_links_deleted_at_idx on public.workspace_links(deleted_at);
create index workspace_notes_workspace_id_idx on public.workspace_notes(workspace_id);
create index workspace_notes_deleted_at_idx on public.workspace_notes(deleted_at);
create index workspace_messages_workspace_id_created_at_idx on public.workspace_messages(workspace_id, created_at);
create index activity_log_workspace_id_created_at_idx on public.activity_log(workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_updated_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = public.current_user_email();
  return new;
end;
$$;

create or replace function public.log_workspace_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (
      workspace_id,
      entity_type,
      entity_id,
      action,
      actor_email,
      new_data
    )
    values (
      new.id,
      'workspace',
      new.id,
      'workspace_created',
      public.current_user_email(),
      to_jsonb(new)
    );
  elsif tg_op = 'UPDATE' then
    insert into public.activity_log (
      workspace_id,
      entity_type,
      entity_id,
      action,
      actor_email,
      old_data,
      new_data
    )
    values (
      new.id,
      'workspace',
      new.id,
      case
        when old.deleted_at is null and new.deleted_at is not null then 'workspace_deleted'
        else 'workspace_updated'
      end,
      public.current_user_email(),
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_link_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (
      workspace_id,
      entity_type,
      entity_id,
      action,
      actor_email,
      new_data
    )
    values (
      new.workspace_id,
      'link',
      new.id,
      'link_created',
      public.current_user_email(),
      to_jsonb(new)
    );
  elsif tg_op = 'UPDATE' then
    insert into public.activity_log (
      workspace_id,
      entity_type,
      entity_id,
      action,
      actor_email,
      old_data,
      new_data
    )
    values (
      new.workspace_id,
      'link',
      new.id,
      case
        when old.deleted_at is null and new.deleted_at is not null then 'link_deleted'
        else 'link_updated'
      end,
      public.current_user_email(),
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;

  return new;
end;
$$;

create trigger set_member_aliases_updated_at
before update on public.member_aliases
for each row execute function public.set_updated_at();

create trigger set_workspaces_updated_metadata
before update on public.workspaces
for each row execute function public.set_updated_metadata();

create trigger log_workspaces_activity
after insert or update on public.workspaces
for each row execute function public.log_workspace_activity();

create trigger set_workspace_links_updated_metadata
before update on public.workspace_links
for each row execute function public.set_updated_metadata();

create trigger log_workspace_links_activity
after insert or update on public.workspace_links
for each row execute function public.log_link_activity();

create trigger set_workspace_notes_updated_metadata
before update on public.workspace_notes
for each row execute function public.set_updated_metadata();

create trigger set_workspace_messages_updated_at
before update on public.workspace_messages
for each row execute function public.set_updated_at();

alter table public.hub_members enable row level security;
alter table public.member_aliases enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_links enable row level security;
alter table public.workspace_notes enable row level security;
alter table public.workspace_messages enable row level security;
alter table public.activity_log enable row level security;

create policy "hub members can view active members"
on public.hub_members for select
to authenticated
using (public.is_hub_member() and removed_at is null);

create policy "admin can add members"
on public.hub_members for insert
to authenticated
with check (public.is_hub_admin());

create policy "admin or self can update members"
on public.hub_members for update
to authenticated
using (public.is_hub_admin() or email = public.current_user_email())
with check (
  public.is_hub_admin()
  or (
    email = public.current_user_email()
    and removed_at is null
    and display_name is not null
    and length(trim(display_name)) > 0
    and color is not null
  )
);

create policy "members can view own aliases"
on public.member_aliases for select
to authenticated
using (public.is_hub_member() and owner_email = public.current_user_email());

create policy "members can create own aliases"
on public.member_aliases for insert
to authenticated
with check (public.is_hub_member() and owner_email = public.current_user_email());

create policy "members can update own aliases"
on public.member_aliases for update
to authenticated
using (public.is_hub_member() and owner_email = public.current_user_email())
with check (public.is_hub_member() and owner_email = public.current_user_email());

create policy "members can delete own aliases"
on public.member_aliases for delete
to authenticated
using (public.is_hub_member() and owner_email = public.current_user_email());

create policy "members can view workspaces"
on public.workspaces for select
to authenticated
using (public.is_hub_member());

create policy "members can create workspaces"
on public.workspaces for insert
to authenticated
with check (public.is_hub_member());

create policy "members can update workspaces"
on public.workspaces for update
to authenticated
using (public.is_hub_member())
with check (public.is_hub_member());

create policy "members can view links"
on public.workspace_links for select
to authenticated
using (public.is_hub_member());

create policy "members can create links"
on public.workspace_links for insert
to authenticated
with check (public.is_hub_member());

create policy "members can update links"
on public.workspace_links for update
to authenticated
using (public.is_hub_member())
with check (public.is_hub_member());

create policy "members can view notes"
on public.workspace_notes for select
to authenticated
using (public.is_hub_member());

create policy "members can create notes"
on public.workspace_notes for insert
to authenticated
with check (public.is_hub_member());

create policy "members can update notes"
on public.workspace_notes for update
to authenticated
using (public.is_hub_member())
with check (public.is_hub_member());

create policy "members can view messages"
on public.workspace_messages for select
to authenticated
using (public.is_hub_member());

create policy "members can create messages"
on public.workspace_messages for insert
to authenticated
with check (public.is_hub_member() and created_by = public.current_user_email());

create policy "message authors can update own messages"
on public.workspace_messages for update
to authenticated
using (public.is_hub_member() and created_by = public.current_user_email())
with check (public.is_hub_member() and created_by = public.current_user_email());

create policy "members can view activity log"
on public.activity_log for select
to authenticated
using (public.is_hub_member());

create policy "members can create activity log"
on public.activity_log for insert
to authenticated
with check (public.is_hub_member() and actor_email = public.current_user_email());

do $$
begin
  alter publication supabase_realtime add table public.hub_members;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workspaces;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workspace_links;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workspace_notes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workspace_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_log;
exception
  when duplicate_object then null;
end $$;

insert into public.hub_members (email, added_by)
values ('jmoncadamo@unal.edu.co', 'system');

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.hub_members to authenticated;
grant select, insert, update, delete on public.member_aliases to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_links to authenticated;
grant select, insert, update, delete on public.workspace_notes to authenticated;
grant select, insert, update, delete on public.workspace_messages to authenticated;
grant select, insert on public.activity_log to authenticated;

grant execute on function public.current_user_email() to authenticated;
grant execute on function public.is_hub_member() to authenticated;
grant execute on function public.is_hub_admin() to authenticated;

notify pgrst, 'reload schema';
