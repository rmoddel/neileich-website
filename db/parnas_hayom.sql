-- Run once against the managed Postgres database referenced by DATABASE_URL.
create table if not exists sponsorship_types (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  price_cents integer not null check (price_cents > 0), active boolean not null default true,
  display_order integer not null default 0, max_per_date integer not null default 1 check (max_per_date > 0),
  recurring_enabled boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists sponsorships (
  id uuid primary key default gen_random_uuid(), sponsorship_type_id uuid not null references sponsorship_types(id),
  donor_name text not null, donor_email text not null, donor_phone text, dedication_type text not null, dedication_text text not null,
  anonymous boolean not null default false, gregorian_date date not null, hebrew_year integer not null, hebrew_month integer not null, hebrew_day integer not null,
  timezone text not null default 'America/New_York', amount_cents integer not null, currency text not null default 'usd', payment_provider text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','manual')),
  payment_reference text, recurring boolean not null default false, recurrence_id uuid, status text not null default 'reserved_pending_payment'
    check (status in ('reserved_pending_payment','confirmed','cancelled','expired','blocked_by_admin','manual')),
  internal_notes text, reservation_expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists donations (
  id uuid primary key default gen_random_uuid(), receipt_token uuid not null default gen_random_uuid() unique,
  donor_name text not null, donor_email text not null, donor_phone text, amount_cents integer not null check (amount_cents >= 100 and amount_cents <= 100000000),
  currency text not null default 'usd', payment_provider text, payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_reference text, status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','failed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table sponsorships add column if not exists receipt_token uuid not null default gen_random_uuid();
create unique index if not exists sponsorships_receipt_token_unique on sponsorships(receipt_token);
create table if not exists recurrence_rules (
  id uuid primary key default gen_random_uuid(), sponsorship_id uuid not null unique references sponsorships(id), calendar_type text not null default 'hebrew',
  hebrew_month integer not null, hebrew_day integer not null, leap_year_policy text not null default 'adar_ii_else_adar', payment_behavior text not null default 'reminder',
  next_occurrence date not null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sponsorships_recurrence_fk'
  ) then
    alter table sponsorships add constraint sponsorships_recurrence_fk foreign key (recurrence_id) references recurrence_rules(id) deferrable initially deferred;
  end if;
end $$;
create table if not exists blocked_dates (id uuid primary key default gen_random_uuid(), date date not null, sponsorship_type_id uuid references sponsorship_types(id), reason text, created_by text not null, created_at timestamptz not null default now());
create index if not exists blocked_dates_lookup on blocked_dates(date, sponsorship_type_id);
create table if not exists payment_events (id uuid primary key default gen_random_uuid(), provider_event_id text not null unique, sponsorship_id uuid references sponsorships(id), event_type text not null, processed_at timestamptz not null default now(), payload_reference text);
create table if not exists email_events (id uuid primary key default gen_random_uuid(), sponsorship_id uuid references sponsorships(id), recipient text not null, template text not null, status text not null, provider_message_id text, sent_at timestamptz, error text);
alter table payment_events add column if not exists donation_id uuid references donations(id);
alter table email_events add column if not exists donation_id uuid references donations(id);
create table if not exists audit_events (id uuid primary key default gen_random_uuid(), sponsorship_id uuid references sponsorships(id), actor text not null, action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

-- Takes a row lock on the sponsorship type. That serializes checkout holds for this type and safely enforces capacity.
drop function if exists create_pending_sponsorship(uuid, text, text, text, text, text, boolean, date, integer, integer, integer, boolean);
create function create_pending_sponsorship(p_type uuid, p_name text, p_email text, p_phone text, p_dedication_type text, p_dedication_text text, p_anonymous boolean, p_date date, p_hebrew_year integer, p_hebrew_month integer, p_hebrew_day integer, p_recurring boolean)
returns table (id uuid, amount_cents integer, receipt_token uuid) language plpgsql as $$
declare v_type sponsorship_types%rowtype; v_count integer; v_id uuid; v_receipt_token uuid;
begin
  select * into v_type from sponsorship_types where sponsorship_types.id = p_type and active = true for update;
  if not found then raise exception 'This sponsorship option is no longer available'; end if;
  if exists (select 1 from blocked_dates where date = p_date and (sponsorship_type_id is null or sponsorship_type_id = p_type)) then raise exception 'This date is unavailable'; end if;
  select count(*) into v_count from sponsorships where sponsorship_type_id = p_type and gregorian_date = p_date and (status = 'confirmed' or (status = 'reserved_pending_payment' and reservation_expires_at > now()));
  if v_count >= v_type.max_per_date then raise exception 'This date was just reserved by another donor'; end if;
  insert into sponsorships (sponsorship_type_id, donor_name, donor_email, donor_phone, dedication_type, dedication_text, anonymous, gregorian_date, hebrew_year, hebrew_month, hebrew_day, amount_cents, recurring, reservation_expires_at)
  values (p_type, p_name, lower(p_email), nullif(p_phone,''), p_dedication_type, p_dedication_text, p_anonymous, p_date, p_hebrew_year, p_hebrew_month, p_hebrew_day, v_type.price_cents, p_recurring, now() + interval '20 minutes') returning sponsorships.id, sponsorships.receipt_token into v_id, v_receipt_token;
  insert into audit_events(sponsorship_id, actor, action) values (v_id, 'donor', 'checkout_hold_created');
  return query select v_id, v_type.price_cents, v_receipt_token;
end $$;
create or replace function confirm_paid_sponsorship(p_id uuid, p_reference text) returns void language plpgsql as $$
begin update sponsorships set payment_status = 'paid', payment_reference = p_reference, status = 'confirmed', reservation_expires_at = null, updated_at = now() where id = p_id and status = 'reserved_pending_payment'; if found then insert into audit_events(sponsorship_id, actor, action) values (p_id, 'payment_webhook', 'payment_confirmed'); end if; end $$;
create or replace function create_pending_donation(p_name text, p_email text, p_phone text, p_amount_cents integer)
returns table (id uuid, receipt_token uuid) language plpgsql as $$
declare v_id uuid; v_receipt_token uuid;
begin
  insert into donations (donor_name, donor_email, donor_phone, amount_cents)
  values (p_name, lower(p_email), nullif(p_phone, ''), p_amount_cents)
  returning donations.id, donations.receipt_token into v_id, v_receipt_token;
  return query select v_id, v_receipt_token;
end $$;

insert into sponsorship_types (name, description, price_cents, display_order, recurring_enabled)
select * from (values
  ('Sponsor a Day', 'Support Neileich programs for a full day.', 18000, 1, true),
  ('Sponsor Night Seder', 'Help make an evening of learning possible.', 7200, 2, true),
  ('Sponsor a Shabbos Program', 'Bring warmth and inspiration to Shabbos.', 36000, 3, true),
  ('Sponsor a Month', 'Sustain a month of belonging and growth.', 180000, 4, false)) as seed(name, description, price_cents, display_order, recurring_enabled)
where not exists (select 1 from sponsorship_types);
