// 로또 6/45 분석과 뽑기 확률
//
// 모든 번호 조합의 1등 확률은 똑같다(1/8,145,060). 과거 번호로 다음 번호를 맞힐 수는 없다.
// 대신 '사람들이 많이 고르는 번호'는 데이터로 알 수 있다. 회차마다 3~5등 당첨자 수가
// 판매량에 비해 많으면 그 회차 번호를 고른 사람이 많았다는 뜻이므로, 번호·무늬별 인기도를 추정해
// 인기 없는 번호를 고르면 당첨됐을 때 나눠 갖는 사람이 줄어 받는 돈의 기대값이 올라간다.

export const FIELDS = { round: 0, date: 1, nums: 2, bonus: 8, w1: 9, w3: 11, w4: 12, w5: 13, sales: 14 };
export const numsOf = (row) => row.slice(2, 8);

// 공 색 (동행복권과 같은 구간)
export const ballClass = (n) => (n <= 10 ? 'b-yellow' : n <= 20 ? 'b-blue' : n <= 30 ? 'b-red' : n <= 40 ? 'b-gray' : 'b-green');

// ---------- 인기도 모델 ----------
const MODEL_FROM_ROUND = 600; // 2014년 무렵부터 (판매 규모가 지금과 비슷하고 최근 습관을 반영)
const RIDGE = 5;
const N_PATTERN = 4;
export const PATTERN_LABELS = ['연속 번호', '모두 31 이하(생일 범위)', '한 십 단위에 4개 이상', '끝자리가 같은 번호 3개 이상'];

export const patternFeatures = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  let consec = 0;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] === 1) consec++;
  const count = (keyFn) => {
    const m = {};
    s.forEach(n => { m[keyFn(n)] = (m[keyFn(n)] || 0) + 1; });
    return Math.max(...Object.values(m));
  };
  return [
    consec,
    s.every(n => n <= 31) ? 1 : 0,
    count(n => Math.floor((n - 1) / 10)) >= 4 ? 1 : 0,
    count(n => n % 10) >= 3 ? 1 : 0
  ];
};

const featuresOf = (nums) => {
  const f = new Array(45 + N_PATTERN).fill(0);
  nums.forEach(n => { f[n - 1] = 1; });
  patternFeatures(nums).forEach((v, i) => { f[45 + i] = v; });
  return f;
};

const solve = (A, b) => {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
};

// 회차의 '인기 점수': 판매량 대비 3·4·5등 당첨자 수(로그)를 표준화해 섞음. 0 보다 크면 많이 고른 번호
const roundScores = (rows) => {
  const raw = rows.map(r => {
    const tickets = r[FIELDS.sales] / 1000;
    return [FIELDS.w3, FIELDS.w4, FIELDS.w5].map(k => Math.log((r[k] + 0.5) / tickets));
  });
  const stat = [0, 1, 2].map(k => {
    const mean = raw.reduce((s, v) => s + v[k], 0) / raw.length;
    const sd = Math.sqrt(raw.reduce((s, v) => s + (v[k] - mean) ** 2, 0) / raw.length) || 1;
    return { mean, sd };
  });
  const weights = [0.5, 0.3, 0.2];
  return raw.map(v => v.reduce((s, x, k) => s + ((x - stat[k].mean) / stat[k].sd) * weights[k], 0));
};

