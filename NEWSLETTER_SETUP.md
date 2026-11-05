# Around the Commons editor

The editor is at `/around-the-commons`; unauthenticated visitors go to `/around-the-commons/login`. `/atc` redirects to the editor. One administrator signs in with a username and password. Google Sheets remains the content source; Google OAuth is not used.

## Set up the spreadsheet service account

1. In Google Cloud, open **APIs & Services → Library**, select **Google Sheets API**, and click **Enable**.
2. Open **IAM & Admin → Service Accounts**, create an `atc-sheets` service account, and copy its email address. No Google Workspace domain-wide delegation or Cloud IAM admin role is needed.
3. Open that service account's **Keys → Add key → Create new key → JSON**. Keep the downloaded JSON private. Its `client_email` is `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and its `private_key` is `GOOGLE_PRIVATE_KEY`.
4. Open the Around the Commons spreadsheet, click **Share**, add only the service account email as **Editor**, and disable notification. Copy the ID between `/d/` and `/edit` in the sheet URL into `GOOGLE_SHEETS_SPREADSHEET_ID`.

## Set up the administrator login

1. Choose a private administrator username for `ATC_AUTH_USERNAME`.
2. Generate a bcrypt hash locally. In this project's **zsh** terminal, run:

   ```zsh
   read -s "ATC_PASSWORD?New ATC password: "; print
   print -rn -- "$ATC_PASSWORD" | node -e 'const b=require("bcryptjs");let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(b.hashSync(s,12)))'
   unset ATC_PASSWORD
   ```

   Copy only the resulting hash into `ATC_AUTH_PASSWORD_HASH`. The password is not stored in `.env` or in the repository.
3. Run `openssl rand -base64 48` and save its output as `ATC_AUTH_SESSION_SECRET`. Use a unique secret; changing it invalidates existing sessions.
4. Set `ATC_SESSION_MAX_AGE_HOURS=12`, or an integer from 1 to 168. The cookie persists across refreshes until it expires or the user signs out. Sign-out deletes the server-side session record.
5. In the existing Neon project, open the SQL Editor for the database referenced by `DATABASE_URL` and run the contents of `db/newsletter_approval_locks.sql`. This creates approval locks, login rate-limit counters, and revocable sessions. Login allows up to five attempts per IP and 30 total attempts per 15-minute window.

## Configure Vercel

In the **existing** Neileich Vercel project, open **Settings → Environment Variables**. Add the server-only variables from `.env.example`: `ATC_AUTH_USERNAME`, `ATC_AUTH_PASSWORD_HASH`, `ATC_AUTH_SESSION_SECRET`, `ATC_SESSION_MAX_AGE_HOURS`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `NEWSLETTER_TIMEZONE=America/New_York`. Keep the existing `DATABASE_URL` and `APP_URL=https://neileich.org`. Set these in the environments where the editor will run. Vercel applies changed variables only to new deployments. Never use a `VITE_` prefix for these credentials.

For local testing, put the same variables in the ignored `.env.local` file and run `npm run dev`. Vite serves the newsletter API handlers in development. No Google OAuth client or redirect URI is needed.

## Newsletter data and print

The source spreadsheet has `Incoming`, `Cleaned`, `Issues`, `Published`, `Categories`, and `Shabbos` tabs. Header-based mapping is in `api/_lib/newsletter-sheets.js`; tab names are in `api/_lib/newsletter-config.js`. `Incoming` is never changed. Approval adds a `snapshot_json` column to `Published` if needed and freezes the printed data. The current 2026-11-06 Shabbos row is verified; its blank `shabbos_ends` is not substituted with another time.

The masthead currently uses `/logo-english.png`. When the Around the Commons logo is supplied, put it in `public/` and update the image path in `src/pages/AroundTheCommons.jsx`.

Run `npm test`, `npm run lint`, and `npm run build`. Before production deployment, test login, invalid credentials, rate limiting, logout, authenticated sheet reads, approval, and a multipage Hebrew print preview. Production deployment remains a separate action.
