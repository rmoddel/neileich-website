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
