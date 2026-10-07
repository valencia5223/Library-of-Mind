// ═════════════════════════════════════════════════════════════════════════════
// 🐠 내 어항 키우기 – 데이터 & 규칙
// 물고기 종류, 장식, 바다 친구 가격, 성장/컨디션 계산, 저장 형식을 모아 둔다.
// (React 없음: voiceLines.js 의 음성 문장 목록에서도 그대로 불러 쓴다)
// ═════════════════════════════════════════════════════════════════════════════

// 물고기 종류
//  len: 다 큰 물고기 길이(px, 화면 크기에 따라 조금 더 커짐) / hRatio: 몸 높이 비율
//  shape: normal(보통) · angel(세로로 긴 마름모) · disc(동그란 원반) · betta(긴 지느러미) · tang(타원) · cory(바닥 메기)
//  growMul: 성장 속도 배율 / zone: 주로 머무는 높이 (mid · bottom · top)
export const FISH_SPECIES = [
  {
    id: 'neon', name: '네온테트라', price: 0, starter: true, len: 34, hRatio: 0.3, shape: 'normal',
    speed: 1.1, growMul: 1.25, school: true, zone: 'mid',
    top: '#475569', belly: '#e2e8f0',
    bands: [{ color: '#22d3ee', y: -0.12, from: 0.05, to: 0.78, w: 0.2, glow: true }, { color: '#ef4444', y: 0.2, from: 0.42, to: 0.92, w: 0.3 }],
    tail: { color: 'rgba(226,232,240,0.55)', len: 0.3, spread: 0.3 }, fin: 'rgba(226,232,240,0.45)'
  },
  {
    id: 'guppy', name: '구피', price: 0, starter: true, len: 34, hRatio: 0.3, shape: 'normal',
    speed: 0.95, growMul: 1.25, school: false, zone: 'top',
    top: '#a8a29e', belly: '#fef3c7',
    tail: { grad: ['#f97316', '#ec4899', '#3b82f6'], len: 0.8, spread: 0.6 }, fin: 'rgba(236,72,153,0.6)'
  },
  {
    id: 'danio', name: '지브라다니오', price: 0, starter: true, len: 36, hRatio: 0.27, shape: 'normal',
    speed: 1.25, growMul: 1.15, school: true, zone: 'mid',
    top: '#94a3b8', belly: '#fefce8',
    bands: [{ color: '#1e3a8a', y: -0.18, from: 0.12, to: 0.98, w: 0.14 }, { color: '#1e40af', y: 0.02, from: 0.1, to: 1, w: 0.14 }, { color: '#1e3a8a', y: 0.22, from: 0.2, to: 1, w: 0.12 }],
    tail: { color: 'rgba(253,224,71,0.5)', len: 0.34, spread: 0.32 }, fin: 'rgba(253,224,71,0.45)'
  },
  {
    id: 'goldfish', name: '금붕어', price: 0, starter: true, len: 60, hRatio: 0.52, shape: 'normal',
    speed: 0.6, growMul: 0.85, school: false, zone: 'mid',
    top: '#ea580c', belly: '#fde68a',
    tail: { color: 'rgba(251,146,60,0.72)', len: 0.75, spread: 0.62, double: true }, fin: 'rgba(251,146,60,0.65)'
  },
  {
    id: 'platy', name: '플래티', price: 150, len: 40, hRatio: 0.4, shape: 'normal',
    speed: 0.9, growMul: 1.1, school: true, zone: 'mid',
    top: '#dc2626', belly: '#fdba74',
    tail: { color: 'rgba(15,23,42,0.75)', len: 0.36, spread: 0.36 }, fin: 'rgba(248,113,113,0.6)'
  },
  {
    id: 'cory', name: '코리도라스', price: 200, len: 40, hRatio: 0.36, shape: 'cory',
    speed: 0.55, growMul: 1, school: true, zone: 'bottom',
    top: '#78716c', belly: '#f5f5f4', spots: '#44403c',
    tail: { color: 'rgba(214,211,209,0.6)', len: 0.3, spread: 0.32 }, fin: 'rgba(214,211,209,0.55)'
  },
  {
    // 비파(플레코): 바닥과 유리에 붙어 다니며 유리 이끼를 먹어 치운다
    id: 'pleco', name: '비파', price: 300, len: 58, hRatio: 0.3, shape: 'pleco',
    speed: 0.45, growMul: 0.9, school: false, zone: 'bottom', algaeEater: true,
    top: '#44403c', belly: '#78716c', spots: '#e7e5e4',
    tail: { color: 'rgba(68,64,60,0.85)', len: 0.3, spread: 0.36, solid: true }, fin: 'rgba(87,83,78,0.85)'
  },
  {
    id: 'betta', name: '베타', price: 250, len: 54, hRatio: 0.3, shape: 'betta',
    speed: 0.5, growMul: 0.95, school: false, zone: 'top',
    top: '#1d4ed8', belly: '#7c3aed',
    tail: { grad: ['#2563eb', '#7c3aed', '#dc2626'], len: 1.05, spread: 0.85 }, fin: 'rgba(124,58,237,0.6)'
  },
  {
    id: 'angel', name: '엔젤피시', price: 400, len: 52, hRatio: 0.95, shape: 'angel',
    speed: 0.55, growMul: 0.9, school: false, zone: 'mid',
    top: '#cbd5e1', belly: '#f8fafc', bars: '#1e293b',
    tail: { color: 'rgba(226,232,240,0.6)', len: 0.4, spread: 0.45 }, fin: 'rgba(226,232,240,0.55)'
  },
  {
    id: 'tang', name: '블루탱', price: 600, len: 60, hRatio: 0.62, shape: 'tang',
    speed: 0.8, growMul: 0.85, school: false, zone: 'mid',
    top: '#1d4ed8', belly: '#3b82f6', mark: '#0f172a',
    tail: { color: '#facc15', len: 0.38, spread: 0.4, solid: true }, fin: 'rgba(15,23,42,0.75)'
  },
  {
    id: 'discus', name: '디스커스', price: 800, len: 62, hRatio: 0.95, shape: 'disc',
    speed: 0.45, growMul: 0.8, school: false, zone: 'mid',
    top: '#ea580c', belly: '#f59e0b', waves: '#38bdf8',
    tail: { color: 'rgba(234,88,12,0.6)', len: 0.25, spread: 0.3 }, fin: 'rgba(234,88,12,0.55)'
  }
];
export const FISH_BY_ID = Object.fromEntries(FISH_SPECIES.map(f => [f.id, f]));

