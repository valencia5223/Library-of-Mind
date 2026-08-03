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
