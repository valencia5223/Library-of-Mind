// OneNote → 일정 변환과 자동 동기화 (설정은 브라우저 localStorage 에 사용자별로 저장)
import { getSignedInAccount, listSections, listPages, listPageIds, getPageText } from './oneNote';

// 메모 최대 길이 (긴 노트 뒷부분을 고쳐도 반영되도록 넉넉하게)
const MEMO_MAX = 50000;

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

// 손으로 가져온 노트가 있는 섹션: 새 노트는 안 가져오고, 이미 가져온 노트의 수정만 반영
// { [sectionId]: { notebookId, notebookShared, dateBasis, lastSync } }
const trackedKey = (userId) => `onenote_tracked_${userId || 'demo'}`;
const loadTracked = (userId) => readJson(trackedKey(userId), {});
const saveTracked = (userId, map) => writeJson(trackedKey(userId), map);
const trackScanKey = (userId) => `onenote_tracked_scanned_${userId || 'demo'}`;

export const trackSection = (userId, section, dateBasis) => {
  const map = loadTracked(userId);
  map[section.id] = {
    notebookId: section.notebookId,
    notebookShared: section.notebookShared,
    dateBasis,
    lastSync: map[section.id]?.lastSync || new Date().toISOString()
  };
  saveTracked(userId, map);
};

// 이 기능 전에 가져온 노트: 한 번만 모든 섹션을 훑어 어느 섹션에 있는지 기록
const scanTrackedOnce = async (userId, existingIds) => {
  if (localStorage.getItem(trackScanKey(userId))) return;
  const imported = [...existingIds].filter(id => id.replace(/^sh_/, '').startsWith('sch_onenote_'));
  if (imported.length > 0) {
    const wanted = new Set(imported.map(id => id.replace(/^sh_/, '')));
    const map = loadTracked(userId);
    for (const sec of await listSections()) {
      if (map[sec.id]) continue;
      let ids = [];
      try {
        ids = await listPageIds(sec.id);
      } catch (e) {
        if (e?.status === 403) continue; // 암호로 보호된 섹션은 건너뜀
        throw e;
      }
      if (ids.some(pid => wanted.has(oneNoteScheduleId(pid)))) {
        map[sec.id] = { notebookId: sec.notebookId, notebookShared: sec.notebookShared, dateBasis: 'created', lastSync: null };
      }
    }
    saveTracked(userId, map);
  }
  try {
    localStorage.setItem(trackScanKey(userId), '1');
  } catch { /* 무시 */ }
};

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
    time: '', // OneNote 노트는 작성 시각이 의미 없어 시간 없이 넣음
    memo: text.length > MEMO_MAX ? `${text.slice(0, MEMO_MAX)}…` : text,
    shared_friend_id: friendId || null
  };
};

// 페이지마다 마지막으로 달력에 반영한 수정 시각 { [pageId]: modifiedIso }
// OneNote 앱이 수정을 서버에 늦게 올려도(수정 시각은 고친 때로 찍힘) 놓치지 않으려고 시각 비교 대신 이 값과 비교
const seenKey = (userId) => `onenote_seen_${userId || 'demo'}`;
const loadSeen = (userId) => readJson(seenKey(userId), {});
export const markSeen = (userId, pages) => {
  const seen = loadSeen(userId);
  const cutoff = Date.now() - 40 * 86400000;
  pages.forEach(p => { seen[p.id] = p.modified; });
  Object.keys(seen).forEach(id => {
    if (new Date(seen[id]).getTime() < cutoff) delete seen[id];
  });
  writeJson(seenKey(userId), seen);
};

// 동기화 기록 (최근 20번): 자동 동기화가 실제로 언제·무엇을 했는지 창에서 확인용
const logKey = (userId) => `onenote_synclog_${userId || 'demo'}`;
export const loadSyncLog = (userId) => readJson(logKey(userId), []);
export const addSyncLog = (userId, entry) => {
  writeJson(logKey(userId), [{ at: new Date().toISOString(), ...entry }, ...loadSyncLog(userId)].slice(0, 20));
};

// 자동 확인 때 다시 훑는 기간 (이 안에서 수정 시각이 바뀐 페이지만 본문을 받음)
const RECHECK_DAYS = 7;
// OneNote 목록의 수정 시각은 캐시돼 늦게 바뀔 수 있어, 최근에 고친 페이지는 수정 시각과 상관없이 본문을 다시 받아 비교
const RECENT_DAYS = 3;
const RECENT_MAX_PER_SECTION = 15;

// 자동 동기화를 켤 때·'지금 동기화' 때 거슬러 확인하는 기간
export const SYNC_LOOKBACK_DAYS = 30;
export const lookbackIso = () => new Date(Date.now() - SYNC_LOOKBACK_DAYS * 86400000).toISOString();

