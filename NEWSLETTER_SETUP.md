# Around the Commons

The editor lives at `/around-the-commons`, its login at `/around-the-commons/login`, and the official shul schedule review at `/around-the-commons/zmanim`. `/atc` redirects to the editor. The Vite site and Vercel API functions use the existing Neon database. Google Sheets and Google OAuth are not used by the site. Apps Script can continue receiving Gmail/Voice submissions and calling Gemini upstream, then forward each submission to the ingestion API.

## Database and deployment

1. In the **existing** Neon database, run [db/around_the_commons.sql](db/around_the_commons.sql) after reviewing the target database. It adds soft deletion and explicit `is_test`/`is_important` flags to announcements and preserves the existing rows and immutable approved snapshots. Apply the SQL before deploying code that selects these columns. The old chart-import audit table remains intact; the PDF upload path is retired.
2. In the **existing** Vercel project, set the server-only variables in `.env.example`: existing `DATABASE_URL` and `APP_URL`, plus `ATC_AUTH_USERNAME`, `ATC_AUTH_PASSWORD_HASH`, `ATC_AUTH_SESSION_SECRET`, `ATC_SESSION_MAX_AGE_HOURS`, `ATC_INGEST_TOKEN`, and `NEWSLETTER_TIMEZONE`. `ATC_SHUL_SCHEDULE_URL` can override the default official feed for another organization. `APP_URL` must be the HTTPS site origin, normally `https://neileich.org`; ATC also accepts requests from the matching `www` hostname when the request host and Origin agree. Timezone is `America/New_York`. Never use a `VITE_` prefix for secrets. Production deployment is a separate action.

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

## Official shul schedule

The authenticated issue API reads [the Bais Medrash schedule feed](https://baismedrashoflakewoodcommons.org/api/schedule.json) server-side when a Friday has no stored zmanim. The feed provides dated Friday and Shabbos events, so the mapper uses exact dates, Hebrew event labels, and M״A/GR״A reckoning. The preview is `NEEDS_REVIEW` until the administrator checks it and saves it as `VERIFIED` in the Shabbos editor. The original two days of feed data are saved in `original_values` for audit. The **Load official shul schedule** button refreshes the draft; it never overwrites a stored row automatically. Existing verified weeks require separate replacement confirmation. Approved snapshots remain frozen. Motzai Shabbos Maariv never fills Havdalah automatically.

The newsletter automatically groups announcements from Neon and lays them into two right-to-left Letter pages, reducing body text from 10.5 pt to a minimum of 8.5 pt when needed. Overflow is visible and warned about, with entries to shorten identified. The HTML preview and browser Print / Save PDF share the same page layout. In the browser print dialog, choose Letter and turn off browser headers and footers. The ATC masthead asset is `public/around-the-commons-logo.png`; replace that file to update the branding.

Announcements can be marked **Important** to lead Community Updates or **test data** for explicit bulk cleanup. Trash icons soft-delete one announcement at a time; **Delete All Test Announcements** only targets rows with `is_test=true` and asks for the exact count. Incoming submissions and import audit rows are preserved. Approved issues reject deletion.

The known 2026-11-06 feed row contains **פרשת חיי שרה**, candle lighting 4:30 PM, sunset 4:48 PM, Shacharis 7:30 / 8:15 AM, Shema M״A / GR״A 8:31 / 9:07 AM, and Motzai Shabbos Maariv 5:48 / 6:00 PM. No Havdalah time is inferred. Previously imported PDF records remain in Neon for historical audit.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`. Run the SQL migration against a disposable PostgreSQL instance before applying it to Neon. Review the rendered Letter PDF and its page count in Chrome. Production migration, environment changes, and deployment have not been performed by the implementation.
