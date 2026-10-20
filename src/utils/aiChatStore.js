// AI 비서 대화 보관 (이 브라우저의 IndexedDB, 사용자별). 노트 본문이 들어가 커질 수 있어 localStorage 대신 씀
// 대화: { id, userId, title, createdAt, updatedAt, items(화면 말풍선), history(Gemini contents) }
const DB_NAME = 'lom_ai_chat';
const STORE = 'conversations';
const KEEP = 50; // 사용자마다 최근 대화 이만큼만 보관

let dbPromise = null;
const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 를 쓸 수 없습니다.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
};

const run = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const newConversationId = () => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// 최근 것부터 (목록용으로 items·history 는 뺌)
export const listConversations = async (userId) => {
  const all = (await run('readonly', store => store.index('userId').getAll(userId || 'demo'))) || [];
  return all
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(({ id, title, createdAt, updatedAt, items }) => ({ id, title, createdAt, updatedAt, count: (items || []).filter(i => i.role === 'user').length }));
};

export const getConversation = (id) => run('readonly', store => store.get(id));

export const saveConversation = async (conv) => {
  await run('readwrite', store => store.put({ ...conv, userId: conv.userId || 'demo', updatedAt: Date.now() }));
  // 오래된 대화 정리
  const list = await listConversations(conv.userId);
  const old = list.slice(KEEP);
  if (old.length > 0) await run('readwrite', store => old.forEach(c => store.delete(c.id)));
};

export const deleteConversation = (id) => run('readwrite', store => store.delete(id));

// 마지막으로 보던 대화 (다른 메뉴에 갔다 와도 이어서)
const activeKey = (userId) => `ai_chat_active_${userId || 'demo'}`;
export const getActiveConversationId = (userId) => {
  try {
    return localStorage.getItem(activeKey(userId));
  } catch {
    return null;
  }
};
export const setActiveConversationId = (userId, id) => {
  try {
    if (id) localStorage.setItem(activeKey(userId), id);
    else localStorage.removeItem(activeKey(userId));
  } catch { /* 무시 */ }
};
