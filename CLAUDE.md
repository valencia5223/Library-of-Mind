# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 구성

하나의 git 저장소에 서로 독립된 여러 프로젝트가 들어 있다. 각 프로젝트는 자체 `package.json` / 의존성을 가지며 서로 코드를 공유하지 않는다. 작업 전에 어느 프로젝트인지 먼저 확인할 것.

| 경로 | 설명 | 스택 |
|---|---|---|
| `/` (루트) | **Library of Mind** — 독서 서재 + 일정관리(OneNote 연동)/친구 등 (라이브: library-of-mind.onrender.com) | React 19 + Vite 5 + Supabase |
| `baby-play-studio/` | 유아용 놀이 앱 (동물·과일·차량 소리/퀴즈, 실로폰, 그림그리기, 동요 등) | React 18 + Vite 5 (백엔드 없음) |
| `Family_MatZip/` | 가족 맛집 앱. Library of Mind와 무관한 별개 프로젝트이므로 루트 앱 작업 시 참고하지 않는다 | React 19 + Vite |
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
- OneNote 가져오기: 일정 달력 헤더의 OneNote 버튼 → `OneNoteImportModal`(lazy 로딩) → `src/utils/oneNote.js`(MSAL 팝업 로그인, 개인 계정 `consumers`, 위임 권한 `Notes.Read`, Graph 호출). 팝업 리디렉트는 `public/onenote-redirect.html`. 페이지는 id `sch_onenote_<페이지id>` 일정으로 upsert 되므로 다시 가져오면 덮어쓴다. 섹션마다 공유할 앱 친구를 한 번 고르면(`onenote_notebook_share_<userId>`, 키=섹션 id, `'none'`=공유 안함, 없으면 예전 노트북 id 설정을 따름 `sectionFriendId`) 가져오기·자동 동기화 모두 shared_friend_id 로 공유된다. 제목에 날짜(10/19, 10월 19일, 2026-10-19)가 있으면 그 날짜로 넣는다(`parseTitleDate`). 자동 동기화를 켜면 최근 30일부터 확인하고, 이후에는 최근 7일 안에 수정된 페이지 중 마지막으로 반영한 수정 시각(`onenote_seen_<userId>`, `markSeen`)과 다른 것 + 최근 3일 안에 고친 페이지(목록의 수정 시각이 캐시돼 늦게 바뀔 수 있어서, 섹션당 15개)만 본문을 받아, 제목·메모·날짜·공유가 실제로 바뀐 것만 저장한다. 메모는 최대 50000자. 실행마다 `onenote_synclog_<userId>` 에 기록(최근 20번)하고 가져오기 창의 '동기화 기록'에서 본다. 원본 서식: `src/utils/noteHtml.js`(`cleanOneNoteHtml` 이 글꼴·크기·색·목록·표·띄어쓰기만 남기고 위치·이미지는 버림, DOMPurify)로 정리한 HTML 을 `user_schedules.memo_html`(암호화, 대시보드에서 `alter table user_schedules add column if not exists memo_html text;` 로 추가하는 칸)에 저장. 목록·로컬 캐시에는 넣지 않고 일정 창을 열 때 그 한 건만 읽어 `NoteRichView`(lazy)로 보여 준다(원본 서식/텍스트 전환). 칸이 없으면 오류 없이 텍스트만 저장. 서식 변경 감지는 `onenote_html_hash_<userId>`. 자동 동기화를 켜지 않은 섹션이라도 손으로 가져온 노트가 있으면(`onenote_tracked_<userId>`, 가져올 때 `trackSection`, 이 기능 전 가져온 노트는 `scanTrackedOnce` 가 한 번 모든 섹션을 훑어 기록) 같은 주기로 확인해 이미 달력에 있는 노트의 수정만 반영한다(새 노트는 안 가져옴). 친구가 공유해 준 노트(user_id 가 내가 아님)는 대상에서 뺀다. OneNote 일정은 시간 없이 넣고(DB 에는 null, 실패 시 00:00) 화면 어디에도 시간을 보여 주지 않는다(`isOneNoteId`). 달력 헤더 '찾기·모아보기'(`ScheduleNotesPanel`, lazy)는 OneNote 노트/전체 일정을 월별로 모아 제목·메모 검색(여러 단어 AND, 강조)하고, 누르면 그 달로 이동해 일정 창을 연다. 섹션별 자동 동기화(`onenote_autosync_<userId>`, `src/utils/oneNoteSync.js` 의 `runAutoSync`)는 일정 화면을 열 때·3분마다·탭으로 돌아오거나 창을 클릭할 때(`focus`, 30초 간격 제한) lastSync 뒤에 고친 페이지를 가져온다. 토큰은 조용히만 받고(만료 시 `NEED_LOGIN` → 버튼이 'OneNote 다시 연결'), MSAL 묶음은 자동 동기화 섹션이 있을 때만 불러온다.
- 주요 테이블: `user_books`, `book_notes`, `reading_sessions`, `user_schedules`, `user_friends`, `shared_memos`, `profiles`, `push_subscriptions`. 스키마는 `supabase_schema.sql`, `supabase_bookshelf_schema.sql`.
- `user_books` 업데이트는 DB에 없는 컬럼 때문에 실패할 수 있어, App.jsx 에서 "안전 필드"만 먼저 저장하고 추가 필드를 따로 저장하는 폴백 패턴을 쓴다. 컬럼을 추가할 때 이 흐름을 유지할 것.
- 실시간 기능은 Supabase Realtime 채널 사용(예: `global_user_nudge:${user.id}`).
- 웹 푸시: `src/utils/webPush.js` → `public/sw.js` 서비스워커 등록, 발송은 Supabase Edge Function `supabase/functions/send-push/index.ts` (`verify_jwt = false`). VAPID 키는 Supabase Secrets(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)로만 주입하며 소스에 하드코딩하지 않는다. 클라이언트 공개키는 `VITE_VAPID_PUBLIC_KEY`.

