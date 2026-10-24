-- #756: default OFF. Applying this migration authorizes no provider spending.
-- USD micro-units (1 USD = 1,000,000); periods are UTC calendar day/month.
create table public.gemini_budget_config (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  provider_project_id text,
  model text not null default 'gemini-3-flash-preview',
  daily_limit_microusd bigint not null default 0 check (daily_limit_microusd >= 0),
  monthly_limit_microusd bigint not null default 0 check (monthly_limit_microusd >= 0),
  input_price_microusd_per_million bigint not null default 500000 check (input_price_microusd_per_million between 1 and 1000000000000),
  output_price_microusd_per_million bigint not null default 3000000 check (output_price_microusd_per_million between 1 and 1000000000000)
);
-- Official Standard text/image rates checked 2026-10-09: $0.50 / $3.00 per 1M.
-- Operators must reconfirm project/model/prices before enabling.
insert into public.gemini_budget_config(id) values (1);
create table public.gemini_budget_periods (
  kind text not null check (kind in ('day','month')),
  period_start date not null,
  used_microusd bigint not null default 0 check (used_microusd >= 0),
  primary key (kind, period_start)
);
create table public.gemini_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  day_start date not null,
  month_start date not null,
  model text not null,
  provider_project_id text not null,
  reserved_microusd bigint not null,
  input_price bigint not null,
  output_price bigint not null,
  prompt_tokens bigint,
  output_tokens bigint,
  actual_microusd bigint,
  status text not null default 'reserved' check (status in ('reserved','settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index gemini_reservations_day on public.gemini_budget_reservations(day_start);
create index gemini_reservations_month on public.gemini_budget_reservations(month_start);
create table public.ai_request_claims (
  key text primary key,
  owner uuid not null,
  fingerprint text not null,
  status text not null default 'processing' check (status in ('processing','complete')),
  response jsonb,
  created_at timestamptz not null default now()
);
create unique index ai_request_processing_fingerprint on public.ai_request_claims(fingerprint) where status='processing';
alter table public.gemini_budget_config enable row level security;
alter table public.gemini_budget_periods enable row level security;
alter table public.gemini_budget_reservations enable row level security;
alter table public.ai_request_claims enable row level security;
revoke all on public.gemini_budget_config, public.gemini_budget_periods, public.gemini_budget_reservations, public.ai_request_claims from public, anon, authenticated;
grant select, insert, update, delete on public.gemini_budget_config, public.gemini_budget_periods, public.gemini_budget_reservations, public.ai_request_claims to service_role;
create policy gemini_config_service on public.gemini_budget_config to service_role using (true) with check (true);
create policy gemini_periods_service on public.gemini_budget_periods to service_role using (true) with check (true);
create policy gemini_reservations_service on public.gemini_budget_reservations to service_role using (true) with check (true);
create policy ai_claims_service on public.ai_request_claims to service_role using (true) with check (true);

create function public.reserve_gemini_budget(p_model text, p_input_tokens bigint, p_output_tokens bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.gemini_budget_config;
  d date := (statement_timestamp() at time zone 'UTC')::date;
  m date := date_trunc('month', statement_timestamp() at time zone 'UTC')::date;
  cost bigint;
  reservation uuid;
begin
  if p_input_tokens is null or p_output_tokens is null or p_input_tokens < 0 or p_input_tokens > 1048576 or p_output_tokens < 0 or p_output_tokens > 65536 then
    raise exception 'Invalid token bounds';
  end if;
  -- One shared row lock governs admission, BOTH period counters and settlement.
  select * into c from public.gemini_budget_config where id=1 for update;
  if not found or not c.enabled or nullif(btrim(c.provider_project_id),'') is null
     or c.model <> p_model or c.daily_limit_microusd <= 0 or c.monthly_limit_microusd <= 0 then
    return jsonb_build_object('status','disabled');
  end if;
  cost := ceil((p_input_tokens::numeric*c.input_price_microusd_per_million + p_output_tokens::numeric*c.output_price_microusd_per_million)/1000000);
  if cost <= 0 then raise exception 'Invalid reservation'; end if;
  insert into public.gemini_budget_periods(kind,period_start) values ('day',d),('month',m) on conflict do nothing;
  -- Detect missing/corrupt counters; never silently recreate capacity while
  -- reservations from this period still exist.
  if (select used_microusd from public.gemini_budget_periods where kind='day' and period_start=d)
       <> (select coalesce(sum(coalesce(actual_microusd,reserved_microusd)),0) from public.gemini_budget_reservations where day_start=d)
     or (select used_microusd from public.gemini_budget_periods where kind='month' and period_start=m)
       <> (select coalesce(sum(coalesce(actual_microusd,reserved_microusd)),0) from public.gemini_budget_reservations where month_start=m) then
    raise exception 'Budget counter mismatch';
  end if;
  if (select used_microusd from public.gemini_budget_periods where kind='day' and period_start=d) + cost > c.daily_limit_microusd
     or (select used_microusd from public.gemini_budget_periods where kind='month' and period_start=m) + cost > c.monthly_limit_microusd then
    return jsonb_build_object('status','exhausted');
  end if;
  update public.gemini_budget_periods set used_microusd=used_microusd+cost
    where (kind='day' and period_start=d) or (kind='month' and period_start=m);
  insert into public.gemini_budget_reservations(day_start,month_start,model,provider_project_id,reserved_microusd,input_price,output_price)
    values(d,m,p_model,c.provider_project_id,cost,c.input_price_microusd_per_million,c.output_price_microusd_per_million) returning id into reservation;
  return jsonb_build_object('status','reserved','reservationId',reservation);
end $$;

create function public.settle_gemini_budget(p_reservation_id uuid, p_prompt_tokens bigint, p_output_tokens bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.gemini_budget_reservations; actual bigint; changed integer;
begin
  if p_prompt_tokens is null or p_output_tokens is null or p_prompt_tokens < 0 or p_output_tokens < 0 or p_prompt_tokens > 1000000000 or p_output_tokens > 1000000000 then
    raise exception 'Invalid usage';
  end if;
  perform 1 from public.gemini_budget_config where id=1 for update;
  if not found then raise exception 'Missing budget config'; end if;
  select * into r from public.gemini_budget_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Unknown reservation'; end if;
  if r.status='settled' then return jsonb_build_object('status','settled'); end if;
  actual := ceil((p_prompt_tokens::numeric*r.input_price + p_output_tokens::numeric*r.output_price)/1000000);
  update public.gemini_budget_periods set used_microusd=used_microusd-r.reserved_microusd+actual
    where (kind='day' and period_start=r.day_start) or (kind='month' and period_start=r.month_start);
  get diagnostics changed = row_count;
  if changed <> 2 then raise exception 'Missing budget periods'; end if;
  update public.gemini_budget_reservations set prompt_tokens=p_prompt_tokens, output_tokens=p_output_tokens,
    actual_microusd=actual,status='settled',settled_at=now() where id=r.id;
  -- Record even unexpected provider overruns; stop subsequent admission.
  if actual > r.reserved_microusd then update public.gemini_budget_config set enabled=false where id=1; end if;
  return jsonb_build_object('status','settled','overrun',actual > r.reserved_microusd);
end $$;

create function public.claim_ai_request(p_key text, p_owner uuid, p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.ai_request_claims; inserted integer;
begin
  if nullif(p_key,'') is null or nullif(p_fingerprint,'') is null or p_owner is null then raise exception 'Invalid claim'; end if;
  insert into public.ai_request_claims(key,owner,fingerprint) values(p_key,p_owner,p_fingerprint) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=1 then return jsonb_build_object('status','claimed'); end if;
  select * into r from public.ai_request_claims where key=p_key for update;
  if r.status='complete' then return jsonb_build_object('status','complete','response',r.response); end if;
  return jsonb_build_object('status','in_progress');
end $$;
create function public.complete_ai_request(p_key text, p_owner uuid, p_response jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.ai_request_claims set status='complete',response=p_response where key=p_key and owner=p_owner and status='processing';
  return found;
end $$;
create function public.release_ai_request(p_key text, p_owner uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.ai_request_claims where key=p_key and owner=p_owner and status='processing';
  return found;
end $$;
revoke all on function public.reserve_gemini_budget(text,bigint,bigint), public.settle_gemini_budget(uuid,bigint,bigint), public.claim_ai_request(text,uuid,text), public.complete_ai_request(text,uuid,jsonb), public.release_ai_request(text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_gemini_budget(text,bigint,bigint), public.settle_gemini_budget(uuid,bigint,bigint), public.claim_ai_request(text,uuid,text), public.complete_ai_request(text,uuid,jsonb), public.release_ai_request(text,uuid) to service_role;
