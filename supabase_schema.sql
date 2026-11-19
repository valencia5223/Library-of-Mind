-- ==========================================
-- 🛠️ 1. 맛집 추천 테이블 생성 스크립트
-- ==========================================

create table if not exists restaurants (
  id bigint primary key,                     -- Date.now() 로컬 타임스탬프 고유 ID (기본키)
  name text not null,                        -- 식당 상호명
  member text not null,                      -- 추천 작성자 키 (papa, mama, daughter, makdung, husband)
  region text not null,                      -- 매핑된 행정 구역 (서울, 경기, 부산, 강원)
  category text not null,                    -- 음식 카테고리 (korean, western, asian, cafe)
  rating numeric(3,1) not null,              -- 추천 별점 (0.5 단위, 0.5~5.0)
  recom_menu text default '대표 메뉴',        -- 대표 먹거리 (recomMenu)
  review text not null,                      -- 한줄평 후기
  tags text[] default '{}',                  -- 태그 명세 배열
  address text,                              -- 도로명/지번 주소
  map_url text,                              -- 카카오맵 연결 링크
  coords double precision[] default '{}',    -- [위도, 경도] 좌표값 배열
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 🔒 2. 로우 레벨 보안 정책 (Row Level Security) 설정
-- 온 가족이 공동으로 자유롭게 공유·추가·삭제해야 하므로
-- 로그인 제한 없이 일반 익명(anon) 접근에 모든 권한을 오픈합니다.
-- ==========================================

alter table restaurants enable row level security;

-- (1) 조회 권한: 누구나 볼 수 있도록 설정
drop policy if exists "공개 조회 허용" on restaurants;
create policy "공개 조회 허용" on restaurants 
  for select using (true);

-- (2) 저장 권한: 누구나 저장할 수 있도록 설정
drop policy if exists "공개 저장 허용" on restaurants;
create policy "공개 저장 허용" on restaurants 
  for insert with check (true);

-- (3) 삭제 권한: 누구나 삭제할 수 있도록 설정
drop policy if exists "공개 삭제 허용" on restaurants;
create policy "공개 삭제 허용" on restaurants 
  for delete using (true);

-- (4) 수정 권한: 누구나 수정할 수 있도록 설정
drop policy if exists "공개 수정 허용" on restaurants;
create policy "공개 수정 허용" on restaurants 
  for update using (true) with check (true);

-- ==========================================
-- 📊 3. 초기 기본 소스 데이터 (기본값) 이식
-- 로컬스토리지가 비어 있는 최초 기동 시에도 마더 맛집 4개가 노출되도록
-- Supabase DB 테이블에 다이렉트 이입합니다.
-- ==========================================

insert into restaurants (id, name, member, region, category, rating, recom_menu, review, tags, address, map_url, coords)
values 
  (
    1, 
    '30년 전통 마포설렁탕', 
    'papa', 
    '서울', 
    'korean', 
    5, 
    '특설렁탕, 접시수육', 
    '지방 출장 갔다가 서울 내리는 길에 꼭 들리는 국밥집. 맑고 깊은 국물이 일품이고 잘 익은 깍두기가 끝내준다. 해장하러 들어갔다가 술 생각나게 만드니 다들 조심하게.', 
    array['30년전통', '든든한국밥', '주차가능', '아빠원픽'], 
    '서울특별시 마포구 토정로 312', 
    'https://map.naver.com/v5/search/%EB%A7%88%ED%8F%AC%EC%84%A4%EB%A0%81%ED%83%95', 
    array[37.5407, 126.9458]
  ),
  (
    2, 
    '초록뜰 우렁 쌈밥정식', 
    'mama', 
    '경기', 
    'korean', 
    5, 
    '제육 쌈밥 정식, 우렁 더덕구이', 
    '동네 부모님들 모임 부동의 1위 고정 장소란다. 신선한 유기농 쌈 야채가 무제한이고, 구수한 강된장에 돌솥밥을 올려 싸먹으면 건강해지는 기분이야.', 
    array['신선한쌈채소', '부모님모시기좋음', '예약필수', '엄마추천'], 
    '경기도 고양시 일산동구 일산로 442', 
    'https://map.kakao.com/?q=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EA%B3%A0%EC%96%91%EC%8B%9C%20%EC%9D%BC%EC%82%B0%EB%8F%99%EA%B5%AC%20%EC%9D%BC%EC%82%B0%EB%A1%9C%20442', 
    array[37.6625, 126.7904]
  ),
  (
    3, 
    '생면 파스타 바 ''라비올라''', 
    'husband', 
    '서울', 
    'western', 
    5, 
    '트러플 감자 뇨끼, 화이트 라구', 
    '아내와 결혼기념일에 갔던 골목 속 보석 같은 다이닝 바입니다. 매일 아침 생면을 제면해서 파스타 면이 부드럽고 속이 아주 편안합니다. 다음에 장모님 모시고 꼭 갈 예정입니다.', 
    array['생면파스타', '부드러운소화', '주차협소', '사위강추'], 
    '서울특별시 마포구 연희로1길 59', 
    'https://map.naver.com/v5/search/%EC%97%B0%EB%82%A8%EB%8F%99%20%EB%9D%BC%EB%B9%85%EC%98%AC%EB%9D%BC', 
    array[37.5612, 126.9248]
  ),
  (
    4, 
    '달콤 푸딩 ''오아시스 카페''', 
    'daughter', 
    '부산', 
    'cafe', 
    4, 
    '일본식 수제 커스터드 푸딩, 아인슈페너', 
    '주말에는 1시간 대기가 필수지만, 부드러운 수제 푸딩 한 입 먹으면 피로가 싹 가셔요! 컵도 너무 귀엽고 감성 사진 찍기 딱 좋은 우리 가족 부산 여행 필수 브런치 스폿.', 
    array['에그푸딩', '인스타감성', '웨이팅필수', '딸의추천'], 
    '부산광역시 해운대구 우동1로 38', 
    'https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%EA%B2%BD%EC%83%81%20%ED%95%B4%EC%9A%B4%EB%8C%80%20%EC%98%A4%EC%95%84%EC%8B%9C%EC%8A%A4%20%EC%B9%B4%ED%8E%98', 
    array[35.1645, 129.1587]
  )
on conflict (id) do nothing;

-- ==========================================
-- 🔔 4. 오프라인 웹 푸시 구독 테이블 (push_subscriptions)
-- ==========================================

create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text,
  auth text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table push_subscriptions enable row level security;

drop policy if exists "푸시 구독 전체 조회 및 저장 허용" on push_subscriptions;
create policy "푸시 구독 전체 조회 및 저장 허용" on push_subscriptions
  for all using (true) with check (true);

-- ==========================================
-- ⚡ 5. 부재중 오프라인 흔들기 기록 테이블 (nudge_history)
-- ==========================================

create table if not exists nudge_history (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid,
  sender_email text not null,
  target_user_id uuid not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table nudge_history enable row level security;

drop policy if exists "부재중 흔들기 기록 전체 조회 및 저장 허용" on nudge_history;
create policy "부재중 흔들기 기록 전체 조회 및 저장 허용" on nudge_history
  for all using (true) with check (true);



-- ===== profiles 노출 막기 (2026-11-19): 나·친구만 보기, 친구 추가는 이메일 정확히 일치 1명 RPC =====
-- 친구 추가용: 이메일을 정확히 아는 계정 한 명만 찾는다(전체 목록은 못 봄). 로그인한 사람만.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, email text, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.name from public.profiles p
  where auth.uid() is not null and lower(p.email) = lower(trim(p_email))
  limit 1;
$$;
revoke all on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;
-- profiles: 나와 친구(내가 등록했거나 나를 등록한 사람)만 보인다. 로그인 안 한 접근은 막음.
create or replace function public.profile_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p = auth.uid()
    or exists (select 1 from public.user_friends f
               where (f.user_id = auth.uid() and f.friend_id = p) or (f.friend_id = auth.uid() and f.user_id = p))
  );
$$;
revoke all on function public.profile_visible(uuid) from public, anon;
grant execute on function public.profile_visible(uuid) to authenticated;
drop policy if exists "Allow public select for profiles" on public.profiles;
drop policy if exists profiles_select_self_or_friends on public.profiles;
create policy profiles_select_self_or_friends on public.profiles for select to authenticated using (public.profile_visible(id));
revoke select on public.profiles from anon;

-- ===== Library of Mind 가입 승인 (2026-11-19) =====
-- 승인 여부는 사용자가 바꿀 수 없는 표 lom_members 에 둔다(예전 user_metadata.is_approved 는 본인이 고칠 수 있어 우회됨).
-- 모든 Library 표의 RLS 에 lom_ok()(승인됨)를 더해, 승인 전에는 API 를 직접 불러도 아무것도 읽고 쓸 수 없다.
create table if not exists public.lom_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  approved boolean not null default false,
  rejected boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.lom_members enable row level security;
drop policy if exists lom_members_select on public.lom_members;
create policy lom_members_select on public.lom_members for select to authenticated using (auth.uid() = user_id);
revoke all on public.lom_members from anon, authenticated;
grant select on public.lom_members to authenticated;

-- 기존 Library 사용자(우리 동네 가입자가 아닌 계정)는 승인된 상태로
insert into public.lom_members (user_id, email, approved, approved_at)
select id, email, true, now() from auth.users where coalesce(raw_user_meta_data->>'app', '') <> 'parent-dashboard'
on conflict (user_id) do nothing;

create or replace function public.lom_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lom_members where user_id = auth.uid() and approved);
$$;
create or replace function public.lom_is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where id = auth.uid() and email = 'valencia5223@gmail.com');
$$;
-- 로그인 직후 부름: 내 줄이 없으면 승인 대기로 만들고 승인 여부를 돌려준다
create or replace function public.lom_my_status() returns boolean
language plpgsql volatile security definer set search_path = public, auth as $$
declare ok boolean;
begin
  if auth.uid() is null then return false; end if;
  insert into public.lom_members (user_id, email)
  select id, email from auth.users where id = auth.uid()
  on conflict (user_id) do nothing;
  select approved into ok from public.lom_members where user_id = auth.uid();
  return coalesce(ok, false);
