-- Run after db/around_the_commons.sql in a disposable transaction/schema.
select save_newsletter_shabbos('2026-11-20','{"parsha_he":"ויצא","parsha_en":"Vayetzei","candle_lighting":"4:17 PM","friday_sunset":"4:35 PM","shacharis":"7:30 / 8:15 AM","sof_zman_shema_mga":"8:40 AM","sof_zman_shema_gra":"9:16 AM","motzai_maariv":"5:35 / 5:47 PM","source":"official feed","verification_status":"VERIFIED","original_values":{"generatedAt":"2026-11-19T00:00:00Z","friday":{"date":"2026-11-20"}}}'::jsonb);
do $$ begin
  if not exists (select 1 from newsletter_zmanim where issue_week='2026-11-20' and verification_status='VERIFIED' and original_values->'friday'->>'date'='2026-11-20') then raise exception 'Official schedule audit values were not preserved'; end if;
end $$;
