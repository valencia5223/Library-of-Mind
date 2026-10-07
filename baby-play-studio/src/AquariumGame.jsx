// ═════════════════════════════════════════════════════════════════════════════
// 🐠 내 어항 키우기 (다마고치형 어항 RPG)
//  - 치어로 시작해 밥 주기·청소·물갈이로 돌보면, 물고기마다 컨디션에 따라 자란다
//  - 돌봐서 모은 조개(포인트)로 상점에서 물고기(치어)·장식·바다 친구를 사서 꾸민다
//  - 그래픽: 캔버스(물고기·수초·장식·모래·거품) + WebGL 빛 레이어(물결 빛무늬·햇살)
//    + SVG 바다 친구 + 유리 이끼/탁한 물 레이어
//  - 진행 상황은 이 기기의 localStorage 에 저장된다 (aquariumData.js)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { VOICE } from './voiceLines.js';
import {
  FISH_SPECIES, FISH_BY_ID, DECOR_ITEMS, DECOR_BY_ID, FRIEND_PRICES, STARTER_FISH_PRICE, LIMITS, STAGE_NAMES,
  stageOf, sizeScale, RATES, isSad, conditionOf, growFactor, REWARDS,
  loadGame, saveGame, catchUpOffline, newFish, newUid, todayKey
} from './aquariumData.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 바다 친구 움직임: swim(헤엄) / crawl(모래 위) / pulse(해파리처럼 둥실)
const FRIEND_MOTION = { crab: 'crawl', starfish: 'crawl', jellyfish: 'pulse' };
// 그림이 오른쪽을 보고 있어 진행 방향에 따라 좌우를 뒤집는 친구
const FRIEND_FLIP = new Set(['fish', 'turtle', 'whale', 'shark', 'seal', 'shrimp', 'seahorse']);
const FRIEND_SPEED = { seahorse: 0.45, octopus: 0.6, turtle: 0.7, whale: 0.65, starfish: 0.35, crab: 1 };

// 장식 크기(터치·끌기 판정용, 화면 배율 k 를 곱한다)
const DECOR_BOX = {
  grass: [50, 120], sword: [90, 85], rock: [80, 50], coral: [74, 84],
  airstone: [32, 22], chest: [72, 62], castle: [112, 104], diver: [52, 92]
};
const FOOD_COLORS = ['#f97316', '#dc2626', '#84cc16', '#facc15', '#a16207'];

// ═══════════════════════════════ 물고기 그리기 ═══════════════════════════════
function bodyProfile(shape, s) {
  if (shape === 'disc') return Math.sqrt(Math.max(0, 1 - Math.pow(2 * s - 1.04, 2)));
  if (shape === 'angel') return s < 0.42 ? Math.pow(s / 0.42, 0.65) : Math.pow(Math.max(0, (1 - s) / 0.58), 0.85);
  if (shape === 'pleco') return Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + s * 0.8)), 0.45) * (1 - s * 0.5);
  if (shape === 'cory') return Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + s * 0.86)), 0.55) * (s < 0.35 ? 1 : 1 - (s - 0.35) * 0.45);
  return Math.pow(Math.sin(Math.PI * (0.07 + s * 0.89)), 0.75);
}

function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

