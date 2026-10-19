// Microsoft Graph OneNote 연동 (개인 Microsoft 계정, 위임 권한 Notes.Read)
// Azure 앱 등록의 클라이언트 ID 는 VITE_MS_CLIENT_ID 로 주입한다.
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

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

const getToken = async () => {
  const msal = await getMsal();
  const account = msal.getAllAccounts()[0];
  if (!account) throw new Error('Microsoft 로그인이 필요합니다.');
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const res = await msal.acquireTokenPopup({ scopes: SCOPES, account });
      return res.accessToken;
    }
    throw e;
  }
};

const graphFetch = async (url, asText = false) => {
  const token = await getToken();
  const res = await fetch(url.startsWith('http') ? url : `${GRAPH}${url}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* 본문 없음 */ }
    throw new Error(`OneNote 요청 실패 (${res.status}) ${detail}`.trim());
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
    '/me/onenote/sections?$select=id,displayName&$expand=parentNotebook($select=displayName)&$top=100'
  );
  return sections
    .map(s => ({ id: s.id, name: s.displayName, notebook: s.parentNotebook?.displayName || '' }))
    .sort((a, b) => (a.notebook + a.name).localeCompare(b.notebook + b.name, 'ko'));
};

export const listPages = async (sectionId) => {
  const pages = await graphFetchAll(
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime&$orderby=createdDateTime desc&$top=100`
  );
  return pages.map(p => ({
    id: p.id,
    title: p.title || '(제목 없음)',
    created: p.createdDateTime,
    modified: p.lastModifiedDateTime
  }));
};

// 페이지 HTML 본문을 줄바꿈이 살아 있는 일반 텍스트로
export const getPageText = async (pageId) => {
  const html = await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`, true);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('title, style, script').forEach(el => el.remove());
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr').forEach(el => el.append('\n'));
  return (doc.body?.textContent || '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};
