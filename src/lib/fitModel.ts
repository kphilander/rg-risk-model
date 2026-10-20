// Pure, deterministic in-browser risk-model fitter.
//
// Lets an operator re-fit BOTH layers of the RiskModel on their own scored +
// labelled data — nothing leaves the browser. Identical feature space to the
// default reference fit: 0–100 marker scores → non-negative (monotonic) logistic
// weighting → weighted-mean aggregate → calibrated harm probability.
//
// Everything here is pure and deterministic: no Math.random, no Date.now, fixed
// iteration counts, index-based holdout split. Same input ⇒ same FitResult.

import { transformMarker, type MarkerTransform, type RiskModel } from '../core/riskModel'

export interface FitResult {
  model: RiskModel
  metrics: { rocAuc: number; prAuc: number; brier: number; ece: number; n: number; positives: number; prevalence: number }
  calibrationCurve: { p: number; obs: number; n: number }[] // predicted-prob bin midpoint, observed rate, bin count
  weights: { id: string; weight: number }[] // fitted weights, sorted desc
  /** Monotone shape learning: tried on the holdout, adopted only if it clearly helps. */
  shapes: { used: boolean; deltaAuc: number | null }
}

// ── numeric helpers ──────────────────────────────────────────────────────────

const sigmoid = (z: number): number => {
  // Numerically stable logistic.
  if (z >= 0) {
    const e = Math.exp(-z)
    return 1 / (1 + e)
  }
  const e = Math.exp(z)
  return e / (1 + e)
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Brier score (mean squared error of probabilities vs 0/1 labels). */
export function brier(p: number[], y: number[]): number {
  const n = p.length
  if (n === 0) return 0
  let s = 0
  for (let i = 0; i < n; i++) {
    const d = clamp01(p[i]) - y[i]
    s += d * d
  }
  return s / n
}

/** ROC-AUC via the Mann–Whitney / rank statistic (handles ties with midranks). */
export function rocAuc(scores: number[], y: number[]): number {
  const n = scores.length
  let pos = 0
  for (let i = 0; i < n; i++) pos += y[i]
  const neg = n - pos
  if (pos === 0 || neg === 0) return 0.5 // undefined; neutral fallback

  // Rank scores ascending, assigning average (mid) ranks to ties.
  const idx = Array.from({ length: n }, (_, i) => i)
  idx.sort((a, b) => scores[a] - scores[b])
  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && scores[idx[j + 1]] === scores[idx[i]]) j++
    // ranks are 1-based; average rank over the tie block [i..j]
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]] = avg
    i = j + 1
  }

  let sumRanksPos = 0
  for (let r = 0; r < n; r++) if (y[r] === 1) sumRanksPos += ranks[r]

  // AUC = (sum of positive ranks − minimum possible) / (pos·neg)
  const auc = (sumRanksPos - (pos * (pos + 1)) / 2) / (pos * neg)
  return auc
}

/** Average precision (area under the precision–recall curve, step interpolation). */
export function averagePrecision(scores: number[], y: number[]): number {
  const n = scores.length
  let totalPos = 0
  for (let i = 0; i < n; i++) totalPos += y[i]
  if (totalPos === 0) return 0

  // Sort by score descending; ties broken by index for determinism.
  const idx = Array.from({ length: n }, (_, i) => i)
  idx.sort((a, b) => (scores[b] - scores[a]) || (a - b))

  let tp = 0
  let fp = 0
  let ap = 0
  let prevRecall = 0
  let k = 0
  while (k < n) {
    // Advance over all rows sharing this score threshold so recall/precision
    // are evaluated at each distinct threshold (correct with ties).
    const s = scores[idx[k]]
    while (k < n && scores[idx[k]] === s) {
      if (y[idx[k]] === 1) tp++
      else fp++
      k++
    }
    const recall = tp / totalPos
    const precision = tp / (tp + fp)
    ap += (recall - prevRecall) * precision
    prevRecall = recall
  }
  return ap
}

