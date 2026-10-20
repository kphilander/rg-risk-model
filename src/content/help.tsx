import type { ReactNode } from 'react'

// Centralised help content — one entry per page, in two registers:
// `plain` for operators / non-technical users, `technical` for researchers /
// developers. Edit here; the HelpPanel renders it. Add a page in one place.

export interface HelpContent {
  plain: ReactNode
  technical: ReactNode
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-soft)' }}>{children}</p>
}
function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mt-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-soft)' }}>
          <span style={{ color: 'var(--brand)' }}>·</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
const Code = ({ children }: { children: ReactNode }) => <code className="text-[12.5px]" style={{ color: 'var(--text)' }}>{children}</code>

export const HELP: Record<string, HelpContent> = {
  overview: {
    plain: (
      <>
        <P>The portfolio at a glance. Every monitored player gets a 0–100 risk score grouped into five bands, Low → Critical. The big number is the portfolio-wide average.</P>
        <P>The cards and charts show how many players sit in each band, which behaviours are driving risk across the base, and the highest-risk players right now.</P>
      </>
    ),
    technical: (
      <>
        <P>Each player is scored from 13 behavioral markers over a rolling 92-day window. The aggregate is a weighted mean (62%) blended with the mean of the top-3 markers (38%), so a concentration of severe markers escalates the score.</P>
        <P>Marker weights are fitted to real self-exclusion outcomes (see <b>Governance</b>). “Top risk drivers” are portfolio-average marker contributions; the trend line is the mean rolling score, coloured by domain.</P>
      </>
    ),
  },
  players: {
    plain: <P>A searchable, sortable list of everyone you monitor. Each row shows the risk score and band, the single behaviour driving it most, a mini trend line, and the 7-day change. Filter by band or jurisdiction, or search by handle / ID.</P>,
    technical: <P>Sortable by score, 7-day Δ, last-active, or handle. The sparkline is the player’s rolling risk trend; the 7-day Δ is the change between the last two weekly trend points. Filtering is client-side over the in-memory portfolio.</P>,
  },
  playerDetail: {
    plain: (
      <>
        <P>Everything about one player: their current risk and band, a plain-language summary of <i>why</i>, how their risk has moved, where it’s projected to go, and the smallest change that would lower their band.</P>
        <P>The behavioural radar and marker breakdown show exactly which behaviours contribute.</P>
      </>
    ),
    technical: (
      <List
        items={[
          <>Gauge = the 0–100 score; trend = a rolling 35-day reassessment across the window.</>,
          <><b>Trajectory forecast</b> extrapolates the least-squares slope of recent trend points.</>,
          <><b>What would lower this</b> greedily relaxes the highest <Code>weight×score</Code> markers until the aggregate crosses the next band threshold down.</>,
          <>Peer percentile is the player’s rank within the current cohort.</>,
        ]}
      />
    ),
  },
  alerts: {
    plain: <P>A worklist of players whose risk warrants operator action, ranked by severity. Each escalation level maps to a recommended action — from automated nudges up to a support referral. Use it to decide who to contact first.</P>,
    technical: <P>Recommended level comes from the player’s band via the escalation ladder (<Code>ESCALATION</Code> in <Code>riskBands.ts</Code>). The Level 5+/4+/3+ cards are cumulative (“and above”). The queue shows players with recommendedLevel ≥ 3.</P>,
  },
  cases: {
    plain: <P>A triage queue that turns flagged players into cases you can own: assign an analyst, set priority, track an SLA, add notes, and run the intervention workflow end-to-end.</P>,
    technical: <P>Cases are seeded from players with recommendedLevel ≥ 4 and persisted in <Code>localStorage</Code> (<Code>rg-risk.cases.v1</Code>). Applying an intervention from a case calls the shared <Code>logIntervention</Code> action and advances the case status.</P>,
  },
  foresight: {
    plain: <P>Where risk is heading, not just where it is. It projects each player’s band 30 and 60 days out from how fast their risk is changing — and flags players who are Low/Moderate today but accelerating toward High, so you can act before harm lands.</P>,
    technical: <P>Velocity is the least-squares slope of the last ~6 weekly trend points (≈ points/week). Projections are <Code>current + velocity × horizon</Code>, clamped 0–100. “Early warning” = current &lt; 60 but projected-60-day ≥ 60. Linear extrapolation — indicative, not a guarantee.</P>,
  },
  efficacy: {
    plain: <P>The feedback loop most tools skip: after an analyst intervenes, did the player’s risk actually fall? It breaks effectiveness out by escalation level, so you can see which actions work.</P>,
    technical: <P>Shows observed pre/post risk per escalation level over a synthetic outcome history (responders vs non-responders + natural drift). Response rate = share with a drop. This is <b>observed, not a randomized causal estimate</b> — subject to regression to the mean.</P>,
  },
  fairness: {
    plain: <P>An open check that the score treats different groups (by gender, age, jurisdiction) fairly, and that its bands line up with real harm. A transparent model can prove this; a black box can’t.</P>,
    technical: (
      <List
        items={[
          <><b>Flag-rate parity</b> = share scored ≥ 60 per subgroup.</>,
          <><b>Calibration</b> = observed harm rate per predicted band (should increase monotonically).</>,
          <><b>Equal opportunity</b> = share of truly-harmed players flagged, per subgroup.</>,
          <>The harm label is a synthetic proxy; self-exclusion is under-ascertained, so these are descriptive, not causal.</>,
        ]}
      />
    ),
  },
  lab: {
    plain: <P>Run experiments on interventions. Pick a question — or design your own — by choosing a group of players, one or more intervention policies, and an outcome metric. The Lab estimates each policy’s effect with a confidence interval and tells you which wins.</P>,
    technical: <P>An <Code>ExperimentSpec</Code> = cohort + arms (policies) + metric. <Code>runExperiment</Code> applies each policy, simulates the outcome under a seeded effect model, and returns per-arm mean + 95% CI, uplift vs control, and an approximate significance test. Outcomes are synthetic — reproducible, but illustrative.</P>,
  },
  games: {
    plain: <P>Score the games themselves, not just the players. Each game is rated on structural characteristics that the research links to harm — how fast it plays, how the betting is structured, how volatile the rewards are — and given a Tier 1–4 profile. The exposure view then shows whether your higher-risk players spend their time on the riskier games.</P>,
    technical: <P>A deterministic instrument (<Code>src/lib/gameRisk.ts</Code>) in the lineage of Griffiths (1993), Parke &amp; Griffiths (2007) and AsTERiG (Meyer et al. 2011): ten cited items across three dimensions (event-frequency, bet-structure, volatility-reward) → 0–100 with tier cuts at 25/50/75, top drivers, and suggested mitigations. The exposure cross-view joins each player’s share of active minutes by game-speed class against the catalog’s tier for that class. Assessments are operator-editable and persist locally. A screening lens — not a substitute for certification testing; exposure ≠ causation.</P>,
  },
  data: {
    plain: <P>Bring your own data. Download the four CSV templates, drop in your files, and we validate every row and score it in your browser — nothing is uploaded. Then load it straight into the dashboard.</P>,
    technical: <P>The format is defined once in <Code>src/core/dataSchema.ts</Code> (identities, wagers, wallet, sessions). Rows are validated for types, enums, required fields, and cross-file <Code>player_id</Code> references, then run through the ingestion adapters → projection → engine. All client-side.</P>,
  },
  compliance: {
    plain: <P>An immutable audit trail of every player-protection intervention — who did what, when, and at what risk level — exportable for regulatory review.</P>,
    technical: <P>Interventions are appended to the audit sink (<Code>localStorage</Code> here; a WORM store in production) and exported to CSV. The regulator report pack bundles portfolio stats + model validation + the audit trail into a printable document.</P>,
  },
  governance: {
    plain: <P>How trustworthy is the score? This page opens up the model: how it was validated, what each behaviour is weighted, where those weights come from, and where the model’s limits are.</P>,
    technical: <P>Marker weights are fitted to real prospective self-exclusion in a longitudinal reference cohort (ROC-AUC ≈ 0.67, calibrated: Brier 0.044). Each marker shows its weight, source citation, fitted-vs-prior status, and univariate discrimination. Self-exclusion is under-ascertained, so the model is tuned for recall (false positives expected). Three markers have no source-data analog and remain informed priors.</P>,
  },
  model: {
    plain: (
      <>
        <P>The model behind every score, in one place. See how much each behaviour counts, what a score means as a real-world chance, and how good the model actually is — each number has a tap-to-open explainer.</P>
        <P>Then make it yours: <b>re-fit</b> it on your own labelled data (everything stays in your browser), or <b>tune weights by hand</b> and watch the portfolio shift live before applying.</P>
      </>
    ),
    technical: <P>The score is a non-negative weighted mean of the 13 marker scores; a discrete-time hazard layer maps it to a calibrated probability of harm within 12 months (piecewise monthly baseline over 1–3/4–6/7–12/13–24/25–36 months; AUC 0.71 at the 12-month horizon, Brier 0.023). Default weights blend a monotonic multivariate logistic with univariate Gini (fitted to later self-exclusion in a reference research cohort); metrics are held-out. Provenance is versioned: <Code>reference-hazard</Code> → <Code>operator-fit</Code> (in-browser refit via <Code>fitRiskModel</Code>; operator refits currently fit a binary logistic calibration) → <Code>manual</Code>. Adopting re-scores the portfolio via <Code>setRiskModel</Code>.</P>,
  },
  assistant: {
    plain: <P>Ask about your portfolio in plain English — who needs attention, what’s driving risk, where risk is rising — and get an answer grounded in the live data.</P>,
    technical: <P>Deterministic, not an LLM: starter prompts and free text route to analytics computed directly from the store (players, assessments, stats). Answers are reproducible.</P>,
  },
}
