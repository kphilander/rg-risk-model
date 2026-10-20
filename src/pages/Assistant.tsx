import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ArrowRight, MessageSquareText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { STARTERS, answerFor, matchPrompt, type AssistantAnswer } from '../lib/assistant'

export function Assistant() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const stats = useStore((s) => s.stats)
  const ctx = useMemo(() => ({ players, assessments, stats }), [players, assessments, stats])

  const [thread, setThread] = useState<{ q: string; a: AssistantAnswer }[]>([])
  const [draft, setDraft] = useState('')

  const ask = (label: string, id?: string) => {
    const resolved = id ?? matchPrompt(label)
    setThread((t) => [...t, { q: label, a: answerFor(resolved, ctx) }])
    setDraft('')
  }

  const cold = thread.length === 0

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <div className="page-head">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="large-title">
              Portfolio questions
            </h1>
            <p className="text-[14px] text-soft mt-0.5">
              Ask about your portfolio — answers are grounded in live behavioral data.
            </p>
          </div>
        </div>
      </div>

      {/* Cold-start starter prompts */}
      {cold && (
        <div className="mt-5 reveal">
          <div className="eyebrow mb-3">Try asking</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {STARTERS.map((s) => (
              <button
                key={s.id}
                onClick={() => ask(s.label, s.id)}
                className="card lift text-left !p-4 flex items-start gap-3"
              >
                <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                  <MessageSquareText size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold tracking-[-0.01em]">{s.label}</span>
                  <span className="block text-[13px] text-faint mt-0.5">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      {thread.map((turn, i) => (
        <div key={i} className="mt-5 space-y-3">
          <div className="flex justify-end">
            <div className="rounded-lg rounded-br-md px-4 py-2.5 text-[15px] font-medium text-white max-w-[80%] gradient-cool">
              {turn.q}
            </div>
          </div>
          <AnswerCard a={turn.a} />
        </div>
      ))}

      {/* Follow-up chips */}
      {!cold && (
        <div className="mt-5 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button key={s.id} onClick={() => ask(s.label, s.id)} className="chip lift !py-1.5 hover:!text-[var(--text)]">
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.trim()) ask(draft.trim())
        }}
        className="mt-5 sticky bottom-4"
      >
        <div className="card !p-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about risk, players, or trends…"
            className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none"
            style={{ color: 'var(--text)' }}
            aria-label="Ask the risk analyst"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn btn-primary !px-2.5 !py-2.5"
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>

      <p className="mt-3 text-center text-[12px] text-faint">
        Demonstration assistant · deterministic answers computed from synthetic portfolio data.
      </p>
    </div>
  )
}

function AnswerCard({ a }: { a: AssistantAnswer }) {
  return (
    <div className="card reveal">
      <h2 className="section-title">{a.title}</h2>
      <p className="mt-2 text-[15px] text-soft leading-relaxed">{a.summary}</p>

      {a.bullets && a.bullets.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {a.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px]">
              <span className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ background: b.color ?? 'var(--brand)' }} />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      )}

      {a.items && a.items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {a.items.map((it, i) => {
            const body = (
              <>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold tracking-[-0.01em] truncate">{it.primary}</div>
                  {it.secondary && <div className="text-[12.5px] text-faint mt-0.5 truncate">{it.secondary}</div>}
                </div>
                {it.accent && (
                  <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: '#c46a1c' }}>{it.accent}</span>
                )}
                {it.score !== undefined && (
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums" style={{ background: `${it.bandColor}1f`, color: it.bandColor }}>
                    {it.score} · {it.bandLabel}
                  </span>
                )}
                {it.to && <ArrowRight size={15} className="shrink-0 text-faint" />}
              </>
            )
            return it.to ? (
              <Link key={i} to={it.to} className="lift flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                {body}
              </Link>
            ) : (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