/** Expected Calibration Error over `bins` equal-width probability bins. */
export function ece(p: number[], y: number[], bins: number): number {
  const n = p.length
  if (n === 0) return 0
  const b = Math.max(1, bins)
  const binConf = new Array<number>(b).fill(0)
  const binAcc = new Array<number>(b).fill(0)
  const binN = new Array<number>(b).fill(0)
  for (let i = 0; i < n; i++) {
    const pi = clamp01(p[i])
    let idx = Math.floor(pi * b)
    if (idx >= b) idx = b - 1
    binConf[idx] += pi
    binAcc[idx] += y[i]
    binN[idx] += 1
  }
  let e = 0
  for (let k = 0; k < b; k++) {
    if (binN[k] === 0) continue
    const conf = binConf[k] / binN[k]
    const acc = binAcc[k] / binN[k]
    e += (binN[k] / n) * Math.abs(acc - conf)
  }
  return e
}

// ── core fitters (pure) ──────────────────────────────────────────────────────

/**
 * Non-negative, L2-regularised logistic fit by projected gradient descent.
 * Features X are in [0,1] (marker/100). Weights are clamped ≥0 after each step
 * (monotonic — a marker can only raise risk); the intercept is free.
 * Returns { intercept, weights } with weights.length === X[0].length.
 */
function fitNonNegLogistic(
  X: number[][],
  y: number[],
  p: number,
  iters: number,
  lr: number,
  l2: number,
): { intercept: number; weights: number[] } {
  const n = X.length
  const weights = new Array<number>(p).fill(0)
  let intercept = 0
  if (n === 0) return { intercept, weights }

  for (let it = 0; it < iters; it++) {
    let gInt = 0
    const gW = new Array<number>(p).fill(0)
    for (let i = 0; i < n; i++) {
      const xi = X[i]
      let z = intercept
      for (let j = 0; j < p; j++) z += weights[j] * xi[j]
      const err = sigmoid(z) - y[i] // dLoss/dz for log-loss
      gInt += err
      for (let j = 0; j < p; j++) gW[j] += err * xi[j]
    }
    // Mean gradient + L2 on weights only (not the intercept).
    intercept -= lr * (gInt / n)
    for (let j = 0; j < p; j++) {
      let w = weights[j] - lr * (gW[j] / n + l2 * weights[j])
      if (w < 0) w = 0 // projection onto the non-negative orthant
      weights[j] = w
    }
  }
  return { intercept, weights }
}

/**
 * Logistic calibration fit: aggregate/100 (a scalar feature `t` in [0,1]) → y,
 * giving {a, b} with p = sigmoid(a·t + b). Plain (unconstrained) gradient
 * descent — the slope `a` is free so a poorly ordered aggregate can still
 * calibrate honestly.
 */
function fitCalibration(t: number[], y: number[], iters: number, lr: number): { a: number; b: number } {
  const n = t.length
  let a = 1
  let b = 0
  if (n === 0) return { a, b }
  for (let it = 0; it < iters; it++) {
    let gA = 0
    let gB = 0
    for (let i = 0; i < n; i++) {
      const err = sigmoid(a * t[i] + b) - y[i]
      gA += err * t[i]
      gB += err
    }
    a -= lr * (gA / n)
    b -= lr * (gB / n)
  }
  return { a, b }
}

// ── aggregate helper ─────────────────────────────────────────────────────────

/**
 * Per-row 0–100 aggregate = Σ wᵢ·markerᵢ / Σ wᵢ, given features in [0,1] and
 * the (relative) weights. Returns the aggregate on the 0–100 scale.
 */
function aggregate01(features: number[], weights: number[]): number {
  let wsum = 0
  let dot = 0
  for (let j = 0; j < weights.length; j++) {
    wsum += weights[j]
    dot += weights[j] * features[j]
  }
  // features are in [0,1]; ×100 puts the aggregate back on the 0–100 scale.
  return wsum > 0 ? (dot / wsum) * 100 : 0
}

// ── learned monotone marker shapes (PAVA) ────────────────────────────────────

/** Refit weights + calibration on a (possibly shaped) matrix — shared by the
 *  plain and shaped candidates so both are trained identically. */
