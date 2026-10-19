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

// 섹션마다 고른 친구 (map[섹션id]: 친구 id, 'none' = 공유 안함). 섹션 설정이 없으면 예전 노트북 설정을 따름
const NO_SHARE = 'none';
export const sectionFriendId = (map, sectionId, notebookId) => {
  const v = map[sectionId];
  if (v !== undefined) return v === NO_SHARE ? null : v;
  return (notebookId && map[notebookId]) || null;
};
export const withSectionFriend = (map, sectionId, friendId) => ({ ...map, [sectionId]: friendId || NO_SHARE });

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

// 제목에 날짜가 있으면 그 날짜: 2026-10-19 / 2026.10.19 / 10/19 / 10.19 / 10월 19일 (연도가 없으면 refIso 의 연도)
export const parseTitleDate = (title, refIso) => {
  if (!title) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const valid = (y, m, d) => {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  };
  let m = title.match(/(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const year = new Date(refIso || Date.now()).getFullYear();
  m = title.match(/(?:^|[^\d])(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || title.match(/(?:^|[^\d.:/])(\d{1,2})[/.](\d{1,2})(?![\d.:/])/);
  if (m && valid(year, +m[1], +m[2])) return `${year}-${pad(m[1])}-${pad(m[2])}`;
  return null;
};

// 페이지 하나 → 일정 항목 (본문을 받아 옴)
export const buildScheduleItem = async (page, { dateBasis = 'created', friendId = null } = {}) => {
  const text = await getPageText(page.id);
  const base = toLocalDateTime(dateBasis === 'created' ? page.created : page.modified);
  const titleDate = parseTitleDate(page.title, page.created);
  return {
    id: oneNoteScheduleId(page.id),
    title: page.title,
    date: titleDate || base.date,
    time: base.time,
    memo: text.length > MEMO_MAX ? `${text.slice(0, MEMO_MAX)}…` : text,
    shared_friend_id: friendId || null
  };
};

// 자동 동기화를 켤 때·'지금 동기화' 때 거슬러 확인하는 기간
export const SYNC_LOOKBACK_DAYS = 30;
export const lookbackIso = () => new Date(Date.now() - SYNC_LOOKBACK_DAYS * 86400000).toISOString();

// 자동 동기화 섹션들에서 마지막 동기화 뒤 새로 만들거나 고친 페이지를 일정으로
// onImport(items) 는 달력 저장 함수. 반환: 가져온 개수
// options.sectionIds: 이 섹션만, options.full: lastSync 를 무시하고 최근 30일을 다시 확인
export const runAutoSync = async (userId, onImport, { sectionIds: only = null, full = false } = {}) => {
  const config = loadAutoSync(userId);
  const sectionIds = Object.keys(config).filter(id => !only || only.includes(id));
  if (sectionIds.length === 0) return 0;
  if (!(await getSignedInAccount())) {
    const err = new Error('Microsoft 로그인이 필요합니다.');
    err.code = 'ONENOTE_NEED_LOGIN';
    throw err;
  }

  const shareMap = loadShareMap(userId);
  const items = [];
  const nextConfig = { ...config };

  for (const sectionId of sectionIds) {
    const sec = config[sectionId];
    const startedAt = new Date().toISOString();
    const since = full || !sec.lastSync ? lookbackIso() : sec.lastSync;
    // 서버 반영이 몇 분 늦을 수 있어 10분 겹쳐서 확인 (같은 페이지는 덮어쓰기라 괜찮음)
    const pages = await listPages(sectionId, new Date(new Date(since).getTime() - 10 * 60000).toISOString());
    const friendId = sectionFriendId(shareMap, sectionId, sec.notebookShared ? sec.notebookId : null);
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
