import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, Plus, Trash2, Flame, Calendar, Sparkles, Clock, ArrowRight } from 'lucide-react';

export const HABIT_CATEGORIES = [
  { id: 'health', name: '💊 건강/영양제', bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  { id: 'workout', name: '🏃 운동/산책', bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  { id: 'water', name: '💧 물 2L 마시기', bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  { id: 'target', name: '🎯 개인 목표', bg: '#fef3c7', text: '#b45309', border: '#fde047' },
  { id: 'work', name: '💼 업무/작업', bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
  { id: 'hobby', name: '🎨 취미/독서', bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' }
];

const INITIAL_HABITS = [
  { id: 'h_1', title: '비타민 & 영양제 챙겨먹기 💊', category: 'health', type: 'routine', targetDay: 'today', completed: false, lastResetDate: new Date().toDateString() },
  { id: 'h_2', title: '물 1.5L 이상 마시기 💧', category: 'water', type: 'routine', targetDay: 'today', completed: false, lastResetDate: new Date().toDateString() },
  { id: 'h_3', title: '가벼운 스트레칭 15분 🏃', category: 'workout', type: 'routine', targetDay: 'today', completed: false, lastResetDate: new Date().toDateString() },
  { id: 'h_4', title: '하루 20분 독서 & 생각 정리 📖', category: 'hobby', type: 'routine', targetDay: 'today', completed: false, lastResetDate: new Date().toDateString() }
];

export default function DailyHabitBoardModal({ isOpen, onClose }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('daily_habits_and_tasks');
      if (saved) {
        let parsed = JSON.parse(saved);
        const todayStr = new Date().toDateString();

        // 자정 지난 경우 자동 날짜 변환 및 루틴 리셋 처리
        parsed = parsed.map(item => {
          let updated = { ...item };
          // 내일 계획으로 등록되었던 할 일이 날짜가 지나 오늘이 된 경우
          if (updated.targetDay === 'tomorrow' && updated.lastResetDate !== todayStr) {
            updated.targetDay = 'today';
            updated.lastResetDate = todayStr;
          }
          // 자정 지난 경우 루틴 항목 자동 리셋
          if (updated.type === 'routine' && updated.lastResetDate !== todayStr) {
            updated.completed = false;
            updated.lastResetDate = todayStr;
          }
          return updated;
        });
        return parsed;
      }
    } catch (e) {}
    return INITIAL_HABITS;
  });

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('work');
  const [type, setType] = useState('todo'); // 기본 선택값: 일회성 할일 (todo)
  const [targetDay, setTargetDay] = useState('today'); // 'today' | 'tomorrow'
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'tomorrow' | 'routine'

  // ESC 키 누르면 창 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 변경 시 localStorage 저장
  useEffect(() => {
    try {
      localStorage.setItem('daily_habits_and_tasks', JSON.stringify(items));
    } catch (e) {}
  }, [items]);

  if (!isOpen) return null;

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title.trim(),
      category,
      type,
      targetDay,
      completed: false,
      createdAt: new Date().toISOString(),
      lastResetDate: new Date().toDateString()
    };

    setItems(prev => [newItem, ...prev]);
    setTitle('');
  };

  const handleToggle = (id) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    }));
  };

  const handleDelete = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // 오늘 할 일 목록 및 달성률
  const todayItems = items.filter(i => i.targetDay !== 'tomorrow');
  const tomorrowItems = items.filter(i => i.targetDay === 'tomorrow');
  const routineItems = items.filter(i => i.type === 'routine');

  const completedTodayCount = todayItems.filter(i => i.completed).length;
  const totalTodayCount = todayItems.length;
  const progressPercent = totalTodayCount > 0 ? Math.round((completedTodayCount / totalTodayCount) * 100) : 0;

  // 탭 필터링된 항목
  let displayedItems = todayItems;
  if (activeTab === 'tomorrow') displayedItems = tomorrowItems;
  if (activeTab === 'routine') displayedItems = routineItems;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '660px', maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Sparkles size={24} style={{ color: '#10b981' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800 }}>
                ✅ 오늘의 할일 & 루틴 관리
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                오늘의 할 일부터 내일 계획까지 스마트하게 기록하세요. (ESC 키로 닫기)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
            title="닫기 (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* 달성률 프로그레스 바 영역 */}
        <div style={{ padding: '1.1rem 1.5rem', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={18} style={{ color: '#f97316' }} />
              오늘의 달성 현황 ({completedTodayCount} / {totalTodayCount}개 완료)
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: progressPercent === 100 ? '#10b981' : '#0284c7' }}>
              {progressPercent}% {progressPercent === 100 && '🎉 완벽 완수!'}
            </span>
          </div>

          <div style={{ width: '100%', height: '12px', backgroundColor: '#cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPercent}%`, height: '100%',
              backgroundColor: progressPercent === 100 ? '#10b981' : '#0284c7',
              borderRadius: '6px', transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* 바디 컨텐츠 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', backgroundColor: '#fafafa' }}>
          
          {/* 새 할일 입력 폼 */}
          <form onSubmit={handleAddItem} style={{
            backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '18px', border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.85rem'
          }}>
            {/* 상단 날짜 설정 & 입력란 */}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={targetDay === 'today' ? "오늘 할 일을 입력하세요..." : "내일 미리 준비할 계획을 입력하세요..."}
                style={{
                  flex: 1, padding: '0.65rem 0.9rem', fontSize: '0.88rem', borderRadius: '10px',
                  border: '1.5px solid #cbd5e1', outline: 'none', fontWeight: 600, color: '#1e293b'
                }}
              />
              <button
                type="submit"
                disabled={!title.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 1.1rem',
                  backgroundColor: title.trim() ? (targetDay === 'today' ? '#10b981' : '#6366f1') : '#94a3b8',
                  color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700,
                  cursor: title.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s ease'
                }}
              >
                <Plus size={16} /> {targetDay === 'today' ? '오늘 추가' : '내일 등록'}
              </button>
            </div>

            {/* 세부 옵션: 날짜 / 유형 / 카테고리 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
              
              {/* 1) 수행 날짜 선택 (오늘 vs 내일) */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTargetDay('today')}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none',
                    backgroundColor: targetDay === 'today' ? '#ffffff' : 'transparent',
                    color: targetDay === 'today' ? '#10b981' : '#64748b',
                    fontWeight: targetDay === 'today' ? 800 : 600, cursor: 'pointer',
                    boxShadow: targetDay === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  ☀️ 오늘 할 일
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDay('tomorrow')}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none',
                    backgroundColor: targetDay === 'tomorrow' ? '#6366f1' : 'transparent',
                    color: targetDay === 'tomorrow' ? '#ffffff' : '#64748b',
                    fontWeight: targetDay === 'tomorrow' ? 800 : 600, cursor: 'pointer',
                    boxShadow: targetDay === 'tomorrow' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  🌅 내일 미리 계획
                </button>
              </div>

              {/* 2) 유형 선택 (기본: 일회성 할일) */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setType('todo')}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none',
                    backgroundColor: type === 'todo' ? '#ffffff' : 'transparent',
                    color: type === 'todo' ? '#0f172a' : '#64748b',
                    fontWeight: type === 'todo' ? 800 : 600, cursor: 'pointer',
                    boxShadow: type === 'todo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  📌 일회성 할일 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setType('routine')}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none',
                    backgroundColor: type === 'routine' ? '#ffffff' : 'transparent',
                    color: type === 'routine' ? '#0f172a' : '#64748b',
                    fontWeight: type === 'routine' ? 800 : 600, cursor: 'pointer',
                    boxShadow: type === 'routine' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  🔁 매일 루틴
                </button>
              </div>

              {/* 3) 카테고리 태그 */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', width: '100%', marginTop: '2px' }}>
                {HABIT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      padding: '0.2rem 0.55rem', fontSize: '0.73rem', borderRadius: '8px',
                      backgroundColor: category === cat.id ? cat.bg : '#f1f5f9',
                      color: category === cat.id ? cat.text : '#64748b',
                      border: category === cat.id ? `1.5px solid ${cat.border}` : '1px solid #e2e8f0',
                      fontWeight: category === cat.id ? 800 : 600, cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

            </div>
          </form>

          {/* 탭 구분 (☀️ 오늘 할 일 / 🌅 내일 미리 계획 / 🔁 매일 루틴) */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('today')}
              style={{
                padding: '0.4rem 0.95rem', fontSize: '0.82rem', borderRadius: '20px', border: 'none',
                backgroundColor: activeTab === 'today' ? '#0f172a' : '#e2e8f0',
                color: activeTab === 'today' ? '#ffffff' : '#475569',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              ☀️ 오늘 할 일 ({todayItems.length})
            </button>
            <button
              onClick={() => setActiveTab('tomorrow')}
              style={{
                padding: '0.4rem 0.95rem', fontSize: '0.82rem', borderRadius: '20px', border: 'none',
                backgroundColor: activeTab === 'tomorrow' ? '#6366f1' : '#e2e8f0',
                color: activeTab === 'tomorrow' ? '#ffffff' : '#475569',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              🌅 내일 미리 계획 ({tomorrowItems.length})
            </button>
            <button
              onClick={() => setActiveTab('routine')}
              style={{
                padding: '0.4rem 0.95rem', fontSize: '0.82rem', borderRadius: '20px', border: 'none',
                backgroundColor: activeTab === 'routine' ? '#0f172a' : '#e2e8f0',
                color: activeTab === 'routine' ? '#ffffff' : '#475569',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              🔁 매일 루틴만 ({routineItems.length})
            </button>
          </div>

          {/* 목록 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {displayedItems.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
                {activeTab === 'tomorrow' ? '내일 미리 등록된 계획이 없습니다. 상단에서 내일 할 일을 추가해보세요!' : '등록된 할 일이 없습니다.'}
              </div>
            ) : (
              displayedItems.map(item => {
                const catObj = HABIT_CATEGORIES.find(c => c.id === item.category) || HABIT_CATEGORIES[0];
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 1.1rem', borderRadius: '14px', backgroundColor: '#ffffff',
                      border: item.completed ? '1.5px solid #cbd5e1' : `1.5px solid ${catObj.border}`,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.15s ease',
                      opacity: item.completed ? 0.65 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {item.completed ? (
                          <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                        ) : (
                          <Circle size={22} style={{ color: '#94a3b8' }} />
                        )}
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          fontSize: '0.9rem', fontWeight: 700, color: item.completed ? '#64748b' : '#1e293b',
                          textDecoration: item.completed ? 'line-through' : 'none'
                        }}>
                          {item.title}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px',
                            backgroundColor: catObj.bg, color: catObj.text, fontWeight: 700
                          }}>
                            {catObj.name}
                          </span>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600,
                            color: item.targetDay === 'tomorrow' ? '#6366f1' : '#64748b'
                          }}>
                            {item.targetDay === 'tomorrow' ? '🌅 내일 예정' : (item.type === 'routine' ? '🔁 매일 반복' : '📌 오늘 할일')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', opacity: 0.7 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
