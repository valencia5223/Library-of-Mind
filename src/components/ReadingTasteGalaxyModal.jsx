import React, { useEffect } from 'react';
import { X, Sparkles, BookOpen, Star, Compass, Award, Layers, TrendingUp } from 'lucide-react';

// 장르별 테마 색상 정의 (성운 오로라 파스텔 톤)
const GENRE_COLORS = [
  { bg: '#818cf8', border: '#a5b4fc', glow: 'rgba(129, 140, 248, 0.45)', name: '인문/철학' },
  { bg: '#f472b6', border: '#fbcfe8', glow: 'rgba(244, 114, 182, 0.45)', name: '소설/문학' },
  { bg: '#38bdf8', border: '#bae6fd', glow: 'rgba(56, 189, 248, 0.45)', name: '과학/IT' },
  { bg: '#34d399', border: '#a7f3d0', glow: 'rgba(52, 211, 153, 0.45)', name: '경제/경영' },
  { bg: '#fbbf24', border: '#fef08a', glow: 'rgba(251, 191, 36, 0.45)', name: '자기계발' },
  { bg: '#c084fc', border: '#e9d5ff', glow: 'rgba(192, 132, 252, 0.45)', name: '에세이/시' },
  { bg: '#fb7185', border: '#fecdd3', glow: 'rgba(251, 113, 133, 0.45)', name: '예술/문화' },
  { bg: '#94a3b8', border: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.35)', name: '기타/일반' }
];

export default function ReadingTasteGalaxyModal({ books = [], onClose }) {
  // ESC 키 누를 경우 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 도서 카테고리/장르 통계 분석
  const categoryStats = React.useMemo(() => {
    const counts = {};
    let totalCount = 0;
    let totalPages = 0;
    let ratedBooksCount = 0;
    let sumRating = 0;

    books.forEach((book) => {
      totalCount += 1;
      totalPages += Number(book.total_pages) || 0;
      if (book.rating && Number(book.rating) > 0) {
        ratedBooksCount += 1;
        sumRating += Number(book.rating);
      }

      // 장르 키워드 매핑
      let genreKey = '기타/일반';
      const rawCat = (book.categoryName || book.publisher || book.title || '').toLowerCase();
      
      if (rawCat.includes('소설') || rawCat.includes('문학') || rawCat.includes('fiction')) {
        genreKey = '소설/문학';
      } else if (rawCat.includes('인문') || rawCat.includes('철학') || rawCat.includes('역사') || rawCat.includes('사회')) {
        genreKey = '인문/철학';
      } else if (rawCat.includes('과학') || rawCat.includes('공학') || rawCat.includes('컴퓨터') || rawCat.includes('it') || rawCat.includes('수학')) {
        genreKey = '과학/IT';
      } else if (rawCat.includes('경제') || rawCat.includes('경영') || rawCat.includes('주식') || rawCat.includes('트렌드') || rawCat.includes('비즈니스')) {
        genreKey = '경제/경영';
      } else if (rawCat.includes('자기계발') || rawCat.includes('성공') || rawCat.includes('습관') || rawCat.includes('동기')) {
        genreKey = '자기계발';
      } else if (rawCat.includes('에세이') || rawCat.includes('시') || rawCat.includes('수필') || rawCat.includes('일기')) {
        genreKey = '에세이/시';
      } else if (rawCat.includes('예술') || rawCat.includes('음악') || rawCat.includes('미술') || rawCat.includes('디자인')) {
        genreKey = '예술/문화';
      }

      counts[genreKey] = (counts[genreKey] || 0) + 1;
    });

    // 비율순 정렬 및 색상 부여
    const list = Object.keys(counts).map((genreName, idx) => {
      const cnt = counts[genreName];
      const ratio = totalCount > 0 ? ((cnt / totalCount) * 100).toFixed(1) : 0;
      const colorObj = GENRE_COLORS.find(c => c.name === genreName) || GENRE_COLORS[idx % GENRE_COLORS.length];
      return {
        name: genreName,
        count: cnt,
        ratio: Number(ratio),
        ...colorObj
      };
    }).sort((a, b) => b.count - a.count);

    const avgRating = ratedBooksCount > 0 ? (sumRating / ratedBooksCount).toFixed(1) : '미평가';

    // 독서 페르소나 결정
    let persona = '지적 호기심 가득한 아카데미아 🎓';
    if (list.length > 0) {
      const topName = list[0].name;
      if (topName === '소설/문학') persona = '풍부한 감성의 스토리 서사 탐험가 📖✨';
      else if (topName === '인문/철학') persona = '세상을 깊이 통찰하는 사색가 🏛️';
      else if (topName === '과학/IT') persona = '미래의 지평을 개척하는 라식 연구자 🔬';
      else if (topName === '경제/경영') persona = '트렌드와 시장을 꿰뚫어보는 실전 전략가 📈';
      else if (topName === '자기계발') persona = '매일 성장을 멈추지 않는 도전자 🔥';
      else if (topName === '에세이/시') persona = '따뜻한 일상의 온도를 기록하는 낭만가 ☕';
    }

    return {
      list,
      totalCount,
      totalPages,
      avgRating,
      persona
    };
  }, [books]);

  return (
    <div
      className="modal-overlay flex justify-center align-center p-3"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          backgroundImage: 'radial-gradient(circle at 50% 0%, #2e1065 0%, #0f172a 75%)',
          borderRadius: '24px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.25)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease-out forwards'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)'
              }}
            >
              <Compass size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🌌 내 지적 취향 성운 (Reading Taste Galaxy)
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#cbd5e1' }}>
                내 서재 도서들의 카테고리를 다각도로 분석하여 독서 성향과 지형도를 시각화합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 스크롤 영역 */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* 1. 독서 페르소나 카드 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                MY READING PERSONA
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                {categoryStats.persona}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>보관 도서</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>{categoryStats.totalCount}권</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>누적 페이지</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>{categoryStats.totalPages.toLocaleString()} p</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>평균 별점</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Star size={13} fill="#fbbf24" color="#fbbf24" /> {categoryStats.avgRating}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 장르별 취향 성운 분배 현황 */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '1.25rem'
            }}
          >
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.925rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color="#c084fc" /> 장르별 탐구 비중 (Taste Galaxy Spectrum)
            </h4>

            {categoryStats.list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                서재에 등록된 도서가 없습니다. 도서를 추가하면 취향 성운이 형성됩니다!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {categoryStats.list.map((item) => (
                  <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', fontWeight: 600 }}>
                      <span style={{ color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            backgroundColor: item.bg,
                            boxShadow: `0 0 8px ${item.glow}`
                          }}
                        />
                        {item.name}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>
                        {item.count}권 <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({item.ratio}%)</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: '9px',
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${item.ratio}%`,
                          backgroundColor: item.bg,
                          borderRadius: '6px',
                          boxShadow: `0 0 10px ${item.glow}`,
                          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 취향 팁 & 가이드 */}
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.2rem' }}>
            💡 탐색 탭에서 다양한 분야의 도서를 내 서재에 수집하면 지적 취향 성운이 더욱 다채롭게 확장됩니다.
          </div>

        </div>
      </div>
    </div>
  );
}
