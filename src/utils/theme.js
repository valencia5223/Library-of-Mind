// src/utils/theme.js - 화면 테마 (<html data-theme="...">, 색·모양 토큰은 index.css)
// 선택은 이 브라우저 localStorage 에만 저장한다

export const THEMES = [
  { id: 'modern', name: '모던 미니멀', swatch: ['#f7f7f8', '#4f46e5'] },
  { id: 'paper', name: '따뜻한 종이 서재', swatch: ['#f6f1e7', '#8b2e3c'] },
  { id: 'gallery', name: '갤러리 모노', swatch: ['#ffffff', '#111111'] },
  { id: 'mint', name: '민트 소다', swatch: ['#f3faf8', '#0f9d8a'] },
  { id: 'pop', name: '팝 스티커', swatch: ['#fff8e1', '#ffcf33'] },
];

const KEY = 'lom_theme';

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.some((x) => x.id === t) ? t : 'modern';
  } catch {
    return 'modern';
  }
}

export function applyTheme(id) {
  const root = document.documentElement;
  if (!id || id === 'modern') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
  // 모바일 주소창 색
  const meta = document.querySelector('meta[name="theme-color"]');
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  if (meta) meta.setAttribute('content', t.swatch[0]);
}

export function setTheme(id) {
  try { localStorage.setItem(KEY, id); } catch { /* 저장 못 해도 화면은 바꿈 */ }
  applyTheme(id);
}