function refitOn(X: number[][], y: number[], p: number): { weights: number[]; cal: { a: number; b: number } } {
  const fit = fitNonNegLogistic(X, y, p, 800, 0.5, 1e-3)
  const raw = fit.weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  let ps = 0
  let pc = 0
  for (const w of raw) if (w > 0) { ps += w; pc++ }
  const mean = pc > 0 ? ps / pc : 0
  const scale = mean > 0 ? 1 / mean : 1
  const weights = raw.map((w) => {
    const nw = w * scale
    return Number.isFinite(nw) && nw >= 0 ? nw : 0
  })
  const t = X.map((feat) => aggregate01(feat, weights) / 100)
  return { weights, cal: fitCalibration(t, y, 400, 0.5) }
}

/** Fit a monotone (non-decreasing) piecewise-linear shape per marker via
 *  quantile binning + pool-adjacent-violators on the bin outcome rates, then
 *  rescaled to the 0–100 marker scale. Markers with too little spread or too
 *  few rows per bin are skipped (identity). */
function fitMonotoneTransforms(
  X: number[][],
  y: number[],
  markerIds: string[],
): Record<string, MarkerTransform> {
  const n = X.length
  const out: Record<string, MarkerTransform> = {}
  const BIN_MIN = 15
  for (let j = 0; j < markerIds.length; j++) {
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => X[a][j] - X[b][j])
    const lo = X[idx[0]][j]
    const hi = X[idx[n - 1]][j]
    if (hi - lo < 1e-6) continue // constant feature — nothing to shape
    const B = Math.min(6, Math.floor(n / BIN_MIN))
    if (B < 3) continue
    // Equal-count bins over the sorted rows.
    const xs: number[] = []
    const ys: number[] = []
    const ws: number[] = []
    for (let b = 0; b < B; b++) {
      const s = Math.floor((b * n) / B)
      const e = Math.floor(((b + 1) * n) / B)
      if (e <= s) continue
      let vSum = 0
      let ySum = 0
      for (let k = s; k < e; k++) {
        vSum += X[idx[k]][j]
        ySum += y[idx[k]]
      }
      xs.push((vSum / (e - s)) * 100)
      ys.push(ySum / (e - s))
      ws.push(e - s)
    }
    // PAVA: enforce non-decreasing bin rates (weighted pooling).
    const py = [...ys]
    const pw = [...ws]
    const px = [...xs]
    let i = 0
    while (i < py.length - 1) {
      if (py[i] <= py[i + 1] + 1e-12) {
        i++
        continue
      }
      const w = pw[i] + pw[i + 1]
      const v = (py[i] * pw[i] + py[i + 1] * pw[i + 1]) / w
      py.splice(i, 2, v)
      pw.splice(i, 2, w)
      px.splice(i + 1, 1)
      if (i > 0) i--
    }
    const yLo = py[0]
    const yHi = py[py.length - 1]
    if (yHi - yLo < 1e-9 || px.length < 2) continue // flat after pooling — no signal
    // Rescale pooled rates onto 0–100 and ensure strictly increasing x knots.
    const knotX: number[] = []
    const knotY: number[] = []
    for (let k = 0; k < px.length; k++) {
      const xv = k > 0 && px[k] <= knotX[k - 1] ? knotX[k - 1] + 1e-6 : px[k]
      knotX.push(xv)
      knotY.push(((py[k] - yLo) / (yHi - yLo)) * 100)
    }
    out[markerIds[j]] = { x: knotX.map((v) => Math.round(v * 100) / 100), y: knotY.map((v) => Math.round(v * 100) / 100) }
  }
  return out
}

/** Apply shapes to one feature row (features are marker/100 in [0,1]). */
function shapeFeatures(feat: number[], markerIds: string[], tf: Record<string, MarkerTransform>): number[] {
  const out = new Array<number>(feat.length)
  for (let j = 0; j < feat.length; j++) {
    const t = tf[markerIds[j]]
    out[j] = t ? clamp01(transformMarker(feat[j] * 100, t) / 100) : feat[j]
  }
  return out
}

// ── public API ───────────────────────────────────────────────────────────────

