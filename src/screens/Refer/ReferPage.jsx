import { useTransitionNavigate } from '../../components/PageTransition'
import Wordmark from '../../components/Wordmark'
import FooterNav from '../../components/FooterNav'

/**
 * Refer screen — scaffold only. Header + footer nav are wired; the content area is
 * deliberately empty, awaiting the referral copy/mechanics from Dweep.
 *
 * The footer's `+` (add match) belongs to Home's bottom sheet, so this screen sends
 * the user there with `?add=1` and Home opens the sheet on arrival, rather than
 * this screen growing a second copy of the add-match flow.
 */
export default function ReferPage() {
  const navigate = useTransitionNavigate()

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col relative overflow-hidden">
        <header className="h-14 px-6 flex items-center justify-center border-b border-white/[0.04] shrink-0">
          <Wordmark />
        </header>

        <div className="flex-1 overflow-y-auto px-6 pt-7 pb-8">
          <div className="relative mb-7">
            <div className="hero-glow" aria-hidden="true" />
            <h1 className="relative font-display text-[30px] leading-tight text-text-primary">
              Refer
            </h1>
          </div>

          {/* TODO: refer content — pending from Dweep */}
        </div>

        <FooterNav active="refer" onAdd={() => navigate('/?add=1')} />
      </div>
    </div>
  )
}