// 원점(몸 가운데)에서 +x 방향을 보는 물고기를 그린다. L: 현재 몸 길이(px)
export function drawFish(ctx, sp, L, o = {}) {
  const growth = o.growth ?? 1;
  const fry = 1 - Math.min(1, growth / 0.6);           // 1 이면 갓 태어난 치어
  const H = L * sp.hRatio * (1 + fry * 0.12);
  const amp = L * (sp.shape === 'disc' || sp.shape === 'angel' ? 0.03 : sp.shape === 'betta' ? 0.09 : 0.07);
  const ph = o.phase || 0;
  const wave = (s) => Math.sin(ph - s * 3.2) * amp * s * s;
  const half = (s) => H * 0.5 * Math.max(0.07, bodyProfile(sp.shape, s));
  const xs = (s) => L * (0.5 - s);
  const finK = 0.4 + 0.6 * (1 - fry);
  const tailX = xs(1), tailY = wave(1);
  const swing = Math.sin(ph - 3.6) * amp * 1.9;
  const t = sp.tail;

  ctx.save();
  ctx.globalAlpha *= 1 - fry * 0.28;

  // ── 지느러미 (몸 뒤) ──
  const finFill = sp.fin;
  ctx.fillStyle = finFill;
  if (sp.shape === 'angel') {
    // 길게 뒤로 뻗은 등·뒷지느러미
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) - half(0.3) * 0.9);
    ctx.quadraticCurveTo(xs(0.55), wave(0.5) - H * 0.95 * finK, xs(1.15), wave(1) - H * 0.85 * finK + swing);
    ctx.lineTo(xs(0.85), wave(0.85) - half(0.85));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) + half(0.3) * 0.9);
    ctx.quadraticCurveTo(xs(0.55), wave(0.5) + H * 0.95 * finK, xs(1.15), wave(1) + H * 0.85 * finK + swing);
    ctx.lineTo(xs(0.85), wave(0.85) + half(0.85));
    ctx.closePath(); ctx.fill();
  } else if (sp.shape === 'betta') {
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, 'rgba(37,99,235,0.75)'); g.addColorStop(1, 'rgba(220,38,38,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(xs(0.25), wave(0.25) - half(0.25));
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) - H * 1.3 * finK + swing * 0.5, xs(1.05), wave(1) - H * 0.4 + swing);
    ctx.lineTo(xs(0.9), wave(0.9));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) + half(0.3));
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) + H * 1.5 * finK + swing * 0.5, xs(1.05), wave(1) + H * 0.5 + swing);
    ctx.lineTo(xs(0.9), wave(0.9));
    ctx.closePath(); ctx.fill();
  } else if (sp.shape === 'pleco') {
    // 커다란 돛 모양 등지느러미 (점무늬)
    ctx.beginPath();
    ctx.moveTo(xs(0.22), wave(0.22) - half(0.22) * 0.95);
    ctx.quadraticCurveTo(xs(0.3), wave(0.3) - half(0.3) - H * 0.95 * finK, xs(0.58), wave(0.58) - half(0.58) - H * 0.25 * finK);
    ctx.lineTo(xs(0.62), wave(0.62) - half(0.62) * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(231,229,228,0.55)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(xs(0.28 + i * 0.06), wave(0.3) - half(0.3) - H * (0.15 + (i % 2) * 0.2) * finK, Math.max(0.7, L * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = finFill;
    // 배 아래로 넓게 펼친 배지느러미
    ctx.beginPath(); ctx.ellipse(xs(0.32), wave(0.32) + half(0.32) * 0.8, L * 0.12 * finK, H * 0.22 * finK, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // 등지느러미
    ctx.beginPath();
    ctx.moveTo(xs(0.32), wave(0.32) - half(0.32) * 0.92);
    ctx.quadraticCurveTo(xs(0.45), wave(0.45) - half(0.45) - H * 0.42 * finK, xs(0.66), wave(0.66) - half(0.66) * 0.9);
    ctx.closePath(); ctx.fill();
    // 뒷지느러미
    ctx.beginPath();
    ctx.moveTo(xs(0.55), wave(0.55) + half(0.55) * 0.9);
    ctx.quadraticCurveTo(xs(0.68), wave(0.68) + half(0.68) + H * 0.26 * finK, xs(0.82), wave(0.82) + half(0.82) * 0.85);
    ctx.closePath(); ctx.fill();
  }

  // ── 꼬리 ──
  const tl = L * t.len * finK, tsp = L * t.spread * finK;
  let tailFill = t.color;
  if (t.grad) {
    const g = ctx.createLinearGradient(tailX, 0, tailX - tl, 0);
    t.grad.forEach((c, i) => g.addColorStop(i / (t.grad.length - 1), c));
    tailFill = g;
  }
  const tailLobe = (yOff, k) => {
    ctx.beginPath();
    ctx.moveTo(tailX + L * 0.05, tailY - H * 0.13 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * 0.45, tailY + swing * 0.5 - tsp * 0.62 * k + yOff, tailX - tl, tailY + swing - tsp * 0.5 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * (t.solid ? 0.72 : sp.shape === 'betta' ? 1.08 : 0.84), tailY + swing + yOff, tailX - tl, tailY + swing + tsp * 0.5 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * 0.45, tailY + swing * 0.5 + tsp * 0.62 * k + yOff, tailX + L * 0.05, tailY + H * 0.13 * k + yOff);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = tailFill;
  if (t.double) {
    ctx.save(); ctx.globalAlpha *= 0.7; tailLobe(-tsp * 0.12, 0.8); ctx.restore();
    tailLobe(tsp * 0.1, 0.85);
  } else {
    tailLobe(0, 1);
  }
  if (o.detail && fry < 0.6) {
    // 꼬리 지느러미 줄무늬
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(0.6, L * 0.012);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(tailX + L * 0.02, tailY);
      ctx.lineTo(tailX - tl * 0.92, tailY + swing + i * tsp * 0.2);
      ctx.stroke();
    }
  }

  // ── 몸통 ──
  const N = 9;
  const pts = [[xs(0) + L * 0.015, wave(0)]];
  for (let i = 1; i <= N; i++) { const s = i / N; pts.push([xs(s), wave(s) - half(s)]); }
  for (let i = N; i >= 1; i--) { const s = i / N; pts.push([xs(s), wave(s) + half(s)]); }
  smoothClosed(ctx, pts);
  const bg = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  bg.addColorStop(0, sp.top);
  bg.addColorStop(0.62, sp.belly);
  bg.addColorStop(1, sp.belly);
  ctx.fillStyle = bg;
  ctx.fill();

  // ── 무늬 (몸 모양으로 잘라 그리기) ──
  ctx.save();
  ctx.clip();
  if (sp.bands) {
    sp.bands.forEach(b => {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = H * b.w;
      ctx.lineCap = 'round';
      if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = L * 0.15; }
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const s = b.from + (b.to - b.from) * i / 8;
        const y = wave(s) + b.y * H * 2 * Math.max(0.5, bodyProfile(sp.shape, s));
        if (i === 0) ctx.moveTo(xs(s), y); else ctx.lineTo(xs(s), y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }
  if (sp.bars) {
    ctx.fillStyle = sp.bars;
    [0.18, 0.46, 0.74].forEach((s, i) => {
      ctx.globalAlpha *= i === 1 ? 0.9 : 0.75;
      ctx.fillRect(xs(s) - L * 0.035, -H, L * (i === 1 ? 0.09 : 0.06), H * 2);
      ctx.globalAlpha /= i === 1 ? 0.9 : 0.75;
    });
  }
  if (sp.spots) {
    ctx.fillStyle = sp.spots;
    for (let i = 0; i < 14; i++) {
      const s = 0.15 + (i * 0.618 % 1) * 0.75, yy = ((i * 0.37) % 1 - 0.5) * H * 0.7;
      ctx.beginPath(); ctx.arc(xs(s), wave(s) + yy, Math.max(0.8, L * 0.022), 0, Math.PI * 2); ctx.fill();
    }
  }
  if (sp.waves) {
    ctx.strokeStyle = sp.waves; ctx.lineWidth = Math.max(0.8, L * 0.022); ctx.globalAlpha *= 0.8;
    for (let r = -3; r <= 3; r++) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const s = i / 12, x = xs(s);
        const y = wave(s) + r * H * 0.12 + Math.sin(s * 14 + r) * H * 0.03;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha /= 0.8;
  }
  if (sp.mark) {
    // 블루탱의 검은 팔레트 무늬
    ctx.fillStyle = sp.mark;
    ctx.beginPath();
    ctx.moveTo(xs(0.2), wave(0.2) - H * 0.18);
    ctx.quadraticCurveTo(xs(0.55), wave(0.55) - H * 0.42, xs(0.98), wave(0.98) - H * 0.05);
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) - H * 0.02, xs(0.45), wave(0.45) + H * 0.12);
    ctx.quadraticCurveTo(xs(0.35), wave(0.35) - H * 0.08, xs(0.2), wave(0.2) - H * 0.18);
    ctx.fill();
  }
  // 입체감: 위쪽 반사광 + 아래쪽 그늘
  const shine = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.32)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0)');
  shine.addColorStop(0.8, 'rgba(15,23,42,0)');
  shine.addColorStop(1, 'rgba(15,23,42,0.28)');
  ctx.fillStyle = shine;
  ctx.fillRect(-L, -H, L * 2, H * 2);
  if (o.sad) { ctx.fillStyle = 'rgba(100,116,139,0.4)'; ctx.fillRect(-L, -H, L * 2, H * 2); }
  ctx.restore();

  // 아가미 선
  if (fry < 0.7) {
    ctx.strokeStyle = 'rgba(15,23,42,0.18)'; ctx.lineWidth = Math.max(0.6, L * 0.015);
    ctx.beginPath(); ctx.arc(xs(0.24) + L * 0.06, wave(0.24), half(0.24) * 0.75, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
  }
  // 가슴지느러미 (파닥파닥)
  ctx.fillStyle = finFill;
  ctx.save();
  ctx.translate(xs(0.3), wave(0.3) + half(0.3) * 0.35);
  ctx.rotate(0.5 + Math.sin(ph * 1.4) * 0.35);
  ctx.beginPath(); ctx.ellipse(-L * 0.06, 0, L * 0.09 * finK, H * 0.13 * finK, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 비파 빨판 입
  if (sp.shape === 'pleco') {
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath(); ctx.ellipse(xs(0.02), wave(0) + H * 0.22, L * 0.05, H * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 코리도라스 수염
  if (sp.shape === 'cory') {
    ctx.strokeStyle = 'rgba(68,64,60,0.7)'; ctx.lineWidth = Math.max(0.6, L * 0.012);
    ctx.beginPath(); ctx.moveTo(xs(0.02), wave(0) + H * 0.12); ctx.lineTo(xs(-0.05), wave(0) + H * 0.32); ctx.stroke();
  }

  // ── 눈 ──
  const ex = xs(0.15), ey = wave(0.15) - H * (sp.shape === 'disc' || sp.shape === 'angel' ? 0.12 : 0.07);
  const er = Math.max(1.3, L * 0.052 * (1 + fry * 0.75));
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath(); ctx.arc(ex, ey, er * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(ex + er * 0.15, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ex + er * 0.45, ey - er * 0.4, er * 0.36, 0, Math.PI * 2); ctx.fill();
  if (o.sad) {
    // 눈물 한 방울
    ctx.fillStyle = 'rgba(125,211,252,0.9)';
    ctx.beginPath(); ctx.ellipse(ex - er * 0.2, ey + er * 2.2, er * 0.45, er * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  } else if (o.happy) {
    ctx.fillStyle = 'rgba(244,63,94,0.45)';
    ctx.beginPath(); ctx.arc(ex - er * 1.2, ey + er * 1.8, er * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════ 장식 그리기 ═══════════════════════════════
// x: 가운데, y: 모래 위 바닥선, k: 화면 배율, t: 시간(초), rt: 상자 열림 등 상태
export function drawDecor(ctx, id, x, y, k, t, rt = {}, flow = 0) {
  ctx.save();
  if (id === 'grass') {
    const cols = ['#15803d', '#16a34a', '#22c55e', '#166534'];
    for (let i = 0; i < 8; i++) {
      const bx = x + (i - 3.5) * 5.5 * k, h = (66 + ((i * 37) % 50)) * k, w = 7 * k;
      const ph = t * 1.25 + i * 0.8 + x * 0.013;
      ctx.beginPath();
      const left = [], right = [];
      for (let j = 0; j <= 7; j++) {
        const q = j / 7;
        const cx = bx + (Math.sin(ph + q * 2.2) * 9 * k + flow * 22 * k) * q * q;
        const cy = y - h * q;
        const hw = w * (1 - q * 0.82) / 2;
        left.push([cx - hw, cy]); right.push([cx + hw, cy]);
      }
      ctx.moveTo(left[0][0], left[0][1]);
      left.forEach(p => ctx.lineTo(p[0], p[1]));
      right.reverse().forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
    }
  } else if (id === 'sword') {
    for (let i = 0; i < 7; i++) {
      const a = -1.05 + i * 0.35 + Math.sin(t * 1.1 + i + x * 0.01) * 0.07 + flow * 0.15;
      const len = (52 + (i % 3) * 12) * k, w = 15 * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, '#166534'); g.addColorStop(0.5, '#4ade80'); g.addColorStop(1, '#15803d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w, -len * 0.55, 0, -len);
      ctx.quadraticCurveTo(-w, -len * 0.55, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,252,231,0.5)'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -len * 0.92); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'rock') {
    const g = ctx.createRadialGradient(x - 12 * k, y - 34 * k, 4 * k, x, y - 18 * k, 46 * k);
    g.addColorStop(0, '#d1d5db'); g.addColorStop(0.55, '#6b7280'); g.addColorStop(1, '#374151');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 40 * k, y);
    ctx.bezierCurveTo(x - 42 * k, y - 30 * k, x - 14 * k, y - 48 * k, x + 8 * k, y - 44 * k);
    ctx.bezierCurveTo(x + 34 * k, y - 40 * k, x + 44 * k, y - 18 * k, x + 40 * k, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(101,163,13,0.55)';
    ctx.beginPath(); ctx.ellipse(x - 10 * k, y - 40 * k, 16 * k, 6 * k, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b5563';
    ctx.beginPath(); ctx.ellipse(x + 34 * k, y - 6 * k, 14 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'coral') {
    ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, depth) => {
      const sway = Math.sin(t * 0.9 + depth + bx * 0.02) * 0.04;
      const ex = bx + Math.sin(ang + sway) * len, ey = by - Math.cos(ang + sway) * len;
      ctx.strokeStyle = depth > 1 ? '#f472b6' : '#ec4899';
      ctx.lineWidth = (10 - depth * 2.4) * k;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      if (depth < 3) {
        branch(ex, ey, len * 0.72, ang - 0.45, depth + 1);
        branch(ex, ey, len * 0.68, ang + 0.5, depth + 1);
      } else {
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath(); ctx.arc(ex, ey, 3.2 * k, 0, Math.PI * 2); ctx.fill();
      }
    };
    branch(x - 8 * k, y, 30 * k, -0.25, 0);
    branch(x + 10 * k, y, 24 * k, 0.35, 1);
  } else if (id === 'airstone') {
    const g = ctx.createRadialGradient(x - 4 * k, y - 10 * k, 2, x, y - 6 * k, 18 * k);
    g.addColorStop(0, '#e5e7eb'); g.addColorStop(1, '#6b7280');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - 6 * k, 15 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(55,65,81,0.6)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 9 * k + i * 3.6 * k, y - 8 * k + (i % 2) * 3 * k, 1.1 * k, 0, Math.PI * 2); ctx.fill(); }
  } else if (id === 'chest') {
    const w = 64 * k, h = 34 * k, open = rt.open || 0;
    if (open > 0.2) {
      const glow = ctx.createRadialGradient(x, y - h, 2, x, y - h, 50 * k);
      glow.addColorStop(0, `rgba(253,224,71,${0.7 * open})`); glow.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 60 * k, y - h - 60 * k, 120 * k, 90 * k);
    }
    const wg = ctx.createLinearGradient(0, y - h, 0, y);
    wg.addColorStop(0, '#b45309'); wg.addColorStop(1, '#78350f');
    ctx.fillStyle = wg; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = 'rgba(69,26,3,0.5)'; ctx.lineWidth = 1.5 * k;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * i / 3); ctx.lineTo(x + w / 2, y - h * i / 3); ctx.stroke(); }
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - w / 2 + 6 * k, y - h, 5 * k, h); ctx.fillRect(x + w / 2 - 11 * k, y - h, 5 * k, h);
    if (open > 0.2) {
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 18 * k + i * 7 * k, y - h - 2 * k, 4 * k, Math.PI, 0); ctx.fill(); }
    }
    // 뚜껑 (뒤쪽 경첩 기준으로 열림)
    ctx.save();
    ctx.translate(x - w / 2, y - h);
    ctx.rotate(-open * 0.95);
    ctx.fillStyle = '#92400e';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w / 2, -h * 0.75, w, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(w / 2 - 4 * k, -4 * k, 8 * k, 9 * k);
    ctx.restore();
  } else if (id === 'castle') {
    const w = 104 * k, h = 62 * k, sand = '#e7c9a0', dark = '#c4a170';
    const block = (bx, by, bw, bh) => {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, sand); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = sand;
      for (let i = 0; i < 3; i++) ctx.fillRect(bx + i * bw / 3 + bw / 12, by - 7 * k, bw / 6, 7 * k);
    };
    block(x - w / 2, y - h, w, h);
    block(x - w / 2 - 6 * k, y - h - 30 * k, 28 * k, h + 30 * k);
    block(x + w / 2 - 22 * k, y - h - 30 * k, 28 * k, h + 30 * k);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.moveTo(x - 14 * k, y); ctx.lineTo(x - 14 * k, y - 26 * k); ctx.arc(x, y - 26 * k, 14 * k, Math.PI, 0); ctx.lineTo(x + 14 * k, y); ctx.fill();
    [[x - w / 2 + 8 * k, y - h - 14 * k], [x + w / 2 - 8 * k, y - h - 14 * k]].forEach(([wx, wy]) => {
      ctx.beginPath(); ctx.arc(wx, wy, 4.5 * k, Math.PI, 0); ctx.lineTo(wx + 4.5 * k, wy + 8 * k); ctx.lineTo(wx - 4.5 * k, wy + 8 * k); ctx.fill();
    });
    [x - w / 2 + 8 * k, x + w / 2 - 8 * k].forEach((fx, i) => {
      const fy = y - h - 37 * k;
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 18 * k); ctx.stroke();
      ctx.fillStyle = i ? '#3b82f6' : '#ef4444';
      const wv = Math.sin(t * 3 + i) * 3 * k;
      ctx.beginPath(); ctx.moveTo(fx, fy - 18 * k); ctx.quadraticCurveTo(fx + 8 * k, fy - 15 * k + wv, fx + 14 * k, fy - 13 * k); ctx.lineTo(fx, fy - 9 * k); ctx.fill();
    });
  } else if (id === 'diver') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 11 * k, y - 26 * k, 9 * k, 24 * k); ctx.fillRect(x + 2 * k, y - 26 * k, 9 * k, 24 * k);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 13 * k, y - 5 * k, 12 * k, 5 * k); ctx.fillRect(x + 1 * k, y - 5 * k, 12 * k, 5 * k);
    const bg2 = ctx.createLinearGradient(x - 16 * k, 0, x + 16 * k, 0);
    bg2.addColorStop(0, '#c2410c'); bg2.addColorStop(0.5, '#fb923c'); bg2.addColorStop(1, '#c2410c');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 15 * k, y - 58 * k, 30 * k, 34 * k, 8 * k) : ctx.rect(x - 15 * k, y - 58 * k, 30 * k, 34 * k); ctx.fill();
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
    const arm = Math.sin(t * 1.5) * 0.25;
    ctx.beginPath(); ctx.moveTo(x - 14 * k, y - 52 * k); ctx.lineTo(x - 24 * k, y - 36 * k + arm * 10 * k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14 * k, y - 52 * k); ctx.lineTo(x + 24 * k, y - 66 * k - arm * 10 * k); ctx.stroke();
    const hg = ctx.createRadialGradient(x - 5 * k, y - 76 * k, 2, x, y - 70 * k, 20 * k);
    hg.addColorStop(0, '#fde68a'); hg.addColorStop(1, '#b45309');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(x, y - 70 * k, 17 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.arc(x + 3 * k, y - 70 * k, 9 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(x + 3 * k, y - 70 * k, 9 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(x + 1 * k, y - 71 * k, 1.6 * k, 0, Math.PI * 2); ctx.arc(x + 6 * k, y - 71 * k, 1.6 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════ WebGL 빛 레이어 ═══════════════════════════════
// 검은 바탕에 빛만 그리고 CSS mix-blend-mode: screen 으로 아래 어항 위에 더한다
const LIGHT_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform float uSurface; uniform float uFloor; uniform vec2 uTilt; uniform float uMurk;
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float y = 1.0 - uv.y;
  float aspect = uRes.x / uRes.y;
  float water = smoothstep(uSurface - 0.004, uSurface + 0.004, y);
  float depth = clamp((y - uSurface) / max(0.05, 1.0 - uSurface), 0.0, 1.0);
  vec2 cuv = vec2(uv.x * aspect * 0.9 + uTilt.x * 0.04, y * 0.9) ;
  float cs = caustic(cuv, uTime * 0.45 + 23.0);
  float floorMask = smoothstep(uFloor - 0.05, uFloor + 0.01, y);
  float clear = 1.0 - uMurk * 0.75;
  float light = cs * (0.09 * (1.0 - depth) + floorMask * 0.5) * water * clear;
  float lean = 0.32 + uTilt.x * 0.35;
  float rx = uv.x * aspect + (y - uSurface) * lean;
  float rays = pow(0.5 + 0.5 * sin(rx * 6.0 + uTime * 0.3), 9.0) + 0.6 * pow(0.5 + 0.5 * sin(rx * 11.0 - uTime * 0.22 + 1.7), 14.0);
  rays *= (1.0 - smoothstep(0.0, 0.85, depth)) * water * 0.3 * clear;
  float surf = exp(-abs(y - uSurface) * 90.0) * (0.45 + 0.35 * sin(uv.x * 90.0 + uTime * 3.0));
  vec3 col = vec3(0.72, 0.95, 1.0) * (light + rays) + vec3(1.0) * surf * 0.45;
  gl_FragColor = vec4(col, 1.0);
}`;

function initLightLayer(canvas) {
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = mk(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
  const fs = mk(gl.FRAGMENT_SHADER, LIGHT_FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n) => gl.getUniformLocation(prog, n);
  return { gl, uRes: u('uRes'), uTime: u('uTime'), uSurface: u('uSurface'), uFloor: u('uFloor'), uTilt: u('uTilt'), uMurk: u('uMurk') };
}

// ═══════════════════════════════ 상점 미리보기 ═══════════════════════════════
function FishPreview({ species }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 110 * d; c.height = 74 * d;
    ctx.scale(d, d);
    ctx.translate(58, 37);
    // 작은 물고기도 잘 보이게 크게 (몸이 높은 종류는 칸에 맞게 조금 작게)
    const L = species.hRatio > 0.8 ? 58 : clamp(species.len * 1.5, 56, 74);
    drawFish(ctx, species, L, { phase: 0.6, growth: 1, detail: true });
  }, [species]);
  return <canvas ref={ref} style={{ width: 110, height: 74 }} />;
}

function DecorPreview({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 110 * d; c.height = 92 * d;
    ctx.scale(d, d);
    const [w, h] = DECOR_BOX[id];
    const k = Math.min(1, 96 / w, 82 / h);
    drawDecor(ctx, id, 55, 88, k, 1.2, { open: id === 'chest' ? 0.8 : 0 });
  }, [id]);
  return <canvas ref={ref} style={{ width: 110, height: 92 }} />;
}

// ═══════════════════════════════ 상단 버튼·물 상태 ═══════════════════════════════
// 큰 둥근 그림 버튼 (아래 작은 글자는 부모용)
function IconButton({ icon, label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: '68px', height: '68px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation',
        background: active ? '#fef08a' : color, border: active ? '4px solid #ffffff' : '4px solid rgba(255,255,255,0.35)',
        boxShadow: active ? '0 0 0 4px #facc15, 0 6px 14px rgba(0,0,0,0.25)' : '0 6px 14px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0,
        transform: active ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease'
      }}
    >
      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.62rem', fontWeight: 900, color: active ? '#713f12' : '#ffffff', marginTop: '1px' }}>{label}</span>
    </button>
  );
}

// 어항 물 상태: 깨끗하면 웃는 얼굴, 더러우면 찡그린 얼굴
function WaterMeter({ value }) {
  const face = value >= 60 ? '😊' : value >= 30 ? '😐' : '😣';
  const col = value >= 60 ? '#38bdf8' : value >= 30 ? '#facc15' : '#f43f5e';
  return (
    <div title="물 깨끗함" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '18px', padding: '6px 10px' }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>💧</span>
      <div style={{ width: '64px', height: '12px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: '8px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{face}</span>
    </div>
  );
}

// ═══════════════════════════════ 본체 ═══════════════════════════════
export default function AquariumGame({ creatures, CreatureSVG, audio, speak }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const lightRef = useRef(null);
  const overlayRef = useRef(null);
  const friendEls = useRef({});
  const simRef = useRef(null);
  const modeRef = useRef('play');

  const [hud, setHud] = useState({ points: 0, clean: 100, sad: 0 });
  const [mode, setModeState] = useState('play');
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState('fish');
  const [info, setInfo] = useState(null);          // 터치한 물고기 uid
  const [infoTick, setInfoTick] = useState(0);
  const [friends, setFriends] = useState([]);      // 화면에 그릴 바다 친구 목록
  const [placed, setPlaced] = useState({ decor: [], friends: [] });
  const [toast, setToast] = useState(null);
  const [tiltState, setTiltState] = useState('none');

  const creatureById = (id) => creatures.find(c => c.id === id);
  const setMode = (m) => { modeRef.current = m; setModeState(m); };

  const showToast = (text) => {
    setToast({ text, key: Date.now() });
  };
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── 시뮬레이션 & 렌더 루프 ──
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, overlay = overlayRef.current;
    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');
    const light = initLightLayer(lightRef.current);

    const game = loadGame();
    const offline = catchUpOffline(game);
    const s = {
      game, W: 0, H: 0, dpr: 1, t: 0, k: 1, quality: 1, slow: 0,
      surface: 0, surfaceBase: 0, floor: 0, gravelH: 60,
      rt: {}, fr: {}, decorRt: {},
      food: [], bubbles: [], ripples: [], pops: [], pearls: [], drops: [], algae: [],
      pointer: { down: false, x: 0, y: 0, downAt: 0, drag: null },
      tilt: { x: 0, y: 0 }, tiltRaw: { x: 0, y: 0 }, tiltBase: null,
      shaker: null, waterChange: null, overlayKey: '',
      lastSave: 0, lastHud: 0, lastVoice: {}, lastYum: 0, bubbleT: 0, backdrop: null, gravel: null
    };
    simRef.current = s;

    // 꺼둔 동안 자란 물고기 보상 & 오늘의 첫 방문 선물
    offline.grown.forEach(f => { game.points += stageOf(f.growth) === 'adult' ? REWARDS.adult : REWARDS.juvenile; });
    const welcomeLines = [];
    if (!game.welcomed) {
      game.welcomed = true; game.lastDaily = todayKey();
      welcomeLines.push(VOICE.aquaWelcome());
    } else if (game.lastDaily !== todayKey()) {
      game.lastDaily = todayKey(); game.points += REWARDS.daily;
      welcomeLines.push(VOICE.aquaWelcomeBack());
      setTimeout(() => showToast(`🎁 오늘의 선물! 조개 +${REWARDS.daily}`), 400);
    }
    if (offline.grown.length) setTimeout(() => showToast(`🌱 그동안 ${offline.grown.length}마리가 자랐어요!`), 3200);
    if (welcomeLines.length) setTimeout(() => speak(welcomeLines[0]), 500);

    setFriends(game.friends.slice());
    setPlaced({ decor: game.decor.slice(), friends: game.friends.slice() });

    const addPoints = (n, x, y) => {
      game.points += n;
      if (x != null) s.pops.push({ x, y, text: `+${n} 🐚`, life: 1.4, vy: -32, color: '#fef08a' });
    };
    s.addPoints = addPoints;
    const say = (key, line, gap = 0) => {
      if (gap && s.t - (s.lastVoice[key] ?? -1e9) < gap) return;
      s.lastVoice[key] = s.t;
      speak(line);
    };
    s.say = say;

    const groundY = (x) => s.floor + Math.sin(x * 0.021) * 3 + Math.sin(x * 0.007 + 1) * 4;
    s.groundY = groundY;

    // ── 화면 크기 & 고정 배경(물 그라데이션·자갈) 미리 그리기 ──
    const makeLayer = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * s.dpr); c.height = Math.round(h * s.dpr);
      const x = c.getContext('2d'); x.scale(s.dpr, s.dpr);
      return [c, x];
    };
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      s.W = Math.max(240, r.width); s.H = Math.max(240, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, s.quality < 1 ? 1 : 2);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 620, 0.8, 1.5);
      s.surfaceBase = Math.round(s.H * 0.075);
      if (!s.waterChange) s.surface = s.surfaceBase;
      s.gravelH = clamp(s.H * 0.12, 52, 92);
      s.floor = s.H - s.gravelH + 10;
      [canvas, overlay].forEach(c => {
        c.width = Math.round(s.W * s.dpr); c.height = Math.round(s.H * s.dpr);
        c.style.width = `${s.W}px`; c.style.height = `${s.H}px`;
      });
      if (light) {
        const ls = s.quality < 1 ? 0.35 : 0.5;
        lightRef.current.width = Math.max(64, Math.round(s.W * s.dpr * ls));
        lightRef.current.height = Math.max(64, Math.round(s.H * s.dpr * ls));
        lightRef.current.style.width = `${s.W}px`; lightRef.current.style.height = `${s.H}px`;
      }

      // 물 + 뒷벽 실루엣
      const [bc, bx] = makeLayer(s.W, s.H);
      const g = bx.createLinearGradient(0, s.surfaceBase, 0, s.H);
      g.addColorStop(0, '#67d4f5'); g.addColorStop(0.28, '#16a3c9'); g.addColorStop(0.68, '#0e6f8f'); g.addColorStop(1, '#0c4a63');
      bx.fillStyle = g; bx.fillRect(0, 0, s.W, s.H);
      // 멀리 보이는 수초 실루엣 (위로 갈수록 물빛에 녹아든다)
      const far = bx.createLinearGradient(0, s.floor - s.H * 0.6, 0, s.floor);
      far.addColorStop(0, 'rgba(20,110,100,0)'); far.addColorStop(1, 'rgba(20,110,100,0.32)');
      bx.fillStyle = far;
      for (let i = 0; i < 9; i++) {
        const px = (i + 0.3) * s.W / 9, ph = s.H * (0.28 + (i * 0.37 % 0.3));
        bx.beginPath(); bx.moveTo(px - 18, s.floor);
        bx.quadraticCurveTo(px - 30 + (i % 3) * 18, s.floor - ph * 0.6, px + (i % 2 ? 12 : -10), s.floor - ph);
        bx.quadraticCurveTo(px + 26, s.floor - ph * 0.5, px + 22, s.floor); bx.fill();
      }
      bx.fillStyle = 'rgba(14,90,100,0.4)';
      bx.beginPath(); bx.moveTo(0, s.floor);
      for (let x = 0; x <= s.W; x += 40) bx.lineTo(x, s.floor - 26 - Math.sin(x * 0.013) * 16 - Math.sin(x * 0.041) * 6);
      bx.lineTo(s.W, s.floor); bx.closePath(); bx.fill();
      s.backdrop = bc;

      // 자갈 바닥
      const [gc, gx] = makeLayer(s.W, s.H);
      const sg = gx.createLinearGradient(0, s.floor - 8, 0, s.H);
      sg.addColorStop(0, '#d6c08f'); sg.addColorStop(1, '#8a6a3a');
      gx.fillStyle = sg;
      gx.beginPath(); gx.moveTo(0, s.H);
      for (let x = 0; x <= s.W; x += 8) gx.lineTo(x, groundY(x));
      gx.lineTo(s.W, s.H); gx.closePath(); gx.fill();
      const pebbleCols = [['#f5f5f4', '#a8a29e'], ['#d6d3d1', '#78716c'], ['#fde68a', '#b45309'], ['#fecaca', '#b91c1c'], ['#bfdbfe', '#1d4ed8'], ['#e7e5e4', '#57534e']];
      const count = Math.round(s.W * s.gravelH / 70);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * s.W, y = groundY(x) + 4 + Math.pow(Math.random(), 0.8) * (s.H - groundY(x) - 4);
        const r = (2 + Math.random() * 4.5) * s.k * (0.6 + (y - s.floor) / s.gravelH * 0.6);
        const [c1, c2] = pebbleCols[i % pebbleCols.length];
        const pg = gx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.2);
        pg.addColorStop(0, c1); pg.addColorStop(1, c2);
        gx.fillStyle = pg;
        gx.beginPath(); gx.ellipse(x, y, r * 1.25, r, (i % 7) * 0.4, 0, Math.PI * 2); gx.fill();
      }
      const edge = gx.createLinearGradient(0, s.floor - 6, 0, s.floor + 18);
      edge.addColorStop(0, 'rgba(255,255,255,0.18)'); edge.addColorStop(1, 'rgba(255,255,255,0)');
      gx.fillStyle = edge; gx.fillRect(0, s.floor - 6, s.W, 24);
      s.gravel = gc;
      s.overlayKey = '';
      if (s.algae.length !== game.algae) regenAlgae();
    };

    // 유리 이끼 위치 (저장된 개수만큼 무작위 배치)
    const regenAlgae = () => {
      s.algae = Array.from({ length: game.algae }, () => makeAlgaeSpot());
      s.overlayKey = '';
    };
    const makeAlgaeSpot = () => ({
      x: Math.random() * s.W, y: s.surfaceBase + 20 + Math.random() * (s.floor - s.surfaceBase - 30),
      r: (10 + Math.random() * 22) * s.k, a: 0.25 + Math.random() * 0.3, blobs: Math.floor(3 + Math.random() * 4), seed: Math.random() * 10
    });

    // ── 물고기 런타임 상태 ──
    const ensureFishRt = (f, entering) => {
      if (s.rt[f.uid]) return s.rt[f.uid];
      const r = {
        x: 40 + Math.random() * Math.max(10, s.W - 80),
        y: entering ? s.surface + 10 : s.surface + 40 + Math.random() * Math.max(10, s.floor - s.surface - 100),
        vx: (Math.random() - 0.5) * 60, vy: entering ? 40 : 0,
        z: 0.35 + Math.random() * 0.65, phase: Math.random() * 6, panic: 0, poopDue: 0, pearlT: 60 + Math.random() * 60,
        boing: 0, happyT: 0
      };
      s.rt[f.uid] = r;
      return r;
    };
    s.ensureFishRt = ensureFishRt;

    const ensureFriendRt = (fr, entering) => {
      if (s.fr[fr.uid]) return s.fr[fr.uid];
      const c = creatureById(fr.id);
      const size = c ? c.size * 0.9 * s.k : 90;
      const motion = FRIEND_MOTION[fr.id] || 'swim';
      const fromLeft = Math.random() < 0.5;
      const r = size * 0.5;
      const q = {
        id: fr.id, size, motion,
        x: entering ? (fromLeft ? r : s.W - r) : r + Math.random() * Math.max(1, s.W - 2 * r),
        y: motion === 'crawl' ? s.floor - r * 0.4 : s.surface + r + Math.random() * Math.max(1, s.floor - s.surface - 2 * r - 20),
        vx: fromLeft ? 30 : -30, vy: 0, heading: FRIEND_FLIP.has(fr.id) && !fromLeft ? -1 : 1, wander: fromLeft ? 0 : Math.PI,
        pulseT: Math.random() * 2, squash: 0, boing: 0, startle: 0, alpha: 0, phase: Math.random() * 6
      };
      s.fr[fr.uid] = q;
      return q;
    };
    s.ensureFriendRt = ensureFriendRt;

    resize();
    game.fish.forEach(f => ensureFishRt(f, false));
    game.friends.forEach(fr => ensureFriendRt(fr, false));
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── 먹이 ──
    const spawnFood = (x, n) => {
      for (let i = 0; i < n; i++) {
        if (s.food.length > 90) break;
        s.food.push({
          x: clamp(x + (Math.random() - 0.5) * 50, 10, s.W - 10), y: s.surface + 2 + Math.random() * 4,
          vx: (Math.random() - 0.5) * 10, vy: 0, state: 'float', t: 0.3 + Math.random() * 0.8,
          rot: Math.random() * 6, color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)], life: 25
        });
      }
    };
    // 밥 한 번 = 한 그릇: 물고기 수에 맞춘 양을 한꺼번에 떨어뜨린다. 남아 있으면 더 주지 않는다.
    s.feed = () => {
      if (s.food.length || s.shaker) { showToast('🍤 아직 밥이 남아 있어요!'); return; }
      const x = s.W * (0.25 + Math.random() * 0.5);
      s.shaker = { x, t: 0, dur: 0.6, dropped: false };
      audio.playYum();
      say('feed', VOICE.aquaFeed(), 6);
    };

    // ── 입력 ──
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const fishLen = (f) => {
      const sp = FISH_BY_ID[f.sp];
      return sp.len * sizeScale(f.growth) * s.k;
    };
    const hitFish = (x, y) => {
      let best = null, bd = Infinity;
      game.fish.forEach(f => {
        const r = s.rt[f.uid]; if (!r) return;
        const d = Math.hypot(r.x - x, r.y - y), rad = Math.max(26, fishLen(f) * 0.75);
        if (d < rad && d < bd) { best = f; bd = d; }
      });
      return best;
    };
    const hitFriend = (x, y) => {
      let best = null, bd = Infinity;
      game.friends.forEach(fr => {
        const q = s.fr[fr.uid]; if (!q) return;
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < q.size * 0.6 + 14 && d < bd) { best = fr; bd = d; }
      });
      return best;
    };
    const hitDecor = (x, y) => {
      for (let i = game.decor.length - 1; i >= 0; i--) {
        const d = game.decor[i], [w, h] = DECOR_BOX[d.id];
        const dx = d.x * s.W, by = groundY(dx);
        if (Math.abs(x - dx) < w * s.k / 2 + 10 && y < by + 14 && y > by - h * s.k - 10) return d;
      }
      return null;
    };
    const cleanAt = (x, y) => {
      let n = 0;
      s.algae = s.algae.filter(a => {
        if (Math.hypot(a.x - x, a.y - y) < a.r + 36 * s.k) { n++; s.pops.push({ x: a.x, y: a.y, text: '✨', life: 0.8, vy: -20 }); return false; }
        return true;
      });
      if (n) {
        game.algae = s.algae.length;
        game.dirt = Math.max(0, game.dirt - n * 0.6);
        addPoints(REWARDS.algae * n, x, y - 20);
        s.overlayKey = '';
        audio.playFreq(1400 + Math.random() * 500, 'sine', 0.05, 0.2);
      }
      const before = game.poop.length;
      game.poop = game.poop.filter(p => Math.hypot(p.x - x, (groundY(p.x) + p.dy) - y) > 40 * s.k);
      const removed = before - game.poop.length;
      s.food = s.food.filter(f => !(f.state === 'ground' && Math.hypot(f.x - x, f.y - y) < 40 * s.k));
      if (removed) {
        addPoints(REWARDS.poop * removed, x, y - 26);
        audio.playPopSound();
        for (let i = 0; i < 4; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 20, y, r: 2 + Math.random() * 3, wob: Math.random() * 6, vy: 70 });
      }
      if ((n || removed) && game.algae === 0 && game.poop.length === 0) say('clean', VOICE.aquaClean(), 20);
    };

    const onDown = (e) => {
      const { x, y } = local(e);
      s.pointer = { down: true, x, y, downAt: s.t, drag: null };
      const m = modeRef.current;
      if (m === 'clean') { cleanAt(x, y); return; }
      if (m === 'decorate') {
        const fr = hitFriend(x, y);
        if (fr) { s.pointer.drag = { kind: 'friend', uid: fr.uid }; return; }
        const d = hitDecor(x, y);
        if (d) { s.pointer.drag = { kind: 'decor', uid: d.uid, dx: d.x * s.W - x }; audio.playSnap(); }
        return;
      }
      // 놀이 모드
      s.ripples.push({ x, y, r: 6, life: 1 });
      const pearl = s.pearls.find(p => Math.hypot(p.x - x, p.y - y) < 34 * s.k);
      if (pearl) {
        s.pearls = s.pearls.filter(p => p !== pearl);
        addPoints(REWARDS.pearl, pearl.x, pearl.y - 20);
        audio.playFanfare();
        say('pearl', VOICE.aquaPearl(), 4);
        return;
      }
      const f = hitFish(x, y);
      if (f) {
        const r = s.rt[f.uid];
        r.boing = 1; r.happyT = 2;
        f.happy = Math.min(100, f.happy + 6);
        audio.playBubble();
        setInfo(f.uid);
        const sp = FISH_BY_ID[f.sp];
        if (isSad(f, game.dirt)) say('info', VOICE.aquaSadFish(sp), 1.5);
        else say('info', VOICE.aquaFishInfo(sp, stageOf(f.growth)), 1.5);
        return;
      }
      const fr = hitFriend(x, y);
      if (fr) {
        const q = s.fr[fr.uid];
        q.boing = 1;
        audio.playBubble();
        const c = creatureById(fr.id);
        if (c) say('friend', VOICE.itemSound(c), 1);
        return;
      }
      for (let i = 0; i < 6; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 30, y, r: 2 + Math.random() * 6, wob: Math.random() * 6, vy: 60 + Math.random() * 50 });
      audio.playBubble();
      game.fish.forEach(fi => {
        const r = s.rt[fi.uid]; if (!r) return;
        const dx = r.x - x, dy = r.y - y, d = Math.hypot(dx, dy) || 1;
        if (d < 200) { const kk = 380 * (1 - d / 200); r.vx += dx / d * kk; r.vy += dy / d * kk; r.panic = 1; }
      });
      Object.values(s.fr).forEach(q => { if (Math.hypot(q.x - x, q.y - y) < 160) q.startle = 1; });
    };
    const onMove = (e) => {
      if (!s.pointer.down) return;
      const { x, y } = local(e);
      s.pointer.x = x; s.pointer.y = y;
      const m = modeRef.current;
      if (m === 'clean') cleanAt(x, y);
      else if (m === 'decorate' && s.pointer.drag) {
        const dr = s.pointer.drag;
        if (dr.kind === 'decor') {
          const d = game.decor.find(it => it.uid === dr.uid);
          if (d) d.x = clamp((x + dr.dx) / s.W, 0.04, 0.96);
        } else {
          const q = s.fr[dr.uid];
          if (q) { q.x = clamp(x, q.size / 2, s.W - q.size / 2); q.y = q.motion === 'crawl' ? q.y : clamp(y, s.surface + q.size / 2, s.floor - q.size * 0.3); q.vx = 0; q.vy = 0; }
        }
      }
    };
    const onUp = () => {
      if (s.pointer.drag) { saveGame(game); setPlaced({ decor: game.decor.slice(), friends: game.friends.slice() }); }
      s.pointer.down = false; s.pointer.drag = null;
    };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // ── 기울기 센서 ──
    s.onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const ang = (window.screen.orientation && window.screen.orientation.angle) ?? window.orientation ?? 0;
      let x = e.gamma, y = e.beta;
      if (ang === 90) { x = e.beta; y = -e.gamma; } else if (ang === -90 || ang === 270) { x = -e.beta; y = e.gamma; } else if (ang === 180) { x = -e.gamma; y = -e.beta; }
      if (!s.tiltBase) s.tiltBase = { x, y };
      s.tiltBase.x += (x - s.tiltBase.x) * 0.005; s.tiltBase.y += (y - s.tiltBase.y) * 0.005;
      s.tiltRaw.x = clamp((x - s.tiltBase.x) / 28, -1, 1); s.tiltRaw.y = clamp((y - s.tiltBase.y) / 28, -1, 1);
    };
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (touchDevice && typeof window.DeviceOrientationEvent !== 'undefined') {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') setTiltState('ask');
      else { window.addEventListener('deviceorientation', s.onOrient); setTiltState('on'); }
    }

    // ── 돌봄 규칙 (배고픔·물 더러움·기분·성장) ──
    const tickCare = (dt) => {
      const groundFood = s.food.filter(f => f.state === 'ground').length;
      game.dirt = Math.min(100, game.dirt + (RATES.dirtPerSec + game.poop.length * 0.004 + groundFood * 0.01) * dt);
      // 물이 더러우면 유리에 이끼가 낀다
      if (game.dirt > 35 && game.algae < 60) {
        s.algaeT = (s.algaeT || 0) + dt;
        if (s.algaeT > 30 - game.dirt / 5) { s.algaeT = 0; game.algae++; s.algae.push(makeAlgaeSpot()); s.overlayKey = ''; }
      }
      game.fish.forEach(f => {
        const sp = FISH_BY_ID[f.sp]; if (!sp) return;
        f.full = Math.max(0, f.full - RATES.fullDropPerSec * dt);
        const comfy = f.full > 60 && game.dirt < 40;
        f.happy = clamp(f.happy + (comfy ? 0.6 : -RATES.happyDropPerSec * (isSad(f, game.dirt) ? 2 : 1)) * dt, 0, 100);
        const before = stageOf(f.growth);
        f.growth = Math.min(1, f.growth + RATES.growPerSec * sp.growMul * growFactor(f, game.dirt) * dt);
        const after = stageOf(f.growth);
        if (after !== before) {
          const r = s.rt[f.uid];
          addPoints(after === 'adult' ? REWARDS.adult : REWARDS.juvenile, r ? r.x : s.W / 2, r ? r.y - 30 : s.H / 2);
          audio.playFanfare();
          say('grow', VOICE.aquaGrow(sp, after));
          if (r) for (let i = 0; i < 16; i++) s.pops.push({ x: r.x + (Math.random() - 0.5) * 60, y: r.y + (Math.random() - 0.5) * 40, text: i % 2 ? '✨' : '⭐', life: 1.2, vy: -40 });
        }
        // 다 큰 물고기가 기분 좋으면 가끔 반짝 조개를 떨어뜨린다
        const r = s.rt[f.uid];
        if (r && after === 'adult' && !isSad(f, game.dirt) && s.pearls.length < 4) {
          r.pearlT -= dt;
          if (r.pearlT <= 0) { r.pearlT = 70 + Math.random() * 60; s.drops.push({ kind: 'pearl', x: r.x, y: r.y, vy: 30 }); }
        }
      });
      // 돌봄 알림 음성 (너무 자주 말하지 않게)
      const avgFull = game.fish.length ? game.fish.reduce((a, f) => a + f.full, 0) / game.fish.length : 100;
      if (avgFull < 30) say('hungry', VOICE.aquaHungry(), 90);
      else if (game.dirt > 65) say('dirty', VOICE.aquaDirty(), 90);
    };

    // ── 물고기 움직임 (Boids + 먹이 쫓기 + 손가락 따라오기) ──
    const updateFish = (dt) => {
      const list = game.fish;
      const p = s.pointer;
      const following = modeRef.current === 'play' && p.down && !p.drag && s.t - p.downAt > 0.3;
      const top = s.surface + 14, bottom = s.floor - 8;
      const friendsRt = Object.values(s.fr);
      list.forEach(f => {
        const r = s.rt[f.uid]; const sp = FISH_BY_ID[f.sp];
        if (!r || !sp) return;
        const L = fishLen(f);
        const sad = isSad(f, game.dirt);
        let fx = 0, fy = 0, ax = 0, ay = 0, cx = 0, cy = 0, cnt = 0;
        list.forEach(o => {
          if (o === f) return;
          const q = s.rt[o.uid]; if (!q) return;
          const dx = q.x - r.x, dy = q.y - r.y, d2 = dx * dx + dy * dy;
          const sep = (L + fishLen(o)) * 0.45;
          if (d2 < sep * sep && d2 > 0.01) { const d = Math.sqrt(d2); fx -= dx / d * (sep - d) * 6; fy -= dy / d * (sep - d) * 6; }
          if (sp.school && o.sp === f.sp && d2 < 130 * 130) { ax += q.vx; ay += q.vy; cx += q.x; cy += q.y; cnt++; }
        });
        if (cnt) { fx += (ax / cnt - r.vx) * 1.2 + (cx / cnt - r.x) * 0.7; fy += (ay / cnt - r.vy) * 1.2 + (cy / cnt - r.y) * 0.7; }
        // 혼자 다니는 물고기는 천천히 배회
        r.wander = (r.wander ?? Math.random() * 6) + (Math.random() - 0.5) * dt * 2;
        fx += Math.cos(r.wander) * 40; fy += Math.sin(r.wander) * 18;
        // 머무는 높이
        const span = bottom - top;
        const pref = sad ? bottom - span * 0.15 : sp.zone === 'bottom' ? bottom - 12 : sp.zone === 'top' ? top + span * 0.18 : null;
        if (pref != null) fy += (pref - r.y) * 0.9;
        // 벽
        const m = 40;
        if (r.x < m) fx += (m - r.x) * 6; if (r.x > s.W - m) fx -= (r.x - (s.W - m)) * 6;
        if (r.y < top + 20) fy += (top + 20 - r.y) * 7; if (r.y > bottom - 10) fy -= (r.y - (bottom - 10)) * 7;
        // 바다 친구 피하기
        friendsRt.forEach(q => {
          const dx = r.x - q.x, dy = r.y - q.y, d = Math.hypot(dx, dy) || 1, rr = q.size * 0.55;
          if (d < rr) { fx += dx / d * (rr - d) * 6; fy += dy / d * (rr - d) * 6; }
        });
        // 먹이 쫓기
        let target = null, td = 420 * 420;
        s.food.forEach(fd => {
          if (fd.state === 'float' && fd.t > 0.6) return;
          const dx = fd.x - r.x, dy = fd.y - r.y, d2 = dx * dx + dy * dy;
          if (d2 < td) { td = d2; target = fd; }
        });
        let maxSp = 70 * sp.speed * (1 + r.panic * 1.6) * (sad ? 0.5 : 1) * (0.7 + 0.3 * sizeScale(f.growth)) * s.k;
        if (target && f.full < 98) {
          const dx = target.x - r.x, dy = target.y - r.y, d = Math.sqrt(td) || 1;
          fx += dx / d * 520; fy += dy / d * 520;
          maxSp *= 1.7;
          if (d < Math.max(8, L * 0.45)) {
            target.eaten = true;
            const wasHungry = f.full < 70;
            f.full = Math.min(100, f.full + 9); f.happy = Math.min(100, f.happy + 2);
            r.poopDue += 1; r.happyT = 1.2;
            if (wasHungry) addPoints(REWARDS.eat, r.x, r.y - 16);
            s.pops.push({ x: r.x + 8, y: r.y - 10, text: '💗', life: 0.9, vy: -30 });
            if (s.t - s.lastYum > 0.12) { s.lastYum = s.t; audio.playFreq(820 + Math.random() * 420, 'sine', 0.07, 0.22); }
            if (r.poopDue >= 4) { r.poopDue = 0; s.drops.push({ kind: 'poop', x: r.x - L * 0.5, y: r.y, vy: 18, delay: 2 + Math.random() * 3 }); }
          }
        } else if (sp.algaeEater && s.algae.length) {
          // 비파: 가장 가까운 유리 이끼로 가서 냠냠 먹는다
          let ag = null, ad = Infinity;
          s.algae.forEach(a => { const d = Math.hypot(a.x - r.x, a.y - r.y); if (d < ad) { ad = d; ag = a; } });
          if (ag) {
            if (pref != null) fy -= (pref - r.y) * 0.9;   // 바닥으로 끌려가지 않게
            fx += (ag.x - r.x) / (ad || 1) * 260; fy += (ag.y - r.y) / (ad || 1) * 260;
            if (ad < ag.r + 12) {
              ag.eat = (ag.eat || 0) + dt;
              r.vx *= 0.9; r.vy *= 0.9;
              if (ag.eat > 2.5) {
                s.algae = s.algae.filter(a => a !== ag);
                game.algae = s.algae.length;
                game.dirt = Math.max(0, game.dirt - 0.6);
                f.full = Math.min(100, f.full + 6); f.happy = Math.min(100, f.happy + 3);
                s.pops.push({ x: ag.x, y: ag.y, text: '😋', life: 1, vy: -24 });
                s.overlayKey = '';
              }
            }
          }
        } else if (following) {
          const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1;
          if (d < 460) { const pull = d > 45 ? 380 : -140; fx += dx / d * pull - dy / d * 60; fy += dy / d * pull + dx / d * 60; }
        }
        fx += s.tilt.x * 140; fy += s.tilt.y * 80;

        r.vx += fx * dt; r.vy += fy * dt;
        const spd = Math.hypot(r.vx, r.vy) || 1, minSp = 14 * s.k;
        if (spd > maxSp) { r.vx *= maxSp / spd; r.vy *= maxSp / spd; } else if (spd < minSp) { r.vx *= minSp / spd; r.vy *= minSp / spd; }
        r.panic = Math.max(0, r.panic - dt);
        r.boing = Math.max(0, r.boing - dt * 1.8);
        r.happyT = Math.max(0, r.happyT - dt);
        r.x = clamp(r.x + r.vx * dt, 6, s.W - 6); r.y = clamp(r.y + r.vy * dt, top, bottom);
        r.phase += dt * (5 + spd * 0.12 / s.k) * (sad ? 0.6 : 1);
        // 진행 방향 (좌우가 자주 바뀌지 않게)
        if (r.vx > 5) r.dir = 1; else if (r.vx < -5) r.dir = -1; else r.dir = r.dir || 1;
      });
      s.food = s.food.filter(fd => !fd.eaten);
    };

    // ── 바다 친구 움직임 ──
    const updateFriends = (dt) => {
      const list = Object.entries(s.fr);
      list.forEach(([uid, c]) => {
        const r = c.size * 0.5;
        c.alpha = Math.min(1, c.alpha + dt * 1.5);
        c.boing = Math.max(0, c.boing - dt * 1.6);
        c.startle = Math.max(0, c.startle - dt * 0.9);
        if (s.pointer.drag && s.pointer.drag.uid === uid) return;
        const spMul = FRIEND_SPEED[c.id] || 1;
        if (c.motion === 'crawl') {
          c.wander += (Math.random() - 0.5) * dt * 1.6;
          const sp = 22 * spMul * (1 + c.startle * 2);
          c.vx += (Math.cos(c.wander) * sp - c.vx) * Math.min(1, dt * 1.5);
          c.vy = (groundY(c.x) - r * 0.45 - c.y) * 4;
        } else if (c.motion === 'pulse') {
          c.pulseT -= dt;
          if (c.pulseT <= 0) { c.pulseT = 2 + Math.random() * 1.6; c.vy = -55; c.vx += (Math.random() - 0.5) * 36; c.squash = 1; }
          c.vy = Math.min(14, c.vy + 26 * dt); c.vx *= 1 - dt * 0.6;
          c.squash = Math.max(0, c.squash - dt * 2.5);
        } else {
          c.wander += (Math.random() - 0.5) * dt * 1.8;
          const sp = 32 * spMul * (1 + c.startle * 2.2);
          c.vx += (Math.cos(c.wander) * sp - c.vx) * Math.min(1, dt * 1.2);
          c.vy += (Math.sin(c.wander) * sp * 0.45 - c.vy) * Math.min(1, dt * 1.2);
        }
        if (c.motion !== 'crawl') { c.vx += s.tilt.x * 45 * dt; c.vy += s.tilt.y * 30 * dt; }
        c.x += c.vx * dt; c.y += c.vy * dt;
        const top = s.surface + r * 0.8 + 4, bottom = s.floor - r * 0.4;
        if (c.x < r) { c.x = r; c.vx = Math.abs(c.vx); if (Math.cos(c.wander) < 0) c.wander = Math.PI - c.wander; }
        if (c.x > s.W - r) { c.x = s.W - r; c.vx = -Math.abs(c.vx); if (Math.cos(c.wander) > 0) c.wander = Math.PI - c.wander; }
        if (c.motion !== 'crawl') {
          if (c.y < top) { c.y = top; c.vy = Math.abs(c.vy) * 0.5; if (Math.sin(c.wander) < 0) c.wander = -c.wander; }
          if (c.y > bottom) { c.y = bottom; c.vy = -Math.abs(c.vy) * 0.5; if (Math.sin(c.wander) > 0) c.wander = -c.wander; }
        }
        if (FRIEND_FLIP.has(c.id)) { if (c.vx > 6) c.heading = 1; else if (c.vx < -6) c.heading = -1; }
        // 바닥 친구는 떨어진 먹이를 주워 먹는다
        if (c.motion === 'crawl') {
          s.food.forEach(fd => { if (fd.state === 'ground' && Math.abs(fd.x - c.x) < r * 0.8) fd.eaten = true; });
        }
      });
      const arr = list.map(e => e[1]);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (a.size + b.size) * 0.55;
        if (d < min) {
          const kk = (min - d) / d * Math.min(1, dt * 3) * 0.5;
          a.x -= dx * kk; b.x += dx * kk;
          if (a.motion !== 'crawl') a.y -= dy * kk;
          if (b.motion !== 'crawl') b.y += dy * kk;
        }
      }
    };

    // ── 먹이·거품·떨어지는 것들 ──
    const updateParticles = (dt) => {
      if (s.shaker) {
        const sh = s.shaker;
        sh.t += dt;
        if (!sh.dropped && sh.t > 0.2) {
          sh.dropped = true;
          spawnFood(sh.x, clamp(Math.round(game.fish.length * 1.5), 4, 16));
          for (let i = 0; i < 3; i++) audio.playFreq(2200 + Math.random() * 900, 'triangle', 0.03, 0.07);
        }
        if (sh.t > sh.dur) s.shaker = null;
      }
      s.food.forEach(fd => {
        if (fd.state === 'float') {
          fd.t -= dt; fd.y = s.surface + 3 + Math.sin(s.t * 3 + fd.rot) * 1.5; fd.x += (fd.vx + s.tilt.x * 20) * dt;
          if (fd.t <= 0) { fd.state = 'sink'; fd.vy = 16 + Math.random() * 12; }
        } else if (fd.state === 'sink') {
          fd.y += fd.vy * dt; fd.x += (Math.sin(s.t * 2 + fd.rot) * 10 + s.tilt.x * 30) * dt; fd.rot += dt;
          const gy = groundY(fd.x) + 4;
          if (fd.y >= gy) { fd.y = gy; fd.state = 'ground'; }
        } else {
          fd.life -= dt;
          if (fd.life <= 0) { fd.eaten = true; game.dirt = Math.min(100, game.dirt + 1.5); }
        }
        fd.x = clamp(fd.x, 6, s.W - 6);
      });
      s.food = s.food.filter(fd => !fd.eaten);

      s.drops.forEach(d => {
        if (d.delay > 0) { d.delay -= dt; return; }
        d.y += d.vy * dt; d.vy = Math.min(60, d.vy + 20 * dt);
        if (d.y >= groundY(d.x) + 2) {
          d.done = true;
          if (d.kind === 'poop' && game.poop.length < 30) game.poop.push({ x: d.x, dy: 2 + Math.random() * 8 });
          if (d.kind === 'pearl') s.pearls.push({ x: d.x, y: groundY(d.x) - 6, life: 40 });
        }
      });
      s.drops = s.drops.filter(d => !d.done);
      s.pearls.forEach(p => { p.life -= dt; });
      s.pearls = s.pearls.filter(p => p.life > 0);

      // 기포돌·잠수부·보물상자 거품
      game.decor.forEach(d => {
        const rt = s.decorRt[d.uid] || (s.decorRt[d.uid] = { acc: Math.random() * 3, open: 0, cycle: Math.random() * 9 });
        const x = d.x * s.W, y = groundY(x);
        if (d.id === 'airstone') {
          rt.acc += dt;
          while (rt.acc > 0.07) { rt.acc -= 0.07; s.bubbles.push({ x: x + (Math.random() - 0.5) * 8, y: y - 10 * s.k, r: 1.5 + Math.random() * 2.5, wob: Math.random() * 6, vy: 70 + Math.random() * 30, grow: 1 }); }
        } else if (d.id === 'diver') {
          rt.acc += dt;
          if (rt.acc > 2.2) { rt.acc = 0; for (let i = 0; i < 4; i++) s.bubbles.push({ x: x + 3 * s.k, y: y - 90 * s.k - i * 8, r: 2 + Math.random() * 3, wob: Math.random() * 6, vy: 55 }); }
        } else if (d.id === 'chest') {
          rt.cycle += dt;
          const ph = rt.cycle % 9;
          const want = ph > 6 ? 1 : 0;
          rt.open += (want - rt.open) * Math.min(1, dt * 3);
          if (ph > 6 && ph - dt <= 6) for (let i = 0; i < 10; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 40 * s.k, y: y - 40 * s.k, r: 2 + Math.random() * 5, wob: Math.random() * 6, vy: 60 + Math.random() * 40 });
        }
      });
      // 바닥 틈 사이로 가끔 올라오는 거품
      s.bubbleT -= dt;
      if (s.bubbleT <= 0) { s.bubbleT = 0.5 + Math.random() * 0.9; const x = Math.random() * s.W; s.bubbles.push({ x, y: groundY(x), r: 1.5 + Math.random() * 3, wob: Math.random() * 6, vy: 40 + Math.random() * 30 }); }
      s.bubbles.forEach(b => {
        b.wob += dt * 3; b.y -= (b.vy + b.r * 4) * dt; b.x += (Math.sin(b.wob) * 16 - s.tilt.x * 40) * dt;
        if (b.grow) b.r = Math.min(6, b.r + dt * 0.8);
        if (b.y <= s.surface + 2) { b.pop = true; s.ripples.push({ x: b.x, y: s.surface + 1, r: 2, life: 0.5, flat: true }); }
      });
      s.bubbles = s.bubbles.filter(b => !b.pop).slice(-220);
      s.ripples.forEach(r => { r.r += (r.flat ? 40 : 170) * dt; r.life -= dt * 1.4; });
      s.ripples = s.ripples.filter(r => r.life > 0).slice(-60);
      s.pops.forEach(p => { p.y += p.vy * dt; p.life -= dt; });
      s.pops = s.pops.filter(p => p.life > 0).slice(-60);

      // 물갈이 애니메이션: 물 높이가 내려갔다가 다시 차오른다
      if (s.waterChange) {
        const w = s.waterChange;
        w.t += dt;
        const low = s.surfaceBase + (s.floor - s.surfaceBase) * 0.42;
        if (w.t < 1.6) s.surface = s.surfaceBase + (low - s.surfaceBase) * Math.sin(Math.min(1, w.t / 1.6) * Math.PI / 2);
        else if (w.t < 3.4) {
          const q = (w.t - 1.6) / 1.8;
          s.surface = low - (low - s.surfaceBase) * (1 - Math.pow(1 - q, 2));
          if (Math.random() < 0.6) s.bubbles.push({ x: s.W * 0.15 + Math.random() * 30, y: s.surface + 6, r: 2 + Math.random() * 4, wob: Math.random() * 6, vy: -80 });
          if (!w.cleaned && q > 0.2) {
            w.cleaned = true;
            const was = game.dirt;
            game.dirt = 0; s.overlayKey = '';
            if (was >= 25) addPoints(REWARDS.waterChange, s.W / 2, s.H / 2);
            game.fish.forEach(f => { f.happy = Math.min(100, f.happy + 20); });
          }
        } else {
          s.surface = s.surfaceBase; s.waterChange = null;
          audio.playFanfare();
          say('water', VOICE.aquaWaterChange());
        }
      }
    };
    s.startWaterChange = () => {
      if (s.waterChange) return;
      if (game.dirt < 8) { showToast('💧 물이 아직 깨끗해요!'); return; }
      s.waterChange = { t: 0, cleaned: false };
      audio.playBubble();
    };

    // ── 그리기 ──
    const draw = () => {
      const { W, H, t, k } = s;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.drawImage(s.backdrop, 0, 0, W, H);

      // 수면 위 공기 (물갈이 중엔 내려간다)
      const ag = ctx.createLinearGradient(0, 0, 0, s.surface);
      ag.addColorStop(0, '#e0f2fe'); ag.addColorStop(1, '#bae6fd');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
      for (let x = W; x >= 0; x -= 14) ctx.lineTo(x, s.surface + Math.sin(x * 0.035 + t * 2.2) * 1.6 + s.tilt.x * (x - W / 2) * 0.04);
      ctx.closePath(); ctx.fill();

      const flow = s.tilt.x;
      // 장식 (수초·바위 등) – 자갈보다 먼저 그려 밑동이 자갈에 묻히게
      game.decor.forEach(d => { const x = d.x * W; drawDecor(ctx, d.id, x, groundY(x) + 8, k, t, s.decorRt[d.uid], flow); });
      ctx.drawImage(s.gravel, 0, 0, W, H);

      // 똥, 바닥 먹이, 조개
      game.poop.forEach(p => {
        const y = groundY(p.x) + p.dy;
        ctx.fillStyle = '#6b4423';
        ctx.beginPath(); ctx.ellipse(p.x, y, 4.5 * k, 2.6 * k, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x + 5 * k, y + 1, 3 * k, 2 * k, -0.2, 0, Math.PI * 2); ctx.fill();
      });
      s.pearls.forEach(p => {
        const glow = 0.5 + 0.5 * Math.sin(t * 4 + p.x);
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 26 * k);
        g.addColorStop(0, `rgba(255,255,255,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 30 * k, p.y - 30 * k, 60 * k, 60 * k);
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath(); ctx.moveTo(p.x - 13 * k, p.y + 4 * k); ctx.quadraticCurveTo(p.x, p.y - 16 * k, p.x + 13 * k, p.y + 4 * k); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 1.3 * k;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(p.x, p.y + 4 * k); ctx.lineTo(p.x + i * 5 * k, p.y - 8 * k + Math.abs(i) * 3 * k); ctx.stroke(); }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y - 1 * k, 4.5 * k, 0, Math.PI * 2); ctx.fill();
      });

      // 물고기 그림자
      game.fish.forEach(f => {
        const r = s.rt[f.uid]; if (!r) return;
        const L = fishLen(f), gy = groundY(r.x) + 6, hgt = gy - r.y;
        const a = 0.22 * (1 - clamp(hgt / (H * 0.8), 0, 1));
        if (a < 0.02) return;
        ctx.fillStyle = `rgba(30,41,59,${a})`;
        ctx.beginPath(); ctx.ellipse(r.x + hgt * 0.08, gy, L * 0.45, L * 0.09 + 1, 0, 0, Math.PI * 2); ctx.fill();
      });

      // 물고기 (멀리 있는 것부터)
      const order = game.fish.filter(f => s.rt[f.uid]).sort((a, b) => s.rt[a.uid].z - s.rt[b.uid].z);
      order.forEach(f => {
        const r = s.rt[f.uid], sp = FISH_BY_ID[f.sp]; if (!sp) return;
        const L = fishLen(f) * (0.82 + r.z * 0.18) * (1 + Math.sin(r.boing * Math.PI) * 0.25);
        ctx.save();
        ctx.translate(r.x, r.y);
        const ang = clamp(Math.atan2(r.vy, Math.abs(r.vx) + 8) * 0.6, -0.6, 0.6);
        ctx.scale(r.dir, 1);
        ctx.rotate(ang * 1);
        ctx.globalAlpha = 0.72 + r.z * 0.28;
        drawFish(ctx, sp, L, { phase: r.phase, growth: f.growth, sad: isSad(f, game.dirt), happy: r.happyT > 0, detail: L > 26 });
        ctx.restore();
        if (info === f.uid) {
          ctx.strokeStyle = 'rgba(254,240,138,0.9)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(r.x, r.y, L * 0.7 + 6, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // 떨어지는 먹이·똥·조개
      s.food.forEach(fd => {
        ctx.save(); ctx.translate(fd.x, fd.y); ctx.rotate(fd.rot);
        ctx.fillStyle = fd.color; ctx.fillRect(-2.6 * k, -1.8 * k, 5.2 * k, 3.6 * k);
        ctx.restore();
      });
      s.drops.forEach(d => {
        if (d.delay > 0) return;
        ctx.fillStyle = d.kind === 'pearl' ? '#ffffff' : '#6b4423';
        ctx.beginPath(); ctx.arc(d.x, d.y, (d.kind === 'pearl' ? 4.5 : 3) * k, 0, Math.PI * 2); ctx.fill();
      });

      // 거품
      s.bubbles.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
      });

      // 수면 아래 반사 띠 & 수면선
      const ug = ctx.createLinearGradient(0, s.surface, 0, s.surface + 16);
      ug.addColorStop(0, 'rgba(255,255,255,0.35)'); ug.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ug; ctx.fillRect(0, s.surface, W, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) {
        const y = s.surface + Math.sin(x * 0.035 + t * 2.2) * 1.6 + s.tilt.x * (x - W / 2) * 0.04;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 물결 링
      s.ripples.forEach(r => {
        ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.7})`; ctx.lineWidth = 2.5 * r.life + 0.8;
        ctx.beginPath();
        if (r.flat) ctx.ellipse(r.x, r.y, r.r, r.r * 0.25, 0, 0, Math.PI * 2); else ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 먹이통
      if (s.shaker) {
        const sh = s.shaker, y = s.surface - 30 * k;
        ctx.save(); ctx.translate(sh.x, y); ctx.rotate(2.3 + Math.sin(sh.t * 26) * 0.25);
        ctx.fillStyle = '#f97316'; ctx.fillRect(-14 * k, -22 * k, 28 * k, 40 * k);
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(-14 * k, -6 * k, 28 * k, 12 * k);
        ctx.fillStyle = '#334155'; ctx.fillRect(-15 * k, 16 * k, 30 * k, 6 * k);
        ctx.restore();
      }

      // 떠오르는 글자 (+1 🐚, 💗, ✨)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      s.pops.forEach(p => {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.font = `900 ${Math.round(16 * k)}px system-ui, sans-serif`;
        if (p.color) { ctx.strokeStyle = 'rgba(15,23,42,0.6)'; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; }
        else ctx.fillStyle = '#ffffff';
        ctx.fillText(p.text, p.x, p.y);
      });
      ctx.globalAlpha = 1;

      // 청소 스펀지
      if (modeRef.current === 'clean' && s.pointer.down) {
        ctx.fillStyle = 'rgba(250,204,21,0.9)'; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s.pointer.x - 24 * k, s.pointer.y - 16 * k, 48 * k, 32 * k, 8 * k) : ctx.rect(s.pointer.x - 24 * k, s.pointer.y - 16 * k, 48 * k, 32 * k);
        ctx.fill(); ctx.stroke();
      }
    };

    // 유리 위 이끼 + 탁한 물 (값이 바뀔 때만 다시 그림)
    const drawOverlay = () => {
      const key = `${Math.round(game.dirt / 2)}|${s.algae.length}|${Math.round(s.surface)}|${s.W}x${s.H}`;
      if (key === s.overlayKey) return;
      s.overlayKey = key;
      octx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      octx.clearRect(0, 0, s.W, s.H);
      const d = game.dirt / 100;
      if (d > 0.05) {
        octx.fillStyle = `rgba(101,108,36,${Math.pow(d, 1.3) * 0.38})`;
        octx.fillRect(0, s.surface, s.W, s.H - s.surface);
      }
      s.algae.forEach(a => {
        for (let i = 0; i < a.blobs; i++) {
          const ang = a.seed + i * 2.1, rr = a.r * (0.45 + (i % 3) * 0.2);
          const bx = a.x + Math.cos(ang) * a.r * 0.5, by = a.y + Math.sin(ang) * a.r * 0.4;
          const g = octx.createRadialGradient(bx, by, 0, bx, by, rr);
          g.addColorStop(0, `rgba(77,124,15,${a.a})`); g.addColorStop(1, 'rgba(77,124,15,0)');
          octx.fillStyle = g;
          octx.beginPath(); octx.arc(bx, by, rr, 0, Math.PI * 2); octx.fill();
        }
      });
    };

    // 바다 친구 SVG 위치 갱신
    const placeFriends = () => {
      Object.entries(s.fr).forEach(([uid, c]) => {
        const els = friendEls.current[uid];
        if (!els || !els.outer || !els.inner) return;
        const w = c.size * 1.1, h = c.size;
        els.outer.style.transform = `translate3d(${(c.x - w / 2).toFixed(1)}px, ${(c.y - h / 2).toFixed(1)}px, 0)`;
        els.outer.style.opacity = c.alpha.toFixed(2);
        const bob = c.motion === 'crawl' ? 0 : Math.sin(s.t * 2 + c.phase) * 3;
        const grow = 1 + Math.sin(c.boing * Math.PI) * 0.22;
        const sq = 1 - (c.squash || 0) * 0.14;
        const ang = FRIEND_FLIP.has(c.id) ? clamp(Math.atan2(c.vy, Math.abs(c.vx) + 20) * 0.5, -0.35, 0.35) * 57.3 : Math.sin(s.t * 1.5 + c.phase) * 4;
        els.inner.style.transform = `translateY(${bob.toFixed(1)}px) scale(${(c.heading * grow / sq).toFixed(3)}, ${(grow * sq).toFixed(3)}) rotate(${ang.toFixed(1)}deg)`;
      });
    };

    const drawLight = () => {
      if (!light) return;
      const { gl } = light;
      const cw = lightRef.current.width, ch = lightRef.current.height;
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(light.uRes, cw, ch);
      gl.uniform1f(light.uTime, s.t);
      gl.uniform1f(light.uSurface, s.surface / s.H);
      gl.uniform1f(light.uFloor, s.floor / s.H);
      gl.uniform2f(light.uTilt, s.tilt.x, s.tilt.y);
      gl.uniform1f(light.uMurk, game.dirt / 100);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    let info = null;
    s.setInfoUid = (uid) => { info = uid; };

    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; s.t += dt;
      if (s.quality === 1) {
        s.slow = dt > 0.03 ? s.slow + 1 : Math.max(0, s.slow - 1);
        if (s.slow > 120) { s.quality = 0.6; resize(); }
      }
      s.tilt.x += (s.tiltRaw.x - s.tilt.x) * Math.min(1, dt * 4);
      s.tilt.y += (s.tiltRaw.y - s.tilt.y) * Math.min(1, dt * 4);

      tickCare(dt);
      updateFish(dt);
      updateFriends(dt);
      updateParticles(dt);
      draw();
      drawOverlay();
      drawLight();
      placeFriends();

      if (s.t - s.lastHud > 0.4) {
        s.lastHud = s.t;
        const fish = game.fish;
        const next = { points: game.points, clean: Math.round(100 - game.dirt), sad: fish.filter(f => isSad(f, game.dirt)).length };
        setHud(prev => (prev.points === next.points && prev.clean === next.clean && prev.sad === next.sad ? prev : next));
        setInfoTick(v => (v + 1) % 1000);
      }
      if (s.t - s.lastSave > 4) { s.lastSave = s.t; game.lastTick = Date.now(); saveGame(game); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const persist = () => { game.lastTick = Date.now(); saveGame(game); };
    const onVis = () => {
      if (document.hidden) { persist(); return; }
      // 다른 앱을 보다 돌아오면 그 사이 시간만큼 반영
      catchUpOffline(game).grown.forEach(f => { game.points += stageOf(f.growth) === 'adult' ? REWARDS.adult : REWARDS.juvenile; });
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', persist);

    return () => {
      persist();
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('deviceorientation', s.onOrient);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', persist);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택한 물고기 표시 링
  useEffect(() => { if (simRef.current) simRef.current.setInfoUid(info); }, [info]);
  useEffect(() => {
    if (!info) return undefined;
    const tm = setTimeout(() => setInfo(null), 9000);
    return () => clearTimeout(tm);
  }, [info]);

  // ── 상점 ──
  const buy = (kind, id) => {
    const s = simRef.current; if (!s) return;
    const game = s.game;
    const price = kind === 'fish' ? FISH_BY_ID[id].price || STARTER_FISH_PRICE : kind === 'decor' ? DECOR_BY_ID[id].price : FRIEND_PRICES[id];
    const full = kind === 'fish' ? game.fish.length >= LIMITS.fish : kind === 'decor' ? game.decor.length >= LIMITS.decor : game.friends.length >= LIMITS.friends;
    if (full) { showToast('🙅 어항이 꽉 찼어요!'); return; }
    if (game.points < price) { showToast(`🐚 조개가 ${price - game.points}개 더 필요해요`); s.say('need', VOICE.aquaNeedMore(), 3); return; }
    game.points -= price;
    if (kind === 'fish') {
      const f = newFish(id);
      game.fish.push(f);
      s.ensureFishRt(f, true);
      for (let i = 0; i < 12; i++) s.bubbles.push({ x: s.rt[f.uid].x + (Math.random() - 0.5) * 30, y: s.surface + 10, r: 2 + Math.random() * 4, wob: Math.random() * 6, vy: 40 });
      s.say('buy', VOICE.aquaNewFish(FISH_BY_ID[id]));
    } else if (kind === 'decor') {
      game.decor.push({ uid: newUid(), id, x: 0.1 + Math.random() * 0.8 });
    } else {
      const fr = { uid: newUid(), id };
      game.friends.push(fr);
      s.ensureFriendRt(fr, true);
      setFriends(game.friends.slice());
      const c = creatureById(id);
      if (c) s.say('buy', VOICE.aquaNewFriend(c));
    }
    audio.playFanfare();
    saveGame(game);
    setPlaced({ decor: game.decor.slice(), friends: game.friends.slice() });
    setHud(h => ({ ...h, points: game.points }));
    setShopOpen(false);
  };

  const sellPlaced = (kind, uid) => {
    const s = simRef.current; if (!s) return;
    const game = s.game;
    if (kind === 'decor') {
      const d = game.decor.find(it => it.uid === uid);
      if (!d) return;
      game.decor = game.decor.filter(it => it.uid !== uid);
      game.points += Math.floor(DECOR_BY_ID[d.id].price / 2);
    } else {
      const fr = game.friends.find(it => it.uid === uid);
      if (!fr) return;
      game.friends = game.friends.filter(it => it.uid !== uid);
      delete s.fr[uid];
      game.points += Math.floor(FRIEND_PRICES[fr.id] / 2);
      setFriends(game.friends.slice());
    }
    audio.playPopSound();
    saveGame(game);
    setPlaced({ decor: game.decor.slice(), friends: game.friends.slice() });
    setHud(h => ({ ...h, points: game.points }));
  };

  const enableTilt = (e) => {
    e.stopPropagation();
    const s = simRef.current;
    window.DeviceOrientationEvent.requestPermission()
      .then(res => { if (res === 'granted' && s) { window.addEventListener('deviceorientation', s.onOrient); setTiltState('on'); } else setTiltState('none'); })
      .catch(() => setTiltState('none'));
  };

  const stop = (e) => e.stopPropagation();
  const sim = simRef.current;
  const infoFish = info && sim ? sim.game.fish.find(f => f.uid === info) : null;
  const pointsNow = sim ? sim.game.points : hud.points;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.7rem' }}>
      {/* 상단 상태판: 27개월 아기도 알아보게 큰 그림 버튼 위주 (글자는 부모용으로 작게) */}
      <div style={{
        background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)', borderRadius: '22px', padding: '0.55rem 0.9rem',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0,
        border: '3px solid #38bdf8', boxShadow: '0 8px 22px rgba(2,132,199,0.25)'
      }}>
        <div style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, fontSize: '1.45rem', padding: '6px 14px', borderRadius: '18px', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.1)' }}>
          🐚 {hud.points}
        </div>
        <WaterMeter value={hud.clean} />
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <IconButton icon="🍤" label="밥" color="#f97316" onClick={() => { setMode('play'); if (simRef.current) simRef.current.feed(); }} />
          <IconButton icon="🧽" label="청소" color="#10b981" active={mode === 'clean'} onClick={() => setMode(mode === 'clean' ? 'play' : 'clean')} />
          <IconButton icon="🚿" label="물갈이" color="#0ea5e9" onClick={() => { if (simRef.current) simRef.current.startWaterChange(); }} />
          <IconButton icon="🛒" label="상점" color="#8b5cf6" onClick={() => setShopOpen(true)} />
          <IconButton icon="🎨" label="꾸미기" color="#ec4899" active={mode === 'decorate'} onClick={() => setMode(mode === 'decorate' ? 'play' : 'decorate')} />
        </div>
      </div>

      {/* 어항 */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, minHeight: '260px', position: 'relative', overflow: 'hidden', borderRadius: '18px',
          border: '7px solid #1e293b', borderTopWidth: '14px', background: '#0e6f8f',
          boxShadow: '0 14px 30px rgba(15,23,42,0.35), inset 0 0 0 2px rgba(255,255,255,0.15)',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          cursor: mode === 'clean' ? 'crosshair' : mode === 'decorate' ? 'grab' : 'pointer'
        }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 0 }} />
        <canvas ref={lightRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 1, mixBlendMode: 'screen', pointerEvents: 'none' }} />

        {friends.map(fr => {
          const c = creatureById(fr.id);
          if (!c) return null;
          const size = c.size * 0.9 * (sim ? sim.k : 1);
          return (
            <div
              key={fr.uid}
              ref={el => { const m = friendEls.current[fr.uid] || (friendEls.current[fr.uid] = {}); m.outer = el; }}
              style={{ position: 'absolute', left: 0, top: 0, width: `${size * 1.1}px`, height: `${size}px`, opacity: 0, pointerEvents: 'none', zIndex: 2, willChange: 'transform' }}
            >
              <div ref={el => { const m = friendEls.current[fr.uid] || (friendEls.current[fr.uid] = {}); m.inner = el; }} style={{ width: '100%', height: '100%' }}>
                <CreatureSVG id={fr.id} />
              </div>
            </div>
          );
        })}

        <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 3, pointerEvents: 'none' }} />
        {/* 유리 반사 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
          background: 'linear-gradient(112deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 16%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.08) 63%, rgba(255,255,255,0) 69%)',
          boxShadow: 'inset 0 0 70px rgba(8,47,73,0.45)'
        }} />

        {/* 모드 안내 */}
        {mode !== 'play' && (
          <div style={{
            position: 'absolute', left: '50%', top: '10px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none',
            background: 'rgba(15,23,42,0.75)', color: '#ffffff', fontWeight: 900, padding: '8px 16px', borderRadius: '16px', fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}>
            {mode === 'clean' ? '🧽 유리 이끼와 바닥 똥을 문질러 치워요' : '🎨 장식과 바다 친구를 끌어서 옮겨요'}
          </div>
        )}

        {toast && (
          <div key={toast.key} style={{
            position: 'absolute', left: '50%', top: mode !== 'play' ? '54px' : '14px', transform: 'translateX(-50%)', zIndex: 7, pointerEvents: 'none',
            background: '#ffffff', color: '#0f172a', fontWeight: 900, padding: '10px 18px', borderRadius: '18px', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap'
          }}>
            {toast.text}
          </div>
        )}

        {tiltState === 'ask' && (
          <button onPointerDown={stop} onClick={enableTilt} style={{
            position: 'absolute', right: '12px', top: '12px', zIndex: 6, background: 'rgba(255,255,255,0.92)', color: '#0369a1', border: 'none',
            padding: '9px 14px', borderRadius: '16px', fontWeight: 900, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', cursor: 'pointer'
          }}>📱 기울여서 놀기</button>
        )}

        {/* 물고기 정보 카드 */}
        {infoFish && (() => {
          const sp = FISH_BY_ID[infoFish.sp];
          const dirt = sim.game.dirt;
          const stage = stageOf(infoFish.growth);
          const sad = isSad(infoFish, dirt);
          const cond = conditionOf(infoFish, dirt);
          const speed = growFactor(infoFish, dirt);
          return (
            <div onPointerDown={stop} data-tick={infoTick} style={{
              position: 'absolute', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: 8,
              background: 'rgba(255,255,255,0.96)', borderRadius: '22px', padding: '12px 16px', width: 'min(360px, calc(100% - 24px))',
              boxShadow: '0 12px 28px rgba(0,0,0,0.3)', border: `3px solid ${sad ? '#94a3b8' : '#38bdf8'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0f172a' }}>
                  {sad ? '😢' : '😊'} {sp.name} <span style={{ fontSize: '0.85rem', color: '#0369a1' }}>· {STAGE_NAMES[stage]}</span>
                </div>
                <button onClick={() => setInfo(null)} style={{ border: 'none', background: '#e2e8f0', borderRadius: '12px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: '8px', fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                {[['🍤 배부름', infoFish.full, '#facc15'], ['💗 기분', infoFish.happy, '#f472b6'], ['💪 컨디션', cond, '#22c55e'], ['🌱 성장', infoFish.growth * 100, '#0ea5e9']].map(([label, v, col]) => (
                  <div key={label}>
                    {label} {Math.round(v)}%
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', marginTop: '2px' }}>
                      <div style={{ width: `${clamp(v, 0, 100)}%`, height: '100%', background: v < 30 && label !== '🌱 성장' ? '#f43f5e' : col }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.82rem', fontWeight: 800, color: sad ? '#be123c' : '#0f766e' }}>
                {stage === 'adult' ? '🎉 다 컸어요! 가끔 반짝 조개를 떨어뜨려요' : sad ? '배고프거나 물이 더러워서 자라지 않아요' : `자라는 속도 ${Math.round(speed * 100)}% (컨디션이 좋을수록 빨라요)`}
              </div>
              <button
                onClick={() => {
                  infoFish.happy = Math.min(100, infoFish.happy + 15);
                  const r = sim.rt[infoFish.uid];
                  if (r) { r.boing = 1; r.happyT = 2; sim.pops.push({ x: r.x, y: r.y - 20, text: '💗', life: 1, vy: -30 }); }
                  if (sim.t - (sim.lastPet || -9) > 3) { sim.lastPet = sim.t; sim.addPoints(REWARDS.pet, r ? r.x : 0, r ? r.y - 40 : 0); }
                  audio.playYum();
                }}
                style={{ marginTop: '10px', width: '100%', border: 'none', borderRadius: '16px', padding: '10px', fontWeight: 900, fontSize: '1rem', background: '#f472b6', color: '#ffffff', cursor: 'pointer' }}
              >💗 쓰다듬기</button>
            </div>
          );
        })()}

        {/* 꾸미기: 놓인 장식·친구 목록 (✕ 는 반값에 되팔기) */}
        {mode === 'decorate' && (
          <div onPointerDown={stop} style={{
            position: 'absolute', left: '10px', right: '10px', bottom: '10px', zIndex: 8, display: 'flex', gap: '6px', overflowX: 'auto',
            background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '8px'
          }}>
            {placed.decor.map(d => (
              <div key={d.uid} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px 8px', whiteSpace: 'nowrap', fontWeight: 900 }}>
                {DECOR_BY_ID[d.id].icon} {DECOR_BY_ID[d.id].name}
                <button onClick={() => sellPlaced('decor', d.uid)} style={{ border: 'none', background: '#fecaca', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>✕ +{Math.floor(DECOR_BY_ID[d.id].price / 2)}🐚</button>
              </div>
            ))}
            {placed.friends.map(fr => {
              const c = creatureById(fr.id);
              return (
                <div key={fr.uid} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e0f2fe', borderRadius: '12px', padding: '4px 8px', whiteSpace: 'nowrap', fontWeight: 900 }}>
                  {c ? `${c.icon} ${c.name}` : fr.id}
                  <button onClick={() => sellPlaced('friend', fr.uid)} style={{ border: 'none', background: '#fecaca', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>✕ +{Math.floor(FRIEND_PRICES[fr.id] / 2)}🐚</button>
                </div>
              );
            })}
            {!placed.decor.length && !placed.friends.length && <span style={{ fontWeight: 800, color: '#64748b' }}>상점에서 장식이나 바다 친구를 사 보세요!</span>}
          </div>
        )}

        {/* 상점 */}
        {shopOpen && (
          <div onPointerDown={stop} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ background: '#ffffff', borderRadius: '26px', width: 'min(760px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff' }}>
                <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>🛒 바다 상점</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, padding: '4px 12px', borderRadius: '14px' }}>🐚 {pointsNow}</span>
                  <button onClick={() => setShopOpen(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', borderRadius: '12px', padding: '6px 12px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '10px 14px 0' }}>
                {[['fish', '🐟 물고기'], ['decor', '🪸 장식'], ['friend', '🐙 바다 친구']].map(([k, label]) => (
                  <button key={k} onClick={() => setShopTab(k)} style={{
                    border: 'none', borderRadius: '14px', padding: '8px 14px', fontWeight: 900, cursor: 'pointer',
                    background: shopTab === k ? '#8b5cf6' : '#f1f5f9', color: shopTab === k ? '#ffffff' : '#475569'
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ padding: '12px 14px 16px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {shopTab === 'fish' && FISH_SPECIES.map(sp => {
                  const price = sp.price || STARTER_FISH_PRICE;
                  return (
                    <div key={sp.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0f9ff' }}>
                      <FishPreview species={sp} />
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{sp.name}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>아기 치어로 와요</div>
                      <button onClick={() => buy('fish', sp.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= price ? '#8b5cf6' : '#cbd5e1', color: '#ffffff' }}>🐚 {price}</button>
                    </div>
                  );
                })}
                {shopTab === 'decor' && DECOR_ITEMS.map(d => (
                  <div key={d.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0fdf4' }}>
                    <DecorPreview id={d.id} />
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{d.name}</div>
                    <button onClick={() => buy('decor', d.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= d.price ? '#10b981' : '#cbd5e1', color: '#ffffff' }}>🐚 {d.price}</button>
                  </div>
                ))}
                {shopTab === 'friend' && creatures.map(c => (
                  <div key={c.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#eff6ff' }}>
                    <div style={{ width: 96, height: 80 }}><CreatureSVG id={c.id} /></div>
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{c.name}</div>
                    <button onClick={() => buy('friend', c.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= FRIEND_PRICES[c.id] ? '#0ea5e9' : '#cbd5e1', color: '#ffffff' }}>🐚 {FRIEND_PRICES[c.id]}</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 16px 14px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>
                물고기 {sim ? sim.game.fish.length : 0}/{LIMITS.fish} · 장식 {placed.decor.length}/{LIMITS.decor} · 바다 친구 {placed.friends.length}/{LIMITS.friends}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
