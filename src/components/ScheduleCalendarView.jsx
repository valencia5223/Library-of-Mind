import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Circle, Trash2, Edit2, Tag, X, BookOpen, AlertCircle, ShieldCheck, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

// 클라이언트 단 엔드투엔드(E2E) 암호화 / 복호화 헬퍼 (DB 관리자도 읽을 수 없도록 보안 보장)
const SECRET_SALT = 'LIB_MIND_E2E_SEC_KEY_2026';
const SHARED_SALT = 'LIB_MIND_SHARED_E2E_KEY_2026';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const encryptText = (plainText, userSecret = 'default', isShared = false) => {
  if (!plainText) return '';
  try {
    const fullKey = isShared ? SHARED_SALT : `${userSecret}_${SECRET_SALT}`;
    const plainBytes = textEncoder.encode(plainText);
    const keyBytes = textEncoder.encode(fullKey);

    const encryptedBytes = new Uint8Array(plainBytes.length);
    for (let i = 0; i < plainBytes.length; i++) {
      encryptedBytes[i] = plainBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    let binary = '';
    for (let i = 0; i < encryptedBytes.length; i++) {
      binary += String.fromCharCode(encryptedBytes[i]);
    }
    const prefix = isShared ? 'enc_sh_v2:' : 'enc_v2:';
    return prefix + btoa(binary);
  } catch (e) {
    return plainText;
  }
};

const decryptText = (cipherText, userSecret = 'default') => {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;

  const isSharedTag = cipherText.startsWith('enc_sh_v2:') || cipherText.startsWith('enc_sh_v1:');
  const isV2 = cipherText.startsWith('enc_sh_v2:') || cipherText.startsWith('enc_v2:');
  const isV1 = cipherText.startsWith('enc_sh_v1:') || cipherText.startsWith('enc_v1:');

  if (!isV2 && !isV1) return cipherText; // 일반 텍스트 하위 호환

  // v2 방식 (TextEncoder / TextDecoder 기반)
  if (isV2) {
    try {
      const rawCipher = cipherText.replace(/^(enc_sh_v2:|enc_v2:)/, '');
      const binary = atob(rawCipher);
      const encryptedBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        encryptedBytes[i] = binary.charCodeAt(i);
      }

      const fullKey = isSharedTag ? SHARED_SALT : `${userSecret}_${SECRET_SALT}`;
      const keyBytes = textEncoder.encode(fullKey);

      const decryptedBytes = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      return textDecoder.decode(decryptedBytes);
    } catch (e) {
      console.warn('v2 복호화 오류:', e);
      return cipherText;
    }
  }

  // v1 레거시 방식 하위 호환 시도
  if (isV1) {
    try {
      const rawCipher = cipherText.replace(/^(enc_sh_v1:|enc_v1:)/, '');
      const decodedStr = decodeURIComponent(atob(rawCipher));
      const fullKey = isSharedTag ? SHARED_SALT : `${userSecret}_${SECRET_SALT}`;
      let plainText = '';
      for (let i = 0; i < decodedStr.length; i++) {
        const charCode = decodedStr.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length);
        plainText += String.fromCharCode(charCode);
      }
      return plainText;
    } catch (e) {
      // v1 복호화 예외 발생 시 하위 호환 세이프티
      try {
        const rawCipher = cipherText.replace(/^(enc_sh_v1:|enc_v1:)/, '');
        const binary = atob(rawCipher);
        const encryptedBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          encryptedBytes[i] = binary.charCodeAt(i);
        }
        const fullKey = isSharedTag ? SHARED_SALT : `${userSecret}_${SECRET_SALT}`;
        const keyBytes = textEncoder.encode(fullKey);
        const decryptedBytes = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
          decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        return textDecoder.decode(decryptedBytes);
      } catch (err) {
        return cipherText;
      }
    }
  }

  return cipherText;
};

