// Regulator report-pack generator. Assembles a self-contained, printable HTML
// report (portfolio summary + model validation + intervention audit trail) and
// opens it in a new window ready to save-as-PDF. Fully client-side.

import type { PortfolioStats } from '../engine/scoring'
import type { InterventionAction, PlayerProfile } from '../types'
import { RISK_BANDS } from './riskBands'
import { MODEL_CARD } from './modelCard'
import { guideFor } from '../core/jurisdictions'
import { BRAND } from '../brand'

interface ReportInput {
  stats: PortfolioStats
  interventions: InterventionAction[]
  players: PlayerProfile[]
  operatorName: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

export function generateReportPack({ stats, interventions, players, operatorName }: ReportInput) {
  const now = new Date()
  const v = MODEL_CARD.validation
  const bandRows = RISK_BANDS.map(
    (b) => `<tr><td><span class="dot" style="background:${b.color}"></span>${esc(b.label)}</td>
      <td class="num">${stats.bandCounts[b.id] ?? 0}</td>
      <td class="num">${(((stats.bandCounts[b.id] ?? 0) / stats.totalPlayers) * 100).toFixed(1)}%</td></tr>`,
  ).join('')

  const markerRows = MODEL_CARD.markers.map(
    (m) => `<tr><td>${esc(m.label)}</td><td class="num">${m.weight.toFixed(2)}</td>
      <td>${m.fitted ? 'Fitted' : 'Prior'}</td>
      <td class="num">${m.auc != null ? m.auc.toFixed(3) : '—'}</td>
      <td class="src">${esc(m.source)}</td></tr>`,
  ).join('')

  const jurCounts = new Map<string, number>()
  for (const p of players) jurCounts.set(p.jurisdiction, (jurCounts.get(p.jurisdiction) ?? 0) + 1)
  const jurRows = [...jurCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => {
      const g = guideFor(code)
      return `<tr><td>${esc(g.name)} (${esc(code)})</td><td class="num">${count.toLocaleString()}</td>
        <td class="num">${g.age}+</td><td>${esc(g.regulator)}</td>
        <td>${esc(g.helpline)}<div class="src">${esc(g.helplineLabel)}</div></td>
        <td class="src">${esc(g.mandatory)}</td></tr>`
    })
    .join('')

  const intvRows = interventions.length
    ? interventions.map(
        (i) => `<tr><td>${esc(new Date(i.timestamp).toLocaleString())}</td><td>${esc(i.playerHandle)}</td>
          <td>L${i.level}</td><td>${esc(i.action)}</td><td class="num">${i.riskAtTime}</td>
          <td>${esc(i.status)}</td><td>${esc(i.operator)}</td></tr>`,
      ).join('')
    : `<tr><td colspan="7" class="muted">No interventions logged in this period.</td></tr>`

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(BRAND.name)} — Regulatory Report Pack</title>
<style>
  :root { --ink:#1b2838; --soft:#565c66; --line:#e3e3e8; --brand:#0e8d7c; }
  * { box-sizing:border-box; }
  body { font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:var(--ink); margin:0; padding:48px; max-width:900px; }
  header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--ink); padding-bottom:16px; margin-bottom:28px; }
  .brand { font-size:22px; font-weight:700; letter-spacing:-.02em; }
  .brand span { color:var(--brand); }
  .meta { text-align:right; font-size:12px; color:var(--soft); }
  h2 { font-size:15px; letter-spacing:.04em; text-transform:uppercase; color:var(--soft); margin:32px 0 10px; border-bottom:1px solid var(--line); padding-bottom:6px; }
  h1 { font-size:26px; letter-spacing:-.02em; margin:0 0 4px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th,td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); font-size:13px; vertical-align:top; }
  th { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color:var(--soft); }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .src { color:var(--soft); font-size:12px; }
  .muted { color:var(--soft); }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; vertical-align:middle; }
  .kpis { display:flex; gap:14px; flex-wrap:wrap; }
  .kpi { flex:1; min-width:150px; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .kpi .l { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color:var(--soft); }
  .kpi .n { font-size:26px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; margin-top:4px; }
  .note { background:#f5f5f7; border-radius:12px; padding:14px 16px; font-size:13px; color:var(--soft); margin-top:10px; }
  footer { margin-top:40px; padding-top:14px; border-top:1px solid var(--line); font-size:11px; color:var(--soft); }
  @media print { body { padding:24px; } .noprint { display:none; } }
  .btn { position:fixed; top:16px; right:16px; background:var(--brand); color:#fff; border:0; border-radius:999px; padding:9px 18px; font-weight:600; cursor:pointer; }
</style></head><body>
<button class="btn noprint" onclick="window.print()">Save as PDF</button>
<header>
  <div><div class="brand">${esc(BRAND.wordmark[0])}<span>${esc(BRAND.wordmark[1])}</span></div><div class="meta" style="text-align:left;color:#565c66;margin-top:2px">${esc(BRAND.tagline)}</div></div>
  <div class="meta">Regulatory Report Pack<br>${esc(operatorName)}<br>Generated ${esc(now.toLocaleString())}<br>Ruleset ${esc(MODEL_CARD.rulesetVersion)}</div>
</header>

<h1>Player-protection monitoring summary</h1>
<div class="muted">Immutable evidence of behavioral-risk monitoring and intervention across the monitored player base.</div>

<h2>Portfolio</h2>
<div class="kpis">
  <div class="kpi"><div class="l">Monitored players</div><div class="n">${stats.totalPlayers.toLocaleString()}</div></div>
  <div class="kpi"><div class="l">Mean risk index</div><div class="n">${stats.averageScore}/100</div></div>
  <div class="kpi"><div class="l">High &amp; critical</div><div class="n">${stats.highRiskCount}</div></div>
  <div class="kpi"><div class="l">Interventions logged</div><div class="n">${interventions.length}</div></div>
</div>
<table><thead><tr><th>Risk band</th><th class="num">Players</th><th class="num">Share</th></tr></thead><tbody>${bandRows}</tbody></table>

<h2>Jurisdiction coverage (${jurCounts.size})</h2>
<table><thead><tr><th>Jurisdiction</th><th class="num">Players</th><th class="num">Min. age</th><th>Regulator</th><th>Helpline</th><th>Mandatory statement</th></tr></thead><tbody>${jurRows}</tbody></table>
<div class="note"><b>Rule-pack note.</b> Helplines, minimum ages and mandatory wording are illustrative defaults — verify each entry with local counsel and the relevant regulator, and override per deployment.</div>

<h2>Model validation</h2>
<div class="kpis">
  <div class="kpi"><div class="l">ROC-AUC (${v.horizonMonths}-month)</div><div class="n">${v.aucAtHorizon.toFixed(2)}</div></div>
  <div class="kpi"><div class="l">PR-AUC</div><div class="n">${v.prAuc.toFixed(2)}</div></div>
  <div class="kpi"><div class="l">Outcome prevalence</div><div class="n">${(v.prevalence * 100).toFixed(1)}%</div></div>
  <div class="kpi"><div class="l">Recall @ op-point</div><div class="n">${(v.operatingPoint.recall * 100).toFixed(0)}%</div></div>
</div>
<div class="note"><b>Design.</b> ${esc(v.design)}<br><br><b>Interpretation.</b> ${esc(MODEL_CARD.limitations)}</div>

<h2>Marker weights &amp; evidence</h2>
<table><thead><tr><th>Marker</th><th class="num">Weight</th><th>Basis</th><th class="num">Univ. AUC</th><th>Source</th></tr></thead><tbody>${markerRows}</tbody></table>

<h2>Intervention audit trail (${interventions.length})</h2>
<table><thead><tr><th>Timestamp</th><th>Player</th><th>Level</th><th>Action</th><th class="num">Risk</th><th>Status</th><th>Operator</th></tr></thead><tbody>${intvRows}</tbody></table>

<footer>${esc(BRAND.name)} · ruleset ${esc(MODEL_CARD.rulesetVersion)} · ${esc(MODEL_CARD.modelType)}. Synthetic demonstration data — contains no real player records. This report is generated client-side and is not a substitute for a formal regulatory submission.</footer>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
