// Microsoft Graph OneNote 연동 (개인 Microsoft 계정, 위임 권한 Notes.Read)
// Azure 앱 등록의 클라이언트 ID 는 VITE_MS_CLIENT_ID 로 주입한다.
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { cleanOneNoteHtml } from './noteHtml';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Notes.Read'];
const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID || '';

export const isOneNoteConfigured = () => Boolean(CLIENT_ID);

let msalPromise = null;

const getMsal = () => {
  if (!msalPromise) {
    const msal = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
        // 팝업 로그인 결과를 받는 빈 페이지 (앱 전체가 팝업 안에서 다시 뜨지 않도록)
        redirectUri: `${window.location.origin}/onenote-redirect.html`
      },
      cache: { cacheLocation: 'localStorage' }
    });
    msalPromise = msal.initialize().then(() => msal);
  }
  return msalPromise;
};

export const getSignedInAccount = async () => {
  const msal = await getMsal();
  return msal.getAllAccounts()[0] || null;
};

export const signInMicrosoft = async () => {
  const msal = await getMsal();
  const result = await msal.loginPopup({ scopes: SCOPES, prompt: 'select_account' });
  return result.account;
};

export const signOutMicrosoft = async () => {
  const msal = await getMsal();
  const account = msal.getAllAccounts()[0];
  if (account) await msal.clearCache({ account });
};

// 로그인이 만료돼 다시 로그인 버튼을 눌러야 할 때 던지는 오류 (자동 동기화는 팝업을 띄울 수 없음)
export const NEED_LOGIN = 'ONENOTE_NEED_LOGIN';

const needLoginError = () => {
  const err = new Error('Microsoft 로그인이 만료되었습니다. 다시 로그인해 주세요.');
  err.code = NEED_LOGIN;
  return err;
};

const getToken = async () => {
  const msal = await getMsal();
  const account = msal.getAllAccounts()[0];
  if (!account) throw needLoginError();
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) throw needLoginError();
    throw e;
  }
};

const graphFetch = async (url, asText = false, attempt = 0) => {
  const token = await getToken();
  const res = await fetch(url.startsWith('http') ? url : `${GRAPH}${url}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  // 요청이 몰려 막히면(429/503) 알려 준 시간만큼 쉬었다가 다시
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    const wait = Math.min(Number(res.headers.get('Retry-After')) || 2 ** attempt, 10) * 1000;
    await new Promise(r => setTimeout(r, wait));
    return graphFetch(url, asText, attempt + 1);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* 본문 없음 */ }
    // 403: 암호로 보호된 섹션 등 Microsoft 가 외부 앱에 열어 주지 않는 곳
    const err = new Error(res.status === 403
      ? '암호로 보호된 섹션이라 OneNote 가 내용을 열어 주지 않습니다. OneNote 에서 섹션 암호를 해제해야 가져올 수 있습니다.'
      : `OneNote 요청 실패 (${res.status}) ${detail}`.trim());
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return asText ? res.text() : res.json();
};

// @odata.nextLink 를 따라가며 전체 목록 수집
const graphFetchAll = async (url) => {
  const items = [];
  let next = url;
  while (next) {
    const data = await graphFetch(next);
    items.push(...(data.value || []));
    next = data['@odata.nextLink'] || null;
  }
  return items;
};

// 모든 노트북의 섹션(섹션 그룹 안의 섹션 포함)을 평평한 목록으로
export const listSections = async () => {
  const sections = await graphFetchAll(
    '/me/onenote/sections?$select=id,displayName&$expand=parentNotebook($select=id,displayName,isShared)&$top=100'
  );
  return sections
    .map(s => ({
      id: s.id,
      name: s.displayName,
      notebookId: s.parentNotebook?.id || '',
      notebook: s.parentNotebook?.displayName || '',
      notebookShared: Boolean(s.parentNotebook?.isShared)
    }))
    .sort((a, b) => (a.notebook + a.name).localeCompare(b.notebook + b.name, 'ko'));
};

const toPage = (p) => ({
  id: p.id,
  title: p.title || '(제목 없음)',
  created: p.createdDateTime,
  modified: p.lastModifiedDateTime
});

const pagesUrl = (sectionId, top, extra = '') =>
  `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime&$orderby=createdDateTime desc&$top=${top}${extra}`;

// sinceIso 를 주면 그 뒤에 만들거나 고친 페이지만 (전부 받음, 자동 동기화용)
export const listPages = async (sectionId, sinceIso = null) => {
  const filter = sinceIso ? `&$filter=lastModifiedDateTime ge ${sinceIso}` : '';
  const pages = await graphFetchAll(pagesUrl(sectionId, 100, filter));
  return pages.map(toPage);
};

// 섹션의 모든 페이지 id (가져온 노트가 어느 섹션에 있는지 찾을 때)
export const listPageIds = async (sectionId) => {
  const pages = await graphFetchAll(`/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$select=id&$top=100`);
  return pages.map(p => p.id);
};

// 화면용: 최근 페이지부터 조금씩. next 를 다시 넘기면 다음 묶음
export const listPagesChunk = async (sectionId, next = null, top = 30) => {
  const data = await graphFetch(next || pagesUrl(sectionId, top));
  return { pages: (data.value || []).map(toPage), next: data['@odata.nextLink'] || null };
};

// 페이지 본문: 검색·미리보기용 일반 텍스트(줄바꿈 유지) + 서식을 살린 HTML
export const getPageContent = async (pageId) => {
  const raw = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`, true);
  const parser = new DOMParser();

  const doc = parser.parseFromString(raw, 'text/html');
  doc.querySelectorAll('title, style, script').forEach(el => el.remove());
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr').forEach(el => el.append('\n'));
  const text = (doc.body?.textContent || '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  let html = null;
  try {
    html = cleanOneNoteHtml(parser.parseFromString(raw, 'text/html'));
  } catch (e) {
    console.warn('OneNote 서식 정리 실패 (텍스트만 저장):', e);
  }
  return { text, html };
};
