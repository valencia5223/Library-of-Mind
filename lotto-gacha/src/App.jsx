import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FIELDS, numsOf, ballClass, buildPopularityModel, buildStats, MODES, planSet, reasonFor,
  makeSetRanker, describeSet, rankOf, nextDrawInfo, fmtDate
} from './lotto';
import { toRow, ROUND_URL } from './rows';

const SAVE_KEY = 'lotto_gacha_saved_v1';
const SPIN_MS = 900;
const DROP_MS = 650;

const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
  } catch {
    return [];
  }
};
const storeSaved = (list) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch { /* 저장 공간 문제는 무시 */ }
};

// 당첨 결과: draws.json 을 읽고, 개발 서버의 /dh 중계가 되면 그 뒤 회차를 더 받음
const useDraws = () => {
  const [state, setState] = useState({ draws: null, updatedAt: null, live: false, error: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let draws = [];
      let updatedAt = null;
      try {
        const res = await fetch('./draws.json', { cache: 'no-cache' });
        const json = await res.json();
        draws = json.draws;
        updatedAt = json.updatedAt;
      } catch {
        if (!cancelled) setState(s => ({ ...s, error: '당첨 번호 데이터를 읽지 못했습니다.' }));
        return;
      }
      if (!cancelled) setState({ draws, updatedAt, live: false, error: null });
      // 새 회차 확인 (최대 3번, 10회차씩)
      let live = false;
      try {
        for (let i = 0; i < 3; i++) {
          const max = draws[draws.length - 1][FIELDS.round];
          // 아직 없는 회차를 기준으로 물으면 빈 목록이 오므로, 가진 마지막 회차를 기준으로 묻는다
          // (응답은 최신 회차까지 잘려서 그 뒤 새 회차들이 같이 옴)
          const res = await fetch(`./dh${ROUND_URL(max)}`, { headers: { accept: 'application/json' } });
          if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) break;
          const list = (await res.json())?.data?.list;
          if (!Array.isArray(list)) break;
          live = true;
          const fresh = list.map(toRow).filter(r => r[FIELDS.round] > max).sort((a, b) => a[0] - b[0]);
          if (fresh.length === 0) break;
          draws = [...draws, ...fresh];
          updatedAt = new Date().toISOString();
        }
      } catch { /* 중계가 없는 배포 환경: draws.json 만 씀 */ }
      if (!cancelled) setState({ draws, updatedAt, live, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
};

const Ball = ({ n, size = 'md', className = '' }) => (
  <span className={`ball ${ballClass(n)} ball-${size} ${className}`}>{n}</span>
);

// 돔 아래쪽에 쌓여 있는 장식용 공 (줄마다 조금씩 엇갈리게)
const DOME_ROWS = [[84, 7], [70, 6], [56, 5], [43, 3]]; // [위치 %, 개수]
const DOME_BALLS = DOME_ROWS.flatMap(([top, count], row) =>
  Array.from({ length: count }, (_, i) => ({
    n: ((row * 11 + i * 7) % 45) + 1,
    left: 50 + (i - (count - 1) / 2) * 13 + (row % 2 ? 3 : -2) + ((i * 5 + row * 3) % 5) - 2,
    top: top + ((i * 7 + row) % 4) - 2,
    delay: ((row + i) % 5) * 0.08
  }))
);

function GachaMachine({ spinning, dropping, current, onSpin, disabled, label }) {
  return (
    <div className={`machine ${spinning ? 'is-spinning' : ''}`}>
      <div className="dome">
        <div className="dome-shine" />
        {DOME_BALLS.map((b, i) => (
          <span
            key={i}
            className={`dome-ball ${ballClass(b.n)}`}
            style={{ left: `calc(${b.left}% - 15px)`, top: `calc(${b.top}% - 15px)`, animationDelay: `${b.delay}s` }}
          />
        ))}
      </div>
      <div className="machine-body">
        <button type="button" className="handle" onClick={onSpin} disabled={disabled} aria-label={label}>
          <span className="handle-bar" />
        </button>
        <div className="chute">
          {current && (
            <div className={`capsule ${dropping ? 'is-dropping' : 'is-open'}`}>
              <span className="capsule-top" />
              <span className="capsule-bottom" />
              {!dropping && <Ball n={current} size="lg" className="pop" />}
            </div>
          )}
        </div>
      </div>
      <button type="button" className="spin-btn" onClick={onSpin} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}

function StatsView({ draws, model, stats }) {
  const [metric, setMetric] = useState('popularity');
  const values = useMemo(() => {
    const v = [];
    for (let n = 1; n <= 45; n++) {
      if (metric === 'popularity') v[n] = model.percentile(n);
      else if (metric === 'recent') v[n] = stats.recent[n] / Math.max(...stats.recent);
      else v[n] = Math.min(stats.gap[n], 30) / 30;
    }
    return v;
  }, [metric, model, stats]);
  const label = (n) => (metric === 'popularity'
    ? `인기 상위 ${100 - Math.round(model.percentile(n) * 100)}%`
    : metric === 'recent' ? `최근 ${stats.recentN}회 ${stats.recent[n]}번` : `${stats.gap[n]}회째 안 나옴`);
  const ranked = [...Array(45)].map((_, i) => i + 1).sort((a, b) => model.beta[a - 1] - model.beta[b - 1]);

  return (
    <div className="stack">
      <section className="card">
        <h2>번호 지도</h2>
        <div className="seg">
          {[['popularity', '사람들이 고르는 정도'], ['recent', `최근 ${stats.recentN}회 출현`], ['gap', '안 나온 기간']].map(([k, l]) => (
            <button key={k} type="button" className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
        <div className="heat">
          {values.map((v, n) => n > 0 && (
            <div key={n} className="heat-cell" style={{ '--v': v }} title={`${n}: ${label(n)}`}>
              <b>{n}</b>
              <small>{metric === 'popularity' ? `${Math.round(v * 100)}` : metric === 'recent' ? stats.recent[n] : stats.gap[n]}</small>
            </div>
          ))}
        </div>
        <p className="hint">
          {metric === 'popularity'
            ? '숫자가 클수록(진할수록) 많은 사람이 고르는 번호예요. 0~100 백분위.'
            : metric === 'recent' ? '최근 출현 횟수는 다음 회차 확률과 상관없어요 (재미용).' : '안 나온 기간도 다음 회차 확률과 상관없어요 (재미용).'}
        </p>
      </section>

      <section className="card">
        <h2>인기도 분석</h2>
        <p className="hint">
          {model.rounds}개 회차의 3~5등 당첨자 수를 판매량과 비교해, 어떤 번호·무늬를 사람들이 많이 고르는지 추정했어요.
          과거로 학습해 최근 회차를 맞혀 본 정확도(상관계수)는 <b>{model.holdoutCorr.toFixed(2)}</b> 입니다.
        </p>
        <div className="pop-row"><span>많이 고르는 번호</span><div>{ranked.slice(-8).reverse().map(n => <Ball key={n} n={n} size="sm" />)}</div></div>
        <div className="pop-row"><span>덜 고르는 번호</span><div>{ranked.slice(0, 8).map(n => <Ball key={n} n={n} size="sm" />)}</div></div>
        <p className="hint">6개가 모두 31 이하(생일 범위)이거나 끝자리가 같은 번호가 많으면 인기가 더 올라가요.</p>
      </section>

      <section className="card">
        <h2>최근 당첨 번호</h2>
        <div className="recent">
          {draws.slice(-10).reverse().map(r => (
            <div key={r[0]} className="recent-row">
              <div className="recent-meta"><b>{r[0]}회</b><small>{fmtDate(r[FIELDS.date])} · 1등 {r[FIELDS.w1]}명</small></div>
              <div className="balls">
                {numsOf(r).map(n => <Ball key={n} n={n} size="sm" />)}
                <span className="plus">+</span>
                <Ball n={r[FIELDS.bonus]} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const { draws, updatedAt, live, error } = useDraws();
  const [tab, setTab] = useState('gacha');
  const [mode, setMode] = useState('smart');
  const [picks, setPicks] = useState([]); // [{ n, reason }]
  const [spinning, setSpinning] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState(loadSaved);
  const [toast, setToast] = useState('');
  const timers = useRef([]);
  const planRef = useRef(null); // 이번 판에 나올 6개 (뽑을 때마다 앞에서부터 하나씩 보여 줌)

  const model = useMemo(() => (draws ? buildPopularityModel(draws) : null), [draws]);
  const stats = useMemo(() => (draws ? buildStats(draws) : null), [draws]);
  const rankSet = useMemo(() => (model ? makeSetRanker(model) : null), [model]);
  const next = draws ? nextDrawInfo(draws) : null;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const flash = (msg) => {
    setToast(msg);
    later(() => setToast(''), 1800);
  };

  const done = picks.length === 6;
  const busy = spinning || dropping;

  const spin = () => {
    if (!model || busy || done) return;
    if (!planRef.current) planRef.current = planSet(mode, { model, stats }, rankSet);
    const n = planRef.current[picks.length];
    setSpinning(true);
    setCurrent(null);
    later(() => {
      setSpinning(false);
      setCurrent(n);
      setDropping(true);
    }, SPIN_MS);
    later(() => {
      setDropping(false);
      setPicks(prev => [...prev, { n, reason: reasonFor(n, mode, { model, stats }) }]);
    }, SPIN_MS + DROP_MS);
  };

  const spinAll = () => {
    if (!model || busy || done) return;
    if (!planRef.current) planRef.current = planSet(mode, { model, stats }, rankSet);
    const added = planRef.current.slice(picks.length).map(n => ({ n, reason: reasonFor(n, mode, { model, stats }) }));
    setCurrent(added[added.length - 1].n);
    setPicks(prev => [...prev, ...added]);
  };

  const reset = () => {
    if (busy) return;
    planRef.current = null;
    setPicks([]);
    setCurrent(null);
  };

  const sortedNums = [...picks.map(p => p.n)].sort((a, b) => a - b);
  const info = done ? describeSet(sortedNums) : null;
  const popPct = done && rankSet ? Math.round(rankSet(sortedNums) * 100) : null;

  const save = () => {
    if (!done || !next) return;
    if (saved.some(s => s.round === next.round && s.nums.join() === sortedNums.join())) {
      flash('이미 저장한 조합이에요');
      return;
    }
    const list = [{ round: next.round, nums: sortedNums, mode, at: Date.now() }, ...saved];
    setSaved(list);
    storeSaved(list);
    flash(`${next.round}회 번호로 저장했어요`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sortedNums.join(', '));
      flash('번호를 복사했어요');
    } catch {
      flash(sortedNums.join(', '));
    }
  };

  const removeSaved = (at) => {
    const list = saved.filter(s => s.at !== at);
    setSaved(list);
    storeSaved(list);
  };

  const drawByRound = useMemo(() => new Map((draws || []).map(r => [r[FIELDS.round], r])), [draws]);

  if (error) return <div className="app"><p className="empty">{error}</p></div>;
  if (!draws || !model) return <div className="app"><p className="empty">당첨 번호 불러오는 중…</p></div>;

  const last = draws[draws.length - 1];

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>로또 캡슐 뽑기</h1>
          <p className="sub">
            {next.round}회 · {fmtDate(next.date)}(토) 추첨 · 지난 {last[0]}회까지 {draws.length}회 분석
            {live ? ' · 실시간 확인됨' : ''}
          </p>
        </div>
        <nav className="seg">
          <button type="button" className={tab === 'gacha' ? 'on' : ''} onClick={() => setTab('gacha')}>뽑기</button>
          <button type="button" className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>저장 {saved.length > 0 ? saved.length : ''}</button>
          <button type="button" className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>분석</button>
        </nav>
      </header>

      {tab === 'gacha' && (
        <div className="stack">
          <section className="card">
            <div className="modes">
              {Object.entries(MODES).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  className={`mode ${mode === key ? 'on' : ''}`}
                  onClick={() => !busy && picks.length === 0 && setMode(key)}
                  disabled={busy || (picks.length > 0 && mode !== key)}
                >
                  <span className="mode-emoji">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            <p className="hint">{MODES[mode].desc}{picks.length > 0 && picks.length < 6 ? ' (뽑는 중에는 모드를 바꿀 수 없어요)' : ''}</p>
          </section>

          <section className="card gacha-card">
            <GachaMachine
              spinning={spinning}
              dropping={dropping}
              current={current}
              onSpin={spin}
              disabled={busy || done}
              label={done ? '6개 다 뽑았어요' : busy ? '뽑는 중…' : `레버 돌리기 (${picks.length + 1}/6)`}
            />
            <div className="tray">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="slot">
                  {picks[i] ? (
                    <>
                      <Ball n={picks[i].n} className="pop" />
                      <small title={picks[i].reason.long}>{picks[i].reason.short}</small>
                    </>
                  ) : (
                    <span className="slot-empty">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="row-btns">
              {!done && <button type="button" className="btn ghost" onClick={spinAll} disabled={busy}>남은 번호 한 번에 뽑기</button>}
              {picks.length > 0 && <button type="button" className="btn ghost" onClick={reset} disabled={busy}>처음부터</button>}
            </div>
          </section>

          {done && (
            <section className="card result">
              <h2>이번 조합</h2>
              <div className="balls big">{sortedNums.map(n => <Ball key={n} n={n} />)}</div>
              <ul className="facts">
                <li>
                  <span>인기도</span>
                  <b>{popPct <= 33 ? '덜 고르는 조합' : popPct >= 67 ? '많이 고르는 조합' : '보통'}</b>
                  <small>무작위 조합 중 하위 {Math.max(popPct, 1)}%</small>
                </li>
                <li><span>홀:짝</span><b>{info.odd}:{info.even}</b></li>
                <li><span>합계</span><b>{info.sum}</b><small>보통 100~175</small></li>
                <li><span>무늬</span><b>{info.patterns.length ? info.patterns.join(', ') : '없음'}</b></li>
              </ul>
              <div className="row-btns">
                <button type="button" className="btn primary" onClick={save}>저장</button>
                <button type="button" className="btn" onClick={copy}>복사</button>
                <button type="button" className="btn" onClick={reset}>다시 뽑기</button>
              </div>
            </section>
          )}

          <p className="notice">
            모든 번호 조합의 1등 확률은 똑같이 8,145,060분의 1이에요. 이 앱은 당첨 확률을 높이지 못하고,
            &apos;덜 겹치는 번호&apos; 모드는 당첨됐을 때 같은 번호를 산 사람이 적을 조합을 고를 뿐이에요.
            로또는 재미로, 정해 둔 금액 안에서만 즐기세요.
          </p>
        </div>
      )}

      {tab === 'saved' && (
        <div className="stack">
          {saved.length === 0 && <p className="empty">저장한 번호가 없어요. 뽑기에서 6개를 뽑고 저장해 보세요.</p>}
          {saved.map(s => {
            const row = drawByRound.get(s.round);
            const rank = row ? rankOf(s.nums, row) : null;
            const win = row ? numsOf(row) : [];
            return (
              <div key={s.at} className="card saved">
                <div className="saved-head">
                  <b>{s.round}회</b>
                  <small>{MODES[s.mode]?.emoji} {MODES[s.mode]?.label}</small>
                  <span className={`badge ${rank ? 'win' : row ? 'lose' : ''}`}>
                    {row ? (rank ? `${rank}등!` : '낙첨') : '추첨 전'}
                  </span>
                  <button type="button" className="x" onClick={() => removeSaved(s.at)} aria-label="지우기">×</button>
                </div>
                <div className="balls">
                  {s.nums.map(n => <Ball key={n} n={n} size="sm" className={row && !win.includes(n) ? 'dim' : ''} />)}
                </div>
                {row && (
                  <small className="hint">
                    당첨 번호 {win.join(', ')} + {row[FIELDS.bonus]} · {s.nums.filter(n => win.includes(n)).length}개 맞음
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && <StatsView draws={draws} model={model} stats={stats} />}

      <footer className="foot">
        데이터: 동행복권 당첨 결과 ({updatedAt ? `${fmtDate(new Date(updatedAt))} 갱신` : ''}) · 비공식 조회 주소를 써서 바뀌면 갱신이 멈출 수 있어요
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
