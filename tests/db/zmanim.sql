\set ON_ERROR_STOP on
begin;

insert into newsletter_zmanim_imports(id,sha256,filename,byte_size,status,uploaded_by,extracted_records)
values ('11111111-1111-4111-8111-111111111111','test-zmanim-a','chart.pdf',42,'READY_FOR_REVIEW','test','[{"parsha_he":"תולדות","candle_lighting":"4:23 PM"}]');

select confirm_newsletter_zmanim('11111111-1111-4111-8111-111111111111','test','[{"source_index":0,"issue_week":"2026-11-13","friday_date":"2026-11-13","parsha_he":"תולדות","candle_lighting":"4:23 PM","friday_sunset":"4:41 PM","shacharis":"7:30 / 8:15 AM","sof_zman_shema_mga":"8:35 AM","sof_zman_shema_gra":"9:11 AM","motzai_maariv":"5:42 / 5:54 PM"}]'::jsonb);

do $$
begin
  if not exists (select 1 from newsletter_zmanim where issue_week='2026-11-13' and verification_status='VERIFIED' and import_id='11111111-1111-4111-8111-111111111111' and original_values->'preview'->>'parsha_he'='תולדות') then raise exception 'Confirmed row or original values missing'; end if;
  if not exists (select 1 from newsletter_zmanim_imports where id='11111111-1111-4111-8111-111111111111' and status='CONFIRMED') then raise exception 'Import not confirmed'; end if;
  begin
    perform confirm_newsletter_zmanim('11111111-1111-4111-8111-111111111111','test','[{"source_index":0,"issue_week":"2026-11-13"}]'::jsonb);
    raise exception 'Duplicate confirmation succeeded';
  exception when others then
    if sqlerrm='Duplicate confirmation succeeded' then raise; end if;
  end;
end $$;

insert into newsletter_zmanim_imports(id,sha256,filename,byte_size,status,uploaded_by,extracted_records)
values ('22222222-2222-4222-8222-222222222222','test-zmanim-b','chart.pdf',42,'READY_FOR_REVIEW','test','[{"parsha_he":"חיי שרה","candle_lighting":"4:30 PM"}]');

do $$
begin
  begin
    perform confirm_newsletter_zmanim('22222222-2222-4222-8222-222222222222','test','[{"source_index":0,"issue_week":"2026-11-06","friday_date":"2026-11-06","parsha_he":"חיי שרה","candle_lighting":"4:30 PM","friday_sunset":"4:48 PM","shacharis":"7:30 / 8:15 AM","sof_zman_shema_mga":"8:31 AM","sof_zman_shema_gra":"9:07 AM","motzai_maariv":"5:48 / 6:00 PM"}]'::jsonb);
    raise exception 'Verified row overwritten';
  exception when others then
    if sqlerrm='Verified row overwritten' then raise; end if;
  end;
  if (select candle_lighting from newsletter_zmanim where issue_week='2026-11-06') <> '4:30 PM' then raise exception 'Verified fixture changed'; end if;
end $$;

do $$
begin
  begin
    perform approve_newsletter('2026-11-20','test');
    raise exception 'Approval succeeded without verified zmanim';
  exception when others then
    if sqlerrm='Approval succeeded without verified zmanim' then raise; end if;
  end;
end $$;

rollback;
