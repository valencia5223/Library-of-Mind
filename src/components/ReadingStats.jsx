import React from 'react';
import { BookOpen, Clock, CheckCircle, BarChart2, Calendar, FileText, Compass, TrendingUp, Zap, Star } from 'lucide-react';

export default function ReadingStats({ books = [], sessions = [] }) {
  const totalBooksCount = books.length;
  const readBooksCount = books.filter(b => b.status === 'READ').length;
  const readingBooksCount = books.filter(b => b.status === 'READING').length;
  const wishBooksCount = books.filter(b => b.status === 'TO_READ').length;

  // 완독률 계산 (소수점 1자리)
  const completionRate = totalBooksCount > 0 
    ? ((readBooksCount / totalBooksCount) * 100).toFixed(1) 
    : '0.0';

  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const totalPages = sessions.reduce((acc, s) => acc + (s.pages_read || 0), 0);

  // 시간 표시 포맷팅
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}분`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${minutes}분 (${hrs}시간 ${mins}분)`;
  };

  // 1. 요일별 집중 독서 시간 집계 (월~일)
  const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayMinutes = [0, 0, 0, 0, 0, 0, 0]; // 일(0) ~ 토(6)

  sessions.forEach(session => {
    if (session.read_date) {
      // 날짜 스트링에 따른 요일 인덱스 파싱
      const dateObj = new Date(session.read_date);
      const dayIndex = dateObj.getDay(); // 0: 일, 1: 월 ...
      if (!isNaN(dayIndex)) {
        dayMinutes[dayIndex] += (session.duration_minutes || 0);
      }
    }
  });

  const maxDayMinutes = Math.max(...dayMinutes, 1); // 분모 0 방지

  // 2. 최근 6개월간 월별 완독 도서 수 & 월간 페이지수 통계
  const last6Months = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    last6Months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1, // 1 ~ 12
      label: `${d.getMonth() + 1}월`,
      completedCount: 0,
      pagesRead: 0
    });
  }

  // 월별 완독 도서수 채우기
  books.filter(b => b.status === 'READ').forEach(book => {
    const targetDateStr = book.completed_at || book.updated_at || book.created_at;
    if (targetDateStr) {
      const date = new Date(targetDateStr);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const monthData = last6Months.find(x => x.year === y && x.month === m);
      if (monthData) {
        monthData.completedCount += 1;
      }
    }
  });

  // 월별 읽은 페이지 수 채우기
  sessions.forEach(session => {
    if (session.read_date) {
      const date = new Date(session.read_date);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const monthData = last6Months.find(x => x.year === y && x.month === m);
      if (monthData) {
        monthData.pagesRead += (session.pages_read || 0);
      }
    }
  });

  const maxMonthPages = Math.max(...last6Months.map(m => m.pagesRead), 1);
  const maxMonthCompleted = Math.max(...last6Months.map(m => m.completedCount), 1);

  // 3. 평균 독서 속도 및 페이스 분석
  // 완독까지 걸린 평균 일수 구하기
  const readBooks = books.filter(b => b.status === 'READ');
  let avgDaysToComplete = 0;
  let countWithDates = 0;
  readBooks.forEach(b => {
    if (b.created_at && b.updated_at) {
      const created = new Date(b.created_at);
      const updated = new Date(b.updated_at);
      const diffTime = Math.abs(updated - created);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        avgDaysToComplete += diffDays;
        countWithDates++;
      }
    }
  });
  const avgDaysResult = countWithDates > 0 
    ? `${(avgDaysToComplete / countWithDates).toFixed(1)}일` 
    : '기록 없음';

  // 1회 세션당 평균 독서 스펙
  const avgMinutesPerSession = sessions.length > 0
    ? (sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / sessions.length).toFixed(1)
    : '0';
  const avgPagesPerSession = sessions.length > 0
    ? (sessions.reduce((acc, s) => acc + (s.pages_read || 0), 0) / sessions.length).toFixed(1)
    : '0';

  // 페이지 당 머무른 시간 (분/페이지)
  const timePerPage = totalPages > 0 
    ? (totalMinutes / totalPages).toFixed(2) 
    : '0';

  // 4. 분야별(카테고리별) 완독률 비교
  const categoryStats = books.reduce((acc, book) => {
    const cat = book.category || '일반';
    if (!acc[cat]) {
      acc[cat] = { count: 0, completed: 0 };
    }
    acc[cat].count += 1;
    if (book.status === 'READ') {
      acc[cat].completed += 1;
    }
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryStats)
    .map(([name, stat]) => {
      const rate = stat.count > 0 ? ((stat.completed / stat.count) * 100).toFixed(1) : 0;
      return {
        name,
        count: stat.count,
        completed: stat.completed,
        rate: parseFloat(rate),
        percentage: totalBooksCount > 0 ? ((stat.count / totalBooksCount) * 100).toFixed(1) : 0
      };
    })
    .sort((a, b) => b.rate - a.rate || b.count - a.count);

  return (
    <div className="reading-stats-container p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="stats-header text-center mb-5">
        <h2 className="flex justify-center align-middle font-bold text-2xl" style={{ gap: '0.5rem' }}>
          <BarChart2 className="animate-pulse" size={32} />
          정량적 독서 분석 대시보드
        </h2>
        <p className="sub-text mt-1 text-slate-500">
          서재에 등록된 도서 정보와 집중 독서 타이머 이력을 통계학적 수치로 시각화한 대시보드입니다.
        </p>
      </div>

      {/* 대시보드 6대 정량적 수치 카드 */}
      <div className="stats-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="stat-card stat-card-total">
          <BookOpen size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{totalBooksCount}권</span>
            <span className="stat-label">보유 총 도서</span>
          </div>
        </div>

        <div className="stat-card stat-card-read">
          <CheckCircle size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{readBooksCount}권</span>
            <span className="stat-label">완독한 도서</span>
          </div>
        </div>

        <div className="stat-card stat-card-reading">
          <Clock size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{readingBooksCount}권</span>
            <span className="stat-label">현재 읽는 중</span>
          </div>
        </div>

        <div className="stat-card stat-card-rate">
          <Compass size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{completionRate}%</span>
            <span className="stat-label">독서 완독률</span>
          </div>
        </div>

        <div className="stat-card stat-card-time">
          <Clock size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{formatTime(totalMinutes)}</span>
            <span className="stat-label">누적 독서 시간</span>
          </div>
        </div>

        <div className="stat-card stat-card-page">
          <FileText size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value">{totalPages}p</span>
            <span className="stat-label">누적 독서 페이지</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 1. 요일별 집중 독서 시간 (알라딘 마젠타 핑크 테마 차트) */}
        <div className="card day-chart-card p-4 shadow-sm">
          <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
            <Calendar size={20} />
            요일별 누적 독서 집중도 (분)
          </h3>
          <p className="text-xs text-slate-400 mb-4">타이머를 활용해 집중적으로 독서에 투입한 총 시간의 요일 분포입니다.</p>
          
          <div className="chart-wrapper flex items-end justify-between px-2 pt-4">
            {dayMinutes.map((minutes, idx) => {
              const heightPercent = Math.min(100, (minutes / maxDayMinutes) * 100);
              const isToday = new Date().getDay() === idx;
              return (
                <div key={idx} className="flex flex-col items-center" style={{ width: `${100 / 7}%` }}>
                  <div className="relative group flex flex-col items-center w-full">
                    {/* 호버 툴팁 */}
                    <span className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                      {minutes}분
                    </span>
                    {/* 그래프 막대 */}
                    <div 
                      style={{ 
                        height: minutes > 0 ? `${Math.max(8, heightPercent * 1.5)}px` : '4px',
                        width: '32px',
                        background: minutes === 0 
                          ? '#cbd5e1' 
                          : isToday 
                            ? 'linear-gradient(180deg, #eb117b 0%, #db2777 100%)' 
                            : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 0.25s ease-in-out',
                        boxShadow: minutes > 0 ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                      }}
                      className="cursor-pointer"
                    ></div>
                  </div>
                  <span className="text-xs mt-2 font-medium" style={{ color: isToday ? '#2563eb' : '#64748b', fontWeight: isToday ? '800' : 'normal' }}>
                    {dayOfWeekNames[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 최근 6개월 월별 독서 결산 및 완독 수 */}
        <div className="card month-chart-card p-4 shadow-sm" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div className="flex justify-between items-center mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="flex align-middle font-bold text-lg" style={{ gap: '0.5rem', color: '#334155', margin: 0 }}>
              <TrendingUp size={20} className="text-primary" />
              최근 6개월 독서 결산
            </h3>
            <div className="flex gap-3 text-xs font-semibold" style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
              <span className="flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#0284c7', borderRadius: '2px', display: 'inline-block' }}></span> 페이지 수
              </span>
              <span className="flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#059669', borderRadius: '2px', display: 'inline-block' }}></span> 완독 수
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
            {last6Months.map((m, idx) => {
              const pageHeightPercent = Math.min(100, (m.pagesRead / maxMonthPages) * 100);
              const completedHeightPercent = Math.min(100, (m.completedCount / maxMonthCompleted) * 100);
              
              return (
                <div key={idx} className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* 상단 수치 요약 */}
                  <div className="text-center mb-1" style={{ height: '34px', textAlign: 'center' }}>
                    <span className="block font-bold" style={{ color: '#0284c7', fontSize: '0.75rem', display: 'block' }}>{m.pagesRead}p</span>
                    <span className="block font-bold" style={{ color: '#059669', fontSize: '0.75rem', display: 'block' }}>{m.completedCount}권</span>
                  </div>

                  {/* 듀얼 그래프 바 */}
                  <div className="flex items-end justify-center gap-1 w-full" style={{ height: '110px', borderBottom: '2px solid #cbd5e1', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', width: '100%' }}>
                    {/* 페이지수 (파란색 바) */}
                    <div 
                      title={`${m.label}: ${m.pagesRead}페이지`}
                      style={{ 
                        height: m.pagesRead > 0 ? `${Math.max(10, pageHeightPercent)}%` : '4px',
                        width: '12px',
                        background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                    ></div>

                    {/* 완독수 (에메랄드 그린 바) */}
                    <div 
                      title={`${m.label}: ${m.completedCount}권 완독`}
                      style={{ 
                        height: m.completedCount > 0 ? `${Math.max(10, completedHeightPercent)}%` : '4px',
                        width: '12px',
                        background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                    ></div>
                  </div>

                  {/* 하단 월 표기 */}
                  <span className="text-xs mt-2 font-bold" style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.4rem' }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3. 독서 페이스 및 정량 피드백 */}
        <div className="card p-4 shadow-sm" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
            <Zap className="text-amber" size={20} />
            상세 독서 페이스 분석
          </h3>
          <p className="text-xs text-slate-400 mb-4">독서 진행 템포와 1회당 집중 세션을 산출한 객관적 독서 속도 관련 수치입니다.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <div className="p-3 rounded-lg pace-box-days" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="block text-slate-500 text-xs font-bold mb-1">도서 평균 완독 기간</span>
              <strong className="block text-lg" style={{ color: '#0f172a' }}>{avgDaysResult}</strong>
              <small className="block mt-1 text-slate-400" style={{ fontSize: '0.7rem' }}>등록부터 완독까지 소요됨</small>
            </div>

            <div className="p-3 rounded-lg pace-box-time" style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5' }}>
              <span className="block text-amber-600 text-xs font-bold mb-1">1페이지 소요 시간</span>
              <strong className="block text-lg" style={{ color: '#9a3412' }}>{timePerPage}분</strong>
              <small className="block mt-1 text-amber-600 opacity-60" style={{ fontSize: '0.7rem' }}>1페이지 읽는 평균 시간</small>
            </div>

            <div className="p-3 rounded-lg pace-box-session" style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce3' }}>
              <span className="block text-green-600 text-xs font-bold mb-1">1회 평균 몰입 시간</span>
              <strong className="block text-lg" style={{ color: '#166534' }}>{avgMinutesPerSession}분</strong>
              <small className="block mt-1 text-green-600 opacity-60" style={{ fontSize: '0.7rem' }}>한 번 앉아서 읽는 시간</small>
            </div>

            <div className="p-3 rounded-lg pace-box-pages" style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
              <span className="block text-blue-600 text-xs font-bold mb-1">1회 평균 돌파량</span>
              <strong className="block text-lg" style={{ color: '#1e40af' }}>{avgPagesPerSession}P</strong>
              <small className="block mt-1 text-blue-600 opacity-60" style={{ fontSize: '0.7rem' }}>한 번 앉아서 넘긴 장수</small>
            </div>
          </div>
        </div>

        {/* 4. 카테고리별 완독 성공률 비교 */}
        <div className="card p-4 shadow-sm" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
            <Compass className="text-purple" size={20} />
            도서 카테고리별 완독 성공률
          </h3>
          <p className="text-xs text-slate-400 mb-4">분야별로 보유한 책 중 완독에 도달한 비율이 높은 카테고리 순위입니다.</p>

          <div style={{ maxHeight: '230px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {sortedCategories.length === 0 ? (
              <p className="text-center py-5 text-slate-400 text-sm">분석할 도서 정보가 없습니다. 책을 추가해 보세요.</p>
            ) : (
              sortedCategories.map((cat, idx) => (
                <div key={idx} style={{ marginBottom: '1rem' }}>
                  <div className="flex justify-between text-xs mb-1" style={{ fontWeight: '600', color: '#475569' }}>
                    <span>{cat.name} ({cat.completed} / {cat.count}권 완료)</span>
                    <span style={{ color: cat.rate === 100 ? '#10b981' : '#eb117b' }}>{cat.rate}% 완독</span>
                  </div>
                  <div className="cat-progress-bg">
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${cat.rate}%`, 
                        background: `linear-gradient(90deg, #6366f1 0%, ${cat.rate === 100 ? '#10b981' : '#eb117b'} 100%)`,
                        transition: 'width 0.5s ease-out'
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. 독서 시간 세션 타임라인 기록 */}
      <div className="card p-5 shadow-sm mt-6" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
          <Calendar className="text-slate-600" size={20} />
          정량 독서 세션 타임라인 (최근 10회)
        </h3>
        <p className="text-xs text-slate-400 mb-4">몰입 타이머를 통해 누적 기입된 최근 10회의 실시간 독서 세션 로그입니다.</p>

        {sessions.length === 0 ? (
          <div className="text-center py-5 text-slate-400 bg-slate-50 rounded-xl" style={{ border: '1px dashed #cbd5e1' }}>
            <p className="text-sm">기록된 집중 세션이 아직 없습니다.</p>
            <p className="text-xs mt-1">몰입 스튜디오에서 독서 타이머를 시작하고 독서를 마쳐보세요.</p>
          </div>
        ) : (
          <div className="sessions-timeline-wrapper max-h-80 overflow-y-auto pr-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {sessions.slice(0, 10).map((session, idx) => {
              const corrBook = books.find(b => b.id === session.book_id);
              return (
                <div key={session.id || idx} className="timeline-item-fancy flex justify-between">
                  <div className="timeline-info flex flex-col justify-between">
                    <span className="font-bold text-slate-700" style={{ fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {corrBook ? corrBook.title : '등록 도서'}
                    </span>
                    <small className="text-slate-400" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{session.read_date || '날짜 정보 없음'}</small>
                  </div>
                  <div className="timeline-values text-right">
                    <span className="font-bold block text-primary" style={{ fontSize: '0.9rem', color: '#eb117b' }}>{session.duration_minutes}분 집중</span>
                    <small className="text-green font-semibold" style={{ fontSize: '0.75rem', color: '#16a34a' }}>+{session.pages_read || 0}페이지 읽음</small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
