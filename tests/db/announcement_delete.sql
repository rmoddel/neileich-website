-- Run after db/around_the_commons.sql in a disposable transaction/schema.
insert into newsletter_issues(issue_week) values ('2026-11-13');
insert into newsletter_incoming(id,issue_week,source,source_id,raw_text)
values ('22222222-2222-4222-8222-222222222222','2026-11-13','spreadsheet','delete-check:1','Original wording');
insert into newsletter_announcements(id,issue_week,incoming_id,category,title,body,review_status,is_test)
values
('11111111-1111-4111-8111-111111111111','2026-11-13','22222222-2222-4222-8222-222222222222','Community Updates','Delete me','Announcement','READY',false),
('11111111-1111-4111-8111-111111111112','2026-11-13',null,'Community Updates','Test 1','Announcement','READY',true),
('11111111-1111-4111-8111-111111111113','2026-11-13',null,'Community Updates','Test 2','Announcement','READY',true),
('11111111-1111-4111-8111-111111111114','2026-11-13',null,'Community Updates','Keep me','Announcement','READY',false);
do $$ begin
  if delete_newsletter_announcement('2026-11-13','11111111-1111-4111-8111-111111111111','editor') <> 1 then raise exception 'Single deletion failed'; end if;
  if delete_newsletter_announcement('2026-11-13','11111111-1111-4111-8111-111111111111','editor') <> 0 then raise exception 'Repeat deletion was not idempotent'; end if;
  if not exists (select 1 from newsletter_incoming where id='22222222-2222-4222-8222-222222222222') then raise exception 'Original submission was lost'; end if;
  if delete_newsletter_test_announcements('2026-11-13','editor',2) <> 2 then raise exception 'Test cleanup failed'; end if;
  if (select count(*) from newsletter_announcements where issue_week='2026-11-13' and deleted_at is null) <> 1 then raise exception 'Wrong rows remained after cleanup'; end if;
  if not exists (select 1 from newsletter_announcements where id='11111111-1111-4111-8111-111111111114' and deleted_at is null) then raise exception 'Non-test row was deleted'; end if;
end $$;
update newsletter_issues set status='APPROVED' where issue_week='2026-11-13';
do $$ begin
  begin
    perform delete_newsletter_announcement('2026-11-13','11111111-1111-4111-8111-111111111114','editor');
    raise exception 'Approved issue accepted deletion';
  exception when others then
    if sqlerrm <> 'Approved issues cannot be edited' then raise; end if;
  end;
end $$;