## baby-play-studio 아키텍처

- Library of Mind와 무관한 별개 프로젝트다. 루트 `src/` 코드를 import하지 않고, 루트 앱도 이 프로젝트를 참조하지 않는다. 한쪽 작업 시 다른 쪽은 참고하지 않는다.
- **`baby-play-studio/` 는 자체 `.git` 을 가진 별도 저장소다** (`github.com/valencia5223/baby-play-studio`). Render 배포(baby-play-studio.onrender.com)는 이 저장소의 `main` push 로 자동 진행된다. 커밋·push 는 반드시 `baby-play-studio/` 안에서 할 것 — 루트에서 하면 Library-of-Mind 저장소에만 들어가고 배포되지 않는다. 작업 전에 `git -C baby-play-studio fetch` 로 다른 곳에서 push 된 커밋이 있는지 확인한다.
- 루트 `public/vehicles/` 는 루트 앱에서 사용하지 않는 사본이다. baby-play-studio는 자체 `baby-play-studio/public/vehicles/` 를 사용한다.
- 사실상 전체 앱이 `baby-play-studio/src/App.jsx` 한 파일(약 7,000줄)에 있다. 순서대로:
  1. `BabySoundEngine` 클래스(싱글턴 `audioEngine`) — Web Audio 합성음, mp3 재생, TTS. iOS Safari의 AudioContext suspended 문제를 `ensureAudioContext()` 와 첫 터치 시 unlock 핸들러로 처리한다. 소리 관련 코드는 반드시 이 엔진을 거칠 것.
  2. 콘텐츠 데이터 배열: `REAL_ANIMALS`, `REAL_FRUITS`, `REAL_VEHICLES`, `RAINBOW_PAINTS`, `TRACING_TEMPLATES`, `STAMP_ITEMS`, `FEEDABLE_ANIMALS` 등. 항목 추가는 보통 여기에 객체 하나를 추가하는 것으로 끝난다.
  3. SVG 일러스트/서브뷰 컴포넌트(`XylophoneChoirView`, `BedtimeSleepView` 등).
  4. `export default function App()` — `activeTab` 으로 탭 전환: `animal`, `fruit`, `vehicle`, `ocean`, `puzzle`, `paint`, `song`, `xylophone`, `sleep`.
