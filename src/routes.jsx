import AuthScreen from './screens/Auth/AuthScreen'
import CheckEmailScreen, { AuthCallback } from './screens/Auth/CheckEmailScreen'
import OnboardingFlow from './screens/Onboarding/OnboardingFlow'
import HomeScreen from './screens/Home/HomeScreen'
import ConversationFlow from './screens/Conversation/ConversationFlow'
import ProfileScreen from './screens/Profile/ProfileScreen'
import PromptReplierScreen from './screens/PromptReplier/PromptReplierScreen'
import ReferPage from './screens/Refer/ReferPage'

// Single source of truth for routes. App.jsx builds the router from this; tests assert it.
// `protected: true` routes require an authenticated session (guard redirects to /auth).
export const ROUTES = [
  { path: '/auth', element: <AuthScreen />, protected: false },
  // Unprotected on purpose: reached both pre-session (right after signup) and by the
  // RequireAuth guard bouncing an unconfirmed session — protecting it would loop.
  { path: '/auth/check-email', element: <CheckEmailScreen />, protected: false },
  { path: '/auth/callback', element: <AuthCallback />, protected: false },
  { path: '/onboarding', element: <OnboardingFlow />, protected: true },
  { path: '/', element: <HomeScreen />, protected: true },
  { path: '/conversation', element: <ConversationFlow />, protected: true },
  // Reached only from Home's + menu. No match behind it — see PromptReplierScreen.
  { path: '/prompt-replier', element: <PromptReplierScreen />, protected: true },
  { path: '/profile', element: <ProfileScreen />, protected: true },
  { path: '/refer', element: <ReferPage />, protected: true },
]
