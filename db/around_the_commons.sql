-- Run against the existing Neon database. Safe to rerun; unrelated tables are untouched.
create table if not exists newsletter_approval_locks (
  issue_week text primary key,
  claimed_at timestamptz not null default now()
);
create table if not exists newsletter_login_attempts (
  attempt_key text not null,
  window_start timestamptz not null,
  attempts integer not null default 0,
  primary key (attempt_key, window_start)
);
create table if not exists newsletter_sessions (
  session_id uuid primary key,
  username text not null,
  expires_at timestamptz not null
);

create table if not exists newsletter_categories (
  category text primary key,
  print_order integer not null,
  usage text not null default '',
  active boolean not null default true
);
create table if not exists newsletter_issues (
  issue_week date primary key check (extract(dow from issue_week) = 5),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED')),
  date_line text not null default '',
  intro text not null default '',
  approved_at timestamptz,
  approved_by text,
  sent_at timestamptz,
  pdf_url text,
  error text,
  updated_at timestamptz not null default now()
);
create table if not exists newsletter_incoming (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  issue_week date not null check (extract(dow from issue_week) = 5),
  source text not null,
  sender text not null default '',
  source_id text not null,
  raw_text text not null,
  cleaned_payload jsonb,
  ingest_status text not null default 'RECEIVED',
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists newsletter_incoming_week_idx on newsletter_incoming (issue_week, received_at);
create table if not exists newsletter_announcements (
  id uuid primary key default gen_random_uuid(),
  issue_week date not null references newsletter_issues(issue_week),
  incoming_id uuid unique references newsletter_incoming(id),
  category text not null references newsletter_categories(category),
  title text not null default '',
  body text not null default '',
  contact text not null default '',
  event_date text not null default '',
  price text not null default '',
  flags text not null default '',
  original_text text not null default '',
  review_status text not null default 'NEEDS_REVIEW' check (review_status in ('NEEDS_REVIEW', 'READY', 'EXCLUDE')),
  sort_order integer not null default 0,
  processed_at timestamptz,
  notes text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletter_announcements_week_idx on newsletter_announcements (issue_week, category, sort_order);
create table if not exists newsletter_zmanim_imports (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique,
  filename text not null,
  byte_size integer not null,
  blob_path text,
  status text not null default 'PROCESSING' check (status in ('PROCESSING','READY_FOR_REVIEW','CONFIRMED','FAILED')),
  embedded_text text not null default '',
  embedded_rows jsonb not null default '[]'::jsonb,
  raw_model_records jsonb not null default '[]'::jsonb,
  extracted_records jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error text not null default '',
  uploaded_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table newsletter_zmanim_imports add column if not exists embedded_rows jsonb not null default '[]'::jsonb;
alter table newsletter_zmanim_imports add column if not exists raw_model_records jsonb not null default '[]'::jsonb;
create table if not exists newsletter_zmanim (
  issue_week date primary key check (extract(dow from issue_week) = 5),
  parsha_he text not null default '', parsha_en text not null default '',
  friday_date text not null default '', shabbos_date text not null default '',
  candle_lighting text not null default '', friday_sunset text not null default '',
  sof_zman_shema_gra text not null default '', shabbos_ends text not null default '',
  source text not null default '', verification_status text not null default 'NEEDS_REVIEW' check (verification_status in ('NEEDS_REVIEW','VERIFIED')),
  notes text not null default '', shacharis text not null default '',
  sof_zman_shema_mga text not null default '', shabbos_mincha text not null default '',
  motzai_maariv text not null default '', friday_mincha text not null default '',
  friday_maariv text not null default '', erev_shabbos_mincha text not null default '',
  import_id uuid references newsletter_zmanim_imports(id),
  original_values jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by text,
  updated_at timestamptz not null default now()
);
create table if not exists newsletter_published (
  issue_week date primary key references newsletter_issues(issue_week),
  snapshot jsonb not null,
  approved_at timestamptz not null,
  approved_by text not null
);
create or replace function newsletter_prevent_published_mutation() returns trigger language plpgsql as $$
begin raise exception 'Approved newsletter snapshots are immutable'; end $$;
drop trigger if exists newsletter_published_immutable on newsletter_published;
create trigger newsletter_published_immutable before update or delete on newsletter_published
for each row execute function newsletter_prevent_published_mutation();

-- The existing lock row serializes draft saves, ingestion, and approval for one week.
create or replace function newsletter_lock_week(p_week date) returns void language plpgsql as $$
begin
  insert into newsletter_approval_locks(issue_week) values (p_week::text) on conflict do nothing;
  perform 1 from newsletter_approval_locks where issue_week = p_week::text for update;
end $$;

create or replace function save_newsletter_draft(p_week date, p_changes jsonb) returns void language plpgsql as $$
declare v_item jsonb; v_id uuid; v_version integer; v_category text; v_status text;
begin
  if extract(dow from p_week) <> 5 or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 300 then raise exception 'Invalid draft'; end if;
  perform newsletter_lock_week(p_week);
  insert into newsletter_issues(issue_week) values (p_week) on conflict do nothing;
  if exists (select 1 from newsletter_issues where issue_week = p_week and status = 'APPROVED') then raise exception 'Approved issues cannot be edited'; end if;
  for v_item in select value from jsonb_array_elements(p_changes) loop
    v_category := v_item->>'category'; v_status := v_item->>'review_status';
    if not exists (select 1 from newsletter_categories where category = v_category and active) then raise exception 'Choose a configured category'; end if;
    if v_status not in ('NEEDS_REVIEW','READY','EXCLUDE') or v_status is null then raise exception 'Choose a valid review status'; end if;
    if length(trim(coalesce(v_item->>'title','') || coalesce(v_item->>'body',''))) = 0 then raise exception 'Announcement wording is required'; end if;
    if (v_item->>'sort_order') !~ '^-?[0-9]+$' then raise exception 'Invalid order'; end if;
    if coalesce(v_item->>'id','') = '' then
      insert into newsletter_announcements(issue_week,category,title,body,contact,event_date,price,flags,original_text,review_status,sort_order,processed_at,notes)
      values(p_week,v_category,coalesce(v_item->>'title',''),coalesce(v_item->>'body',''),coalesce(v_item->>'contact',''),coalesce(v_item->>'event_date',''),coalesce(v_item->>'price',''),coalesce(v_item->>'flags',''),coalesce(v_item->>'original_text',''),v_status,(v_item->>'sort_order')::integer,now(),coalesce(v_item->>'notes',''));
    else
      v_id := (v_item->>'id')::uuid; v_version := (v_item->>'revision')::integer;
      update newsletter_announcements set category=v_category,title=coalesce(v_item->>'title',''),body=coalesce(v_item->>'body',''),contact=coalesce(v_item->>'contact',''),event_date=coalesce(v_item->>'event_date',''),price=coalesce(v_item->>'price',''),flags=coalesce(v_item->>'flags',''),review_status=v_status,sort_order=(v_item->>'sort_order')::integer,notes=coalesce(v_item->>'notes',''),version=version+1,updated_at=now()
      where id=v_id and issue_week=p_week and version=v_version;
      if not found then raise exception 'This announcement changed. Reload before saving.'; end if;
    end if;
  end loop;
end $$;

-- A spreadsheet batch is atomic. The existing incoming source identity makes a retry idempotent.
-- Only individual announcement fields are stored; the original spreadsheet file stays in the browser.
create or replace function import_newsletter_bulk(p_week date, p_batch uuid, p_entries jsonb) returns jsonb language plpgsql as $$
declare v_item jsonb; v_ordinal bigint; v_id uuid; v_category text; v_status text; v_existing integer; v_order integer;
begin
  if extract(dow from p_week) <> 5 or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 300 then raise exception 'Invalid bulk import'; end if;
  perform newsletter_lock_week(p_week);
  select count(*) into v_existing from newsletter_incoming where source='spreadsheet' and source_id like p_batch::text || ':%';
  if v_existing > 0 then
    if v_existing <> jsonb_array_length(p_entries) then raise exception 'This import key was already used for different entries'; end if;
    for v_item, v_ordinal in select value, ordinality from jsonb_array_elements(p_entries) with ordinality loop
      if not exists (select 1 from newsletter_incoming where source='spreadsheet' and source_id=p_batch::text || ':' || v_ordinal::text and issue_week=p_week and cleaned_payload=v_item) then
        raise exception 'This import key was already used for different entries';
      end if;
    end loop;
    return jsonb_build_object('week',p_week,'imported',0,'alreadyImported',v_existing,'failed',0);
  end if;
  insert into newsletter_issues(issue_week) values(p_week) on conflict do nothing;
  if exists (select 1 from newsletter_issues where issue_week=p_week and status='APPROVED') then raise exception 'Approved issues cannot be edited'; end if;
  select coalesce(max(sort_order),0) into v_order from newsletter_announcements where issue_week=p_week;
  for v_item, v_ordinal in select value, ordinality from jsonb_array_elements(p_entries) with ordinality loop
    v_category := v_item->>'category'; v_status := v_item->>'review_status';
    if not exists (select 1 from newsletter_categories where category=v_category and active) then raise exception 'Row % has an unknown category: %', v_ordinal, v_category; end if;
    if trim(coalesce(v_item->>'body','')) = '' then raise exception 'Row % is missing announcement wording', v_ordinal; end if;
    if v_status not in ('NEEDS_REVIEW','READY') or v_status is null then raise exception 'Row % has an invalid review status', v_ordinal; end if;
    if coalesce(v_item->>'event_date','') <> '' and (v_item->>'event_date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Row % has an invalid event date', v_ordinal; end if;
    insert into newsletter_incoming(issue_week,source,source_id,raw_text,cleaned_payload,ingest_status)
      values(p_week,'spreadsheet',p_batch::text || ':' || v_ordinal::text,coalesce(v_item->>'original_text',v_item->>'body'),v_item,'PROCESSED') returning id into v_id;
    insert into newsletter_announcements(issue_week,incoming_id,category,title,body,contact,event_date,price,flags,original_text,review_status,sort_order,processed_at,notes)
      values(p_week,v_id,v_category,coalesce(v_item->>'title',''),v_item->>'body',coalesce(v_item->>'contact',''),coalesce(v_item->>'event_date',''),coalesce(v_item->>'price',''),'',coalesce(v_item->>'original_text',v_item->>'body'),v_status,v_order+v_ordinal::integer,now(),coalesce(v_item->>'notes',''));
  end loop;
  return jsonb_build_object('week',p_week,'imported',jsonb_array_length(p_entries),'alreadyImported',0,'failed',0);
end $$;

create or replace function approve_newsletter(p_week date, p_actor text) returns jsonb language plpgsql as $$
declare v_shabbos jsonb; v_entries jsonb; v_categories jsonb; v_snapshot jsonb; v_approved_at timestamptz := now();
begin
  if extract(dow from p_week) <> 5 then raise exception 'Invalid Friday issue date'; end if;
  perform newsletter_lock_week(p_week);
  insert into newsletter_issues(issue_week) values (p_week) on conflict do nothing;
  if exists (select 1 from newsletter_published where issue_week=p_week) or exists (select 1 from newsletter_issues where issue_week=p_week and status='APPROVED') then raise exception 'Issue is already approved'; end if;
  select to_jsonb(s) into v_shabbos from newsletter_zmanim s where issue_week=p_week and verification_status='VERIFIED';
  if v_shabbos is null or coalesce(v_shabbos->>'parsha_he','')='' or coalesce(v_shabbos->>'candle_lighting','')='' or coalesce(v_shabbos->>'friday_sunset','')='' or coalesce(v_shabbos->>'shacharis','')='' or coalesce(v_shabbos->>'sof_zman_shema_mga','')='' or coalesce(v_shabbos->>'sof_zman_shema_gra','')='' or coalesce(v_shabbos->>'motzai_maariv','')='' then raise exception 'Verified Shabbos information is required'; end if;
  if exists (select 1 from newsletter_announcements where issue_week=p_week and review_status='NEEDS_REVIEW') then raise exception 'Resolve announcements that need review'; end if;
  if exists (select 1 from newsletter_announcements where issue_week=p_week and review_status='READY' and (trim(flags)<>'' or (trim(title)='' and trim(body)='') or (event_date<>'' and (event_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or event_date < p_week::text)))) then raise exception 'Resolve blocking announcement warnings'; end if;
  select jsonb_agg(to_jsonb(a) order by a.sort_order,a.id) into v_entries from newsletter_announcements a where issue_week=p_week and review_status='READY';
  if v_entries is null then raise exception 'No READY announcements to approve'; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.print_order,c.category),'[]'::jsonb) into v_categories from newsletter_categories c where active;
  v_snapshot := jsonb_build_object('week',p_week::text,'entries',v_entries,'shabbos',v_shabbos,'categories',v_categories);
  insert into newsletter_published(issue_week,snapshot,approved_at,approved_by) values(p_week,v_snapshot,v_approved_at,p_actor);
  update newsletter_issues set status='APPROVED',approved_at=v_approved_at,approved_by=p_actor,updated_at=v_approved_at where issue_week=p_week;
  return v_snapshot;
end $$;

create or replace function save_newsletter_shabbos(p_week date,p_data jsonb) returns void language plpgsql as $$
begin
  if extract(dow from p_week) <> 5 or jsonb_typeof(p_data) <> 'object' then raise exception 'Invalid Shabbos data'; end if;
  perform newsletter_lock_week(p_week);
  if exists (select 1 from newsletter_issues where issue_week=p_week and status='APPROVED') or exists (select 1 from newsletter_published where issue_week=p_week) then raise exception 'Approved issues cannot be edited'; end if;
  if p_data->>'verification_status'='VERIFIED' and (coalesce(p_data->>'candle_lighting','')='' or coalesce(p_data->>'friday_sunset','')='' or coalesce(p_data->>'shacharis','')='' or coalesce(p_data->>'sof_zman_shema_mga','')='' or coalesce(p_data->>'sof_zman_shema_gra','')='' or coalesce(p_data->>'motzai_maariv','')='') then raise exception 'Required official zmanim are missing'; end if;
  if exists (select 1 from newsletter_zmanim where issue_week=p_week and verification_status='VERIFIED') and coalesce(p_data->>'replace_verified','false') <> 'true' then raise exception 'Confirm replacement of verified zmanim'; end if;
  insert into newsletter_zmanim(issue_week,parsha_he,parsha_en,friday_date,shabbos_date,candle_lighting,friday_sunset,sof_zman_shema_gra,shabbos_ends,source,verification_status,notes,shacharis,sof_zman_shema_mga,shabbos_mincha,motzai_maariv,friday_mincha,friday_maariv,erev_shabbos_mincha,verified_at,verified_by)
  values(p_week,coalesce(p_data->>'parsha_he',''),coalesce(p_data->>'parsha_en',''),coalesce(p_data->>'friday_date',''),coalesce(p_data->>'shabbos_date',''),coalesce(p_data->>'candle_lighting',''),coalesce(p_data->>'friday_sunset',''),coalesce(p_data->>'sof_zman_shema_gra',''),coalesce(p_data->>'shabbos_ends',''),coalesce(p_data->>'source',''),coalesce(p_data->>'verification_status','NEEDS_REVIEW'),coalesce(p_data->>'notes',''),coalesce(p_data->>'shacharis',''),coalesce(p_data->>'sof_zman_shema_mga',''),coalesce(p_data->>'shabbos_mincha',''),coalesce(p_data->>'motzai_maariv',''),coalesce(p_data->>'friday_mincha',''),coalesce(p_data->>'friday_maariv',''),coalesce(p_data->>'erev_shabbos_mincha',''),case when p_data->>'verification_status'='VERIFIED' then now() end,case when p_data->>'verification_status'='VERIFIED' then p_data->>'verified_by' end)
  on conflict(issue_week) do update set parsha_he=excluded.parsha_he,parsha_en=excluded.parsha_en,friday_date=excluded.friday_date,shabbos_date=excluded.shabbos_date,candle_lighting=excluded.candle_lighting,friday_sunset=excluded.friday_sunset,sof_zman_shema_gra=excluded.sof_zman_shema_gra,shabbos_ends=excluded.shabbos_ends,source=excluded.source,verification_status=excluded.verification_status,notes=excluded.notes,shacharis=excluded.shacharis,sof_zman_shema_mga=excluded.sof_zman_shema_mga,shabbos_mincha=excluded.shabbos_mincha,motzai_maariv=excluded.motzai_maariv,friday_mincha=excluded.friday_mincha,friday_maariv=excluded.friday_maariv,erev_shabbos_mincha=excluded.erev_shabbos_mincha,verified_at=excluded.verified_at,verified_by=excluded.verified_by,updated_at=now();
end $$;

-- One transaction confirms every reviewed week. Existing verified rows and approved issues are never replaced.
create or replace function confirm_newsletter_zmanim(p_import uuid,p_actor text,p_records jsonb) returns void language plpgsql as $$
declare v_record jsonb; v_week date; v_original jsonb; v_seen integer[] := '{}'; v_source_index integer;
begin
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 or jsonb_array_length(p_records) > 100 then raise exception 'Choose 1 to 100 reviewed weeks'; end if;
  perform 1 from newsletter_zmanim_imports where id=p_import and status='READY_FOR_REVIEW' for update;
  if not found then raise exception 'Import is unavailable or already confirmed'; end if;
  for v_record in select value from jsonb_array_elements(p_records) order by value->>'issue_week' loop
    v_source_index := (v_record->>'source_index')::integer;
    if v_source_index < 0 or v_source_index = any(v_seen) then raise exception 'Duplicate or invalid source record'; end if;
    v_seen := array_append(v_seen,v_source_index);
    v_week := (v_record->>'issue_week')::date;
    if extract(dow from v_week) <> 5 or coalesce(v_record->>'friday_date','') <> v_week::text or coalesce(v_record->>'parsha_he','') = '' then raise exception 'Each week needs a Friday date and parsha'; end if;
    if coalesce(v_record->>'candle_lighting','') = '' or coalesce(v_record->>'friday_sunset','') = '' or coalesce(v_record->>'shacharis','') = '' or coalesce(v_record->>'sof_zman_shema_mga','') = '' or coalesce(v_record->>'sof_zman_shema_gra','') = '' or coalesce(v_record->>'motzai_maariv','') = '' then raise exception 'Required official times are missing'; end if;
    if exists (select 1 from newsletter_issues where issue_week=v_week and status='APPROVED') or exists (select 1 from newsletter_published where issue_week=v_week) then raise exception 'An approved issue cannot change'; end if;
    perform newsletter_lock_week(v_week);
    if exists (select 1 from newsletter_zmanim where issue_week=v_week and verification_status='VERIFIED') then raise exception 'Verified zmanim already exist for %',v_week; end if;
    select jsonb_build_object('preview',value,'raw_model',(select raw_model_records->((v_record->>'source_index')::integer) from newsletter_zmanim_imports where id=p_import),'embedded_rows',(select embedded_rows from newsletter_zmanim_imports where id=p_import)) into v_original from jsonb_array_elements((select extracted_records from newsletter_zmanim_imports where id=p_import)) with ordinality as item(value,ord) where ord=(v_record->>'source_index')::integer+1;
    if v_original is null then raise exception 'Invalid source record'; end if;
    insert into newsletter_zmanim(issue_week,parsha_he,parsha_en,friday_date,shabbos_date,candle_lighting,friday_sunset,sof_zman_shema_gra,shabbos_ends,source,verification_status,notes,shacharis,sof_zman_shema_mga,shabbos_mincha,motzai_maariv,friday_mincha,friday_maariv,erev_shabbos_mincha,import_id,original_values,verified_at,verified_by)
    values(v_week,coalesce(v_record->>'parsha_he',''),coalesce(v_record->>'parsha_en',''),v_week::text,coalesce(v_record->>'shabbos_date',''),coalesce(v_record->>'candle_lighting',''),coalesce(v_record->>'friday_sunset',''),coalesce(v_record->>'sof_zman_shema_gra',''),coalesce(v_record->>'shabbos_ends',''),'Bais Medrash of Lakewood Commons — imported chart','VERIFIED',coalesce(v_record->>'notes',''),coalesce(v_record->>'shacharis',''),coalesce(v_record->>'sof_zman_shema_mga',''),coalesce(v_record->>'shabbos_mincha',''),coalesce(v_record->>'motzai_maariv',''),coalesce(v_record->>'friday_mincha',''),coalesce(v_record->>'friday_maariv',''),coalesce(v_record->>'erev_shabbos_mincha',''),p_import,v_original,now(),p_actor)
    on conflict(issue_week) do update set parsha_he=excluded.parsha_he,parsha_en=excluded.parsha_en,friday_date=excluded.friday_date,shabbos_date=excluded.shabbos_date,candle_lighting=excluded.candle_lighting,friday_sunset=excluded.friday_sunset,sof_zman_shema_gra=excluded.sof_zman_shema_gra,shabbos_ends=excluded.shabbos_ends,source=excluded.source,verification_status=excluded.verification_status,notes=excluded.notes,shacharis=excluded.shacharis,sof_zman_shema_mga=excluded.sof_zman_shema_mga,shabbos_mincha=excluded.shabbos_mincha,motzai_maariv=excluded.motzai_maariv,friday_mincha=excluded.friday_mincha,friday_maariv=excluded.friday_maariv,erev_shabbos_mincha=excluded.erev_shabbos_mincha,import_id=excluded.import_id,original_values=excluded.original_values,verified_at=excluded.verified_at,verified_by=excluded.verified_by,updated_at=now();
  end loop;
  update newsletter_zmanim_imports set status='CONFIRMED',updated_at=now() where id=p_import;
end $$;

create or replace function ingest_newsletter(p_source text,p_source_id text,p_received_at timestamptz,p_week date,p_sender text,p_raw text,p_cleaned jsonb) returns uuid language plpgsql as $$
declare v_id uuid; v_category text; v_cleaned jsonb; v_stored_week date;
begin
  if extract(dow from p_week) <> 5 then raise exception 'Invalid Friday issue date'; end if;
  perform newsletter_lock_week(p_week);
  insert into newsletter_incoming(received_at,issue_week,source,sender,source_id,raw_text,cleaned_payload,ingest_status)
  values(p_received_at,p_week,p_source,coalesce(p_sender,''),p_source_id,p_raw,p_cleaned,case when p_cleaned is null then 'RECEIVED' else 'PROCESSED' end)
  on conflict(source,source_id) do update set cleaned_payload=coalesce(newsletter_incoming.cleaned_payload,excluded.cleaned_payload),ingest_status=case when newsletter_incoming.cleaned_payload is null and excluded.cleaned_payload is not null then 'PROCESSED' else newsletter_incoming.ingest_status end
  returning id,cleaned_payload,issue_week into v_id,v_cleaned,v_stored_week;
  if v_stored_week <> p_week then raise exception 'Submission issue week cannot change'; end if;
  if p_cleaned is null or exists (select 1 from newsletter_announcements where incoming_id=v_id) then return v_id; end if;
  if exists (select 1 from newsletter_issues where issue_week=p_week and status='APPROVED') then update newsletter_incoming set ingest_status='AFTER_APPROVAL' where id=v_id; return v_id; end if;
  insert into newsletter_issues(issue_week) values(p_week) on conflict do nothing;
  v_category := p_cleaned->>'category';
  if not exists (select 1 from newsletter_categories where category=v_category and active) then v_category := 'Other Notices'; end if;
  if not exists (select 1 from newsletter_categories where category=v_category and active) then raise exception 'Configure at least one fallback category'; end if;
  insert into newsletter_announcements(issue_week,incoming_id,category,title,body,contact,event_date,price,flags,original_text,review_status,sort_order,processed_at,notes)
  values(p_week,v_id,v_category,coalesce(p_cleaned->>'title',''),coalesce(p_cleaned->>'body',''),coalesce(p_cleaned->>'contact',''),coalesce(p_cleaned->>'event_date',''),coalesce(p_cleaned->>'price',''),coalesce(p_cleaned->>'flags',''),p_raw,'NEEDS_REVIEW',coalesce((select max(sort_order)+1 from newsletter_announcements where issue_week=p_week),1),now(),coalesce(p_cleaned->>'notes',''));
  return v_id;
end $$;

insert into newsletter_categories(category,print_order,usage) values
('Neileich Updates',1,'Lead feature'),('Mazel Tov',2,'Simchos and celebrations'),('Community Updates',3,'Neighborhood news and notices'),('Events & Shiurim',4,'Classes and events'),('Lost & Found',5,'Missing or found property'),('Looking For',6,'Requests and carpools'),('Libraries & Kids',7,'Libraries and children’s programs'),('Selling / For Rent',8,'Items and rentals'),('Classifieds & Services',9,'Local advertising and services'),('Dedications',10,'Memorials and sponsorships'),('Other Notices',11,'Unclassified items for manual review')
on conflict(category) do nothing;
insert into newsletter_zmanim(issue_week,parsha_he,parsha_en,friday_date,shabbos_date,candle_lighting,friday_sunset,sof_zman_shema_gra,shabbos_ends,source,verification_status,notes,shacharis,sof_zman_shema_mga,shabbos_mincha,motzai_maariv,friday_mincha,friday_maariv,erev_shabbos_mincha)
values('2026-11-06','פרשת חיי שרה','Chayei Sara','2026-11-06','2026-11-07','4:30 PM','4:48 PM','9:07 AM','','Bais Medrash of Lakewood Commons — uploaded Zmanim Chart','VERIFIED','Official shul chart. The chart lists Motzai Shabbos Maariv 5:48 / 6:00 PM, not a separate Shabbos-end/havdalah time.','7:30 / 8:15 AM','8:31 AM','1:20 PM; 4:03 / 4:18 PM','5:48 / 6:00 PM','4:33 PM','5:38 PM','12:30 / 1:00 / 1:15 PM; 1:35 / 1:50 / 2:15 / 3:00 PM')
on conflict(issue_week) do nothing;
