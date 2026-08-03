import React from 'react';
import { Award, Flame, TreePine, BookOpen, Clock, CheckCircle, Lock, Trophy, Sparkles } from 'lucide-react';

export default function ReadingStats({ books = [], sessions = [] }) {
  const readBooksCount = books.filter(b => b.status === 'READ').length;
  const readingBooksCount = books.filter(b => b.status === 'READING').length;
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const totalPages = sessions.reduce((acc, s) => acc + (s.pages_read || 0), 0);

  // 독서 온도계 계산 (기본 36.5도 + 완독권수*5도 + 총 독서시간*0.5도)
  const temperature = Math.min(100, (36.5 + readBooksCount * 5 + (totalMinutes / 10)).toFixed(1));

  // 독서 나무 단계
  const getTreeLevel = () => {
    if (readBooksCount >= 10) return { stage: '완성된 독서의 숲', desc: '10권 이상 완독하여 울창한 숲을 이루었습니다!', level: 4 };
    if (readBooksCount >= 5) return { stage: '풍성한 큰 나무', desc: '5권 이상 완독하여 탐스러운 열매가 맺혔습니다.', level: 3 };
    if (readBooksCount >= 1) return { stage: '파릇파릇한 새싹', desc: '첫 완독을 달성하고 파릇파릇 자라납니다.', level: 2 };
    return { stage: '꿈꾸는 독서 씨앗', desc: '첫 책을 읽고 씨앗을 자라나게 해보세요!', level: 1 };
  };

  const treeInfo = getTreeLevel();

  // 배지 업적 시스템
  const badges = [
    { id: 1, title: '첫 걸음', desc: '첫 도서 서재에 등록', unlocked: books.length > 0, icon: '🌱' },
    { id: 2, title: '첫 완독 정복', desc: '첫 번째 책 완독 달성', unlocked: readBooksCount >= 1, icon: '🏆' },
    { id: 3, title: '열독가', desc: '누적 독서 1시간(60분) 달성', unlocked: totalMinutes >= 60, icon: '⏱️' },
    { id: 4, title: '다독왕', desc: '총 5권 이상 완독', unlocked: readBooksCount >= 5, icon: '👑' },
    { id: 5, title: '지식의 숲', desc: '총 10권 이상 완독', unlocked: readBooksCount >= 10, icon: '🌳' },
    { id: 6, title: '페이지 수집가', desc: '총 100페이지 이상 읽기', unlocked: totalPages >= 100, icon: '📖' },
  ];

  return (
    <div className="reading-stats-container">
      <div className="stats-header text-center">
        <h2><Trophy className="text-warning inline-block me-2" size={28} /> 독서 리포트 & 성장 숲</h2>
        <p className="sub-text">당신의 지식과 지혜가 자라나는 과정을 한눈에 확인하세요.</p>
      </div>

      {/* 대시보드 4대 지표 카드 */}
      <div className="stats-summary-grid mt-4">
        <div className="stat-card border-blue">
          <BookOpen className="stat-icon text-blue" size={24} />
          <div>
            <span className="stat-value">{books.length}권</span>
            <span className="stat-label">서재 총 책 수</span>
          </div>
        </div>

        <div className="stat-card border-green">
          <CheckCircle className="stat-icon text-green" size={24} />
          <div>
            <span className="stat-value">{readBooksCount}권</span>
            <span className="stat-label">완독한 책</span>
          </div>
        </div>

        <div className="stat-card border-amber">
          <Clock className="stat-icon text-amber" size={24} />
          <div>
            <span className="stat-value">{totalMinutes}분</span>
            <span className="stat-label">누적 집중 독서</span>
          </div>
        </div>

        <div className="stat-card border-purple">
          <Flame className="stat-icon text-purple" size={24} />
          <div>
            <span className="stat-value">{temperature}°C</span>
            <span className="stat-label">독서 온도계</span>
          </div>
        </div>
      </div>

      {/* 성장하는 독서 나무 & 온도계 섹션 */}
      <div className="growth-section-grid mt-4">
        {/* 독서 나무 카드 */}
        <div className="tree-card text-center p-4">
          <h3><TreePine className="text-success inline-block me-1" size={22} /> 성장하는 독서 나무</h3>
          <p className="sub-text">{treeInfo.desc}</p>

          <div className="tree-visual mt-4">
            <div className={`tree-avatar level-${treeInfo.level}`}>
              {treeInfo.level === 1 && '🌱'}
              {treeInfo.level === 2 && '🌿'}
              {treeInfo.level === 3 && '🌳'}
              {treeInfo.level === 4 && '🌲✨'}
            </div>
            <h4 className="tree-stage-title mt-2">{treeInfo.stage}</h4>
          </div>
        </div>

        {/* 온도계 & 서재 열정 지수 */}
        <div className="temp-card p-4">
          <h3><Flame className="text-danger inline-block me-1" size={22} /> 내 서재 열정 온도계</h3>
          <p className="sub-text">책을 읽을수록 서재의 온도가 뜨겁게 피어오릅니다.</p>

          <div className="temp-meter-wrapper mt-4">
            <div className="temp-bar-bg">
              <div
                className="temp-bar-fill"
                style={{ width: `${temperature}%`, backgroundColor: temperature > 70 ? '#ef4444' : temperature > 50 ? '#f59e0b' : '#3b82f6' }}
              ></div>
            </div>
            <div className="flex justify-between mt-2 font-bold">
              <span>36.5°C (시작)</span>
              <span className="text-danger">{temperature}°C</span>
              <span>100°C (최고)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 달성 배지 그리드 */}
      <div className="badges-section mt-5">
        <h3><Award className="text-warning inline-block me-1" size={24} /> 독서 업적 배지 목록</h3>
        <p className="sub-text">다양한 미션을 달성하여 귀여운 독서 배지들을 수집해보세요.</p>

        <div className="badges-grid mt-3">
          {badges.map((b) => (
            <div key={b.id} className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}>
              <div className="badge-icon-box">
                {b.unlocked ? b.icon : <Lock size={20} className="text-sub" />}
              </div>
              <div className="badge-info">
                <h4>{b.title}</h4>
                <p>{b.desc}</p>
                <span className={`badge-status-pill ${b.unlocked ? 'status-unlocked' : 'status-locked'}`}>
                  {b.unlocked ? '✨ 달성 완료' : '🔒 잠김'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