// 1) 자동 동기화 섹션: 마지막 확인 뒤 새로 만들거나 고친 페이지를 모두 일정으로
// 2) 손으로 가져온 노트가 있는 섹션: 고친 페이지 중 이미 달력에 있는 것만 갱신
// onImport(items) 는 달력 저장 함수. 반환: { changed: 실제로 바뀐 개수, stats: 기록용 요약 }
// options.sectionIds: 이 섹션만, options.full: lastSync 를 무시하고 최근 30일을 다시 확인,
// options.existingIds: 달력에 있는 일정 id (2번 판단용)
export const runAutoSync = async (userId, onImport, { sectionIds: only = null, full = false, existingIds = null } = {}) => {
  const config = loadAutoSync(userId);
  const syncIds = Object.keys(config).filter(id => !only || only.includes(id));
  const hasImported = existingIds && [...existingIds].some(id => id.replace(/^sh_/, '').startsWith('sch_onenote_'));
  if (syncIds.length === 0 && !hasImported) return { changed: 0, stats: null };
  if (!(await getSignedInAccount())) {
    // 자동 동기화를 켠 적 없이 이 기기에서 로그인 안 했을 뿐이면 조용히 넘어감
    if (syncIds.length === 0) return { changed: 0, stats: null };
    const err = new Error('Microsoft 로그인이 필요합니다.');
    err.code = 'ONENOTE_NEED_LOGIN';
    throw err;
  }

  const tracked = loadTracked(userId);
  const trackIds = hasImported && !only ? Object.keys(tracked).filter(id => !config[id]) : [];

  const shareMap = loadShareMap(userId);
  const items = [];
  const syncDone = {};
  const trackDone = {};
  const seen = loadSeen(userId);
  const synced = [];
  const recheckIso = new Date(Date.now() - RECHECK_DAYS * 86400000).toISOString();
  const recentMs = Date.now() - RECENT_DAYS * 86400000;
  const isImported = (pageId) => existingIds.has(oneNoteScheduleId(pageId)) || existingIds.has(`sh_${oneNoteScheduleId(pageId)}`);

  const stats = { sections: 0, listed: 0, fetched: [], changed: [] }; // 기록용
  const blocked = {}; // 암호로 보호된 섹션 (다음부터 건너뜀)
  const failures = [];
  for (const sectionId of [...syncIds, ...trackIds]) {
    const isSync = Boolean(config[sectionId]);
    const sec = isSync ? config[sectionId] : tracked[sectionId];
    const startedAt = new Date().toISOString();
    // 처음·'지금 동기화'는 최근 30일 전부, 평소에는 최근 7일 중 지난번과 수정 시각이 다른 페이지만
    const firstOrFull = full || !sec.lastSync;
    try {
      let pages = await listPages(sectionId, firstOrFull ? lookbackIso() : recheckIso);
      stats.sections++;
      stats.listed += pages.length;
      if (!firstOrFull) {
        // 수정 시각이 달라진 페이지 + 최근 3일 안에 고친 페이지(최대 15개)
        const recent = pages
          .filter(p => new Date(p.modified).getTime() >= recentMs)
          .sort((a, b) => b.modified.localeCompare(a.modified))
          .slice(0, RECENT_MAX_PER_SECTION)
          .map(p => p.id);
        pages = pages.filter(p => seen[p.id] !== p.modified || recent.includes(p.id));
      }
      if (!isSync) pages = pages.filter(p => isImported(p.id));
      const friendId = sectionFriendId(shareMap, sectionId, sec.notebookShared ? sec.notebookId : null);
      items.push(...await mapLimit(pages, 3, page => buildScheduleItem(page, { dateBasis: sec.dateBasis, friendId })));
      synced.push(...pages);
      stats.fetched.push(...pages.map(p => ({ id: p.id, title: p.title, modified: p.modified })));
      (isSync ? syncDone : trackDone)[sectionId] = startedAt;
    } catch (e) {
      // 한 섹션이 실패해도 나머지 섹션은 계속
      if (e?.code === 'ONENOTE_NEED_LOGIN') throw e;
      if (e?.status === 403) blocked[sectionId] = true;
      else failures.push(e);
      console.warn('OneNote 섹션 동기화 실패:', sectionId, e);
    }
  }

  // onImport 는 실제로 바뀐 일정 id 목록을 돌려줌 (내용이 같으면 저장하지 않음)
  let changed = 0;
  if (items.length > 0) {
    const res = await onImport(items, { silent: true });
    const changedIds = Array.isArray(res) ? res : items.map(i => i.id);
    changed = changedIds.length;
    stats.changed = changedIds;
  }
  if (synced.length > 0) markSeen(userId, synced);

  // 예전에 가져온 노트가 어느 섹션에 있는지 한 번 훑기 (동기화 뒤에, 실패해도 다음에 다시)
  if (hasImported && !only) {
    try {
      await scanTrackedOnce(userId, existingIds);
    } catch (e) {
      console.warn('OneNote 섹션 훑기 실패 (다음에 다시 시도):', e);
    }
  }
  // 설정이 그사이 바뀌었을 수 있으니 lastSync 만 덮어씀
  const latest = loadAutoSync(userId);
  Object.keys(latest).forEach(id => {
    if (syncDone[id]) latest[id] = { ...latest[id], lastSync: syncDone[id], blocked: false };
    else if (blocked[id]) latest[id] = { ...latest[id], blocked: true };
  });
  saveAutoSync(userId, latest);
  const latestTracked = loadTracked(userId);
  Object.keys(trackDone).forEach(id => {
    if (latestTracked[id]) latestTracked[id] = { ...latestTracked[id], lastSync: trackDone[id] };
  });
  Object.keys(blocked).forEach(id => delete latestTracked[id]); // 보호된 섹션은 수정 확인 대상에서 뺌
  saveTracked(userId, latestTracked);
  // 모든 섹션이 다른 이유로 실패했을 때만 오류로 알림 (보호된 섹션은 오류로 치지 않음)
  if (failures.length > 0 && Object.keys(syncDone).length + Object.keys(trackDone).length === 0) throw failures[0];
  return {
    changed,
    // 기록용 요약 (호출한 쪽이 addSyncLog 로 남김)
    stats: {
      sections: stats.sections,
      listed: stats.listed,
      pages: stats.fetched.map(p => ({ title: p.title, modified: p.modified, changed: stats.changed.includes(oneNoteScheduleId(p.id)) })),
      blocked: Object.keys(blocked).length,
      failed: failures.length
    }
  };
};