// 장식 (모래 위에 놓는다) – 그림은 AquariumGame.jsx 의 drawDecor 가 그린다
export const DECOR_ITEMS = [
  { id: 'grass', name: '수초 덤불', price: 40, icon: '🌿' },
  { id: 'rock', name: '둥근 바위', price: 30, icon: '🪨' },
  { id: 'sword', name: '넓은잎 수초', price: 70, icon: '🍃' },
  { id: 'coral', name: '분홍 산호', price: 90, icon: '🪸' },
  { id: 'airstone', name: '뽀글 기포돌', price: 100, icon: '🫧' },
  { id: 'chest', name: '보물상자', price: 150, icon: '💰' },
  { id: 'castle', name: '모래성', price: 200, icon: '🏰' },
  { id: 'diver', name: '잠수부 아저씨', price: 250, icon: '🤿' }
];
export const DECOR_BY_ID = Object.fromEntries(DECOR_ITEMS.map(d => [d.id, d]));

// 바다 친구(기존 바다 생물 SVG) 가격
export const FRIEND_PRICES = {
  fish: 150, crab: 150, starfish: 150, shrimp: 150, seahorse: 200, jellyfish: 200,
  octopus: 300, squid: 300, turtle: 350, penguin: 350, seal: 400, shark: 550, whale: 600
};

// 기본 물고기(처음 받는 치어 종류)를 상점에서 더 살 때 가격
export const STARTER_FISH_PRICE = 60;

export const LIMITS = { fish: 14, friends: 4, decor: 10 };

// ── 성장 단계 ──
export const STAGE_NAMES = { fry: '아기 치어', juvenile: '어린 물고기', adult: '다 큰 물고기' };
export const stageOf = (growth) => (growth < 0.34 ? 'fry' : growth < 0.8 ? 'juvenile' : 'adult');
export const sizeScale = (growth) => 0.55 + 0.45 * (1 - Math.pow(1 - Math.min(1, growth), 1.6));

