import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // The web deploy serves the MATRI6 landing page at rizzing.matri6.com/ and this app at
  // /app, so every built asset URL has to carry the /app prefix. `import.meta.env.BASE_URL`
  // is derived from this and is the single source both the router basename (App.jsx) and
  // the Supabase OAuth callback (lib/auth.js) read — so there is one knob, not three.
  //
  // The Capacitor APK serves the same bundle from the webview ROOT, where /app/… 404s.
  // `npm run build:android` passes `--base=/` on the CLI to override this; that keeps the
  // override in one place instead of an env var that Windows npm scripts can't set inline.
  base: '/app/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
})
