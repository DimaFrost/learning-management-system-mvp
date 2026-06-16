# Google Drive setup for `drive-operations`

Service accounts **cannot upload files** to regular My Drive folders (no storage quota). All LMS files must live in a **Google Shared Drive**.

## 1. Create a Shared Drive

1. In Google Drive, click **Shared drives** → **New**.
2. Name it (e.g. `TBO LMS`).
3. **Manage members** → add the service account email (`client_email` from `GOOGLE_SERVICE_ACCOUNT_JSON`) as **Content manager** or **Manager**.

## 2. Set the root folder secret

1. Inside the Shared drive, create a folder (e.g. `Curriculum`).
2. Open the folder and copy its ID from the URL (`.../folders/FOLDER_ID`).
3. In Supabase → Project Settings → Edge Functions → Secrets, set:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — full service account JSON
   - `DRIVE_ROOT_FOLDER_ID` — folder ID **inside the Shared drive**

## 3. Deploy the edge function

```bash
npx supabase functions deploy drive-operations --project-ref YOUR_PROJECT_REF
```

## 4. Re-provision class folders

Existing folder IDs in Supabase may point at the old My Drive tree. Clear them and re-run folder setup:

```sql
-- Optional: clear course/subject roots if they were under My Drive
UPDATE public.courses SET drive_folder_id = NULL;
UPDATE public.subjects SET drive_folder_id = NULL;

UPDATE public.classes SET
  drive_folder_id = NULL,
  materials_folder_id = NULL,
  homework_folder_id = NULL,
  teacher_notes_folder_id = NULL,
  translator_notes_folder_id = NULL;
```

Then in the app, open each class → **Set up Google Drive folders**, or create new subjects/classes so folders are created under the Shared drive root.

## 5. Verify upload

Upload a small file in Class Detail → Materials. It should appear under `Materials` in the Shared drive folder for that class.

## Troubleshooting

| Error | Action |
|-------|--------|
| Service accounts do not have storage quota | Root must be in a Shared drive; re-provision folders after updating `DRIVE_ROOT_FOLDER_ID` |
| Insufficient permissions | Add service account to Shared drive as Content manager |
| File not found (parent) | Parent folder ID is invalid or not in Shared drive; clear IDs and re-provision |
