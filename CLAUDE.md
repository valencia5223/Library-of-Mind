# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 구성

하나의 git 저장소에 서로 독립된 여러 프로젝트가 들어 있다. 각 프로젝트는 자체 `package.json` / 의존성을 가지며 서로 코드를 공유하지 않는다. 작업 전에 어느 프로젝트인지 먼저 확인할 것.

| 경로 | 설명 | 스택 |
|---|---|---|
| `/` (루트) | **Library of Mind** — 독서 서재 + 일정관리(OneNote 연동)/친구 등 (라이브: library-of-mind.onrender.com) | React 19 + Vite 5 + Supabase |
| `baby-play-studio/` | 유아용 놀이 앱 (동물·과일·차량 소리/퀴즈, 실로폰, 그림그리기, 동요 등) | React 18 + Vite 5 (백엔드 없음) |
| `Family_MatZip/` | 가족 맛집 앱. Library of Mind와 무관한 별개 프로젝트이므로 루트 앱 작업 시 참고하지 않는다 | React 19 + Vite |
| `lotto-gacha/` | 로또 6/45 캡슐 뽑기 (당첨 번호 분석 + 번호 뽑기) | React 19 + Vite 5 (백엔드 없음) |
| `yuna_nutrition_tracker/` | 영양/수면 기록 웹앱 | Flask + Supabase + Gemini, gunicorn 배포 |
| `flask_app/` | DB 쿼리/프로시저 분석 데스크톱 도구 | Flask, PyInstaller exe |
| `road_to_threez/`, `creep_company_game/`, 루트 `game.py`/`sprites.py` | 파이썬 게임 | pygame, PyInstaller(`.spec`) |

루트의 `tmp_*.js` / `tmp_*.py` 는 Supabase 확인용 일회성 스크립트다.

## 명령어

JS 프로젝트(루트, `baby-play-studio/`, `Family_MatZip/`)는 각 디렉터리에서:

```bash
npm install
npm run dev       # Vite 개발 서버
npm run build     # dist/ 로 빌드
npm run lint      # ESLint (루트, Family_MatZip만 설정됨)
```

테스트 프레임워크는 없다. 변경 검증은 `npm run build` 성공 여부와 dev 서버에서 직접 확인하는 방식으로 한다.

시스템 Node는 v18.12.1. `node-portable/node-v20.15.0-win-x64` 에 포터블 Node 20이 있다(필요 시 사용).

Python 프로젝트: `yuna_nutrition_tracker/requirements.txt`, 로컬 실행은 `python app.py` 또는 `run.bat`. exe 빌드는 각 폴더의 `build_exe.py` / `.spec`.

## 배포

- Render 정적 사이트. 루트 `render.yaml` 과 `baby-play-studio/render.yaml` 모두 **baby-play-studio** 를 빌드하도록 되어 있다(루트 버전은 `cd baby-play-studio` 후 빌드).
- SPA 라우팅을 위해 `/* → /index.html` rewrite 사용. 루트 앱은 `public/_redirects` 도 가지고 있다.

## 루트 앱 (Library of Mind) 아키텍처

