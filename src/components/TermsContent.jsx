import { TERMS_SECTIONS, TERMS_SUMMARY, TERMS_VERSION } from '../lib/legal'

// Scrollable Terms & Privacy body. Reused by the onboarding consent gate and the
// Profile screen so the two never drift. `scrollable` caps the height with its own
// overflow area (onboarding); Profile renders it inline in a sheet.
export default function TermsContent({ scrollable = true }) {
  return (
    <div
      className={
        scrollable
          ? 'chat-thread rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 max-h-[42vh]'
          : ''
      }
    >
      <p className="text-text-secondary text-[13px] leading-relaxed">{TERMS_SUMMARY}</p>
      <div className="mt-5 flex flex-col gap-4">
        {TERMS_SECTIONS.map((s) => (
          <div key={s.heading}>
            <h3 className="text-text-primary text-[13px] font-medium tracking-wide">{s.heading}</h3>
            <p className="text-text-secondary text-[13px] leading-relaxed mt-1">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="text-text-muted text-[11px] tracking-wide mt-5">Version {TERMS_VERSION}</p>
    </div>
  )
}
