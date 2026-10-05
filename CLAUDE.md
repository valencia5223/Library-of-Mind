# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 구성

하나의 git 저장소에 서로 독립된 여러 프로젝트가 들어 있다. 각 프로젝트는 자체 `package.json` / 의존성을 가지며 서로 코드를 공유하지 않는다. 작업 전에 어느 프로젝트인지 먼저 확인할 것.

| 경로 | 설명 | 스택 |
|---|---|---|
| `/` (루트) | **Library of Mind** — 독서 서재 + 일정관리/친구/맛집지도 등 (라이브: library-of-mind.onrender.com) | React 19 + Vite 5 + Supabase |
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

- `src/App.jsx` 가 상위 상태(사용자, `books`/`notes`/`sessions`, `activeTab`)와 대부분의 Supabase CRUD를 가지고, 탭별 컴포넌트(`src/components/`)에 props로 내려준다. 탭: `schedule`(기본), `bookshelf`, `search`, `focus`, `stats`, `social`, `places`. 모달류는 App 상태 플래그로 열고 닫는다.
- 친구 서재 보기: `viewedFriend` 가 설정되면 같은 뷰가 친구의 `user_id` 데이터로 다시 로드된다.
- Supabase 클라이언트 파일이 두 개 있다:
  - `src/supabase.js` — 거의 모든 컴포넌트가 import하는 주 클라이언트.
  - `src/supabaseClient.js` — placeholder 대체값과 `isSupabaseConfigured()` 를 제공하는 버전.
  새 코드는 기존 주변 코드가 쓰는 쪽을 따를 것.
- 환경변수: `.env` 의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- 주요 테이블: `user_books`, `book_notes`, `reading_sessions`, `user_schedules`, `user_friends`, `shared_memos`, `shared_restaurants`, `profiles`, `push_subscriptions`. 스키마는 `supabase_schema.sql`, `supabase_bookshelf_schema.sql`.
- `user_books` 업데이트는 DB에 없는 컬럼 때문에 실패할 수 있어, App.jsx 에서 "안전 필드"만 먼저 저장하고 추가 필드를 따로 저장하는 폴백 패턴을 쓴다. 컬럼을 추가할 때 이 흐름을 유지할 것.
- 실시간 기능은 Supabase Realtime 채널 사용(예: `global_user_nudge:${user.id}`).
- 웹 푸시: `src/utils/webPush.js` → `public/sw.js` 서비스워커 등록, 발송은 Supabase Edge Function `supabase/functions/send-push/index.ts` (`verify_jwt = false`).

## baby-play-studio 아키텍처

- Library of Mind와 무관한 별개 프로젝트다. 루트 `src/` 코드를 import하지 않고, 루트 앱도 이 프로젝트를 참조하지 않는다. 한쪽 작업 시 다른 쪽은 참고하지 않는다.
- 루트 `public/vehicles/` 는 루트 앱에서 사용하지 않는 사본이다. baby-play-studio는 자체 `baby-play-studio/public/vehicles/` 를 사용한다.
- 사실상 전체 앱이 `baby-play-studio/src/App.jsx` 한 파일(약 7,000줄)에 있다. 순서대로:
  1. `BabySoundEngine` 클래스(싱글턴 `audioEngine`) — Web Audio 합성음, mp3 재생, TTS. iOS Safari의 AudioContext suspended 문제를 `ensureAudioContext()` 와 첫 터치 시 unlock 핸들러로 처리한다. 소리 관련 코드는 반드시 이 엔진을 거칠 것.
  2. 콘텐츠 데이터 배열: `REAL_ANIMALS`, `REAL_FRUITS`, `REAL_VEHICLES`, `RAINBOW_PAINTS`, `TRACING_TEMPLATES`, `STAMP_ITEMS`, `FEEDABLE_ANIMALS` 등. 항목 추가는 보통 여기에 객체 하나를 추가하는 것으로 끝난다.
  3. SVG 일러스트/서브뷰 컴포넌트(`XylophoneChoirView`, `BedtimeSleepView` 등).
  4. `export default function App()` — `activeTab` 으로 탭 전환: `animal`, `fruit`, `vehicle`, `ocean`, `puzzle`, `paint`, `song`, `xylophone`, `sleep`.
- 음성 안내: 모든 문장은 `src/voiceLines.js` 의 `VOICE` 빌더로 만들고 `speakNaturalKorean()` 으로 재생한다. 남성 아나운서(Edge TTS `ko-KR-InJoonNeural`) MP3가 `public/voice/<해시>.mp3` 로 미리 생성돼 있고(목록: `src/voiceIndex.json`), 없으면 브라우저 TTS로 대체된다. 문장·동물·과일을 바꾸면 `npm run voices` 를 다시 실행할 것. 음성은 항상 하나만 재생(새 음성이 이전 음성을 끊음)하며, 화면을 떠난 뒤 실행되면 안 되는 음성 타이머는 `audioEngine.later()` 를 쓴다(`interruptVoice()`/`stopAllSounds()` 시 취소).
- 동요 목록은 `import.meta.glob('/public/music/*.mp3')` 로 자동 생성된다. 곡 추가 = `public/music/` 에 mp3 추가(파일명 앞 숫자는 정렬용이며 제목에서 제거됨). `public/songs_code.js`, `songs_data.json` 은 예전 방식의 산출물이다.
- 이미지는 `src/assets/`(import) 또는 `public/`(URL 경로)에 둔다. 실제 사진을 쓸 때는 대상과 일치하는지 검증된 이미지를 사용한다(최근 커밋에서 차량 사진을 실사로 교체함).
- UI 텍스트와 음성은 모두 한국어이고, 대상은 영유아(큰 터치 영역, 모바일/태블릿 우선)다.
