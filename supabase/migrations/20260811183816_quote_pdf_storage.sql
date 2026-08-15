-- Switch quote PDF archival from Google Drive to Supabase Storage.
-- Drive was abandoned after a live test proved a real Google API limitation:
-- bare service accounts have no storage quota and cannot own files outside a
-- paid-Workspace-only Shared Drive (403 storageQuotaExceeded, confirmed via
-- a direct call to archive-quote-to-drive after GOOGLE_SERVICE_ACCOUNT_KEY
-- was set). Supabase Storage needs no external credential at all — it's the
-- same project already connected, service_role bypasses RLS on
-- storage.objects same as it does on every other table here.

insert into storage.buckets (id, name, public)
values ('quote-pdfs', 'quote-pdfs', false)
on conflict (id) do nothing;

-- drive_folder_id no longer means anything (Storage has no folder-sharing
-- concept the way Drive did — the bucket itself is the container, and the
-- per-quote path is enough). drive_file_id is repurposed as the Storage
-- object path rather than a Google file ID.
alter table public.quotes rename column drive_file_id to storage_path;
alter table public.quotes drop column drive_folder_id;