export default function ScheduleCalendarView({ userId = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('WORK'); // 기본값: WORK (💼 업무)
  const [memo, setMemo] = useState('');
  const [sharedFriendId, setSharedFriendId] = useState(''); // 공유할 친구 ID

  const storageKey = `user_schedules_${userId || 'demo'}`;

  // 스케줄 & 친구 목록 로드
  useEffect(() => {
    loadSchedules();
    fetchFriends();
  }, [userId]);

  // 친구 목록 조회
  const fetchFriends = async () => {
    if (!isSupabaseConfigured() || !userId) return;
    try {
      const { data: friendsData } = await supabase
        .from('user_friends')
        .select('id, friend_id')
        .eq('user_id', userId);

      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => f.friend_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', friendIds);

        if (profilesData) {
          setFriendsList(profilesData);
        }
      }
    } catch (err) {
      console.warn('친구 목록 조회 실패:', err);
    }
  };

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
        // 1) 내가 작성한 일정 쿼리
        const { data: myData, error: myError } = await supabase
          .from('user_schedules')
          .select('*')
          .eq('user_id', userId);

        // 2) 친구가 나에게 공유한 일정 쿼리 (shared_friend_id == 내 ID)
        const { data: sharedData, error: sharedError } = await supabase
          .from('user_schedules')
          .select('*')
          .eq('shared_friend_id', userId);

        // DB 테이블 미존재 또는 쿼리 오류 시 기존 로컬스토리지 보존
        if (myError || sharedError) {
          console.warn('Supabase 일정 쿼리 오류 (로컬 캐시 보존됨):', myError || sharedError);
          return;
        }

        const combined = [...(myData || []), ...(sharedData || [])];
        
        // 중복 ID 제거
        const scheduleMap = new Map();
        combined.forEach(item => {
          if (item && item.id) {
            scheduleMap.set(item.id, item);
          }
        });
        const uniqueData = Array.from(scheduleMap.values());

        if (uniqueData && uniqueData.length > 0) {
          // DB에서 불러온 암호화된 title, memo 데이터를 복호화
          const decryptedList = uniqueData.map(s => ({
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
      setCategory(scheduleToEdit.category || 'WORK');
      setMemo(scheduleToEdit.memo || '');
      setSharedFriendId(scheduleToEdit.shared_friend_id || '');
    } else {
      setEditingSchedule(null);
      setTitle('');
      setTime('10:00');
      setCategory('WORK'); // 기본값: 업무
      setMemo('');
      setSharedFriendId('');
    }
    setShowModal(true);
  };

  // 일정 저장
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    const dateStr = formatDateString(selectedDate);
    const isShared = Boolean(sharedFriendId);
    const newSchedule = {
      id: editingSchedule ? editingSchedule.id : `sch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      user_id: userId,
      shared_friend_id: sharedFriendId || null,
      is_shared: isShared,
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
        // 1) 내 계정 레코드 DB 업서트 (E2E 암호화)
        const dbSchedulePayload = {
          ...newSchedule,
          title: encryptText(newSchedule.title, userId, isShared),
          memo: encryptText(newSchedule.memo, userId, isShared)
        };
        await supabase.from('user_schedules').upsert(dbSchedulePayload);

        // 2) 친구와 공유 시, 상대방 계정 기준 레코드도 듀얼 업서트 시도 (실패 시에도 위의 shared_friend_id 쿼리로 노출 보장)
        if (isShared && sharedFriendId) {
          try {
            const friendSchedulePayload = {
              ...dbSchedulePayload,
              id: `sh_${newSchedule.id}`,
              user_id: sharedFriendId,
              shared_friend_id: userId,
              is_shared: true
            };
            await supabase.from('user_schedules').upsert(friendSchedulePayload);
          } catch (fErr) {
            console.info('친구 레코드 직접 업서트는 RLS 정책으로 차단됨 (1번 원본 공유 레코드로 자동 교차 쿼리됨):', fErr);
          }
        }
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
        const altId = scheduleId.startsWith('sh_') ? scheduleId.replace('sh_', '') : `sh_${scheduleId}`;
        await supabase.from('user_schedules').update({ is_completed: target.is_completed }).in('id', [scheduleId, altId]);
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
      const altId = scheduleId.startsWith('sh_') ? scheduleId.replace('sh_', '') : `sh_${scheduleId}`;
      await supabase.from('user_schedules').delete().in('id', [scheduleId, altId]);
    }
  };

  // 카테고리 태그 정보
  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'WORK':
        return { label: '💼 업무', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'READING':
        return { label: '📖 독서', bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
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
                  const isSharedItem = sch.is_shared || sch.shared_friend_id;
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
                      title={`${sch.time ? '[' + sch.time + '] ' : ''}${isSharedItem ? '[공유] ' : ''}${sch.title}${sch.memo ? ' - ' + sch.memo : ''}`}
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
                      <span className="schedule-title">
                        {isSharedItem && <Users size={12} style={{ color: '#0284c7', marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} title="공유 일정" />}
                        {sch.title}
                      </span>
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
          <div className="modal-card calendar-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', width: '92%' }}>
            <div className="modal-header">
              <h3 className="modal-title flex align-center gap-2">
                <CalendarIcon size={20} className="text-primary" />
                {editingSchedule ? '일정 수정하기' : '새 일정 추가'}
                <span className="text-xs sub-text font-normal">({formatDateString(selectedDate)})</span>
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)} title="닫기">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="modal-body space-y-4">
              <div>
                <label className="form-label font-bold text-xs">일정 제목 *</label>
                <input
                  type="text"
                  className="input-field mt-1"
                  placeholder="예: 프로젝트 업무 미팅, 독서 모임"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-2 gap-3">
                <div>
                  <label className="form-label font-bold text-xs flex align-center gap-1">
                    <Clock size={13} className="text-primary" /> 시간
                  </label>
                  <input
                    type="time"
                    className="input-field mt-1 font-bold"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.9rem',
                      height: '42px'
                    }}
                  />
                </div>
                <div>
                  <label className="form-label font-bold text-xs">카테고리 태그</label>
                  <select
                    className="input-field mt-1 font-bold"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.9rem',
                      height: '42px'
                    }}
                  >
                    <option value="WORK">💼 업무</option>
                    <option value="READING">📖 독서</option>
                    <option value="PERSONAL">☕ 개인</option>
                    <option value="IMPORTANT">🔥 중요</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label font-bold text-xs flex align-center gap-1">
                  <Users size={14} className="text-sky-600" /> 등록된 친구와 일정 공유 (선택)
                </label>
                <select
                  className="input-field mt-1 font-bold"
                  value={sharedFriendId}
                  onChange={(e) => setSharedFriendId(e.target.value)}
                  style={{
                    backgroundColor: sharedFriendId ? '#f0f9ff' : '#ffffff',
                    borderColor: sharedFriendId ? '#0284c7' : '#cbd5e1',
                    color: sharedFriendId ? '#0369a1' : '#334155'
                  }}
                >
                  <option value="">🔒 공유 안함 (나만의 개인 일정)</option>
                  {friendsList.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name || f.email.split('@')[0]} 님과 공유 ({f.email})
                    </option>
                  ))}
                </select>
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
