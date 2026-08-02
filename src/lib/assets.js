/**
 * Runtime URLs for files in `public/`.
 *
 * A literal `src="/1.jpg"` in JSX is an opaque string — Vite never rewrites it, unlike the
 * same path in index.html. Since the web deploy serves this app from `/app` (the MATRI6
 * landing page owns the domain root), a root-relative literal resolves to the LANDING
 * site's `/1.jpg` and 404s. `import.meta.env.BASE_URL` carries the deploy's base ('/app/'
 * on web, '/' under Capacitor and in tests) and always ends in a slash.
 *
 * Every public-asset URL used at runtime belongs here, so adding a base can never again
 * break one screen's images while leaving the favicon working.
 */

/** RIZZING puzzle-piece brand mark — the same image as the favicon. */
export const LOGO_SRC = `${import.meta.env.BASE_URL}1.jpg`