const pearson = (a, b) => {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let cov = 0, va = 0, vb = 0;
  a.forEach((v, i) => {
    cov += (v - ma) * (b[i] - mb);
    va += (v - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  });
  return cov / Math.sqrt(va * vb);
};

const fitRidge = (X, y) => {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  X.forEach((x, i) => {
    for (let a = 0; a < p; a++) {
      if (!x[a]) continue;
      b[a] += x[a] * y[i];
      for (let c = 0; c < p; c++) A[a][c] += x[a] * x[c];
    }
  });
  for (let a = 0; a < p; a++) A[a][a] += RIDGE;
  return solve(A, b);
};

// 인기도 모델: 번호별 인기(beta), 무늬별 영향(pattern), 검증 상관계수(앞 80% 로 학습해 뒤 20% 예측)
export const buildPopularityModel = (draws) => {
  const rows = draws.filter(r => r[FIELDS.round] >= MODEL_FROM_ROUND && r[FIELDS.sales] > 0);
  const y = roundScores(rows);
  const X = rows.map(r => featuresOf(numsOf(r)));
  const cut = Math.floor(rows.length * 0.8);
  const wTrain = fitRidge(X.slice(0, cut), y.slice(0, cut));
  const holdoutCorr = pearson(X.slice(cut).map(x => x.reduce((s, v, i) => s + v * wTrain[i], 0)), y.slice(cut));
  const w = fitRidge(X, y);
  const beta = w.slice(0, 45);
  const sortedBeta = [...beta].sort((a, b) => a - b);
  return {
    beta,
    pattern: w.slice(45),
    holdoutCorr,
    rounds: rows.length,
    // 번호 인기 순위(백분위, 0 = 가장 덜 고름)
    percentile: (n) => sortedBeta.indexOf(beta[n - 1]) / 44,
    score: (nums) => featuresOf(nums).reduce((s, v, i) => s + v * w[i], 0)
  };
};

// ---------- 출현 통계 ----------
export const buildStats = (draws, recentN = 50) => {
  const total = new Array(46).fill(0);
  const recent = new Array(46).fill(0);
  const lastSeen = new Array(46).fill(0);
  const latest = draws[draws.length - 1]?.[FIELDS.round] || 0;
  draws.forEach(r => {
    numsOf(r).forEach(n => {
      total[n]++;
      lastSeen[n] = r[FIELDS.round];
      if (r[FIELDS.round] > latest - recentN) recent[n]++;
    });
  });
  return { total, recent, gap: lastSeen.map(s => latest - s), recentN, latest };
};

// ---------- 뽑기 ----------
export const MODES = {
  smart: { label: '덜 겹치는 번호', emoji: '🎯', desc: '사람들이 덜 고르는 번호·무늬 위주. 당첨 확률은 같지만 당첨되면 나눠 갖는 사람이 줄어요.' },
  hot: { label: '요즘 핫한 번호', emoji: '🔥', desc: '최근 50회에 많이 나온 번호 위주 (재미용, 확률은 같아요)' },
  cold: { label: '오래 쉰 번호', emoji: '🧊', desc: '최근에 안 나온 번호 위주 (재미용, 확률은 같아요)' },
  random: { label: '완전 무작위', emoji: '🎲', desc: '45개 번호를 똑같은 확률로' }
};

const randomUnit = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

// 이미 뽑은 번호(picked)를 보고 다음 번호 하나의 가중치
export const nextWeights = (mode, picked, { model, stats }) => {
  const w = new Array(46).fill(0);
  for (let n = 1; n <= 45; n++) {
    if (picked.includes(n)) continue;
    let v = 1;
    if (mode === 'smart') {
      v = Math.exp(-2.2 * model.beta[n - 1]);
      // 조합 무늬: 연속·같은 끝자리·같은 십 단위가 쌓이면 줄이고, 마지막 번호에서 '모두 31 이하'를 피함
      if (picked.some(p => Math.abs(p - n) === 1)) v *= 0.35;
      if (picked.filter(p => p % 10 === n % 10).length >= 2) v *= 0.3;
      if (picked.filter(p => Math.floor((p - 1) / 10) === Math.floor((n - 1) / 10)).length >= 3) v *= 0.3;
      if (picked.length === 5 && picked.every(p => p <= 31) && n <= 31) v *= 0.15;
    } else if (mode === 'hot') {
      v = (stats.recent[n] + 1) ** 1.6;
    } else if (mode === 'cold') {
      v = Math.min(stats.gap[n], 40) + 1;
    }
    w[n] = v;
  }
  return w;
};

export const drawOne = (mode, picked, ctx) => {
  const w = nextWeights(mode, picked, ctx);
  const sum = w.reduce((s, v) => s + v, 0);
  let r = randomUnit() * sum;
  for (let n = 1; n <= 45; n++) {
    r -= w[n];
    if (r <= 0 && w[n] > 0) return n;
  }
  return w.lastIndexOf(Math.max(...w));
};

// 한 판(6개)을 미리 정함. 뽑기 화면은 이 순서대로 한 개씩 보여 준다.
// 덜 겹치는 번호 모드는 번호마다 가중치로 뽑은 조합 중 인기도 하위 30% 안의 것만 씀(안 되면 가장 덜 고르는 조합)
export const SMART_MAX_PCT = 0.3;
export const planSet = (mode, ctx, rankSet) => {
  const once = () => {
    const picked = [];
    while (picked.length < 6) picked.push(drawOne(mode, picked, ctx));
    return picked;
  };
  if (mode !== 'smart' || !rankSet) return once();
  let best = null;
  let bestPct = Infinity;
  for (let i = 0; i < 300; i++) {
    const set = once();
    const pct = rankSet(set);
    if (pct <= SMART_MAX_PCT) return set;
    if (pct < bestPct) {
      best = set;
      bestPct = pct;
    }
  }
  return best;
};

// 뽑힌 번호 한 개에 붙일 설명 { short: 받침 칸용, long: 자세히 }
export const reasonFor = (n, mode, { model, stats }) => {
  const pct = Math.round(model.percentile(n) * 100);
  if (mode === 'smart') {
    if (pct <= 33) return { short: `인기 하위 ${pct + 1}%`, long: `사람들이 덜 고르는 번호 (인기 하위 ${pct + 1}%)` };
    if (pct >= 67) return { short: '인기 번호', long: '많이 고르는 번호지만 조합 균형으로 뽑힘' };
    return { short: '인기 보통', long: `인기 중간 (하위 ${pct + 1}%)` };
  }
  if (mode === 'hot') return { short: `최근 ${stats.recent[n]}번`, long: `최근 ${stats.recentN}회 중 ${stats.recent[n]}번 나옴` };
  if (mode === 'cold') {
    return stats.gap[n] === 0
      ? { short: '지난주 나옴', long: '지난 회차에 나옴' }
      : { short: `${stats.gap[n]}회 쉼`, long: `${stats.gap[n]}회째 안 나옴` };
  }
  return { short: '무작위', long: '무작위' };
};

// 조합 인기도: 무작위 조합들과 비교한 백분위 (0 = 가장 덜 고름)
export const makeSetRanker = (model, samples = 20000) => {
  const scores = [];
  for (let i = 0; i < samples; i++) {
    const set = new Set();
    while (set.size < 6) set.add(1 + Math.floor(randomUnit() * 45));
    scores.push(model.score([...set]));
  }
  scores.sort((a, b) => a - b);
  return (nums) => {
    const s = model.score(nums);
    let lo = 0, hi = scores.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (scores[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo / scores.length;
  };
};

export const describeSet = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const odd = s.filter(n => n % 2).length;
  const sum = s.reduce((a, b) => a + b, 0);
  const pat = patternFeatures(s);
  return { odd, even: 6 - odd, sum, patterns: PATTERN_LABELS.filter((_, i) => pat[i] > 0) };
};

// 저장한 조합 맞춰 보기: 등수 (없으면 0)
export const rankOf = (nums, row) => {
  const win = numsOf(row);
  const hit = nums.filter(n => win.includes(n)).length;
  if (hit === 6) return 1;
  if (hit === 5) return nums.includes(row[FIELDS.bonus]) ? 2 : 3;
  if (hit === 4) return 4;
  if (hit === 3) return 5;
  return 0;
};

export const nextDrawInfo = (draws) => {
  const last = draws[draws.length - 1];
  const d = String(last[FIELDS.date]);
  const date = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)) + 7);
  return { round: last[FIELDS.round] + 1, date };
};

export const fmtDate = (ymdOrDate) => {
  if (ymdOrDate instanceof Date) return `${ymdOrDate.getFullYear()}.${ymdOrDate.getMonth() + 1}.${ymdOrDate.getDate()}`;
  const d = String(ymdOrDate);
  return `${d.slice(0, 4)}.${Number(d.slice(4, 6))}.${Number(d.slice(6, 8))}`;
};