- 음성 안내: 모든 문장은 `src/voiceLines.js` 의 `VOICE` 빌더로 만들고 `speakNaturalKorean()` 으로 재생한다. 남성 아나운서(Edge TTS `ko-KR-InJoonNeural`) MP3가 `public/voice/<해시>.mp3` 로 미리 생성돼 있고(목록: `src/voiceIndex.json`), 없으면 브라우저 TTS로 대체된다. 문장·동물·과일을 바꾸면 `npm run voices` 를 다시 실행할 것. **시스템 Node 18에서는 모든 문장이 실패하므로** 포터블 Node 20으로 실행한다: `..\node-portable\node-v20.15.0-win-x64\node.exe scripts/generate-voices.mjs`. 과일 하나를 추가하면 먹이기 게임 조합 때문에 음성이 수십 개 늘어난다. 음성은 항상 하나만 재생(새 음성이 이전 음성을 끊음)하며, 화면을 떠난 뒤 실행되면 안 되는 음성 타이머는 `audioEngine.later()` 를 쓴다(`interruptVoice()`/`stopAllSounds()` 시 취소).
- 동요 목록은 `import.meta.glob('/public/music/*.mp3')` 로 자동 생성된다. 곡 추가 = `public/music/` 에 mp3 추가(파일명 앞 숫자는 정렬용이며 제목에서 제거됨). `public/songs_code.js`, `songs_data.json` 은 예전 방식의 산출물이다.
- 이미지는 `src/assets/`(과일, import) 또는 `public/`(`animals/`, `vehicles/`, URL 경로)에 둔다. 실제 사진을 쓸 때는 대상과 일치하는지 검증된 이미지를 사용하고, 외부 출처 사진은 `baby-play-studio/IMAGE_CREDITS.md` 에 작성자·라이선스를 기록한다.
- 동물 항목에 `soundUrl`(울음소리 MP3)이 없으면 `soundText` 를 음성 안내로 읽는다(기린·공룡 등).
- `ocean` 탭은 "내 어항" 다마고치형 게임으로, App.jsx 밖의 별도 파일이다(App 은 `<AquariumGame>` 에 `audioEngine`·`speakNaturalKorean` 을 props 로 넘김).
  - `src/aquariumData.js`: 물고기·바다 친구 종류(`FISH_SPECIES`, 그림 파라미터 포함)·장식, 성장/컨디션 규칙(`RATES`, `growFactor`), 보상(`REWARDS`), localStorage 저장(`bps_aquarium_v1`)·꺼둔 시간 따라잡기(`catchUpOffline`). 저장 형식을 바꾸면 `version` 을 올리고 이전 데이터 변환을 넣을 것.
  - `src/AquariumGame.jsx`: 캔버스(물고기 `drawFish`·바다 친구 `drawCreature`·장식 `drawDecor`·자갈·거품) + WebGL 빛 레이어(물결 빛무늬·햇살, `mix-blend-mode: screen`) + 이끼/탁한 물 오버레이 캔버스. 위치는 매 프레임 ref 로 갱신(React 리렌더 없음), 상단 상태(조개·물 깨끗함)만 0.4초마다 state 로 반영.
  - 규칙: 물고기마다 배부름·기분, 어항 전체 물 더러움 → 컨디션 → 성장 속도(슬프면 멈춤, 죽지 않음). 밥은 한 번에 한 그릇(남아 있으면 더 못 줌). 청소 모드에서 문질러 이끼·똥 제거, 물갈이로 물 더러움 0. 비파(`algaeEater`)는 유리 이끼를 먹는다. 바다 친구(게·문어·상어 등, `sea: true`)도 `FISH_SPECIES` 항목이라 물고기와 똑같이 밥·병·이름·번식·자연으로 보내기가 된다(`crawl`: 바닥을 기며 가라앉은 밥만 먹음, `upright`: 몸을 기울이지 않음). 예전 저장의 `game.friends` 는 `loadGame` 에서 `game.fish` 로 옮긴다(`fish` → `clownfish`). 상점은 '물고기·바다 친구' / '장식' 두 탭. 물고기마다 암수(`sex`)가 있고, 같은 종류의 다 큰 수컷이 있으면 컨디션 좋은 다 큰 암컷이 가끔 임신(`preg` 0→1, `mateStatus`)해 배가 불러온다. `breedOf` 로 난태생(구피·플래티: 새끼, 한 번 짝짓기하면 수컷 없이도 가끔 임신)과 알(바닥 `game.eggs` → 깨어남)을 구분. 실제 시계로 저녁 8시~아침 7시는 밤(`isNightTime`): 밥을 쫓거나 놀란 게 아니면 물고기가 아래쪽에서 눈을 감고 잔다(`r.asleep`, zZ 는 오버레이에). 자는 물고기를 누르면 깨우지 않고 `VOICE.aquaSleepTap()`. 가족: 아기는 `mom`·`dad`(uid)와 그때 이름 `momName`·`dadName` 을 저장하고, 다 크기 전(growth<0.8)엔 엄마를 따라다니며 밤엔 엄마 옆에서 잔다. 물고기를 누르면 쓰다듬기(기분+15, 3초마다 조개+1). 물고기는 놀 때 가끔 랜덤으로 아프고(`sick`, `RATES.sickPerSec`·`sickMax`, `isSad` 에 포함되어 성장 멈춤) 상단 🩹 치료 버튼(모드 `heal`) 후 그 물고기를 누르면 낫는다.
  - 새 물고기 = `FISH_SPECIES` 항목 추가(필요하면 `drawFish` 의 shape 분기). 새 바다 친구 = `FISH_SPECIES` 에 `sea: true` 항목 + `drawCreature` 분기 + `CREATURE_SHAPES`. 새 장식 = `DECOR_ITEMS` + `drawDecor` 분기 + `DECOR_BOX` 크기. 이름이 음성 문장에 들어가므로 추가 후 음성을 다시 생성할 것.
  - 느린 기기에서는 프레임이 계속 늦으면 해상도·빛 레이어 해상도를 자동으로 낮춘다.
  - 조명은 기본 3단(가장 밝게), 상단 버튼줄의 💡 버튼(밥 왼쪽)으로 3→0(꺼짐)→1→2→3단. 불을 끈 밝기는 실제 시계를 따른다(`ambientDark`: 아침 8시~오후 5시는 꺼도 환함, 저녁에 점점 어두워져 저녁 7시 반~아침 6시는 깜깜). 조명 단계가 그 어둠을 `LAMP` 비율만큼 걷어내므로 저녁·밤에는 불을 켜야 환하다. 어둠과 야광은 맨 위 오버레이 캔버스에 그린다. 빛나는 부분은 `bands[].glow`·구피 `glowTail`·이로치. 개체 모습은 `lookOf(종류, 개체)` 로 구피 디자인(`GUPPY_VARIANTS`)과 이로치(`shiny`, `SHINY_RATE`)를 합쳐 만든다. 물고기마다 `name`(직접 지은 이름)을 저장하며, 누르면 `VOICE.aquaHello(종류, 이름)` 을 읽는다 — 이름이 들어간 문장은 미리 만든 MP3 가 없어 기기 TTS 로 재생된다.
- 전역 CSS `button:active { transform: scale(0.95) !important }` 가 있다. 버튼을 `transform: translateX(-50%)` 로 가운데 정렬하면 누르는 순간 버튼이 밀려나 클릭이 안 되므로 `margin: 0 auto` 등으로 정렬할 것.
- UI 텍스트와 음성은 모두 한국어이고, 대상은 영유아(큰 터치 영역, 모바일/태블릿 우선)다.
