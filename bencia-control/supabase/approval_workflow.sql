-- Bencia Control approval workflow hardening (apply after schema.sql)
-- Decisions are made through a narrowly-scoped RPC; direct row updates are constrained too.

drop policy if exists "reviewers decide approval requests" on public.approval_requests;

create policy "reviewers decide pending approval requests"
on public.approval_requests
for update
to authenticated
using (
  status = 'pending'
  and private.has_org_role(organization_id, array['owner','admin','reviewer'])
)
with check (
  status in ('approved','rejected','changes_requested')
  and decided_by = (select auth.uid())
  and decided_at is not null
  and private.has_org_role(organization_id, array['owner','admin','reviewer'])
);

create or replace function private.guard_approval_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending' then
    raise exception 'Only pending requests can be decided';
  end if;
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.agent_id is distinct from old.agent_id
     or new.requested_by is distinct from old.requested_by
     or new.request_summary is distinct from old.request_summary
     or new.created_at is distinct from old.created_at then
    raise exception 'Approval request details are immutable';
  end if;
  if new.status not in ('approved','rejected','changes_requested')
     or new.decided_by is distinct from (select auth.uid())
     or new.decided_at is null then
    raise exception 'Invalid approval decision';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_approval_update on public.approval_requests;
create trigger trg_guard_approval_update
before update on public.approval_requests
for each row execute function private.guard_approval_update();

create or replace function public.decide_approval_request(
  p_request_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_agent_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_decision not in ('approved','rejected','changes_requested') then
    raise exception 'Unsupported decision';
  end if;

  update public.approval_requests
  set status = p_decision,
      decided_by = (select auth.uid()),
      decided_at = now()
  where id = p_request_id
    and status = 'pending'
  returning organization_id, agent_id into v_org_id, v_agent_id;

  if v_org_id is null then
    raise exception 'Request not found, already decided, or not permitted';
  end if;

  insert into public.activity_events (
    organization_id, agent_id, actor_id, event_type, summary, metadata
  ) values (
    v_org_id, v_agent_id, (select auth.uid()),
    'approval.' || p_decision,
    'Approval request ' || p_decision,
    jsonb_build_object('approval_request_id', p_request_id, 'decision', p_decision)
  );

  return p_request_id;
end;
$$;

revoke all on function public.decide_approval_request(uuid, text) from public;
revoke all on function public.decide_approval_request(uuid, text) from anon;
grant execute on function public.decide_approval_request(uuid, text) to authenticated;
