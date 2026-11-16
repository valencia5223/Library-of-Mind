// supabase/functions/yes24/index.ts - 예스24 Open API 중계 (알라딘 OpenAPI 는 2026-10-30 종료)
//
// 키는 소스·브라우저에 두지 않는다(예스24 규정). Supabase Secrets 로만 주입:
//   supabase secrets set YES24_API_KEY=...   (developers.yes24.com 에서 발급)
// 로그인한 사용자만 호출(config.toml 에서 verify_jwt = true).
// body: { action: 'bestseller' | 'search' | 'detail' | 'categories', ... }
// 응답은 예스24 응답을 그대로 돌려준다({ success, message, data, errorCode }).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://apis.yes24.com/v1';

// 같은 요청은 10분 동안 다시 부르지 않는다(한도 절약, 인스턴스가 살아 있는 동안만)
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; body: string; status: number }>();

const json = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clampInt = (v: unknown, def: number, min: number, max: number) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// action 별로 허용한 경로·파라미터만 보낸다
function buildRequest(b: any): { path: string; params: Record<string, string> } | null {
  switch (b?.action) {
    case 'bestseller': {
      const kind = ['bestseller', 'bestsellerRealtime', 'bestsellerSteady'].includes(b.kind) ? b.kind : 'bestseller';
      const params: Record<string, string> = {
        categoryId: /^\d{3,20}$/.test(String(b.categoryId || '')) ? String(b.categoryId) : '001',
        detail: 'N',
      };
      if (kind !== 'bestsellerRealtime') {
        params.page = String(clampInt(b.page, 1, 1, 50));
        params.pageSize = String(clampInt(b.pageSize, 20, 1, 100));
      }
      return { path: `/category/${kind}`, params };
    }
    case 'search': {
      const query = String(b.query || '').trim().slice(0, 100);
      if (!query) return null;
      const sort = ['DEFAULT', 'RELATION', 'RECENT', 'REG_DTS'].includes(b.sort) ? b.sort : 'DEFAULT';
      return {
        path: '/goods/itemList',
        params: {
          query,
          category: 'BOOK',
          sort,
          page: String(clampInt(b.page, 1, 1, 50)),
          pageSize: String(clampInt(b.pageSize, 30, 1, 100)),
          detail: 'N',
        },
      };
    }
    case 'detail': {
      const query = String(b.query || '').replace(/[^0-9Xx]/g, '');
      if (!query) return null;
      const searchType = b.searchType === 'ItemId' ? 'ItemId' : 'ISBN13';
      return { path: '/goods/itemDetail', params: { searchType, query, detail: 'Y' } };
    }
    case 'categories': {
      const params: Record<string, string> = {};
      if (/^\d{3,20}$/.test(String(b.categoryId || ''))) params.categoryId = String(b.categoryId);
      return { path: '/category/list', params };
    }
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('YES24_API_KEY');
  if (!apiKey) return json({ success: false, message: 'YES24_API_KEY 가 Supabase Secrets 에 없습니다.', errorCode: 'NO_KEY' }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: '잘못된 요청입니다.', errorCode: 'BAD_REQUEST' }, 400);
  }

  const built = buildRequest(body);
  if (!built) return json({ success: false, message: '지원하지 않는 요청입니다.', errorCode: 'BAD_REQUEST' }, 400);

  const url = `${BASE}${built.path}?${new URLSearchParams(built.params)}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.body, hit.status);

  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } });
    const text = await res.text();
    // 결과 없음(404)은 오류가 아니라 빈 목록으로 돌려준다
    const status = res.status === 404 ? 200 : res.status;
    if (res.ok) {
      cache.set(url, { at: Date.now(), body: text, status });
      if (cache.size > 300) cache.delete(cache.keys().next().value!);
    }
    return json(text || '{}', status);
  } catch (e) {
    return json({ success: false, message: `예스24 연결 실패: ${(e as Error).message}`, errorCode: 'UPSTREAM_UNAVAILABLE' }, 502);
  }
});
