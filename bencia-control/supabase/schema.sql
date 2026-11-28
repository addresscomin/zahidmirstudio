create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','reviewer','member','auditor')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  environment text not null default 'development' check (environment in ('development','staging','production')),
  framework text,
  owner_id uuid references auth.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table if not exists public.agent_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  resource_name text not null,
  access_level text not null check (access_level in ('read','write','admin','unknown')),
  data_category text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (agent_id, organization_id) references public.agents(id, organization_id) on delete cascade
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested')),
  request_summary text not null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (agent_id, organization_id) references public.agents(id, organization_id) on delete cascade
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (agent_id, organization_id) references public.agents(id, organization_id) on delete set null (agent_id)
);

create table if not exists public.decommission_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  task text not null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (agent_id, organization_id) references public.agents(id, organization_id) on delete cascade
);

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  generated_by uuid references auth.users(id) on delete set null,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists idx_memberships_user on public.organization_memberships(user_id);
create index if not exists idx_agents_org on public.agents(organization_id);
create index if not exists idx_permissions_agent on public.agent_permissions(agent_id);
create index if not exists idx_approvals_org_status on public.approval_requests(organization_id, status);
create index if not exists idx_activity_org_created on public.activity_events(organization_id, created_at desc);
create index if not exists idx_reports_org_period on public.monthly_reports(organization_id, period_start desc);

create or replace function private.has_org_role(p_org_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org_id
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any(p_roles))
  );
$$;
revoke all on function private.has_org_role(uuid, text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

create or replace function private.add_organization_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is distinct from (select auth.uid()) then
    raise exception 'Organization creator must match authenticated user';
  end if;
  insert into public.organization_memberships (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
revoke all on function private.add_organization_owner() from public;
drop trigger if exists trg_add_organization_owner on public.organizations;
create trigger trg_add_organization_owner after insert on public.organizations
for each row execute function private.add_organization_owner();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.agents enable row level security;
alter table public.agent_permissions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_events enable row level security;
alter table public.decommission_tasks enable row level security;
alter table public.monthly_reports enable row level security;

create policy "org members read organizations" on public.organizations
for select to authenticated using (private.has_org_role(id));
create policy "users create own organization" on public.organizations
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners admins update organization" on public.organizations
for update to authenticated using (private.has_org_role(id, array['owner','admin']))
with check (private.has_org_role(id, array['owner','admin']));

create policy "members read memberships" on public.organization_memberships
for select to authenticated using (private.has_org_role(organization_id));
create policy "owners admins add non-owner members" on public.organization_memberships
for insert to authenticated with check (
  role in ('admin','reviewer','member','auditor')
  and private.has_org_role(organization_id, array['owner','admin'])
);
create policy "owners update membership roles" on public.organization_memberships
for update to authenticated using (role <> 'owner' and private.has_org_role(organization_id, array['owner']))
with check (role in ('admin','reviewer','member','auditor') and private.has_org_role(organization_id, array['owner']));
create policy "owners admins remove members" on public.organization_memberships
for delete to authenticated using (
  role <> 'owner'
  and (private.has_org_role(organization_id, array['owner']) or private.has_org_role(organization_id, array['admin']))
);

create policy "members read agents" on public.agents
for select to authenticated using (private.has_org_role(organization_id));
create policy "members register agents" on public.agents
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "members update agents" on public.agents
for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "owners admins delete agents" on public.agents
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

create policy "members read permissions" on public.agent_permissions
for select to authenticated using (private.has_org_role(organization_id));
create policy "members add permissions" on public.agent_permissions
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "members update permissions" on public.agent_permissions
for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "owners admins delete permissions" on public.agent_permissions
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

create policy "members read approval requests" on public.approval_requests
for select to authenticated using (private.has_org_role(organization_id));
create policy "members submit approval requests" on public.approval_requests
for insert to authenticated with check (
  requested_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner','admin','member'])
);
create policy "reviewers decide approval requests" on public.approval_requests
for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','reviewer']))
with check (private.has_org_role(organization_id, array['owner','admin','reviewer']));

create policy "members read activity events" on public.activity_events
for select to authenticated using (private.has_org_role(organization_id));
create policy "members append activity events" on public.activity_events
for insert to authenticated with check (
  actor_id = (select auth.uid()) and private.has_org_role(organization_id)
);
-- No UPDATE or DELETE policies are created for activity_events.

create policy "members read decommission tasks" on public.decommission_tasks
for select to authenticated using (private.has_org_role(organization_id));
create policy "members add decommission tasks" on public.decommission_tasks
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "members update decommission tasks" on public.decommission_tasks
for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy "owners admins delete decommission tasks" on public.decommission_tasks
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

create policy "members read reports" on public.monthly_reports
for select to authenticated using (private.has_org_role(organization_id));
create policy "owners admins reviewers create reports" on public.monthly_reports
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','reviewer']));

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select, insert, update, delete on public.agent_permissions to authenticated;
grant select, insert, update on public.approval_requests to authenticated;
grant select, insert on public.activity_events to authenticated;
grant select, insert, update, delete on public.decommission_tasks to authenticated;
grant select, insert on public.monthly_reports to authenticated;
