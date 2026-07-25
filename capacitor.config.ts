import type { CapacitorConfig } from '@capacitor/cli'

// Bundled mode: web assets compiled into the APK. No server.url — the app must work
// offline and must NOT depend on Vercel at runtime. `cap sync` copies dist/ into android/.
const config: CapacitorConfig = {
  appId: 'com.matri6.rizzing',
  appName: 'RIZZING',
  webDir: 'dist',
  backgroundColor: '#0D0D0D',
}

export default config
