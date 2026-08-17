-- Atlas Health — medical record file storage
--
-- Original documents are stored as real files here, separate from the
-- structured facts parsed out of them (source_documents row + downstream
-- lab_markers/conditions/medications, see docs/PRODUCT-VISION.md). Path
-- convention: <subject_id>/<timestamp>-<filename> — the leading folder is
-- what the storage policies below key off, via the same can_view_subject/
-- can_edit_subject functions every other table uses.

insert into storage.buckets (id, name, public)
values ('medical-records', 'medical-records', false)
on conflict (id) do nothing;

create policy medical_records_select on storage.objects
  for select using (
    bucket_id = 'medical-records'
    and can_view_subject(((storage.foldername(name))[1])::uuid)
  );

create policy medical_records_insert on storage.objects
  for insert with check (
    bucket_id = 'medical-records'
    and can_edit_subject(((storage.foldername(name))[1])::uuid)
  );

create policy medical_records_delete on storage.objects
  for delete using (
    bucket_id = 'medical-records'
    and can_edit_subject(((storage.foldername(name))[1])::uuid)
  );
