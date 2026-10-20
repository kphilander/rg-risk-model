import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import type { GameQuestion } from '../../lib/gameRisk'

const LIKERT_LABELS = ['1 · Very low', '2 · Low', '3 · Medium', '4 · High', '5 · Extreme']

/** One editable instrument item: prompt + evidence tooltip + typed control.
 *  Commits every valid change so the profile re-scores live. */
export function QuestionControl({
  question,
  value,
  onChange,
}: {
  question: GameQuestion
  value: number | boolean | undefined
  onChange: (value: number | boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
        <span className="truncate">{question.prompt}</span>
        <span
          className="inline-flex shrink-0 cursor-help"
          title={`${question.whyItMatters.body}\n\n${question.whyItMatters.citation}`}
          aria-label={`Why "${question.prompt}" matters`}
        >
          <Info size={13} className="text-faint opacity-60 transition-opacity hover:opacity-100" />
        </span>
      </span>
      <span className="shrink-0">
        {question.type === 'binary' ? (
          <BinaryControl value={value === true} onChange={onChange} />
        ) : question.type === 'likert' ? (
          <LikertControl
            value={typeof value === 'number' ? value : question.scale?.min ?? 1}
            scale={question.scale}
            onChange={onChange}
          />
        ) : (
          <NumericControl
            value={typeof value === 'number' ? value : 0}
            unit={question.unit}
            onChange={onChange}
          />
        )}
      </span>
    </div>
  )
}

function BinaryControl({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <span className="segmented">
      {([true, false] as const).map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`segmented-btn !px-3 !py-1 !text-[12px] ${value === opt ? 'segmented-btn-active' : ''}`}
        >
          {opt ? 'Yes' : 'No'}
        </button>
      ))}
    </span>
  )
}

function LikertControl({
  value,
  scale,
  onChange,
}: {
  value: number
  scale?: { min: number; max: number; higherIsRiskier: boolean }
  onChange: (v: number) => void
}) {
  const min = scale?.min ?? 1
  const max = scale?.max ?? 5
  const options: number[] = []
  for (let v = min; v <= max; v++) options.push(v)
  return (
    <select
      className="input w-auto !py-1.5 !text-[12px]"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((v) => (
        <option key={v} value={v}>
          {LIKERT_LABELS[v - 1] ?? String(v)}
        </option>
      ))}
    </select>
  )
}

/** Number field with local draft state: follows the store while blurred, but
 *  never fights the user mid-keystroke; commits every finite value typed. */
function NumericControl({
  value,
  unit,
  onChange,
}: {
  value: number
  unit?: string
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        className="input !w-[84px] !py-1.5 text-right !text-[12px] tabular-nums"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setText(String(value))
        }}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n)
        }}
      />
      {unit && <span className="w-4 text-[11px] text-faint">{unit}</span>}
    </span>
  )
}
