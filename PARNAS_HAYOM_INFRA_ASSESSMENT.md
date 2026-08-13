# Parnas Hayom infrastructure assessment

## Existing stack

- **Application:** React 19 + Vite single-page app, using React Router and custom CSS.
- **Hosting/deployment:** Vercel (`vercel.json` currently provides SPA rewrites).
- **Forms/email:** The contact form posts to a configurable external endpoint from the browser. Its bearer token currently uses a `VITE_` variable, which is public by design and is not suitable for payments or donor data.
- **Database, auth, payments, storage, jobs, server APIs, admin, logging:** none are present in this repository.

## Reusable components  

- Existing React Router application, Vercel deployment, `Header`, `Footer`, logo, color tokens, responsiveness, and form conventions.
- The Parnas Hayom route uses the existing header/footer but adds a focused transaction design and a new server-side API namespace.

## Missing capabilities

- Persistent, transaction-capable storage and database constraints.
- Secure server-side secrets and payment/webhook handling.
- Hebrew calendar calculation library and timezone-aware scheduling.
- Email delivery, scheduled jobs, authentication/authorization, audit logging, and an admin interface.

## Proposed additions

1. **Vercel Functions** in `api/` for availability, checkout, Stripe webhook, and recurrence processing. This preserves the current host and avoids a separate backend service.
2. **Postgres** (Neon is used through the standard `DATABASE_URL`) for durable sponsorship data, atomic reservations, and unique/locking constraints. The included SQL migration may be run against Neon, Vercel Postgres, or another managed Postgres provider.
3. **Stripe Checkout** for payment collection; card data never reaches this app.
4. **Resend** for transactional email; it can be replaced with the organization’s existing provider by changing the server mail adapter.
5. **Vercel Cron** to expire unpaid reservations and schedule Hebrew-date annual reminders. It uses `CRON_SECRET` and the organization timezone (`America/New_York`).
6. **Supabase Auth or equivalent managed admin authentication** must be connected before exposing `/admin/parnas-hayom`. This repository has no identity provider, so an admin UI is deliberately not shipped with a client-side shared password or token.

## Risks and deployment prerequisites

- The existing contact-form API secret is browser-visible. Do not reuse it for this feature; move sensitive email functionality server-side.
- Stripe, Postgres, Resend, and an auth provider require provisioned accounts, production environment variables, and a database migration before payments can be enabled.
- Vercel Hobby cron timing and database connection limits should be checked against expected volume. A managed Postgres provider with backups is required.
- The hosting platform has no built-in transaction semantics; those are supplied by Postgres in the included schema/functions.

## Final architecture

```text
Browser
  -> existing Neileich React/Vite app (/parnas-hayom)
  -> Vercel Functions (/api/parnas-hayom/*)
  -> Postgres (types, holds, sponsorships, recurrence, audit)
  -> Stripe Checkout -> signed Stripe webhook -> Postgres + email
  -> Resend (donor and Neileich notifications)
  -> Vercel Cron -> expire holds + create annual Hebrew-date reminders
```

## Required server environment variables

`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
`EMAIL_FROM`, `NOTIFICATION_EMAIL`, `APP_URL`, and `CRON_SECRET`.

These are server-only variables—none may be prefixed with `VITE_`.
