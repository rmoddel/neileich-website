# Around the Commons

The editor lives at `/around-the-commons`, its login at `/around-the-commons/login`, and the Zmanim upload area at `/around-the-commons/zmanim`. `/atc` redirects to the editor. The Vite site and Vercel API functions use the existing Neon database. Google Sheets and Google OAuth are not used by the site. Apps Script can continue receiving Gmail/Voice submissions and calling Gemini upstream, then forward each submission to the ingestion API.

## Database and deployment

1. In the **existing** Neon database, run [db/around_the_commons.sql](db/around_the_commons.sql). It creates only newsletter tables/functions, reuses `newsletter_approval_locks`, seeds the existing category list and the already verified 2026-11-06 Bais Medrash times, and never replaces an existing row. Do not run against production before reviewing the target database and migration. `newsletter_zmanim` is the weekly source; `newsletter_zmanim_imports` keeps private chart references, extracted text, raw model records, and processing status. Approved issue snapshots remain immutable in `newsletter_published`.
2. In the **existing** Vercel project, set the server-only variables in `.env.example`: existing `DATABASE_URL` and `APP_URL`, plus `ATC_AUTH_USERNAME`, `ATC_AUTH_PASSWORD_HASH`, `ATC_AUTH_SESSION_SECRET`, `ATC_SESSION_MAX_AGE_HOURS`, `ATC_INGEST_TOKEN`, `NEWSLETTER_TIMEZONE`, `GEMINI_API_KEY`, and optional `ATC_GEMINI_MODEL` (default `gemini-3.8-flash`). `APP_URL` must be the HTTPS site origin, normally `https://neileich.org`; ATC also accepts requests from the matching `www` hostname when the request host and Origin agree. Timezone is `America/New_York`. Never use a `VITE_` prefix for these secrets. Production deployment is a separate action.
3. Create a **private** Vercel Blob store connected to the same project and environments. It supplies `BLOB_READ_WRITE_TOKEN`. The PDFs are stored there, never in Neon or Git. Only the authenticated `/api/newsletter/zmanim/source` function streams them back. The initial server upload limit is 2.8 MB because Vercel Functions have a 4.5 MB request-body limit and the JSON API base64-encodes the PDF. Larger charts require a direct upload flow.

## Administrator login

Choose a private username. From the project directory, generate a bcrypt password hash with a twice-entered, hidden password:

```zsh
zsh scripts/atc-hash-password.zsh
```

Set only the resulting 60-character hash as `ATC_AUTH_PASSWORD_HASH` in Vercel, without quotes or spaces; do not store the password. Ensure `ATC_AUTH_USERNAME` exactly matches the username entered at login. Changing a Vercel environment variable requires a new deployment before the live site uses it. Run `openssl rand -base64 48` separately for `ATC_AUTH_SESSION_SECRET` and `ATC_INGEST_TOKEN`. Set `ATC_SESSION_MAX_AGE_HOURS=12` (allowed 1–168). Sessions are signed, HttpOnly, Secure, SameSite cookies with server-side revocation. Sign-in is limited to five attempts per IP and 30 total attempts per 15-minute window. Run `npm run dev` with local values in an ignored `.env.local` file; Vite serves the API handlers locally.

## Apps Script ingestion

Send `POST https://neileich.org/api/around-the-commons/ingest` with `Authorization: Bearer <ATC_INGEST_TOKEN>`, `Content-Type: application/json`, and a stable source ID. Example body:

```json
{
  "source": "gmail",
  "sourceId": "gmail-message-id",
  "receivedAt": "2026-11-05T17:00:00Z",
  "sender": "example@example.com",
  "rawText": "Original submission",
  "cleaned": { "category": "Community Updates", "title": "", "body": "Gemini-cleaned wording", "flags": "", "notes": "" }
}
```

`issueWeek` is optional; if supplied it must match the Friday calculated from `receivedAt` in New York. The raw message is preserved. Duplicate `(source, sourceId)` calls are idempotent. Machine-cleaned entries enter `NEEDS_REVIEW` and cannot be published until an editor marks them `READY`. Keep the token in Apps Script properties, not in client code or source control.

### Spreadsheet bulk import

In the ATC editor, choose **Import Spreadsheet**. The browser reads the first worksheet of an `.xlsx` file or a `.csv` file, detects headers, and shows editable column mapping and announcement rows. Choose the Friday issue week, correct unknown categories against the active Neon category list, and submit only after reviewing the rows. The spreadsheet file is never uploaded or stored; only reviewed announcement fields and each row's original wording are sent to the authenticated `/api/newsletter/bulk-import` endpoint. New rows default to `NEEDS_REVIEW`, then appear in the existing newsletter editor for approval and PDF printing.

The `import_newsletter_bulk` function in `db/around_the_commons.sql` must be installed in Neon before using the importer. It appends all rows in one transaction under the issue lock and uses a batch identity to make retries safe.

## Zmanim chart workflow

Upload the official Bais Medrash seasonal PDF in the authenticated Zmanim area. PDF.js extracts embedded text and positioned table rows first; Gemini then interprets the PDF and those rows into structured records. The system retains the original extracted records and PDF source for audit. If the chart does not establish the calendar year, Friday dates stay blank. An administrator must enter actual dates, correct all times, mark each included row **Reviewed**, and explicitly confirm. A row can be **Skipped**; skipped rows remain in the import audit. Confirmation saves included rows to `newsletter_zmanim` in one database transaction. It refuses to replace an existing verified week or an approved issue; an existing verified row can only be changed through the newsletter's Shabbos editor with a separate explicit confirmation. Motzai Shabbos Maariv never fills Havdalah automatically.

The newsletter loads the corresponding Friday's verified row. Its Shabbos editor can make manual corrections before approval. Approval checks required times and freezes a copy in `newsletter_published`; later edits do not change the approved print layout. Browser Print / Save PDF uses the same HTML layout.

The known 2026-11-06 row contains **פרשת חיי שרה**, candle lighting 4:30 PM, sunset 4:48 PM, Shacharis 7:30 / 8:15 AM, Shema M״A / GR״A 8:31 / 9:07 AM, and Motzai Shabbos Maariv 5:48 / 6:00 PM. No Havdalah time is inferred. The supplied original PDF is kept outside Git; the local test reads it from the supplied Desktop path when available.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`. Run the SQL migration and `tests/db/zmanim.sql` against a disposable PostgreSQL instance before applying it to Neon. Review a multi-page Hebrew print preview in a browser. Production migration, environment changes, and deployment have not been performed by the implementation.
