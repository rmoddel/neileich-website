# Neileich Lakewood Commons

Official website for Neileich, a community organization dedicated to youth engagement, Torah learning programs, and building strong kehilla connections.

## About Neileich

Neileich places the Shul at the center of a child's life, offering age-tailored learning programs, captivating shiurim, and meaningful activities every evening, weekend, and vacation.

**Mission:** Building belonging. Thriving children. Strong Kehila.

## Tech Stack

- React 18
- Vite
- React Router DOM
- CSS (custom properties/variables)

## Deployment

This site is hosted on Vercel.

If production `VITE_` environment variables are missing or stale, check the Vercel project environment settings and redeploy if needed. Do not debug this as an AWS Amplify issue.

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Header        # Navigation with logo
│   ├── Footer        # Site footer with links
│   ├── Hero          # Landing hero section
│   ├── ScrollLink    # Smooth scroll navigation
│   └── ...           # Content sections
├── pages/            # Route pages
│   ├── Home          # Main landing page
│   ├── Contact       # Contact form with SMS opt-in
│   ├── PrivacyPolicy # Privacy policy (10DLC compliant)
│   └── Terms         # Terms and conditions
└── App.jsx           # Main app with routing
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

The site will be available at `http://localhost:5173`

### Local environment variables

Vite only exposes variables prefixed with `VITE_`, and it reads them when the dev server starts.

1. Copy `.env.example` to `.env.local`
2. Fill in the real values
3. Restart `npm run dev`

Example:

```bash
cp .env.example .env.local
```

The contact form now logs a local-only env debug summary in the browser console and shows a dev-only warning when required keys are missing.

For production, these same `VITE_` variables must also be defined in Vercel for the correct environment.

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home page with all content sections |
| `/contact` | Contact form with SMS opt-in disclosure |
| `/privacy-policy` | Privacy policy page |
| `/terms` | Terms and conditions page |
| `/parnas-hayom` | Date-based sponsorship flow |

## Parnas Hayom deployment

See [PARNAS_HAYOM_INFRA_ASSESSMENT.md](./PARNAS_HAYOM_INFRA_ASSESSMENT.md) for the infrastructure decision. Before enabling the page in production:

1. Provision managed Postgres and run `db/parnas_hayom.sql` once.
2. Configure the server-only variables listed in `.env.example` in Vercel.
3. Configure Sola account webhooks for `/api/parnas-hayom/sola-webhook`, with the same alphanumeric `SOLA_WEBHOOK_PIN` configured in the server environment.
4. Verify the Resend sending domain and configure the daily Vercel cron authorization secret.
5. Connect an existing or managed identity provider before enabling the planned admin route; never expose an administrator token in the browser.

For Parnas Hayom API testing locally, use `npm run dev:full` rather than Vite alone. Vite serves the React app but cannot execute Vercel Functions; the full-stack command serves both the app and `/api` functions on port 5173.

## 10DLC Compliance

The website includes pages required for SMS/10DLC compliance:

- **Contact page** (`/contact`): Includes opt-in form with required disclosure language
- **Privacy Policy** (`/privacy-policy`): Contains mobile data privacy statements
- **Terms & Conditions** (`/terms`): Contains messaging terms and opt-out instructions

## Customization

### Colors

Edit CSS variables in `src/index.css`:

```css
:root {
  --color-primary: #1e3a5f;      /* Dark blue */
  --color-primary-light: #2c5282;
  --color-primary-dark: #0f2942;
  --color-accent-gold: #d4a84b;
  --color-accent-green: #2d8a4e;
}
```

### Logo

Replace `public/logo-english.png` with your logo file.

### Favicon

Edit `public/favicon.svg` to update the browser tab icon.
