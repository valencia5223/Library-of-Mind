// OneNote → 일정 변환과 자동 동기화 (설정은 브라우저 localStorage 에 사용자별로 저장)
import { getSignedInAccount, listPages, getPageText } from './oneNote';

const MEMO_MAX = 3000;

export const oneNoteScheduleId = (pageId) => `sch_onenote_${pageId}`;

export const toLocalDateTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
};

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* 저장 공간 문제는 무시 (이번 실행에는 반영됨) */ }
};

// 공유 노트북 → 공유할 친구 id (노트북마다 한 번 고르면 기억)
const shareMapKey = (userId) => `onenote_notebook_share_${userId || 'demo'}`;
export const loadShareMap = (userId) => readJson(shareMapKey(userId), {});
export const saveShareMap = (userId, map) => writeJson(shareMapKey(userId), map);

// 자동 동기화 섹션: { [sectionId]: { name, notebook, notebookId, notebookShared, dateBasis, lastSync } }
const autoSyncKey = (userId) => `onenote_autosync_${userId || 'demo'}`;
export const loadAutoSync = (userId) => readJson(autoSyncKey(userId), {});
export const saveAutoSync = (userId, config) => writeJson(autoSyncKey(userId), config);
export const hasAutoSync = (userId) => Object.keys(loadAutoSync(userId)).length > 0;

// 섹션·페이지 목록 캐시 (계정별): 창을 열면 바로 보여 주고 뒤에서 새로 받음
const cacheKey = (accountId, name) => `onenote_cache_${accountId}_${name}`;
export const loadCache = (accountId, name) => readJson(cacheKey(accountId, name), null);
export const saveCache = (accountId, name, value) => writeJson(cacheKey(accountId, name), value);
export const clearCache = (accountId) => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(`onenote_cache_${accountId}_`))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* 무시 */ }
};

// 최대 limit 개씩 동시에 처리 (순서 유지). onProgress(끝난 개수)
export const mapLimit = async (list, limit, fn, onProgress = null) => {
  const out = new Array(list.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
      done++;
      if (onProgress) onProgress(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
};

// 페이지 하나 → 일정 항목 (본문을 받아 옴)
export const buildScheduleItem = async (page, { dateBasis = 'created', friendId = null } = {}) => {
  const text = await getPageText(page.id);
  const { date, time } = toLocalDateTime(dateBasis === 'created' ? page.created : page.modified);
  return {
    id: oneNoteScheduleId(page.id),
    title: page.title,
    date,
    time,
    memo: text.length > MEMO_MAX ? `${text.slice(0, MEMO_MAX)}…` : text,
    shared_friend_id: friendId || null
  };
};

// 자동 동기화 섹션들에서 마지막 동기화 뒤 새로 만들거나 고친 페이지를 일정으로
// onImport(items) 는 달력 저장 함수. 반환: 가져온 개수
export const runAutoSync = async (userId, onImport) => {
  const config = loadAutoSync(userId);
  const sectionIds = Object.keys(config);
  if (sectionIds.length === 0) return 0;
  if (!(await getSignedInAccount())) return 0;

  const shareMap = loadShareMap(userId);
  const items = [];
  const nextConfig = { ...config };

  for (const sectionId of sectionIds) {
    const sec = config[sectionId];
    const startedAt = new Date().toISOString();
    const pages = await listPages(sectionId, sec.lastSync || null);
    const friendId = sec.notebookShared ? (shareMap[sec.notebookId] || null) : null;
    items.push(...await mapLimit(pages, 3, page => buildScheduleItem(page, { dateBasis: sec.dateBasis, friendId })));
    nextConfig[sectionId] = { ...sec, lastSync: startedAt };
  }

  if (items.length > 0) await onImport(items, { silent: true });
  // 설정이 그사이 바뀌었을 수 있으니 lastSync 만 덮어씀
  const latest = loadAutoSync(userId);
  Object.keys(latest).forEach(id => {
    if (nextConfig[id]) latest[id] = { ...latest[id], lastSync: nextConfig[id].lastSync };
  });
  saveAutoSync(userId, latest);
  return items.length;
};
