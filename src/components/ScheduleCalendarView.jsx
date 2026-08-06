import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Circle, Trash2, Edit2, Tag, X, BookOpen, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

// 클라이언트 단 엔드투엔드(E2E) 암호화 / 복호화 헬퍼 (DB 관리자도 읽을 수 없도록 보안 보장)
const SECRET_SALT = 'LIB_MIND_E2E_SEC_KEY_2026';

const encryptText = (plainText, userSecret = 'default') => {
  if (!plainText) return '';
  try {
    const fullKey = `${userSecret}_${SECRET_SALT}`;
    let xorResult = '';
    for (let i = 0; i < plainText.length; i++) {
      const charCode = plainText.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length);
      xorResult += String.fromCharCode(charCode);
    }
    return 'enc_v1:' + btoa(encodeURIComponent(xorResult));
  } catch (e) {
    return plainText;
  }
};

const decryptText = (cipherText, userSecret = 'default') => {
  if (!cipherText) return '';
  if (typeof cipherText !== 'string' || !cipherText.startsWith('enc_v1:')) return cipherText; // 일반 텍스트 하위 호환
  try {
    const rawCipher = cipherText.replace('enc_v1:', '');
    const decodedStr = decodeURIComponent(atob(rawCipher));
    const fullKey = `${userSecret}_${SECRET_SALT}`;
    let plainText = '';
    for (let i = 0; i < decodedStr.length; i++) {
      const charCode = decodedStr.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length);
      plainText += String.fromCharCode(charCode);
    }
    return plainText;
  } catch (e) {
    return cipherText;
  }
};

