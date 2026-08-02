import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from './routes'
import PageTransition from './components/PageTransition'
import { useAuthStore } from './store/authStore'

// Redirects unauthenticated users to /auth, preserving where they were headed.
// A session whose email is still unconfirmed is treated as not-yet-usable: it gets
// parked on the "check your email" wall instead of reaching Home/ConversationFlow.
function RequireAuth({ children }) {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }
  if (!session.user?.email_confirmed_at) {
    return <Navigate to="/auth/check-email" replace />
  }
  return children
}

// Exported so tests can mount the real routing + guard wiring inside a MemoryRouter.
// App owns the BrowserRouter; this owns everything a test needs to exercise.
export function AppRoutes() {
  const location = useLocation()
  return (
    // Keyed on pathname so every route change replays the enter animation.
    <PageTransition transitionKey={location.pathname}>
      <Routes location={location}>
        {ROUTES.map(({ path, element, protected: isProtected }) => (
          <Route
            key={path}
            path={path}
            element={isProtected ? <RequireAuth>{element}</RequireAuth> : element}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  )
}

// Vite's BASE_URL is '/app/' for the web deploy and '/' for the Capacitor build (see
// vite.config.js). React Router wants it without the trailing slash, and '' for root —
// deriving it here means the router basename can never drift from the build's base.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-bg-app flex items-center justify-center">
        <span className="text-gold">RIZZING…</span>
      </div>
    )
  }

  return (
    <BrowserRouter basename={BASENAME}>
      <AppRoutes />
    </BrowserRouter>
  )
}
