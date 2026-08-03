-- ========================================================
-- [책장 관리 프로그램] Supabase Database Schema SQL
-- Supabase 대시보드 -> SQL Editor -> New Query 에 붙여넣고 Run 클릭!
-- ========================================================

-- 1. 사용자 서재 (Books) 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  cover_url TEXT,
  isbn TEXT,
  total_pages INT DEFAULT 0,
  current_pages INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'TO_READ', -- 'TO_READ' (읽고싶은), 'READING' (읽는중), 'READ' (완독)
  rating INT DEFAULT 0, -- 1~5점
  buy_link TEXT,
  category TEXT DEFAULT '일반',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 생각 저장소 / 구절 수집 (Thought Notes) 테이블 생성
CREATE TABLE IF NOT EXISTS public.book_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE,
  book_title TEXT,
  quote TEXT NOT NULL, -- 마음에 남는 문장
  thought TEXT, -- 나의 생각/감상평
  page_number INT,
  tags TEXT[], -- ['#동기부여', '#인문학']
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 독서 세션 / 타이머 기록 테이블 생성
CREATE TABLE IF NOT EXISTS public.reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.user_books(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL DEFAULT 0, -- 독서 시간 (분 단위)
  pages_read INT DEFAULT 0, -- 읽은 페이지 수
  read_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Row Level Security (RLS) 보안 정책 설정
-- 로그인한 사용자 본인 데이터만 CRUD 가능하게 설정
-- --------------------------------------------------------

-- user_books RLS
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own books"
  ON public.user_books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books"
  ON public.user_books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
  ON public.user_books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
  ON public.user_books FOR DELETE
  USING (auth.uid() = user_id);


-- book_notes RLS
ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes"
  ON public.book_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON public.book_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.book_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.book_notes FOR DELETE
  USING (auth.uid() = user_id);


-- reading_sessions RLS
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.reading_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.reading_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.reading_sessions FOR DELETE
  USING (auth.uid() = user_id);


-- ========================================================
-- [선택/필수] 알라딘 TTB Open API 우회용 DB Proxy SQL 정의
-- 브라우저 CORS 및 ORB (Opaque Response Blocking) 보안 차단을 100% 우회합니다.
-- ========================================================

-- 1. PostgreSQL HTTP 확장 기능 활성화 (Supabase 기본 제공)
CREATE EXTENSION IF NOT EXISTS "http";

-- 2. 알라딘 실시간 베스트셀러 API 프록시 함수 정의
CREATE OR REPLACE FUNCTION public.aladin_bestseller_proxy()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_record RECORD;
  result_json JSON;
  api_url TEXT;
BEGIN
  -- 알라딘 베스트셀러 API URL (ttbkey 하드코딩)
  api_url := 'http://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=ttbcdw2341334001&QueryType=Bestseller&MaxResults=20&start=1&SearchTarget=Book&Cover=Big&Version=20131101&output=js';
  
  -- HTTP GET 수행
  SELECT * FROM http_get(api_url) INTO response_record;
  
  -- content를 JSON으로 파싱
  result_json := response_record.content::json;
  
  RETURN result_json;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;


-- 3. 알라딘 실시간 도서 검색 API 프록시 함수 정의 (정렬 및 페이지네이션 매개변수 추가)
CREATE OR REPLACE FUNCTION public.aladin_search_proxy(
  search_query TEXT,
  start_page INT DEFAULT 1,
  sort_option TEXT DEFAULT 'Accuracy'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_record RECORD;
  result_json JSON;
  api_url TEXT;
BEGIN
  -- MaxResults=30으로 고정하고 start, Sort 파라미터를 동적으로 바인딩
  api_url := 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=ttbcdw2341334001&Query=' 
             || urlencode(search_query) 
             || '&MaxResults=30' 
             || '&start=' || start_page 
             || '&Sort=' || urlencode(sort_option) 
             || '&SearchTarget=Book&Cover=Big&Version=20131101&output=js';
  
  -- HTTP GET 수행
  SELECT * FROM http_get(api_url) INTO response_record;
  
  -- content를 JSON으로 파싱
  result_json := response_record.content::json;
  
  RETURN result_json;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;


-- ========================================================
-- 4. 사용자 공개 프로필 테이블 생성 (이메일로 친구 매핑)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- profiles RLS 설정하여 전체 조회를 허용 (이메일로 친구의 ID 검색 가능)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for profiles" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Allow upsert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);


-- ========================================================
-- 5. 친구 관계 테이블 생성
-- ========================================================
CREATE TABLE IF NOT EXISTS public.user_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- user_friends RLS 설정
ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friends list" 
  ON public.user_friends FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add friends" 
  ON public.user_friends FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete friends" 
  ON public.user_friends FOR DELETE 
  USING (auth.uid() = user_id);


-- ========================================================
-- 6. user_books & book_notes 에 친구 공개용 SELECT RLS 정책 추가
-- ========================================================
DROP POLICY IF EXISTS "Users can view their own books" ON public.user_books;
DROP POLICY IF EXISTS "Users can view own or friends books" ON public.user_books;

CREATE POLICY "Users can view own or friends books" 
  ON public.user_books FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR user_id IN (SELECT friend_id FROM public.user_friends WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their own notes" ON public.book_notes;
DROP POLICY IF EXISTS "Users can view own or friends notes" ON public.book_notes;

CREATE POLICY "Users can view own or friends notes" 
  ON public.book_notes FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR user_id IN (SELECT friend_id FROM public.user_friends WHERE user_id = auth.uid())
  );



