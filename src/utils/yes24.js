// src/utils/yes24.js - 예스24 Open API (Supabase Edge Function 'yes24' 중계)
// 알라딘 OpenAPI 는 2026-10-30 에 종료됐다. 키는 Supabase Secrets(YES24_API_KEY)에만 있고 브라우저에는 없다.
// 예스24 이용 조건: 책 정보 화면에 '예스24' 출처를 표기하고, 구매 링크는 예스24 상품 페이지로 연결한다.

import { supabase, isSupabaseConfigured } from '../supabaseClient';

// 결과가 없을 때 오는 코드(오류가 아니라 빈 목록)
const EMPTY_CODES = ['SEARCH_001', 'BEST_001', 'GOODS_001'];

async function callYes24(body) {
  if (!isSupabaseConfigured()) throw new Error('서버 연결이 없어 도서 정보를 불러올 수 없습니다.');
  const { data, error } = await supabase.functions.invoke('yes24', { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await error.context?.json?.();
      if (j?.message) msg = j.message;
    } catch { /* 본문이 JSON 이 아니면 기본 메시지 */ }
    throw new Error(msg || '예스24 도서 정보를 불러오지 못했습니다.');
  }
  if (!data?.success) {
    if (EMPTY_CODES.includes(data?.errorCode)) return { items: [], totalCount: 0 };
    throw new Error(data?.message || '예스24 도서 정보를 불러오지 못했습니다.');
  }
  return data.data || { items: [] };
}

const cleanText = (s) =>
  String(s || '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatDate = (d) => {
  const s = String(d || '');
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
};

export const yes24SearchUrl = (title) =>
  `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(title || '')}`;

// 예스24 상품 → 앱의 책 객체
export function toBook(item, { rank = false } = {}) {
  const cd = item.contentDetail || {};
  const intro = cleanText(cd.bookIntroduction);
  const summary = cleanText(cd.bookSummary);
  const pages = parseInt(item.pages, 10);
  return {
    id: `yes24-${item.itemId}`,
    title: item.title || '제목 정보 없음',
    author: item.author || '저자 미상',
    publisher: item.publisher || '',
    cover_url: item.cover || '',
    isbn: item.isbn13 || item.isbn10 || '',
    description: intro || summary,
    toc: cleanText(cd.tableOfContents),
    buy_link: item.link || yes24SearchUrl(item.title),
    rating: item.starScore ? (item.starScore / 2).toFixed(1) : null, // 예스24 평점은 10점 만점
    total_pages: pages > 0 ? pages : null,
    price: item.salePrice ? `₩${Math.round(item.salePrice).toLocaleString()}` : '',
    pub_date: formatDate(item.publishDate),
    category: (item.goodsSortNm || '').split('-').pop() || '',
    bestRank: rank ? item.sortOrder || null : null,
  };
}

// 베스트셀러 (categoryId: 예스24 분류 코드, '001' = 국내도서 종합)
export async function fetchBestsellers(categoryId = '001', pageSize = 20) {
  const data = await callYes24({ action: 'bestseller', categoryId, pageSize });
  return (data.items || []).map((it) => toBook(it, { rank: true }));
}

// 책 검색. sort: DEFAULT(정확도) | RECENT(신간) | RELATION | REG_DTS
export async function searchBooks(query, { page = 1, pageSize = 30, sort = 'DEFAULT' } = {}) {
  const data = await callYes24({ action: 'search', query, page, pageSize, sort });
  return { books: (data.items || []).map((it) => toBook(it)), totalCount: data.totalCount || 0 };
}

// ISBN13(또는 예스24 상품번호)으로 상세 정보(쪽수·소개·목차). 못 찾으면 null
export async function fetchBookDetail(id) {
  const raw = String(id || '').replace(/^[a-z0-9]+-/i, '').replace(/[^0-9Xx]/g, '');
  if (!raw) return null;
  const searchType = raw.length === 13 ? 'ISBN13' : raw.length === 10 ? null : 'ItemId';
  if (!searchType) return null; // ISBN10 은 상세 조회가 안 됨 → 제목 검색으로
  try {
    const data = await callYes24({ action: 'detail', searchType, query: raw });
    const item = data.items?.[0];
    return item ? toBook(item) : null;
  } catch (e) {
    console.warn('예스24 상세 조회 실패:', e);
    return null;
  }
}

// 책 객체로 상세 찾기: ISBN13 → 예스24 상품번호(id 가 yes24-…) → 제목 검색 첫 결과
export async function findBookDetail(book) {
  if (!book) return null;
  const isbn = String(book.isbn || '').replace(/[^0-9Xx]/g, '');
  if (isbn.length === 13) {
    const d = await fetchBookDetail(isbn);
    if (d) return d;
  }
  const m = String(book.id || '').match(/^yes24-(\d+)$/);
  if (m) {
    const d = await fetchBookDetail(m[1]);
    if (d) return d;
  }
  const title = String(book.title || '').split('(')[0].split(' - ')[0].trim();
  if (!title) return null;
  try {
    const { books } = await searchBooks(title, { pageSize: 5 });
    const hit = books.find((b) => isbn && b.isbn === isbn) || books[0];
    return hit?.isbn ? await fetchBookDetail(hit.isbn) : null;
  } catch {
    return null;
  }
}
