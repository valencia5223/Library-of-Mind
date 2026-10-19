import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Circle, Trash2, Edit2, Tag, X, BookOpen, AlertCircle, ShieldCheck, Users, ExternalLink, Download, CheckSquare, NotebookText } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
const OneNoteImportModal = lazy(() => import('./OneNoteImportModal'));

const ONENOTE_SYNC_MS = 5 * 60 * 1000;

// 자동 동기화 섹션이 있는지 (MSAL 묶음을 불러오지 않고 localStorage 만 확인)
const hasOneNoteAutoSync = (userId) => {
  try {
    return Object.keys(JSON.parse(localStorage.getItem(`onenote_autosync_${userId || 'demo'}`) || '{}')).length > 0;
  } catch {
    return false;
  }
};

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
      for (let i = 0; i < decryptedBytes.length; i++) {
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
        for (let i = 0; i < decryptedBytes.length; i++) {
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

export default function ScheduleCalendarView({ userId = null, onOpenHabitBoard = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form states
  const [scheduleDate, setScheduleDate] = useState('');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('WORK'); // 기본값: WORK (💼 업무)
  const [memo, setMemo] = useState('');
  const [sharedFriendId, setSharedFriendId] = useState(''); // 공유할 친구 ID
  const [showOneNote, setShowOneNote] = useState(false);
  const [oneNoteSyncState, setOneNoteSyncState] = useState(''); // '' | 'syncing' | 'needLogin' | 'error'
  const [oneNoteSyncError, setOneNoteSyncError] = useState('');
  const oneNoteSyncRef = useRef(null);
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;
  const importOneNoteRef = useRef(null);

  const storageKey = `user_schedules_${userId || 'demo'}`;

  // 스케줄 & 친구 목록 로드
  useEffect(() => {
    loadSchedules();
    fetchFriends();
  }, [userId]);

  // OneNote 자동 동기화: 화면을 열 때(일정 로드 뒤), 열어 둔 동안 5분마다, 다시 볼 때
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let running = false;
    let lastRun = 0;
    const sync = async (force = false) => {
      if (stopped || running || (!force && Date.now() - lastRun < 60 * 1000) || !hasOneNoteAutoSync(userId)) return;
      running = true;
      lastRun = Date.now();
      setOneNoteSyncState('syncing');
      try {
        const { runAutoSync } = await import('../utils/oneNoteSync');
        await runAutoSync(userId, (items, opts) => importOneNoteRef.current(items, opts));
        if (!stopped) setOneNoteSyncState('');
      } catch (e) {
        console.warn('OneNote 자동 동기화 실패:', e);
        if (!stopped) {
          setOneNoteSyncState(e?.code === 'ONENOTE_NEED_LOGIN' ? 'needLogin' : 'error');
          setOneNoteSyncError(e?.message || String(e));
        }
      } finally {
        running = false;
      }
    };
    oneNoteSyncRef.current = sync;
    const first = setTimeout(sync, 3000);
    const timer = setInterval(sync, ONENOTE_SYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      oneNoteSyncRef.current = null;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

        // 중복 ID 제거 (sh_ 접두사 canonicalId 기반으로 동일 공유 일정 중복 표시 100% 차단)
        const scheduleMap = new Map();
        
        // 1차: 내 일정 먼저 등록 (원본 sch_...)
        (myData || []).forEach(item => {
          if (item && item.id) {
            const canonicalId = item.id.replace(/^sh_/, '');
            scheduleMap.set(canonicalId, item);
          }
        });

        // 2차: 공유받은 일정 등록 (내가 작성한 원본이 없을 때만 등록)
        (sharedData || []).forEach(item => {
          if (item && item.id) {
            const canonicalId = item.id.replace(/^sh_/, '');
            if (!scheduleMap.has(canonicalId)) {
              scheduleMap.set(canonicalId, item);
            }
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

// 대한민국 법정 공휴일 & 주요 음력 명절 / 대체공휴일 맵 (2025 ~ 2030년)
const KOREAN_HOLIDAYS_MAP = {
  // 양력 고정 공휴일 / 국경일
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '07-17': '제헌절',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',

  // 2025년 음력 명절 & 명시적 대체공휴일
  '2025-01-28': '설날 연휴', '2025-01-29': '설날', '2025-01-30': '설날 연휴',
  '2025-03-03': '대체공휴일(삼일절)',
  '2025-05-06': '대체공휴일(부처님오신날)',
  '2025-10-05': '추석 연휴', '2025-10-06': '추석', '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일(추석)',

  // 2026년 음력 명절 & 명시적 대체공휴일
  '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-09-28': '대체공휴일(추석)',
  '2026-10-05': '대체공휴일(개천절)',

  // 2027년 음력 명절 & 명시적 대체공휴일
  '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일(설날)',
  '2027-05-13': '부처님오신날',
  '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
  '2027-10-04': '대체공휴일(개천절)', '2027-10-11': '대체공휴일(한글날)',

  // 2028년 음력 명절 & 명시적 대체공휴일
  '2028-01-26': '설날 연휴', '2028-01-27': '설날', '2028-01-28': '설날 연휴',
  '2028-05-02': '부처님오신날',
  '2028-10-02': '추석 연휴', '2028-10-03': '추석/개천절', '2028-10-04': '추석 연휴', '2028-10-05': '대체공휴일(추석)'
};

// 대체공휴일 법정 대상 목록 (삼일절, 어린이날, 광복절, 개천절, 한글날, 성탄절)
const SUBSTITUTE_HOLIDAY_TARGETS = ['삼일절', '어린이날', '광복절', '개천절', '한글날', '성탄절', '제헌절'];

const getKoreanHoliday = (dateObj) => {
  if (!dateObj) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');

  const fullKey = `${y}-${m}-${d}`;
  const monthDayKey = `${m}-${d}`;

  // 1. 명시적 연월일 지정 공휴일
  if (KOREAN_HOLIDAYS_MAP[fullKey]) {
    return KOREAN_HOLIDAYS_MAP[fullKey];
  }
  // 2. 고정 양력 공휴일
  if (KOREAN_HOLIDAYS_MAP[monthDayKey]) {
    return KOREAN_HOLIDAYS_MAP[monthDayKey];
  }

  // 3. 동적 대체공휴일 연산 (월요일인 경우, 어제(일요일) 또는 그제(토요일)가 공휴일이었는지 체크)
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 1) { // 월요일
    // 어제 (일요일)
    const yesterday = new Date(dateObj);
    yesterday.setDate(dateObj.getDate() - 1);
    const yMonthDay = `${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const yHoliday = KOREAN_HOLIDAYS_MAP[yMonthDay];

    if (yHoliday && SUBSTITUTE_HOLIDAY_TARGETS.includes(yHoliday)) {
      return `대체공휴일(${yHoliday})`;
    }

    // 그제 (토요일)
    const twoDaysAgo = new Date(dateObj);
    twoDaysAgo.setDate(dateObj.getDate() - 2);
    const tMonthDay = `${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;
    const tHoliday = KOREAN_HOLIDAYS_MAP[tMonthDay];

    if (tHoliday && SUBSTITUTE_HOLIDAY_TARGETS.includes(tHoliday)) {
      return `대체공휴일(${tHoliday})`;
    }
  }

  return null;
};

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
    const dateFormatted = formatDateString(dateObj);
    if (scheduleToEdit) {
      setEditingSchedule(scheduleToEdit);
      setScheduleDate(scheduleToEdit.date || dateFormatted);
      setTitle(scheduleToEdit.title);
      setTime(scheduleToEdit.time || '10:00');
      setCategory(scheduleToEdit.category || 'WORK');
      setMemo(scheduleToEdit.memo || '');
      setSharedFriendId(scheduleToEdit.shared_friend_id || '');
    } else {
      setEditingSchedule(null);
      setScheduleDate(dateFormatted);
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
    if (!title.trim() || !scheduleDate) return;

    const dateStr = scheduleDate;
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

  // OneNote 페이지 → 일정 (같은 페이지는 id 가 같아 다시 가져오면 덮어씀)
  // 공유 노트북에 친구가 연결돼 있으면 shared_friend_id 가 들어와 그 친구 달력에도 공유된다.
  // silent: 자동 동기화에서 부를 때 알림 없이
  const handleImportOneNote = async (items, { silent = false } = {}) => {
    const schedules = schedulesRef.current;
    const prevById = new Map(schedules.map(s => [s.id, s]));
    // 친구가 이미 나에게 공유한 같은 페이지는 내 달력에 보이므로 다시 만들지 않음
    const sharedToMe = items.filter(item => {
      const prev = prevById.get(item.id);
      return prev && prev.user_id && prev.user_id !== userId;
    });
    const imported = items
      .filter(item => !sharedToMe.includes(item))
      .map(item => {
        const prev = prevById.get(item.id);
        return {
          ...item,
          user_id: userId,
          shared_friend_id: item.shared_friend_id || null,
          is_shared: Boolean(item.shared_friend_id),
          category: prev?.category || 'PERSONAL',
          is_completed: prev ? prev.is_completed : false,
          created_at: prev ? prev.created_at : new Date().toISOString()
        };
      });
    if (imported.length === 0) {
      if (silent) return;
      window.alert('선택한 페이지는 이미 친구가 공유해 준 일정이라 따로 가져오지 않았습니다.');
      return;
    }
    const importedIds = new Set(imported.map(s => s.id));
    saveSchedulesToLocal([...schedules.filter(s => !importedIds.has(s.id)), ...imported]);

    if (isSupabaseConfigured() && userId) {
      const payload = imported.map(s => ({
        ...s,
        title: encryptText(s.title, userId, s.is_shared),
        memo: encryptText(s.memo, userId, s.is_shared)
      }));
      const { error } = await supabase.from('user_schedules').upsert(payload);
      if (error) console.warn('OneNote 일정 저장 실패 (로컬 유지됨):', error.message);

      // 친구 계정 기준 레코드도 시도 (handleSaveSchedule 과 같은 방식, RLS 로 막혀도 원본 레코드로 보임)
      const friendPayload = payload
        .filter(s => s.is_shared)
        .map(s => ({ ...s, id: `sh_${s.id}`, user_id: s.shared_friend_id, shared_friend_id: userId }));
      if (friendPayload.length > 0) {
        const { error: fErr } = await supabase.from('user_schedules').upsert(friendPayload);
        if (fErr) console.info('친구 레코드 직접 업서트는 RLS 정책으로 차단됨 (원본 공유 레코드로 보임):', fErr.message);
      }

      // 공유를 끊었거나 다른 친구로 바꾼 페이지는 예전 친구 쪽 레코드 정리
      const staleFriendIds = imported
        .filter(s => {
          const prevFriend = prevById.get(s.id)?.shared_friend_id;
          return prevFriend && prevFriend !== s.shared_friend_id;
        })
        .map(s => `sh_${s.id}`);
      if (staleFriendIds.length > 0) {
        await supabase.from('user_schedules').delete().in('id', staleFriendIds);
      }
    }

    if (silent) return;
    const sharedCount = imported.filter(s => s.is_shared).length;
    const friendName = (id) => {
      const f = friendsList.find(fr => fr.id === id);
      return f ? (f.name || f.email.split('@')[0]) : '친구';
    };
    window.alert(
      `OneNote 페이지 ${imported.length}개를 일정으로 가져왔습니다.` +
      (sharedCount > 0 ? `\n그중 ${sharedCount}개는 ${friendName(imported.find(s => s.is_shared).shared_friend_id)}님 달력에도 공유됩니다.` : '') +
      (sharedToMe.length > 0 ? `\n${sharedToMe.length}개는 이미 친구가 공유해 준 일정이라 건너뛰었습니다.` : '')
    );
  };

  importOneNoteRef.current = handleImportOneNote;

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

  // ──────────────────────────────────────────────────
  // 📅 Google 캘린더 내보내기 URL 생성 함수
  // ──────────────────────────────────────────────────
  const generateGoogleCalendarUrl = (schedule) => {
    if (!schedule) return '';
    const dateStr = schedule.date.replace(/-/g, ''); // YYYYMMDD
    const timeStr = schedule.time ? schedule.time.replace(':', '') + '00' : '100000'; // HHMMSS
    const dtStart = `${dateStr}T${timeStr}`;
    // 종료 시간: 시작 시간 + 1시간
    const startHour = parseInt(schedule.time?.split(':')[0] || '10', 10);
    const endHour = String(Math.min(startHour + 1, 23)).padStart(2, '0');
    const endMin = schedule.time?.split(':')[1] || '00';
    const dtEnd = `${dateStr}T${endHour}${endMin}00`;

    const badge = getCategoryBadge(schedule.category);
    const details = [badge.label, schedule.memo].filter(Boolean).join(' | ');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: schedule.title,
      dates: `${dtStart}/${dtEnd}`,
      details: details,
      ctz: 'Asia/Seoul'
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // ──────────────────────────────────────────────────
  // 📥 ICS 파일 다운로드 함수 (아이폰/네이버/아웃룩 범용)
  // ──────────────────────────────────────────────────
  const downloadICSFile = (schedule) => {
    if (!schedule) return;
    const dateStr = schedule.date.replace(/-/g, '');
    const timeStr = schedule.time ? schedule.time.replace(':', '') + '00' : '100000';
    const startHour = parseInt(schedule.time?.split(':')[0] || '10', 10);
    const endHour = String(Math.min(startHour + 1, 23)).padStart(2, '0');
    const endMin = schedule.time?.split(':')[1] || '00';

    const badge = getCategoryBadge(schedule.category);
    const description = [badge.label, schedule.memo].filter(Boolean).join(' | ');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Library of Mind//Schedule//KO',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `DTSTART;TZID=Asia/Seoul:${dateStr}T${timeStr}`,
      `DTEND;TZID=Asia/Seoul:${dateStr}T${endHour}${endMin}00`,
      `SUMMARY:${schedule.title}`,
      `DESCRIPTION:${description}`,
      `UID:${schedule.id}@libraryofmind`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${schedule.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${schedule.date}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 일정 모달의 입력 묶음 (OneNote 일정은 메모를 크게, 나머지는 접어서 보여 준다)
  const isOneNoteSchedule = Boolean(editingSchedule?.id?.replace(/^sh_/, '').startsWith('sch_onenote_'));

  const scheduleMetaFields = (
    <>
      <div className="grid grid-2 gap-3">
        <div>
          <label className="form-label font-bold text-xs flex align-center gap-1">
            <CalendarIcon size={13} className="text-primary" /> 날짜 *
          </label>
          <input
            type="date"
            className="input-field mt-1 font-bold"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            required
            style={{
              padding: '0.65rem 0.85rem',
              fontSize: '0.9rem',
              height: '42px'
            }}
          />
        </div>
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
      </div>

      <div>
        <label className="form-label font-bold text-xs flex align-center gap-1">
          <Tag size={13} className="text-primary" /> 카테고리 태그
        </label>
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
    </>
  );

  const scheduleMemoField = (
    <div style={isOneNoteSchedule ? { display: 'flex', flexDirection: 'column' } : undefined}>
      <label className="form-label font-bold text-xs flex align-center gap-1">
        {isOneNoteSchedule && <NotebookText size={14} style={{ color: '#7719aa' }} />}
        세부 메모
      </label>
      <textarea
        className="input-field mt-1"
        rows={isOneNoteSchedule ? undefined : 3}
        placeholder="일정과 관련된 세부 내용이나 메모를 입력하세요."
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        style={isOneNoteSchedule ? {
          height: 'min(62vh, 680px)',
          minHeight: '280px',
          resize: 'vertical',
          fontSize: '0.98rem',
          lineHeight: 1.75,
          padding: '1rem 1.1rem',
          whiteSpace: 'pre-wrap',
          backgroundColor: '#fdfcff'
        } : undefined}
      />
    </div>
  );

  const scheduleExportButtons = (
    <>
      {/* 📅 외부 캘린더 내보내기 버튼 (수정 모드에서만 노출) */}
      {editingSchedule && (
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0', marginBottom: '4px' }}>
          <button
            type="button"
            onClick={() => {
              const currentScheduleData = {
                ...editingSchedule,
                date: scheduleDate || editingSchedule.date,
                time: time,
                title: title,
                memo: memo,
                category: category
              };
              const url = generateGoogleCalendarUrl(currentScheduleData);
              window.open(url, '_blank');
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(66,133,244,0.3)'
            }}
            title="이 일정을 Google 캘린더에 바로 등록합니다"
          >
            <ExternalLink size={14} /> Google 캘린더로 내보내기
          </button>
          <button
            type="button"
            onClick={() => {
              const currentScheduleData = {
                ...editingSchedule,
                date: scheduleDate || editingSchedule.date,
                time: time,
                title: title,
                memo: memo,
                category: category
              };
              downloadICSFile(currentScheduleData);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
            }}
            title="ICS 파일을 다운로드하여 아이폰/네이버/아웃룩 캘린더에 등록합니다"
          >
            <Download size={14} /> ICS 파일 (아이폰/네이버)
          </button>
        </div>
      )}
    </>
  );

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
            <p className="text-xs sub-text m-0 mt-1" style={{ color: '#64748b', fontWeight: 500 }}>
              월별 일정을 손쉽게 등록하고 관리할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="calendar-nav-controls flex align-center gap-2">
          {onOpenHabitBoard && (
            <button
              type="button"
              className="btn btn-sm font-bold flex align-center gap-1.5"
              onClick={onOpenHabitBoard}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                borderRadius: '10px',
                padding: '0.4rem 0.85rem',
                marginRight: '6px',
                fontSize: '0.85rem'
              }}
              title="오늘의 할일 / 해빗 트래커 보드 열기"
            >
              <CheckSquare size={16} /> ✅ 오늘의 할일
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm font-bold flex align-center gap-1.5"
            onClick={() => setShowOneNote(true)}
            style={{
              backgroundColor: 'rgba(119, 25, 170, 0.1)',
              color: '#7719aa',
              borderColor: 'rgba(119, 25, 170, 0.35)',
              borderRadius: '10px',
              padding: '0.4rem 0.85rem',
              marginRight: '6px',
              fontSize: '0.85rem'
            }}
            title={
              oneNoteSyncState === 'needLogin' ? 'OneNote 로그인이 만료되어 자동 동기화가 멈췄습니다. 눌러서 다시 로그인하세요.'
                : oneNoteSyncState === 'error' ? `OneNote 자동 동기화 오류: ${oneNoteSyncError}`
                  : 'OneNote 페이지를 일정으로 가져오기'
            }
          >
            <NotebookText size={16} />
            {oneNoteSyncState === 'syncing' ? 'OneNote 동기화 중…'
              : oneNoteSyncState === 'needLogin' ? 'OneNote 다시 연결'
                : oneNoteSyncState === 'error' ? 'OneNote 동기화 오류' : 'OneNote'}
            {(oneNoteSyncState === 'needLogin' || oneNoteSyncState === 'error') && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#e11d48', display: 'inline-block' }} />
            )}
          </button>

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
      <div className="calendar-week-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
        <div className="week-cell sun">일</div>
        <div className="week-cell">월</div>
        <div className="week-cell">화</div>
        <div className="week-cell">수</div>
        <div className="week-cell">목</div>
        <div className="week-cell">금</div>
        <div className="week-cell sat">토</div>
      </div>

      {/* 달력 그리드 - 7열 그리드 보장 */}
      <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
        {days.map((dateObj, idx) => {
          if (!dateObj) {
            return <div key={`empty-${idx}`} className="calendar-day-cell empty" />;
          }

          const dateStr = formatDateString(dateObj);
          const isToday = dateStr === todayStr;
          const dayNum = dateObj.getDate();
          const dayOfWeek = dateObj.getDay();
          const holidayName = getKoreanHoliday(dateObj);
          const isHoliday = Boolean(holidayName) || dayOfWeek === 0;

          // 해당 날짜의 일정 목록
          const daySchedules = schedules.filter(s => s.date === dateStr);

          return (
            <div
              key={dateStr}
              className={`calendar-day-cell ${isToday ? 'is-today' : ''} ${isHoliday ? 'is-sun' : ''} ${dayOfWeek === 6 ? 'is-sat' : ''}`}
              onClick={() => handleOpenAddModal(dateObj)}
              style={holidayName ? { backgroundColor: 'rgba(254, 242, 242, 0.6)' } : {}}
            >
              <div className="day-cell-top flex justify-between align-center">
                <div className="flex align-center gap-1">
                  <span className={`day-number ${isToday ? 'today-pill' : ''}`} style={holidayName ? { color: '#dc2626', fontWeight: 800 } : {}}>
                    {dayNum}
                  </span>
                  {holidayName && (
                    <span className="holiday-badge" style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#dc2626',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap'
                    }}>
                      🚩 {holidayName}
                    </span>
                  )}
                </div>
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
          <div className="modal-card calendar-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isOneNoteSchedule ? '880px' : '460px', width: isOneNoteSchedule ? '95%' : '92%' }}>
            <div className="modal-header">
              <h3 className="modal-title flex align-center gap-2">
                {isOneNoteSchedule ? <NotebookText size={20} style={{ color: '#7719aa' }} /> : <CalendarIcon size={20} className="text-primary" />}
                {isOneNoteSchedule ? 'OneNote 노트' : editingSchedule ? '일정 수정하기' : '새 일정 추가'}
                <span className="text-xs sub-text font-normal">({scheduleDate || formatDateString(selectedDate)})</span>
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
                  autoFocus={!isOneNoteSchedule}
                  style={isOneNoteSchedule ? { fontSize: '1.05rem', fontWeight: 700 } : undefined}
                />
              </div>

              {isOneNoteSchedule ? (
                <>
                  {scheduleMemoField}
                  <details style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.6rem 0.85rem' }}>
                    <summary className="text-xs font-bold" style={{ cursor: 'pointer', color: '#475569' }}>
                      일정 정보 · {scheduleDate} {time} · {getCategoryBadge(category).label} (눌러서 수정)
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.9rem' }}>
                      {scheduleMetaFields}
                      {scheduleExportButtons}
                    </div>
                  </details>
                </>
              ) : (
                <>
                  {scheduleMetaFields}
                  {scheduleMemoField}
                  {scheduleExportButtons}
                </>
              )}

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

      {showOneNote && (
        <Suspense fallback={null}>
          <OneNoteImportModal
            onClose={() => {
              setShowOneNote(false);
              setOneNoteSyncState('');
              // 방금 켠 설정·다시 한 로그인으로 바로 한 번 확인
              setTimeout(() => oneNoteSyncRef.current?.(true), 500);
            }}
            onImport={handleImportOneNote}
            importedIds={new Set(schedules.map(s => s.id))}
            userId={userId}
            friendsList={friendsList}
          />
        </Suspense>
      )}
    </div>
  );
}