end $$;
create or replace function public.get_pending_approval_users()
returns table (id uuid, email text, full_name text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, m.email, u.raw_user_meta_data->>'full_name', m.created_at
  from public.lom_members m join auth.users u on u.id = m.user_id
  where public.lom_is_admin() and not m.approved and not m.rejected
  order by m.created_at;
$$;
create or replace function public.approve_user_signup(target_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lom_is_admin() then raise exception 'not allowed'; end if;
  update public.lom_members set approved = true, rejected = false, approved_at = now() where user_id = target_user_id;
end $$;
create or replace function public.reject_user_signup(target_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lom_is_admin() then raise exception 'not allowed'; end if;
  update public.lom_members set approved = false, rejected = true, approved_at = null where user_id = target_user_id;
end $$;
revoke all on function public.lom_ok(), public.lom_is_admin(), public.lom_my_status(), public.get_pending_approval_users(),
  public.approve_user_signup(uuid), public.reject_user_signup(uuid) from public, anon;
grant execute on function public.lom_ok(), public.lom_is_admin(), public.lom_my_status(), public.get_pending_approval_users(),
  public.approve_user_signup(uuid), public.reject_user_signup(uuid) to authenticated;

-- 친구 찾기도 승인된 사람만
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, email text, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.name from public.profiles p
  where public.lom_ok() and lower(p.email) = lower(trim(p_email))
  limit 1;
$$;

-- Library 표의 모든 정책에 lom_ok() 를 더한다(한 번만)
do $$
declare r record; q text; c text;
begin
  for r in select * from pg_policies where schemaname = 'public'
    and tablename in ('book_notes','nudge_history','profiles','push_subscriptions','reading_sessions','shared_memos','user_books','user_friends','user_schedules')
  loop
    if coalesce(r.qual, '') like '%lom_ok()%' or coalesce(r.with_check, '') like '%lom_ok()%' then continue; end if;
    q := case when r.qual is null then '' else format(' using ((%s) and public.lom_ok())', r.qual) end;
    c := case when r.with_check is null then '' else format(' with check ((%s) and public.lom_ok())', r.with_check) end;
    if q = '' and c = '' then continue; end if;
    execute format('alter policy %I on public.%I%s%s', r.policyname, r.tablename, q, c);
  end loop;
end $$;

-- ===== 우리 동네 가입자는 Library profiles 에 넣지 않기 (2026-11-19) =====
-- Library 를 쓰게 되면(승인 후) Library 앱이 로그인할 때 자기 프로필을 만든다(App.jsx upsert).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'app', '') = 'parent-dashboard' then return new; end if;
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
delete from public.profiles p using auth.users u
where u.id = p.id and u.raw_user_meta_data->>'app' = 'parent-dashboard'
  and not exists (select 1 from public.lom_members m where m.user_id = u.id and m.approved);