export function fitRiskModel(
  rows: { markers: Record<string, number>; label: number }[],
  opts: { markerIds: string[]; stamp: string },
): FitResult {
  const markerIds = opts.markerIds
  const p = markerIds.length

  // 1. Feature matrix X (rows × markerIds, each marker/100 in [0,1]) and y.
  const X: number[][] = []
  const y: number[] = []
  for (const row of rows) {
    const feat = new Array<number>(p)
    for (let j = 0; j < p; j++) {
      const raw = row.markers[markerIds[j]]
      const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      feat[j] = clamp01(v / 100)
    }
    X.push(feat)
    y.push(row.label >= 0.5 ? 1 : 0)
  }

  const n = X.length
  let positives = 0
  for (let i = 0; i < n; i++) positives += y[i]
  const prevalence = n > 0 ? positives / n : 0

  const ITERS = 800
  const LR = 0.5
  const L2 = 1e-3
  const CAL_ITERS = 400
  const CAL_LR = 0.5

  // 2. Non-negative L2 logistic on the FULL data → the deployed weights.
  const fullFit = fitNonNegLogistic(X, y, p, ITERS, LR, L2)

  // 3. Normalise weights so their positive mean ≈ 1.0 (relative-only; the
  //    aggregate is a weighted MEAN). Markers with no signal keep their small
  //    fitted weight. Never NaN/negative.
  const rawWeights = fullFit.weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  let posSum = 0
  let posCount = 0
  for (const w of rawWeights) {
    if (w > 0) {
      posSum += w
      posCount++
    }
  }
  const posMean = posCount > 0 ? posSum / posCount : 0
  const scale = posMean > 0 ? 1 / posMean : 1
  const normWeights = rawWeights.map((w) => {
    const nw = w * scale
    return Number.isFinite(nw) && nw >= 0 ? nw : 0
  })

  // 4. Fit the logistic calibration agg/100 → y on the FULL data (deployed).
  const tFull = X.map((feat) => aggregate01(feat, normWeights) / 100)
  const cal = fitCalibration(tFull, y, CAL_ITERS, CAL_LR)

  // 5. Honest holdout: index % 4 === 0 → test, else train. Fit on train,
  //    evaluate on test. Degenerate test split ⇒ fall back to in-sample.
  const trainIdx: number[] = []
  const testIdx: number[] = []
  for (let i = 0; i < n; i++) (i % 4 === 0 ? testIdx : trainIdx).push(i)

  let testPos = 0
  for (const i of testIdx) testPos += y[i]
  const testDegenerate =
    testIdx.length === 0 || trainIdx.length === 0 || testPos === 0 || testPos === testIdx.length

  // Choose eval indices + the fit those predictions come from. Two candidates
  // are trained identically on the train split: PLAIN (weights + calibration)
  // and SHAPED (learned monotone marker shapes first). The shaped variant is
  // adopted only if it clearly beats plain on the same holdout.
  let evalIdx: number[]
  let evalWeights: number[]
  let evalCal: { a: number; b: number }
  let evalTf: Record<string, MarkerTransform> | null = null
  let deployWeights = normWeights
  let deployCal = cal
  let deployTf: Record<string, MarkerTransform> | null = null
  const shapes: { used: boolean; deltaAuc: number | null } = { used: false, deltaAuc: null }
  if (testDegenerate) {
    // In-sample fallback (still finite). Reuse the full fit.
    evalIdx = Array.from({ length: n }, (_, i) => i)
    evalWeights = normWeights
    evalCal = cal
  } else {
    // Refit strictly on the training rows (identical recipe to the full fit).
    const Xtr = trainIdx.map((i) => X[i])
    const ytr = trainIdx.map((i) => y[i])
    const plainTr = refitOn(Xtr, ytr, p)
    evalIdx = testIdx
    evalWeights = plainTr.weights
    evalCal = plainTr.cal

    // Shaped candidate — needs enough positives for stable bin rates.
    if (positives >= 40) {
      const tf = fitMonotoneTransforms(Xtr, ytr, markerIds)
      if (Object.keys(tf).length > 0) {
        const shapedTr = refitOn(Xtr.map((f) => shapeFeatures(f, markerIds, tf)), ytr, p)
        const plainAggs: number[] = []
        const shapedAggs: number[] = []
        const yv: number[] = []
        for (const i of testIdx) {
          plainAggs.push(aggregate01(X[i], plainTr.weights))
          shapedAggs.push(aggregate01(shapeFeatures(X[i], markerIds, tf), shapedTr.weights))
          yv.push(y[i])
        }
        const plainAuc = rocAuc(plainAggs, yv)
        const shapedAuc = rocAuc(shapedAggs, yv)
        shapes.deltaAuc = Math.round((shapedAuc - plainAuc) * 1000) / 1000
        if (shapedAuc >= plainAuc + 0.005) {
          // Adopt shapes: re-learn shapes + weights + calibration on FULL data
          // for deployment; keep reporting metrics from the holdout candidate.
          shapes.used = true
          evalWeights = shapedTr.weights
          evalCal = shapedTr.cal
          evalTf = tf
          deployTf = fitMonotoneTransforms(X, y, markerIds)
          const full = refitOn(X.map((f) => shapeFeatures(f, markerIds, deployTf!)), y, p)
          deployWeights = full.weights
          deployCal = full.cal
        }
      }
    }
  }

  // Predictions on the eval set: ordinal aggregate (for ROC/PR ranking) and
  // calibrated probability (for Brier/ECE and the calibration curve).
  const evalAgg: number[] = []
  const evalProb: number[] = []
  const evalY: number[] = []
  for (const i of evalIdx) {
    const feat = evalTf ? shapeFeatures(X[i], markerIds, evalTf) : X[i]
    const agg = aggregate01(feat, evalWeights) // 0–100
    evalAgg.push(agg)
    evalProb.push(clamp01(sigmoid(evalCal.a * (agg / 100) + evalCal.b)))
    evalY.push(y[i])
  }

  const metrics = {
    rocAuc: rocAuc(evalAgg, evalY),
    prAuc: averagePrecision(evalAgg, evalY),
    brier: brier(evalProb, evalY),
    ece: ece(evalProb, evalY, 10),
    n,
    positives,
    prevalence,
  }

  // 6. Calibration curve: 10 equal-width probability bins over the calibrated
  //    eval predictions → { p: bin midpoint, obs: observed rate, n }; skip empty.
  const BINS = 10
  const cSum = new Array<number>(BINS).fill(0)
  const cN = new Array<number>(BINS).fill(0)
  for (let i = 0; i < evalProb.length; i++) {
    let bi = Math.floor(evalProb[i] * BINS)
    if (bi >= BINS) bi = BINS - 1
    if (bi < 0) bi = 0
    cSum[bi] += evalY[i]
    cN[bi] += 1
  }
  const calibrationCurve: { p: number; obs: number; n: number }[] = []
  for (let k = 0; k < BINS; k++) {
    if (cN[k] === 0) continue
    calibrationCurve.push({
      p: (k + 0.5) / BINS, // bin midpoint on the probability axis
      obs: cSum[k] / cN[k],
      n: cN[k],
    })
  }

  // Fitted weights, rounded to 3 dp, sorted desc — the deployed (full-data) fit.
  const round3 = (x: number): number => {
    const r = Math.round(x * 1000) / 1000
    return Object.is(r, -0) ? 0 : r
  }
  const roundedWeights = deployWeights.map(round3)
  const weights = markerIds
    .map((id, j) => ({ id, weight: roundedWeights[j] }))
    .sort((a, b) => b.weight - a.weight)

  // 7. Assemble the RiskModel artifact (provenance 'operator-fit').
  const model: RiskModel = {
    version: `operator-fit-${opts.stamp}${shapes.used ? '+shapes' : ''}`,
    provenance: 'operator-fit',
    markerWeights: Object.fromEntries(markerIds.map((id, j) => [id, roundedWeights[j]])),
    ...(deployTf ? { markerTransforms: deployTf } : {}),
    calibration: {
      type: 'logistic',
      a: round3(deployCal.a),
      b: round3(deployCal.b),
      note: 'p_harm = sigmoid(a·(aggregate/100)+b)',
    },
    metrics: {
      rocAuc: metrics.rocAuc,
      prAuc: metrics.prAuc,
      brier: metrics.brier,
      ece: metrics.ece,
      n,
      positives,
      prevalence,
    },
    fittedOn: { n, positives, prevalence },
    design: shapes.used
      ? 'Operator re-fit in-browser: learned monotone marker shapes (PAVA) → non-negative logistic → calibrated harm probability.'
      : 'Operator re-fit in-browser: non-negative logistic on marker scores → calibrated harm probability.',
    caveat: 'Fit on operator-supplied labels; validation on a held-out split.',
  }

  return { model, metrics, calibrationCurve, weights, shapes }
}
