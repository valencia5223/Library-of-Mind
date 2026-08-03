# 📚 Library of Mind - 나만의 3D 비주얼 독서 서재

Supabase, Render, GitHub, Open API를 활용한 인터랙티브 책장 관리 애플리케이션입니다.

🌐 **실제 라이브 서비스 URL**: [https://library-of-mind.onrender.com](https://library-of-mind.onrender.com)

---

## 🌟 주요 기능

1. **3D 비주얼 서재 (`BookshelfView`)**
   - 3D 책등(Spine) 및 원목 책장 연출 (완독 / 읽는 중 / 위시리스트)
   - 책 클릭 시 읽기 상태 변경, 별점 관리, 알라딘/네이버 구매링크 연결

2. **도서 탐색 & 베스트셀러 (`BookSearch`)**
   - 실시간 베스트셀러 도서 목록 및 키워드 검색
   - 1클릭 내 책장에 담기 및 구매 링크 연동

3. **생각 저장소 (`ThoughtLedger`)**
   - 인상 깊은 구절(Quote)과 감상평, 페이지 수집
   - `#동기부여`, `#인문학` 등 태그별 필터링

4. **몰입 독서 스튜디오 (`FocusStudio`)**
   - 독서 뽀모도로 / 스톱워치 타이머
   - Web Audio ASMR 백색소음 (빗소리, 모닥불, 카페, 종이 소리)

5. **독서 성장 리포트 & 배지 (`ReadingStats`)**
   - 독서 나무 성장 아바타 및 독서 온도계
   - 6가지 미션 달성 배지 언락 시스템

---

## 🛠️ 기술 스택

- **Frontend**: React (Vite) + Lucide Icons + Custom Glassmorphic CSS
- **Backend / Auth / DB**: Supabase (PostgreSQL + Auth + RLS)
- **Deployment**: Render (Static Site Hosting) + GitHub CI/CD

---

## 🚀 로컬 실행 방법

```bash
npm install
npm run dev
```