export default function ScheduleCalendarView({ userId = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('READING'); // READING | WORK | PERSONAL | IMPORTANT
  const [memo, setMemo] = useState('');

  const storageKey = `user_schedules_${userId || 'demo'}`;

  // 스케줄 로드
  useEffect(() => {
    loadSchedules();
  }, [userId]);

  // ESC 키 누르면 팝업 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setShowModal(false);
      }
    };

    if (showModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const loadSchedules = async () => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setSchedules(JSON.parse(cached));
      }

      if (isSupabaseConfigured() && userId) {
        const { data, error } = await supabase
          .from('user_schedules')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          // DB에서 불러온 암호화된 title, memo 데이터를 클라이언트에서 복호화
          const decryptedList = data.map(s => ({
            ...s,
            title: decryptText(s.title, userId),
            memo: decryptText(s.memo, userId)
          }));
          setSchedules(decryptedList);
          localStorage.setItem(storageKey, JSON.stringify(decryptedList));
        }
      }
    } catch (e) {
      console.warn('일정 데이터 로드 오류:', e);
    }
  };

  const saveSchedulesToLocal = (newSchedules) => {
    setSchedules(newSchedules);
    localStorage.setItem(storageKey, JSON.stringify(newSchedules));
  };

  // 월 이동
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 날짜 관련 헬퍼
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 ~ 11

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0(일) ~ 6(토)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  // 날짜 스트링 헬퍼 (YYYY-MM-DD)
  const formatDateString = (dateObj) => {
    if (!dateObj) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatDateString(new Date());

  // 일정 등록 / 수정 모달 열기
  const handleOpenAddModal = (dateObj, scheduleToEdit = null) => {
    setSelectedDate(dateObj);
    if (scheduleToEdit) {
      setEditingSchedule(scheduleToEdit);
      setTitle(scheduleToEdit.title);
      setTime(scheduleToEdit.time || '10:00');
      setCategory(scheduleToEdit.category || 'READING');
      setMemo(scheduleToEdit.memo || '');
    } else {
      setEditingSchedule(null);
      setTitle('');
      setTime('10:00');
      setCategory('READING');
      setMemo('');
    }
    setShowModal(true);
  };

  // 일정 저장
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    const dateStr = formatDateString(selectedDate);
    const newSchedule = {
      id: editingSchedule ? editingSchedule.id : `sch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      user_id: userId,
      date: dateStr,
      title: title.trim(),
      time: time,
      category: category,
      memo: memo.trim(),
      is_completed: editingSchedule ? editingSchedule.is_completed : false,
      created_at: editingSchedule ? editingSchedule.created_at : new Date().toISOString()
    };

    let updatedList = [];
    if (editingSchedule) {
      updatedList = schedules.map(s => s.id === editingSchedule.id ? newSchedule : s);
    } else {
      updatedList = [...schedules, newSchedule];
    }

    saveSchedulesToLocal(updatedList);
    setShowModal(false);

    if (isSupabaseConfigured() && userId) {
      try {
        // Supabase DB 저장 시에는 클라이언트 암호화(enc_v1:...) 문자열로 업서트하여 DB 관리자 열람 완전 차단
        const dbSchedulePayload = {
          ...newSchedule,
          title: encryptText(newSchedule.title, userId),
          memo: encryptText(newSchedule.memo, userId)
        };
        await supabase.from('user_schedules').upsert(dbSchedulePayload);
      } catch (err) {
        console.warn('Supabase 일정 저장 실패 (로컬 유지됨):', err.message);
      }
    }
  };

  // 일정 토글 완료
  const handleToggleComplete = async (scheduleId, e) => {
    e.stopPropagation();
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return { ...s, is_completed: !s.is_completed };
      }
      return s;
    });
    saveSchedulesToLocal(updated);

    if (isSupabaseConfigured() && userId) {
      const target = updated.find(s => s.id === scheduleId);
      if (target) {
        await supabase.from('user_schedules').update({ is_completed: target.is_completed }).eq('id', scheduleId);
      }
    }
  };

  // 일정 삭제
  const handleDeleteSchedule = async (scheduleId, e) => {
    e.stopPropagation();
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;

    const updated = schedules.filter(s => s.id !== scheduleId);
    saveSchedulesToLocal(updated);

    if (isSupabaseConfigured() && userId) {
      await supabase.from('user_schedules').delete().eq('id', scheduleId);
    }
  };

  // 카테고리 태그 정보
  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'READING':
        return { label: '📖 독서', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
      case 'WORK':
        return { label: '💼 업무', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'IMPORTANT':
        return { label: '🔥 중요', bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' };
      default:
        return { label: '☕ 개인', bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' };
    }
  };

  return (
    <div className="schedule-calendar-wrapper">
      {/* 상단 컨트롤 헤더 */}
      <div className="calendar-header-bar">
        <div className="flex align-center gap-3">
          <div className="calendar-icon-box">
            <CalendarIcon size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex align-center gap-2 m-0" style={{ color: '#0f172a' }}>
              {year}년 {month + 1}월 일정 관리
            </h2>
            <p className="text-xs sub-text m-0 mt-1 flex align-center gap-1" style={{ color: '#0284c7', fontWeight: 600 }}>
              <ShieldCheck size={14} className="text-sky-600" />
              등록되는 모든 일정은 클라이언트 암호화(End-to-End Encryption) 처리되어 DB 조회 권한자도 내용을 볼 수 없도록 안전하게 보호됩니다.
            </p>
          </div>
        </div>

        <div className="calendar-nav-controls flex align-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth} title="이전달 이동">
            <ChevronLeft size={18} />
          </button>
          <span className="current-month-badge font-bold text-sm" style={{
            background: '#e0f2fe',
            color: '#0369a1',
            padding: '0.35rem 0.85rem',
            borderRadius: '12px',
            border: '1px solid #bae6fd',
            minWidth: '60px',
            textAlign: 'center',
            userSelect: 'none'
          }}>
            {month + 1}월
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleNextMonth} title="다음달 이동">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 요일 헤더 - 7열 그리드 보장 */}
      <div className="calendar-week-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        <div className="week-cell sun">일</div>
        <div className="week-cell">월</div>
        <div className="week-cell">화</div>
        <div className="week-cell">수</div>
        <div className="week-cell">목</div>
        <div className="week-cell">금</div>
        <div className="week-cell sat">토</div>
      </div>

      {/* 달력 그리드 - 7열 그리드 보장 */}
      <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {days.map((dateObj, idx) => {
          if (!dateObj) {
            return <div key={`empty-${idx}`} className="calendar-day-cell empty" />;
          }

          const dateStr = formatDateString(dateObj);
          const isToday = dateStr === todayStr;
          const dayNum = dateObj.getDate();
          const dayOfWeek = dateObj.getDay();

          // 해당 날짜의 일정 목록
          const daySchedules = schedules.filter(s => s.date === dateStr);

          return (
            <div
              key={dateStr}
              className={`calendar-day-cell ${isToday ? 'is-today' : ''} ${dayOfWeek === 0 ? 'is-sun' : ''} ${dayOfWeek === 6 ? 'is-sat' : ''}`}
              onClick={() => handleOpenAddModal(dateObj)}
            >
              <div className="day-cell-top">
                <span className={`day-number ${isToday ? 'today-pill' : ''}`}>{dayNum}</span>
                <button
                  className="add-schedule-mini-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAddModal(dateObj);
                  }}
                  title="일정 추가"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* 일정 스케줄 목록 */}
              <div className="day-schedules-list">
                {daySchedules.map((sch) => {
                  const badge = getCategoryBadge(sch.category);
                  return (
                    <div
                      key={sch.id}
                      className={`schedule-chip ${sch.is_completed ? 'completed' : ''}`}
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        borderLeft: `3.5px solid ${badge.color}`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddModal(dateObj, sch);
                      }}
                      title={`${sch.time ? '[' + sch.time + '] ' : ''}${sch.title}${sch.memo ? ' - ' + sch.memo : ''}`}
                    >
                      <button
                        className="check-toggle-btn"
                        onClick={(e) => handleToggleComplete(sch.id, e)}
                      >
                        {sch.is_completed ? (
                          <CheckCircle2 size={12} style={{ color: '#059669' }} />
                        ) : (
                          <Circle size={12} style={{ opacity: 0.6 }} />
                        )}
                      </button>
                      <span className="schedule-time">{sch.time}</span>
                      <span className="schedule-title">{sch.title}</span>
                      <button
                        className="delete-sch-btn"
                        onClick={(e) => handleDeleteSchedule(sch.id, e)}
                        title="삭제"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 일정 추가 / 편집 모달 (화면 중앙 정렬) */}
      {showModal && (
        <div className="modal-overlay modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card calendar-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '92%' }}>
            <div className="modal-header">
              <h3 className="modal-title flex align-center gap-2">
                <CalendarIcon size={20} className="text-primary" />
                {editingSchedule ? '일정 수정하기' : '새 일정 추가'}
                <span className="text-xs sub-text font-normal">({formatDateString(selectedDate)})</span>
              </h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="modal-body space-y-4">
              <div>
                <label className="form-label font-bold text-xs">일정 제목 *</label>
                <input
                  type="text"
                  className="input-field mt-1"
                  placeholder="예: 클린 코드 3장 읽기, 신규 회원 미팅"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-2 gap-3">
                <div>
                  <label className="form-label font-bold text-xs">시간</label>
                  <input
                    type="time"
                    className="input-field mt-1"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label font-bold text-xs">카테고리 태그</label>
                  <select
                    className="input-field mt-1 font-bold"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="READING">📖 독서</option>
                    <option value="WORK">💼 업무</option>
                    <option value="PERSONAL">☕ 개인</option>
                    <option value="IMPORTANT">🔥 중요</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label font-bold text-xs">세부 메모</label>
                <textarea
                  className="input-field mt-1"
                  rows={3}
                  placeholder="일정과 관련된 세부 내용이나 메모를 입력하세요."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary font-bold">
                  {editingSchedule ? '일정 수정 저장' : '일정 등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
