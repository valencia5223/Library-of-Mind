// src/utils/notify.js - 브라우저 기본 alert/confirm 대신 쓰는 앱 알림
//   toast('저장했습니다')                 화면 아래 잠깐 떴다 사라지는 알림 (종류는 문구로 추측, { type } 로 지정 가능)
//   await confirmDialog('삭제할까요?')    확인 창, 확인이면 true
//   await alertDialog('긴 안내…')         확인 버튼 하나뿐인 안내 창 (여러 줄 안내용)
// 화면은 src/components/NotifyHost.jsx 가 그린다(main.jsx 에서 한 번 붙임).

const listeners = new Set();
let state = { toasts: [], dialog: null };
const pending = [];
let seq = 0;

const emit = () => listeners.forEach((fn) => fn(state));

export function subscribeNotify(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

// 문구 앞 이모지는 아이콘으로 대신하므로 뗀다
const LEADING = /^\s*(✅|🎉|⚠️|⚠|❌|☕|🚨|💡|🔔)️?\s*/u;

function inferType(text) {
  if (/^\s*(✅|🎉)/u.test(text)) return 'success';
  if (/^\s*(❌|🚨)/u.test(text) || /오류|실패|못했|없습니다|못 찾|차단/.test(text)) return 'error';
  if (/^\s*⚠/u.test(text)) return 'warning';
  return 'info';
}

export function dismissToast(id) {
  if (!state.toasts.some((t) => t.id === id)) return;
  state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
  emit();
}

export function toast(message, opts = {}) {
  const raw = String(message ?? '');
  const text = raw.replace(LEADING, '');
  const id = ++seq;
  const item = {
    id,
    type: opts.type || inferType(raw),
    text,
    duration: opts.duration ?? (text.length > 50 ? 6000 : 3500),
  };
  state = { ...state, toasts: [...state.toasts.slice(-3), item] }; // 최대 4개
  emit();
  setTimeout(() => dismissToast(id), item.duration);
  return id;
}

// 창은 한 번에 하나씩 차례로
function nextDialog() {
  if (state.dialog || pending.length === 0) return;
  const open = pending.shift();
  open();
}

function openDialog(kind, message, opts, resolve) {
  const raw = String(message ?? '');
  const danger = opts.danger ?? (kind === 'confirm' && /삭제|지우|지울|초기화|거절|뺄까|빼기/.test(raw));
  const okText =
    opts.okText ||
    (kind === 'alert' ? '확인'
      : /삭제/.test(raw) ? '삭제'
      : /초기화|지우|지울/.test(raw) ? '지우기'
      : /거절/.test(raw) ? '거절'
      : '확인');
  pending.push(() => {
    state = {
      ...state,
      dialog: {
        kind,
        title: opts.title || '',
        message: raw.replace(LEADING, ''),
        danger,
        okText,
        cancelText: opts.cancelText || '취소',
        close: (value) => {
          state = { ...state, dialog: null };
          emit();
          resolve(value);
          setTimeout(nextDialog, 0);
        },
      },
    };
    emit();
  });
  nextDialog();
}

export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => openDialog('confirm', message, opts, resolve));
}

export function alertDialog(message, opts = {}) {
  return new Promise((resolve) => openDialog('alert', message, opts, () => resolve()));
}
