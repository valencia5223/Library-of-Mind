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
        <h2 className="flex justify-center align-middle font-bold text-2xl" style={{ gap: '0.5rem', color: '#1e293b' }}>
          <BarChart2 className="text-primary animate-pulse" size={32} />
          정량적 독서 분석 대시보드
        </h2>
        <p className="sub-text mt-1 text-slate-500">
          서재에 등록된 도서 정보와 집중 독서 타이머 이력을 통계학적 수치로 시각화한 대시보드입니다.
        </p>
      </div>

      {/* 대시보드 6대 정량적 수치 카드 */}
      <div className="stats-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <BookOpen className="text-blue" size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{totalBooksCount}권</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>보유 총 도서</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <CheckCircle className="text-green" size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{readBooksCount}권</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>완독한 도서</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <Clock className="text-amber" size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{readingBooksCount}권</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>현재 읽는 중</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <Compass className="text-purple" size={24} style={{ marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{completionRate}%</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>독서 완독률</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <Clock className="text-red" size={24} style={{ color: '#ef4444', marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatTime(totalMinutes)}</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>누적 독서 시간</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #6366f1', padding: '1.25rem', borderRadius: '12px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <FileText className="text-indigo" size={24} style={{ color: '#6366f1', marginBottom: '0.5rem' }} />
          <div>
            <span className="stat-value" style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{totalPages}p</span>
            <span className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>누적 독서 페이지</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 1. 요일별 집중 독서 시간 (SVG 막대 차트) */}
        <div className="card p-4 shadow-sm" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
            <Calendar className="text-blue" size={20} />
            요일별 누적 독서 집중도 (분)
          </h3>
          <p className="text-xs text-slate-400 mb-4">타이머를 활용해 집중적으로 독서에 투입한 총 시간의 요일 분포입니다.</p>
          
          <div className="chart-wrapper flex items-end justify-between px-2 pt-4" style={{ height: '200px', borderBottom: '2px solid #cbd5e1' }}>
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
                        background: minutes === 0 ? '#cbd5e1' : isToday ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)' : 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.8s ease-in-out',
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

        {/* 2. 최근 6개월 월별 독서 결산 및 완독 수 (듀얼 스케일 SVG 바 차트) */}
        <div className="card p-4 shadow-sm" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 className="flex align-middle font-bold text-lg mb-3" style={{ gap: '0.5rem', color: '#334155' }}>
            <TrendingUp className="text-green" size={20} />
            최근 6개월 독서 결산 (완독 수 / 페이지 수)
          </h3>
          <p className="text-xs text-slate-400 mb-4">막대(배경)는 해당 월 독서 페이지수, 전면 선(포인트)은 완독한 도서 개수를 보여줍니다.</p>

          <div className="chart-wrapper flex items-end justify-between px-2 pt-4 relative" style={{ height: '200px', borderBottom: '2px solid #cbd5e1' }}>
            {/* 배경 눈금선 */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between" style={{ height: '100%', pointerEvents: 'none' }}>
              <div style={{ borderBottom: '1px dashed #f1f5f9', width: '100%', height: '0' }}></div>
              <div style={{ borderBottom: '1px dashed #f1f5f9', width: '100%', height: '0' }}></div>
              <div style={{ borderBottom: '1px dashed #f1f5f9', width: '100%', height: '0' }}></div>
              <div style={{ borderBottom: '1px dashed #f1f5f9', width: '100%', height: '0' }}></div>
            </div>

            {last6Months.map((m, idx) => {
              const pageHeightPercent = Math.min(100, (m.pagesRead / maxMonthPages) * 100);
              const completedHeightPercent = Math.min(100, (m.completedCount / maxMonthCompleted) * 100);
              
              return (
                <div key={idx} className="flex flex-col items-center z-10" style={{ width: `${100 / 6}%` }}>
                  <div className="relative group flex items-end justify-center w-full" style={{ height: '150px' }}>
                    
                    {/* 독서 페이지수 (배경 투명 바) */}
                    <div 
                      style={{ 
                        height: m.pagesRead > 0 ? `${pageHeightPercent}%` : '4px',
                        width: '28px',
                        background: '#e2e8f0',
                        borderRadius: '4px 4px 0 0',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1
                      }}
                    ></div>

                    {/* 완독 도서수 (전면 그라디언트 바) */}
                    <div 
                      style={{ 
                        height: m.completedCount > 0 ? `${completedHeightPercent}%` : '4px',
                        width: '14px',
                        background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
                        borderRadius: '3px 3px 0 0',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      className="cursor-pointer"
                    ></div>

                    {/* 툴팁 */}
                    <span className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 shadow-lg" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                      {m.label}: {m.pagesRead}페이지 / {m.completedCount}권 완독
                    </span>
                  </div>
                  <span className="text-xs mt-2 font-medium text-slate-500">{m.label}</span>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>도서 평균 완독 기간</span>
              <strong style={{ fontSize: '1.25rem', color: '#1e293b', marginTop: '0.25rem', display: 'block' }}>{avgDaysResult}</strong>
              <small className="text-slate-400" style={{ fontSize: '0.7rem' }}>책 등록일부터 완독 처리일까지의 평균 소요 기간</small>
            </div>

            <div className="p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>1페이지당 평균 시간</span>
              <strong style={{ fontSize: '1.25rem', color: '#1e293b', marginTop: '0.25rem', display: 'block' }}>{timePerPage}분 / page</strong>
              <small className="text-slate-400" style={{ fontSize: '0.7rem' }}>세션 기록 기반 1페이지를 정독하는 데 걸린 시간</small>
            </div>

            <div className="p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>1회 평균 독서 집중</span>
              <strong style={{ fontSize: '1.25rem', color: '#1e293b', marginTop: '0.25rem', display: 'block' }}>{avgMinutesPerSession}분</strong>
              <small className="text-slate-400" style={{ fontSize: '0.7rem' }}>몰입 스튜디오 타이머 가동시 1회당 평균 독서 밀도</small>
            </div>

            <div className="p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>1회 평균 독서량</span>
              <strong style={{ fontSize: '1.25rem', color: '#1e293b', marginTop: '0.25rem', display: 'block' }}>{avgPagesPerSession}페이지</strong>
              <small className="text-slate-400" style={{ fontSize: '0.7rem' }}>몰입 스튜디오 타이머 가동시 1회당 평균 돌파력</small>
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
                    <span style={{ color: cat.rate === 100 ? '#10b981' : '#4f46e5' }}>{cat.rate}% 완독</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${cat.rate}%`, 
                        background: `linear-gradient(90deg, #6366f1 0%, ${cat.rate === 100 ? '#10b981' : '#4f46e5'} 100%)`,
                        borderRadius: '4px',
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
                <div key={session.id || idx} className="timeline-item p-3 rounded-lg border flex justify-between" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div className="timeline-info flex flex-col justify-between">
                    <span className="font-bold text-slate-700" style={{ fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {corrBook ? corrBook.title : '등록 도서'}
                    </span>
                    <small className="text-slate-400" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{session.read_date || '날짜 정보 없음'}</small>
                  </div>
                  <div className="timeline-values text-right">
                    <span className="font-bold block text-primary" style={{ fontSize: '0.9rem', color: '#2563eb' }}>{session.duration_minutes}분 집중</span>
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
