create extension if not exists pgcrypto;

create or replace function public.is_unal_user()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@unal.edu.co'
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

create table if not exists public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  url text not null,
  note text default '',
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  content text not null,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

create table if not exists public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  content text not null,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_links enable row level security;
alter table public.workspace_notes enable row level security;
alter table public.workspace_messages enable row level security;

drop policy if exists "unal users can view workspaces" on public.workspaces;
drop policy if exists "unal users can create workspaces" on public.workspaces;
drop policy if exists "unal users can edit workspaces" on public.workspaces;
drop policy if exists "unal users can delete workspaces" on public.workspaces;

create policy "unal users can view workspaces"
on public.workspaces for select
to authenticated
using (public.is_unal_user());

create policy "unal users can create workspaces"
on public.workspaces for insert
to authenticated
with check (public.is_unal_user());

create policy "unal users can edit workspaces"
on public.workspaces for update
to authenticated
using (public.is_unal_user())
with check (public.is_unal_user());

create policy "unal users can delete workspaces"
on public.workspaces for delete
to authenticated
using (public.is_unal_user());

drop policy if exists "unal users can view links" on public.workspace_links;
drop policy if exists "unal users can create links" on public.workspace_links;
drop policy if exists "unal users can edit links" on public.workspace_links;
drop policy if exists "unal users can delete links" on public.workspace_links;

create policy "unal users can view links"
on public.workspace_links for select
to authenticated
using (public.is_unal_user());

create policy "unal users can create links"
on public.workspace_links for insert
to authenticated
with check (public.is_unal_user());

create policy "unal users can edit links"
on public.workspace_links for update
to authenticated
using (public.is_unal_user())
with check (public.is_unal_user());

create policy "unal users can delete links"
on public.workspace_links for delete
to authenticated
using (public.is_unal_user());

drop policy if exists "unal users can view notes" on public.workspace_notes;
drop policy if exists "unal users can create notes" on public.workspace_notes;

create policy "unal users can view notes"
on public.workspace_notes for select
to authenticated
using (public.is_unal_user());

create policy "unal users can create notes"
on public.workspace_notes for insert
to authenticated
with check (public.is_unal_user());

drop policy if exists "unal users can view messages" on public.workspace_messages;
drop policy if exists "unal users can create messages" on public.workspace_messages;

create policy "unal users can view messages"
on public.workspace_messages for select
to authenticated
using (public.is_unal_user());

create policy "unal users can create messages"
on public.workspace_messages for insert
to authenticated
with check (public.is_unal_user());

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

notify pgrst, 'reload schema';