// ── 컨디션 & 성장 규칙 ──
// 배부름(full)·기분(happy)은 물고기마다, 물 더러움(dirt)은 어항 전체 값이다 (모두 0~100)
export const RATES = {
  growPerSec: 1 / 720,      // 컨디션 최고일 때 치어 → 다 큰 물고기 약 12분 (종류별 growMul 곱)
  offlineGrowMul: 0.15,     // 앱을 꺼둔 동안은 15% 속도로 자란다
  fullDropPerSec: 100 / 420, // 놀 때 배부름 100 → 0 약 7분
  offlineFullDropPerSec: 100 / (8 * 3600),
  dirtPerSec: 100 / 1500,   // 놀 때 물 더러움 0 → 100 약 25분
  offlineDirtPerSec: 100 / (24 * 3600),
  happyDropPerSec: 100 / 900,
  offlineCapSec: 24 * 3600
};
export const isSad = (fish, dirt) => fish.full < 25 || dirt > 70;
// 컨디션 점수 0~100 (배부름 40% + 물 깨끗함 40% + 기분 20%)
export const conditionOf = (fish, dirt) => Math.round(fish.full * 0.4 + (100 - dirt) * 0.4 + fish.happy * 0.2);
// 컨디션에 따른 성장 배율 (슬프면 멈춤)
export const growFactor = (fish, dirt) => (isSad(fish, dirt) ? 0 : Math.max(0.15, Math.min(1, (conditionOf(fish, dirt) - 30) / 55)));

// ── 포인트(조개) 보상 ──
export const REWARDS = { eat: 1, poop: 2, algae: 1, waterChange: 10, juvenile: 20, adult: 50, pearl: 5, daily: 20, pet: 1 };

// ── 저장 ──
export const SAVE_KEY = 'bps_aquarium_v1';
let uidSeq = 0;
export const newUid = () => `${Date.now().toString(36)}${(uidSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const newFish = (sp) => ({ uid: newUid(), sp, growth: 0, full: 80, happy: 80, bornAt: Date.now() });

export function createNewGame() {
  return {
    version: 1,
    points: 30,
    dirt: 0,
    algae: 0,
    poop: [],
    // 처음엔 기본 물고기들의 치어로 시작 (떼 지어 다니는 종류는 여러 마리)
    fish: ['neon', 'neon', 'neon', 'danio', 'danio', 'guppy', 'guppy', 'goldfish'].map(newFish),
    friends: [],
    decor: [
      { uid: newUid(), id: 'grass', x: 0.12 },
      { uid: newUid(), id: 'rock', x: 0.72 },
      { uid: newUid(), id: 'grass', x: 0.86 }
    ],
    lastTick: Date.now(),
    lastDaily: '',
    welcomed: false
  };
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      if (g && g.version === 1 && Array.isArray(g.fish)) return g;
    }
  } catch (e) { /* 저장소를 못 쓰면 새 게임 */ }
  return createNewGame();
}

export function saveGame(game) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* 저장 실패는 무시 */ }
}

// 앱을 꺼둔 시간만큼 천천히 배고파지고, 물이 더러워지고, 조금씩 자란다 (1분 단위로 계산)
export function catchUpOffline(game, now = Date.now()) {
  const gone = Math.min(RATES.offlineCapSec, Math.max(0, (now - (game.lastTick || now)) / 1000));
  const grown = [];
  for (let t = 0; t < gone; t += 60) {
    const step = Math.min(60, gone - t);
    game.dirt = Math.min(100, game.dirt + RATES.offlineDirtPerSec * step);
    game.fish.forEach(f => {
      f.full = Math.max(0, f.full - RATES.offlineFullDropPerSec * step);
      const before = stageOf(f.growth);
      const sp = FISH_BY_ID[f.sp];
      f.growth = Math.min(1, f.growth + RATES.growPerSec * RATES.offlineGrowMul * (sp ? sp.growMul : 1) * growFactor(f, game.dirt) * step);
      if (stageOf(f.growth) !== before) grown.push(f);
    });
  }
  game.lastTick = now;
  return { goneSec: gone, grown };
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