- `src/App.jsx` 가 상위 상태(사용자, `books`/`notes`/`sessions`, `activeTab`)와 대부분의 Supabase CRUD를 가지고, 탭별 컴포넌트(`src/components/`)에 props로 내려준다. 탭: `schedule`(기본), `bookshelf`, `search`, `focus`, `stats`, `social`. (맛집지도 `places` 탭·카카오맵·메모장 장소 공유는 삭제됨. DB 의 `shared_restaurants` 테이블은 남아 있지만 코드에서 안 씀) 모달류는 App 상태 플래그로 열고 닫는다.
- 친구 서재 보기: `viewedFriend` 가 설정되면 같은 뷰가 친구의 `user_id` 데이터로 다시 로드된다.
- Supabase 클라이언트는 `src/supabaseClient.js` (placeholder 대체값 + `isSupabaseConfigured()`)를 모든 코드가 사용한다. `isSupabaseConfigured()` 가 false면 데모 모드로 localStorage에만 저장한다. (`src/supabase.js`, `src/mockData.js` 는 어디서도 import하지 않는 미사용 파일)
- 낙관적 업데이트로 임시 id(`b-`/`n-`/`s-` + timestamp)를 먼저 넣고, insert 후 `.select().single()` 결과로 실제 UUID로 교체한다(`replaceTempId`). 새 insert 흐름도 이 패턴을 따를 것.
- 스키마 SQL 파일에 없는 테이블/RPC가 코드에서 쓰인다: `user_schedules`, `user_profiles`, RPC `get_pending_approval_users`, `approve_user_signup`. 실제 정의는 Supabase 대시보드에서 확인할 것.
- 디자인(모던 미니멀): 색·크기는 `src/index.css` 맨 위 `:root` 토큰(`--primary` 인디고 #4f46e5, `--text-main`, `--border-color`, `--bg-subtle`, `--btn-h` 36px 등)만 쓴다. 회색은 zinc 계열, 포인트 색은 인디고 하나. 버튼은 `.btn` + `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-danger` + 크기 `btn-sm`(30)/`btn-xs`(26)/`btn-lg`(44)로만 꾸미고 인라인 style 로 색·높이·모서리·그라데이션을 주지 않는다(레이아웃 속성만). 탭·토글은 회색 바 위 흰 세그먼트(`.nav-tab-capsule`, `.toggle-group`). `index.css` 끝부분 '디자인 시스템'·'유틸리티 클래스' 섹션이 앞 규칙보다 우선한다. 글꼴 Pretendard(index.html CDN). `src/App.css` 는 삭제됨(어디서도 import 안 하던 맛집 화면용).
- 환경변수: `.env` 의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MS_CLIENT_ID`(OneNote 연동용 Azure 앱 클라이언트 ID).
- OneNote 가져오기: 일정 달력 헤더의 OneNote 버튼 → `OneNoteImportModal`(lazy 로딩) → `src/utils/oneNote.js`(MSAL 팝업 로그인, 개인 계정 `consumers`, 위임 권한 `Notes.Read`, Graph 호출). 팝업 리디렉트는 `public/onenote-redirect.html`. 페이지는 id `sch_onenote_<페이지id>` 일정으로 upsert 되므로 다시 가져오면 덮어쓴다. 섹션마다 공유할 앱 친구를 한 번 고르면(`onenote_notebook_share_<userId>`, 키=섹션 id, `'none'`=공유 안함, 없으면 예전 노트북 id 설정을 따름 `sectionFriendId`) 가져오기·자동 동기화 모두 shared_friend_id 로 공유된다. 제목에 날짜(10/19, 10월 19일, 2026-10-19)가 있으면 그 날짜로 넣는다(`parseTitleDate`). 자동 동기화를 켜면 최근 30일부터 확인하고, 이후에는 최근 7일 안에 수정된 페이지 중 마지막으로 반영한 수정 시각(`onenote_seen_<userId>`, `markSeen`)과 다른 것 + 최근 3일 안에 고친 페이지(목록의 수정 시각이 캐시돼 늦게 바뀔 수 있어서, 섹션당 15개)만 본문을 받아, 제목·메모·날짜·공유가 실제로 바뀐 것만 저장한다. 메모는 최대 50000자. 실행마다 `onenote_synclog_<userId>` 에 기록(최근 20번)하고 가져오기 창의 '동기화 기록'에서 본다. 원본 서식: `src/utils/noteHtml.js`(`cleanOneNoteHtml` 이 글꼴·크기·색·목록·표·띄어쓰기만 남기고 위치·이미지는 버림, DOMPurify)로 정리한 HTML 을 `user_schedules.memo_html`(암호화, 대시보드에서 `alter table user_schedules add column if not exists memo_html text;` 로 추가하는 칸)에 저장. 목록·로컬 캐시에는 넣지 않고 일정 창을 열 때 그 한 건만 읽어 `NoteRichView`(lazy)로 보여 준다(원본 서식/텍스트 전환). 칸이 없으면 오류 없이 텍스트만 저장. 서식 변경 감지는 `onenote_html_hash_<userId>`. 텍스트 메모(`noteDocToText`)에는 취소선을 `~~글자~~`, 할 일 태그를 ☑/☐ 로 남긴다. AI 비서는 OneNote 노트 본문을 memo_html 에서 다시 뽑아(`loadNoteText`) 이 기능 전에 가져온 노트의 취소선도 본다. 자동 동기화를 켜지 않은 섹션이라도 손으로 가져온 노트가 있으면(`onenote_tracked_<userId>`, 가져올 때 `trackSection`, 이 기능 전 가져온 노트는 `scanTrackedOnce` 가 한 번 모든 섹션을 훑어 기록) 같은 주기로 확인해 이미 달력에 있는 노트의 수정만 반영한다(새 노트는 안 가져옴). 친구가 공유해 준 노트(user_id 가 내가 아님)는 대상에서 뺀다. 노트 위치(노트북 › 섹션 그룹 › 섹션, `sectionPath`)는 `user_schedules.onenote_path`(암호화, 대시보드에서 `alter table user_schedules add column if not exists onenote_path text;` 로 추가하는 칸, 없으면 `onenote_paths_<userId>` 로 이 브라우저에만)에 저장해 일정 창·찾기·모아보기·달력 칩 툴팁·AI 비서(`onenote_location`)에 보여 준다. 이 기능 전에 가져온 노트는 자동 동기화 때 `fillPathsOnce` 가 한 번 모든 섹션을 훑어 채운다. `persistSchedule` 은 일정 객체를 통째로 upsert 하므로 DB 에 없는 칸을 넣으면 저장 전체가 실패한다(새 칸은 빠져도 저장되게 할 것). OneNote 일정은 시간 없이 넣고(DB 에는 null, 실패 시 00:00) 화면 어디에도 시간을 보여 주지 않는다(`isOneNoteId`). 달력 헤더 '찾기·모아보기'(`ScheduleNotesPanel`, lazy)는 OneNote 노트/전체 일정을 월별로 모아 제목·메모 검색(여러 단어 AND, 강조)하고, 누르면 그 달로 이동해 일정 창을 연다. 섹션별 자동 동기화(`onenote_autosync_<userId>`, `src/utils/oneNoteSync.js` 의 `runAutoSync`)는 일정 화면을 열 때·3분마다·탭으로 돌아오거나 창을 클릭할 때(`focus`, 30초 간격 제한) lastSync 뒤에 고친 페이지를 가져온다. 토큰은 조용히만 받고(만료 시 `NEED_LOGIN` → 버튼이 'OneNote 다시 연결'), MSAL 묶음은 자동 동기화 섹션이 있을 때만 불러온다.
- 주요 테이블: `user_books`, `book_notes`, `reading_sessions`, `user_schedules`, `user_friends`, `shared_memos`, `profiles`, `push_subscriptions`. 스키마는 `supabase_schema.sql`, `supabase_bookshelf_schema.sql`.
- `user_books` 업데이트는 DB에 없는 컬럼 때문에 실패할 수 있어, App.jsx 에서 "안전 필드"만 먼저 저장하고 추가 필드를 따로 저장하는 폴백 패턴을 쓴다. 컬럼을 추가할 때 이 흐름을 유지할 것.
- AI 일정 비서: 달력 헤더 'AI 비서' → `AiChatPanel`(lazy, 오른쪽 패널) → `src/utils/aiAssistant.js` 의 `runAssistantTurn` 이 Supabase Edge Function `supabase/functions/ai-chat`(Google Gemini REST `generateContent`, 무료 등급, 모델은 Secrets `GEMINI_MODEL` 없으면 `gemini-3.5-flash`(-latest/preview 는 무료 등급에서 1분 넘게 걸려 안 씀, 한도(429)·과부하(5xx)·없는 모델(404)이면 `FALLBACK_MODELS`(3.5-flash-lite → 3.1-flash-lite → flash-lite-latest, 무료 한도가 모델마다 따로)로 차례로 넘기고 이때 thoughtSignature 는 `skip_thought_signature_validator` 로 바꿔 보냄, 429 는 하루/분 한도를 구분해 안내, 생각 시간은 최소로, 쓸 수 있는 모델은 body `{list_models:true}`), `verify_jwt = true`, 키는 Secrets `GEMINI_API_KEY`)을 부른다. 함수는 시스템 프롬프트·도구 정의만 고정해 한 번씩 중계하고, 도구(`search_schedules`(결과 30개·60000자 이하면 본문 전체 포함, 여러 단어면 `matches_per_word`)·`read_note`·`read_notes`(최대 20개)·`add_schedule`·`update_schedule`·`delete_schedule`)는 브라우저가 `createScheduleTools` 로 사용자 권한에서 실행한다(수정·삭제는 `window.confirm`, 친구가 공유해 준 일정은 수정 불가). 저장은 `ScheduleCalendarView` 의 `persistSchedule`/`removeSchedule` 을 같이 쓴다. 대화 기록은 Gemini `contents` 형식이고 받은 parts(`thoughtSignature` 포함)를 고치지 않고 뒤에만 덧붙여 다시 보낸다(도구 결과는 `functionResponse`, 안전 필터 차단 시 그 질문은 기록에서 뺀다). 사용자 메시지 앞에 `[오늘: YYYY-MM-DD (요일) HH:MM]` 을 붙여 날짜 기준을 준다. 대화는 `src/utils/aiChatStore.js`(IndexedDB `lom_ai_chat`, 사용자별 최근 50개, 마지막 대화 id 는 localStorage `ai_chat_active_<userId>`)에 말풍선(items)과 Gemini 기록(history)을 함께 저장해, 다른 메뉴에 갔다 와도 이어지고 '지난 대화'에서 다시 열어 이어서 묻는다. 기기 간 동기화는 안 됨. 엑셀 첨부: 비서 창 헤더 엑셀 버튼 → `src/utils/excelSource.js`(IndexedDB `lom_excel`, 사용자당 1개). 시트는 월별, C열이 날짜(엑셀 날짜·'10/19'·'2026-10-20'·일만 적은 칸은 시트 이름의 월로, 병합·빈 칸은 위 줄 날짜를 이어 씀), C열 날짜 첫 줄 위의 줄을 머리글로 쓴다. 파싱은 SheetJS(`xlsx`, npm 의 옛 버전 말고 cdn.sheetjs.com tarball, 도구를 부를 때만 불러옴). Chrome·Edge 는 `showOpenFilePicker` 핸들을 같이 저장해 도구를 부를 때마다 원본을 다시 읽고(권한은 '엑셀/일지' 가 들어간 메시지를 보낼 때나 '연결' 버튼에서 받음), 안 되면 마지막 사본을 쓴다. 도구 `search_excel`(날짜 범위·검색어, 0건이면 가까운 기록 날짜). '엑셀 요약' 은 오늘 날짜 줄을 업체명별 번호 목록(`1. 업체명` → `1) 내용` → `- 비고`, 셀 내용 그대로)으로 정리하도록 시스템 프롬프트에 규칙이 있다.
- 실시간 기능은 Supabase Realtime 채널 사용(예: `global_user_nudge:${user.id}`).
- 웹 푸시: `src/utils/webPush.js` → `public/sw.js` 서비스워커 등록, 발송은 Supabase Edge Function `supabase/functions/send-push/index.ts` (`verify_jwt = false`). VAPID 키는 Supabase Secrets(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)로만 주입하며 소스에 하드코딩하지 않는다. 클라이언트 공개키는 `VITE_VAPID_PUBLIC_KEY`.

## lotto-gacha 아키텍처

- 다른 프로젝트와 무관한 별도 앱. 당첨 결과는 `scripts/update-draws.mjs` 가 동행복권(개편 후 비공식 주소 `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=N` 이 N 근처 10회차, 최신 회차는 `/lt645/result` 의 `id="opt_val"`)에서 받아 `public/draws.json`(행 = [회차, 날짜, 번호 6개, 보너스, 1~5등 당첨자 수, 총판매액])에 새 회차만 덧붙인다. `npm run build` 전에 자동 실행(네트워크 실패 시 기존 데이터로 진행). 브라우저는 CORS 때문에 직접 못 부르므로 개발/preview 서버의 `/dh` 중계로 새 회차를 더 확인한다(정적 배포에서는 draws.json 만).
- 모든 조합의 당첨 확률은 같으므로 '예측'은 하지 않는다. `src/lotto.js` 의 인기도 모델: 600회 이후 회차의 판매량 대비 3·4·5등 당첨자 수(로그, 표준화)를 번호 45개 + 무늬 4개(연속, 모두 31 이하, 한 십 단위 4개+, 같은 끝자리 3개+)로 릿지 회귀. 앞 80% 학습→뒤 20% 상관 약 0.70. '덜 겹치는 번호' 모드는 인기 낮은 번호 가중치 + 무늬 벌점으로 뽑되 무작위 조합 대비 인기도 하위 30% 이하인 조합만 쓴다(`planSet`, 한 판 6개를 미리 정하고 레버마다 하나씩 공개). 핫/콜드/무작위는 재미용이라고 화면에 밝힌다. 난수는 `crypto.getRandomValues`.
- 저장한 조합은 localStorage `lotto_gacha_saved_v1`, 추첨 뒤 데이터가 들어오면 등수를 보여 준다.
- 배포: Render 정적 사이트(Root Directory `lotto-gacha`, Build `npm install && npm run build`, Publish `dist`, Rewrite `/dh/*` → `https://www.dhlottery.co.kr/*`). 설정은 `lotto-gacha/render.yaml`. 루트 `render.yaml` 은 baby-play-studio 용이라 건드리지 않는다. main 에 push 할 때마다 다시 빌드되며 그때 새 회차를 받는다.

## baby-play-studio 아키텍처

- Library of Mind와 무관한 별개 프로젝트다. 루트 `src/` 코드를 import하지 않고, 루트 앱도 이 프로젝트를 참조하지 않는다. 한쪽 작업 시 다른 쪽은 참고하지 않는다.
- **`baby-play-studio/` 는 자체 `.git` 을 가진 별도 저장소다** (`github.com/valencia5223/baby-play-studio`). Render 배포(baby-play-studio.onrender.com)는 이 저장소의 `main` push 로 자동 진행된다. 커밋·push 는 반드시 `baby-play-studio/` 안에서 할 것 — 루트에서 하면 Library-of-Mind 저장소에만 들어가고 배포되지 않는다. 작업 전에 `git -C baby-play-studio fetch` 로 다른 곳에서 push 된 커밋이 있는지 확인한다.
- 루트 `public/vehicles/` 는 루트 앱에서 사용하지 않는 사본이다. baby-play-studio는 자체 `baby-play-studio/public/vehicles/` 를 사용한다.
- 사실상 전체 앱이 `baby-play-studio/src/App.jsx` 한 파일(약 7,000줄)에 있다. 순서대로:
  1. `BabySoundEngine` 클래스(싱글턴 `audioEngine`) — Web Audio 합성음, mp3 재생, TTS. iOS Safari의 AudioContext suspended 문제를 `ensureAudioContext()` 와 첫 터치 시 unlock 핸들러로 처리한다. 소리 관련 코드는 반드시 이 엔진을 거칠 것.
  2. 콘텐츠 데이터 배열: `REAL_ANIMALS`, `REAL_FRUITS`, `REAL_VEHICLES`, `RAINBOW_PAINTS`, `TRACING_TEMPLATES`, `STAMP_ITEMS`, `FEEDABLE_ANIMALS` 등. 항목 추가는 보통 여기에 객체 하나를 추가하는 것으로 끝난다.
  3. SVG 일러스트/서브뷰 컴포넌트(`XylophoneChoirView`, `BedtimeSleepView` 등).
  4. `export default function App()` — `activeTab` 으로 탭 전환: `cards`, `ocean`, `farm`, `train`, `puzzle`, `paint`, `song`. 동물·과일·탈것은 상단 탭 '생생 카드'(`cards`, 고르기 화면) 하나로 모여 있고, 그 안에서 고르면 `activeTab` 이 예전 id(`animal`·`fruit`·`vehicle`, `CARD_CATEGORIES`)가 된다(`enterCardTab`).
- 음성 안내: 모든 문장은 `src/voiceLines.js` 의 `VOICE` 빌더로 만들고 `speakNaturalKorean()` 으로 재생한다. 남성 아나운서(Edge TTS `ko-KR-InJoonNeural`) MP3가 `public/voice/<해시>.mp3` 로 미리 생성돼 있고(목록: `src/voiceIndex.json`), 없으면 브라우저 TTS로 대체된다. 문장·동물·과일을 바꾸면 `npm run voices` 를 다시 실행할 것. **시스템 Node 18에서는 모든 문장이 실패하므로** 포터블 Node 20으로 실행한다: `..\node-portable\node-v20.15.0-win-x64\node.exe scripts/generate-voices.mjs`. 과일 하나를 추가하면 먹이기 게임 조합 때문에 음성이 수십 개 늘어난다. 음성은 항상 하나만 재생(새 음성이 이전 음성을 끊음)하며, 화면을 떠난 뒤 실행되면 안 되는 음성 타이머는 `audioEngine.later()` 를 쓴다(`interruptVoice()`/`stopAllSounds()` 시 취소).
- 동요 목록은 `import.meta.glob('/public/music/*.mp3')` 로 자동 생성된다. 곡 추가 = `public/music/` 에 mp3 추가(파일명 앞 숫자는 정렬용이며 제목에서 제거됨). 동요는 탭을 바꿔도 계속 나오고, 한 번 틀면 헤더에 미니 플레이어(`songPlayerOn`: 제목·이전·재생/일시정지·다음·끄기)가 생긴다. 연속 재생·셔플은 ref(`autoNextRef`·`shuffleRef`)로 `onended` 에 반영, 음소거 버튼이 동요도 끈다. `public/songs_code.js`, `songs_data.json` 은 예전 방식의 산출물이다.
- 이미지는 `src/assets/`(과일, import) 또는 `public/`(`animals/`, `vehicles/`, URL 경로)에 둔다. 실제 사진을 쓸 때는 대상과 일치하는지 검증된 이미지를 사용하고, 외부 출처 사진은 `baby-play-studio/IMAGE_CREDITS.md` 에 작성자·라이선스를 기록한다.
- 동물 항목에 `soundUrl`(울음소리 MP3)이 없으면 `soundText` 를 음성 안내로 읽는다(기린·공룡 등).
- `ocean` 탭은 "내 어항" 다마고치형 게임으로, App.jsx 밖의 별도 파일이다(App 은 `<AquariumGame>` 에 `audioEngine`·`speakNaturalKorean` 을 props 로 넘김).
  - `src/aquariumData.js`: 물고기·바다 친구 종류(`FISH_SPECIES`, 그림 파라미터 포함)·장식, 성장/컨디션 규칙(`RATES`, `growFactor`), 보상(`REWARDS`), localStorage 저장(`bps_aquarium_v1`)·꺼둔 시간 따라잡기(`catchUpOffline`). 저장 형식을 바꾸면 `version` 을 올리고 이전 데이터 변환을 넣을 것.
  - `src/AquariumGame.jsx`: 캔버스(물고기 `drawFish`·바다 친구 `drawCreature`·장식 `drawDecor`·자갈·거품) + WebGL 빛 레이어(물결 빛무늬·햇살, `mix-blend-mode: screen`) + 이끼/탁한 물 오버레이 캔버스. 위치는 매 프레임 ref 로 갱신(React 리렌더 없음), 상단 상태(조개·물 깨끗함)만 0.4초마다 state 로 반영.
  - 규칙: 물고기마다 배부름·기분, 어항 전체 물 더러움 → 컨디션 → 성장 속도(슬프면 멈춤, 죽지 않음). 밥은 한 번에 한 그릇(남아 있으면 더 못 줌). 청소 모드에서 문질러 이끼·똥 제거, 물갈이로 물 더러움 0. 비파(`algaeEater`)는 유리 이끼를 먹고, 이끼가 없으면 바닥·옆 유리벽에 빨판으로 붙어(`r.anchor`, 벽에서는 머리 위로) 오래 쉬다가 자리를 옮긴다. `nocturnal` 이라 밤에 자지 않고 더 부지런하다. 코리도라스(`forager`)는 바닥에서 코를 박고 모래를 훑으며(`r.pose` 기울기, `s.sand` 모래 알갱이) 가끔 수면으로 올라가 숨을 쉰다. `bottomFeeder` 는 많이 배고프지 않으면 가라앉은 밥만 먹는다. 정보 카드는 물고기가 아닌 곳을 누르면 닫힌다. 바다 친구(게·문어·상어 등, `sea: true`)도 `FISH_SPECIES` 항목이라 물고기와 똑같이 밥·병·이름·번식·자연으로 보내기가 된다(`crawl`: 바닥을 기며 가라앉은 밥만 먹음, `upright`: 몸을 기울이지 않음). 예전 저장의 `game.friends` 는 `loadGame` 에서 `game.fish` 로 옮긴다(`fish` → `clownfish`). 상점은 '물고기·바다 친구' / '장식' 두 탭. 물고기마다 암수(`sex`)가 있고, 같은 종류의 다 큰 수컷이 있으면 컨디션 좋은 다 큰 암컷이 가끔 임신(`preg` 0→1, `mateStatus`)해 배가 불러온다. `breedOf` 로 난태생(구피·플래티: 새끼, 한 번 짝짓기하면 수컷 없이도 가끔 임신)과 알(바닥 `game.eggs` → 깨어남)을 구분. 실제 시계로 저녁 8시~아침 7시는 밤(`isNightTime`). 밤에 `SLEEP_IDLE_SEC`(30초) 동안 사용자 동작(화면·버튼 터치, 키 입력)이 없으면 `s.sleeping` 이 되어, 밥을 쫓거나 놀란 게 아니면 물고기가 아래쪽에서 눈을 감고 잔다(`r.asleep`, zZ 는 오버레이에). 다시 만지면 깬다. 자는 물고기를 누르면 깨우지 않고 `VOICE.aquaSleepTap()` + 정보 카드(😴)를 보여 준다. 정보 카드(`data-quiet`) 조작도 깨우지 않는다. 가족: 아기는 `mom`·`dad`(uid)와 그때 이름 `momName`·`dadName` 을 저장하고, 다 크기 전(growth<0.8)엔 엄마를 따라다니며 밤엔 엄마 옆에서 잔다. 물고기를 누르면 쓰다듬기(기분+15, 3초마다 조개+1). 물고기는 놀 때 가끔 랜덤으로 아프고(꺼둔 동안에도 `offlineSickMul` 비율로)(`sick`, `RATES.sickPerSec`·`sickMax`, `isSad` 에 포함되어 성장 멈춤) 상단 🩹 치료 버튼(모드 `heal`) 후 그 물고기를 누르면 낫는다.
  - 새 물고기 = `FISH_SPECIES` 항목 추가(필요하면 `drawFish` 의 shape 분기). 새 바다 친구 = `FISH_SPECIES` 에 `sea: true` 항목 + `drawCreature` 분기 + `CREATURE_SHAPES`. 새 장식 = `DECOR_ITEMS` + `drawDecor` 분기 + `DECOR_BOX` 크기. 이름이 음성 문장에 들어가므로 추가 후 음성을 다시 생성할 것.
  - 특별 행동 플래그(FISH_SPECIES): `frog`(growth 로 올챙이→개구리 그림이 바뀜, 개구리라고 부르는 성장 80%에 변신 완성, `stageNames`·`babyName`·`growLines`·`infoLines` 로 단계 이름과 안내 문장을 종류별로 바꿈. 개체를 부를 때는 `speciesOf(개체)` 를 써서 다 크기 전엔 `babyName`(올챙이)으로 부른다), `hermit`(소라게: 놀라면 `r.hideT` 로 껍데기 속, 단계가 바뀌면 `startHouseMove` 로 `s.shells` 의 새 껍데기로 이사), `jumper`(돌고래: `r.jump` dive→rise→air 포물선, `splashAt` 물보라), `swim`(게: 배고프면 `r.swimming` 으로 헤엄). `tailFlip`(가재: 놀라면 `r.flipT` 동안 앞을 본 채 뒤로 튕김, 누르면 `r.clawT` 집게 번쩍), `otter`(수달: `r.otterFloat` 이면 수면에 배를 위로 하고 떠서 조개 톡톡, 그림은 `o.backFloat`), `lieDown`(광어: 바닥에 엎드려 쉬고, 그림은 `o.lie` 로 몸을 납작하게 눕혀 그린다). 상어 가족(`shape: 'shark'`: `shark`=아기상어(예전 저장 호환)·`sharkMom`·`sharkDad`·`sharkGrandma`·`sharkGrandpa`, 동요 색): `sex` 로 성별 고정, `mate`(짝 종류)·`babySp`(태어나는 종류)로 엄마+아빠→아기상어, `noBreed` 는 아기를 낳지 않음. 누르면 `playSharkTune` 이 전래 동요 멜로디 한 소절(약 7초)을 합성음으로 연주(아빠·할아버지는 한 옥타브 낮게). 상점은 가격순 정렬. 자연으로 보내기는 두 번 확인(두 번째는 버튼 자리가 바뀜)하고, `releaseReward`(종류 값 × (40% + 자란 만큼 최대 160%), 이로치 두 배. 반쯤 자라면 1.2배, 다 크면 2배)만큼 조개를 준다. 사료는 무료. 사는 물고기 수는 제한 없고 저절로 태어나는 아기만 `LIMITS.breed`(40)까지. 새로 산 친구는 정보 카드가 열리고, 기는 친구도 수면에서 가라앉아 내려앉는다. 사료는 `kind` flake(팔랑팔랑)·pellet(빨리 가라앉음).
  - 어항 오른쪽 위 ⛶ 버튼은 전체화면(`toggleFull`: Fullscreen API·webkit 접두사, 미지원 기기는 `position: fixed` 로 꽉 채우기). iOS 기울기 권한도 이 버튼을 누를 때 함께 요청한다.
  - 이름 인사처럼 미리 녹음할 수 없는 문장은 `App.jsx` 의 `REMOTE_VOICE_API`(baby-play-studio 전용 Supabase 프로젝트의 Edge Function `baby-play-studio/supabase/functions/baby-voice`, 같은 InJoon 목소리)에서 MP3 를 받아 Cache Storage(`bps-voice-v1`)에 저장해 재사용한다. 비어 있거나 실패하면 기기 TTS. Library of Mind 의 Supabase 와 섞지 말 것.
  - 느린 기기 대응: 해상도는 `DPR_STEPS`(2 → 1.6 → 1.3 → 1배) 단계로, 프레임이 계속 늦거나 물고기가 많으면(`crowdLevel`) 한 단계씩 낮춘다. 물고기가 16마리를 넘으면 일반 물고기(바다 친구·배부름·부풀기 제외)는 `drawFishSprite` 가 종류·크기별 헤엄 8장면을 미리 그려 복사한다(`spriteCache`, 최대 240장, 해상도 바뀌면 비움). 자잘한 효과(광택·부유물·빛망울·수면 빛줄·조명 소프트 라이트)는 `s.fx` 가 0 이면 생략. 청소 모드 커서는 `SPONGE_CURSOR`(수세미).
  - 조명은 기본 3단(가장 밝게), 상단 버튼줄의 💡 버튼(밥 왼쪽)으로 3→0(꺼짐)→1→2→3단. 불을 끈 밝기는 실제 시계를 따른다(`ambientDark`: 아침 8시~오후 5시는 꺼도 환함, 저녁에 점점 어두워져 저녁 7시 반~아침 6시는 깜깜). 조명 단계가 그 어둠을 `LAMP` 비율만큼 걷어내므로 저녁·밤에는 불을 켜야 환하다. 어둠과 야광은 맨 위 오버레이 캔버스에 그린다. 빛나는 부분은 `bands[].glow`·구피 `glowTail`·이로치. 개체 모습은 `lookOf(종류, 개체)` 로 구피 디자인(`GUPPY_VARIANTS`)과 이로치(`shiny`, `SHINY_RATE`)를 합쳐 만든다. 물고기마다 `name`(직접 지은 이름)을 저장하며, 누르면 `VOICE.aquaHello(종류, 이름)` 을 읽는다 — 이름이 들어간 문장은 미리 만든 MP3 가 없어 기기 TTS 로 재생된다.
- `puzzle` 탭(아기 퍼즐)은 조각 퍼즐이다. 그림은 `PuzzleSceneG`: 주인공 동물이 자연 속에 있는 300×300 장면(머리는 `PuzzleArtworkG` 얼굴 그림을 `PzHead` 로 줄여 쓰고 몸통·배경을 따로 그림). `BABY_PUZZLES` 항목의 `cut` 이 자르는 방식이다: `jigsaw`(비튼 격자+돌기)·`curvy`(돌기 없는 S자 격자)·`waves`(구불구불한 띠, `dir: 'v'` 세로)·`pie`(가운데에서 부채꼴)·`bricks`(줄마다 조각 수가 다른 엇갈림, `rows: [2,3,2]`). `puzzleGeo(theme)` 는 경계를 점 목록으로 만들어 이웃 조각이 같은 경계를 거꾸로 공유하고, 조각마다 `d`·`vb`·가운데 `cx`·`cy` 를 돌려준다(모양은 테마 id 고정 난수). `PuzzlePiece` 가 clipPath 로 오려 종이 질감(`#pz-paper` 필터)·도톰한 테두리를 입힌다. `PuzzlePiece` 가 clipPath 로 오려 종이 질감(`#pz-paper` 필터)·도톰한 테두리를 입힌다. 조각은 끌어다 놓아야만 맞춰진다(누르기만으로는 안 들어감). `puzzleNearSlot`·`puzzleSlotAt` 은 칸이 아니라 조각 가운데와의 거리로 자리를 찾는다.
- `farm` 탭은 "내 목장"(내 어항의 육지판)으로, 어항과 코드를 공유하지 않는 별도 파일이다(App 은 `<FarmGame>` 에 `audioEngine`·`speakNaturalKorean`·`REAL_ANIMALS` 를 넘김).
  - `src/farmData.js`: 동물 종류(`FARM_SPECIES`, 그림 파라미터 포함), 규칙(`FARM_RATES`, 배부름·기분·흙먼지 `mud` + 바닥 똥 `farmDirt` → 컨디션 → 성장), 별 보상(`FARM_REWARDS`), 저장(`bps_farm_v1`)·꺼둔 시간 따라잡기(`catchUpFarm`).
  - `src/FarmGame.jsx`: 캔버스 한 장. 고정 배경(언덕·헛간·나무·울타리·풀밭)은 `buildLayer` 로 크기가 바뀔 때만 그리고, 하늘·해·달·구름은 실제 시계(`farmDark`)에 따라 매 프레임 그린다. 닭·오리(`drawBird`)는 성장 34~80% 동안 병아리 모습에서 어른 모습으로 몸 색·볏·꼬리깃·목이 서서히 바뀐다. 동물은 밭 위를 걸으며(`r.x` px, `r.d` 깊이 0~1 → 멀수록 작게, 깊이순으로 그림) `drawAnimal`(네 발 `drawQuad`·닭 `drawBird`)이 종류 파라미터(`ear`·`tail`·`snout`·`wool`·`spots` 등)로 그린다.
  - 규칙: 밥은 한 번에 한 상(동물 수에 비례한 먹이 더미, 더미 하나에 세 입). 🧼 씻기·청소 모드에서 동물을 문지르면 흙먼지가, 똥을 문지르면 똥이 지워진다. 🩹 치료는 어항과 같다. 다 큰 동물은 컨디션이 좋으면 가끔 선물(`gift`: 달걀·우유 등)을 떨어뜨리고 누르면 별을 받는다. 동물을 누르면 쓰다듬기 + 이름을 지었으면 이름 인사(`farmHello`), 아니면 종류·단계(`farmInfo`, 다 크기 전 병아리·아기 오리는 `babyName`). 아픈 동물 머리 위에는 어항과 같은 밴드 그림(`drawBandageBadge`, 다른 동물보다 나중에 그림). 밤에 30초 동안 만지지 않으면 엎드려 잔다. 번식: 동물마다 `sex`, 같은 종류의 다 큰 수컷이 있으면 컨디션 좋은 다 큰 암컷이 가끔 임신(`preg`, `farmMateStatus`) → 배가 불룩(`o.belly`). `farmBreedOf`: 닭·오리는 둥지에 알(`game.eggs` → `eggHatchSec` 뒤 깨어남), 나머지는 새끼. 저절로 태어나는 아기는 `FARM_LIMITS.breed`(30)까지. 아기는 `mom`·`dad` 를 기억하고 엄마를 따라다닌다. 강아지·고양이는 `FARM_VARIANTS` 품종(살 때 무작위, 아기는 엄마·아빠를 닮음)이 있고 그림은 `farmLookOf(개체)` 로 품종 값을 덮어쓴다. 씻기 모드 커서는 수세미(`SPONGE_CURSOR`, 터치 기기는 `drawSponge`). 해상도는 어항과 같은 단계식(`FARM_DPR_STEPS`, `farmCrowdLevel`). 장식은 아직 없다.
  - 새 동물 = `FARM_SPECIES` 항목 추가(필요하면 `drawQuad` 분기). 음성은 문장 수를 줄이려고 종류 이름이 들어가는 문장이 `farmNew`·`farmGrow` 뿐이다. 추가 후 음성을 다시 생성할 것.
- `train` 탭은 "기차 마을"로, 별도 파일이다(App 은 `<TrainGame>` 에 `audioEngine`·`speakNaturalKorean` 을 넘김).
  - `src/trainData.js`: 역(`TRAIN_STATIONS`: 철길 변 `side`·`frac` 위치, `unlockAt` = 데려다준 친구 수로 열리는 역), 승객 종류(`PASSENGERS` = 목장 동물 id), 짐 색(`CARGO_COLORS`), 상점(`ENGINES`·`ENGINE_COLORS`·객차·화물칸·`TOWN_DECOR`), 보상, 저장(`bps_train_v1`).
  - `src/TrainGame.jsx`: 캔버스 한 장. `buildTrack` 이 둥근 직사각형 철길(시계 방향)을 점 목록으로 만들고 `at(s)` 로 위치를 준다. 고정 배경(풀밭·강·길·침목·레일·역)은 `buildLayer`, 기차·승객·짐·신호등·건널목·자동차·산(터널, 기차 위에 덮음)·연기·밤은 매 프레임. 승객 그림은 `FarmGame.jsx` 의 `drawAnimal` 을 빌려 쓴다.
  - 규칙: 출발하면 할 일이 있는 역(`needStop`: 내릴 친구·탈 친구·짐)에 멈추고, 아이가 친구를 눌러 태운 뒤 다시 출발을 눌러야 떠난다. 친구는 가고 싶은 역(말풍선)에 도착하면 자동으로 내린다. 짐 상자는 눌러 고른 뒤 같은 색 화물칸을 누르면 실리고 다음 역에서 내려진다. 신호등은 한 바퀴에 한 번 반쯤 빨간불이 되고, 누르면 초록불(7초 지나면 저절로).
- 전역 CSS `button:active { transform: scale(0.95) !important }` 가 있다. 버튼을 `transform: translateX(-50%)` 로 가운데 정렬하면 누르는 순간 버튼이 밀려나 클릭이 안 되므로 `margin: 0 auto` 등으로 정렬할 것.
- UI 텍스트와 음성은 모두 한국어이고, 대상은 영유아(큰 터치 영역, 모바일/태블릿 우선)다.
