/** @type {import('tailwindcss').Config} */
// RIZZING design tokens — the single source of truth for brand colors.
// Loaded by Tailwind v4 via the `@config` directive in src/index.css.
// Do NOT use Tailwind default colors anywhere in the app; use these tokens.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        'bg-app': '#0D0D0D',
        'bg-card': '#171717',
        'bg-elevated': '#212121',
        'bg-border': '#2E2E2E',

        // Gold accent — primary brand color
        'gold-tint': '#1A1608',
        'gold-light': '#E8C56F',
        gold: '#D4A843',
        'gold-dark': '#B08828',

        // Text
        'text-primary': '#F0EDE8',
        'text-secondary': '#9B9690',
        'text-muted': '#5C5852',

        // Reply type system
        safe: '#3D8B5E',
        'safe-bg': '#0E1A13',
        witty: '#D4A843',
        'witty-bg': '#1A1608',
        bold: '#C4503A',
        'bold-bg': '#1A0E0B',
      },
      borderRadius: {
        card: '8px',
        sheet: '12px',
        fullsheet: '20px',
      },
      borderWidth: {
        hairline: '0.5px',
        active: '1.5px',
      },
    },
  },
  plugins: [],
}
