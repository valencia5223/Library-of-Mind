import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './components/AuthModal';
import BookshelfView from './components/BookshelfView';
import BookSearch from './components/BookSearch';
import ThoughtLedger from './components/ThoughtLedger';
import FocusStudio from './components/FocusStudio';
import ReadingStats from './components/ReadingStats';
import FriendManager from './components/FriendManager';
import AdminApprovalModal from './components/AdminApprovalModal';
import ScheduleCalendarView from './components/ScheduleCalendarView';
import PdfLibraryModal from './components/PdfLibraryModal';
import { BookOpen, Search, MessageSquare, Timer, BarChart2, User, Library, Lock, Sparkles, LogIn, ArrowRight, Users, ShieldCheck, Calendar as CalendarIcon, FileText, CheckSquare, Zap, MoreHorizontal } from 'lucide-react';
import NewsTicker from './components/NewsTicker';
import WeatherWidget from './components/WeatherWidget';
import SharedLiveMemoModal from './components/SharedLiveMemoModal';
import ThemePicker from './components/ThemePicker';
import { alertDialog } from './utils/notify';
import { registerServiceWorker, subscribeUserToPush, isNotificationSupported, getNotificationPermission } from './utils/webPush';
import { randomNudgeMessage } from './utils/nudgeMessages';


// 메인 탭 (위쪽 탭 = label, 핸드폰 아래쪽 탭 바 = short)
const MAIN_TABS = [
  { id: 'schedule', label: '일정관리', short: '일정', icon: CalendarIcon },
  { id: 'bookshelf', label: '내 서재', short: '서재', icon: BookOpen },
  { id: 'search', label: '탐색', short: '탐색', icon: Search },
  { id: 'focus', label: '몰입 스튜디오', short: '몰입', icon: Timer },
  { id: 'stats', label: '독서 리포트', short: '리포트', icon: BarChart2 },
  { id: 'social', label: '이웃 서재', short: '이웃', icon: Users },
];
// 핸드폰 아래쪽 탭 바에 바로 두는 탭 (나머지는 '더보기')
const MOBILE_BAR_IDS = ['schedule', 'bookshelf', 'search', 'social'];
const MOBILE_BAR_TABS = MAIN_TABS.filter((t) => MOBILE_BAR_IDS.includes(t.id));
const MOBILE_MORE_TABS = MAIN_TABS.filter((t) => !MOBILE_BAR_IDS.includes(t.id));

export default function App() {
  const [activeTab, setActiveTab] = useState('schedule'); // 기본 메인화면: 일정관리
  const [showMoreMenu, setShowMoreMenu] = useState(false); // 핸드폰 아래쪽 '더보기'
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const [showPdfLibrary, setShowPdfLibrary] = useState(false);
  const [loading, setLoading] = useState(true);

  // 알림 클릭 시 바로 열리는 1:1 채팅 룸 친구 상태
  const [activeMemoFriend, setActiveMemoFriend] = useState(null);

  // 가입 승인 확인: 승인 여부는 사용자가 못 바꾸는 표 lom_members 에 있고(supabase_schema.sql 끝), 모든 표의 RLS 도
  // 승인된 사람만 통과시킨다. 자동 로그인으로 들어와도 여기서 확인해 승인 전이면 로그아웃한다.
  const isAuthOpenRef = useRef(false);
  isAuthOpenRef.current = isAuthOpen;
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    let alive = true;
    supabase.rpc('lom_my_status').then(({ data, error }) => {
      if (!alive || error) return; // 연결 오류면 그대로 둔다(어차피 DB 가 승인 전 접근을 막음)
      if (data !== true) {
        supabase.auth.signOut();
        setUser(null);
        if (!isAuthOpenRef.current) alertDialog('관리자의 가입 승인 대기 중입니다. 관리자가 승인한 뒤 이용할 수 있어요.', { title: '승인 대기' });
      }
    });
    return () => { alive = false; };
  }, [user?.id]);

  // 관리자 권한 확인 (지정된 관리자 이메일만 허용, 데모 모드는 로컬 전용이므로 허용)
  // 주의: 이메일에 'admin' 이 포함됐다는 이유로 관리자 권한을 주면 누구나 가입만으로 관리자가 될 수 있다.
  const isAdmin = user && (user.email === 'valencia5223@gmail.com' || !isSupabaseConfigured());

  // URL 딥링크 (?open_chat=true) 파라미터 감지 시 1:1 채팅 모달 자동 오픈
  useEffect(() => {
    if (user) {
      const urlParams = new URLSearchParams(window.location.search);
      const openChat = urlParams.get('open_chat');
      const senderId = urlParams.get('sender_id');
      const senderEmail = urlParams.get('sender_email');

      if (openChat === 'true' && (senderId || senderEmail)) {
        setActiveMemoFriend({
          friend_id: senderId || '',
          email: senderEmail || '상대방',
          name: senderEmail ? senderEmail.split('@')[0] : '상대방'
        });
        // URL 딥링크 파라미터 깔끔하게 클리어 (새로고침 시 재열림 방지)
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [user]);

  // 데이터 상태 (사용자별 개별 데이터)
  const [books, setBooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  // 인증 및 세션 확인
  useEffect(() => {
    // URL 해시에 recovery(비밀번호 재설정 링크) 파라미터가 있는지 확인
    const checkRecoveryHash = () => {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('type%3Drecovery'))) {
        setAuthModalMode('reset');
        setIsAuthOpen(true);
      }
    };
    checkRecoveryHash();

    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        // Supabase 비밀번호 재설정 링크 접속 이벤트 감지
        if (event === 'PASSWORD_RECOVERY') {
          setAuthModalMode('reset');
          setIsAuthOpen(true);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      const savedUser = localStorage.getItem('demo_user');
      if (savedUser) setUser(JSON.parse(savedUser));
      setLoading(false);
    }
  }, []);

  // 전역 흔들기/깜박임 알람 상태
  const [isNudgeShaking, setIsNudgeShaking] = useState(false);

  // 브라우저 최소화 시에도 청각으로 즉시 알아챌 수 있는 '띵동!' 맑은 알림음 (Web Audio Synth)
  const triggerNudgeChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // 880Hz -> 1760Hz 맑고 청아한 알림음
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1760, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn('Chime audio failed', e);
    }
  };

  // 작업표시줄 아이콘 & 탭 제목 깜박임 (document.title 교체)
  const triggerTaskbarBlink = (alertTitle = '🔔 일정 알림') => {
    const originalTitle = 'Library of Mind';
    // 업무 중 화면을 봐도 채팅인지 모르게 보낸 사람·채팅 문구를 넣지 않는다(보낸 쪽이 고른 홍보 문구 제목)

    let count = 0;
    const interval = setInterval(() => {
      document.title = count % 2 === 0 ? alertTitle : originalTitle;
      count++;
      if (count >= 20) {
        clearInterval(interval);
        document.title = originalTitle;
      }
    }, 500);
  };

  // 웹 데스크톱 알림 (OS 작업표시줄·알림 센터). 같은 흔들기는 웹 푸시(sw.js)로도 오므로,
  // 잠깐 기다렸다가 같은 번호(nid)의 알림이 이미 떠 있으면 띄우지 않는다(한 번만 울리게).
  // 서비스워커 알림으로 띄워 나중에 도착한 푸시도 같은 번호를 보고 소리 없이 덮어쓴다(sw.js).
  // 보낸 사람·채팅 문구는 보이지 않게 하고, 누르면 sw.js 가 ?open_chat 으로 채팅창을 연다.
  // 자동으로 닫지 않는다: 아무도 안 누르고 사라지는 알림이 쌓이면 브라우저가 알림 권한을 회수한다
  const triggerWebNotification = ({ senderEmail, senderId, title, body, nid }) => {
    if (!isNotificationSupported() || Notification.permission !== 'granted') return;
    const tag = 'nudge-shake-notification';
    const t = title;
    const opts = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag,
      renotify: true,
      requireInteraction: false,
      data: { url: '/', sender_id: senderId || '', sender_email: senderEmail || '', nid: nid || '', at: Date.now() }
    };
    const showInPage = () => {
      const n = new Notification(t, opts);
      n.onclick = () => {
        window.focus();
        if (senderEmail || senderId) {
          setActiveMemoFriend({ friend_id: senderId || '', email: senderEmail || '상대방', name: senderEmail ? senderEmail.split('@')[0] : '상대방' });
        }
        n.close();
      };
    };
    if (!('serviceWorker' in navigator)) { showInPage(); return; }
    setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) { showInPage(); return; }
        const list = await reg.getNotifications({ tag });
        // 푸시로 이미 떴음(번호가 없는 예전 버전 흔들기는 8초 안에 뜬 알림이면 같은 것으로 봄)
        if (list.some((n) => (nid ? n.data?.nid === nid : Date.now() - (n.data?.at || 0) < 8000))) return;
        await reg.showNotification(t, opts);
      } catch {
        showInPage();
      }
    }, 3000);
  };

  // 로그인 시 메모창 미오픈 상태에서도 흔들기/알람 수신 가능한 전역 Supabase 채널 구독 및 서비스 워커 연동
  useEffect(() => {
    // 1. 서비스 워커 등록 및 Web Push 구독 자동 등록 (창 닫힘 상태 오프라인 알림 수신용)
    registerServiceWorker().then(() => {
      if (user) {
        subscribeUserToPush(user.id, user.email);
      }
    });

    if (user && isSupabaseConfigured()) {
      // 알림 권한은 여기서 요청하지 않는다(클릭 없는 요청은 브라우저가 자동 차단함). 친구 화면 '알림 켜기' 버튼에서만 요청
      const channel = supabase.channel(`global_user_nudge:${user.id}`)
        .on('broadcast', { event: 'nudge_received' }, (payload) => {
          // 본인이 보낸 흔들기 이벤트라면 본인 알림 무시 (상대방만 알림 수신)
          if (payload.payload?.sender_id === user.id) return;

          // 1. 화면 전체 진동 애니메이션
          setIsNudgeShaking(true);
          setTimeout(() => {
            setIsNudgeShaking(false);
          }, 1400);

          // 2. 작업표시줄 & 브라우저 탭 제목 깜박임
          const senderEmail = payload.payload?.sender_email;
          const senderId = payload.payload?.sender_id;
          const { nid } = payload.payload || {};
          // 예전 버전 화면에서 보낸 흔들기는 문구가 없거나 기본값이라 여기서 홍보 문구로 바꾼다
          const sent = payload.payload || {};
          const { title, body } = sent.title && sent.title !== '🔔 일정 알림' ? sent : randomNudgeMessage();
          triggerTaskbarBlink(title);

          // 3. 데스크톱 알림 (Windows 작업표시줄 팝업, 웹 푸시와 겹치면 한 번만)
          triggerWebNotification({ senderEmail, senderId, title, body, nid });

          // 4. 최소화 상태 대응 띵동! 사운드 알림음
          triggerNudgeChime();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // 친구 조회 모드 상태
  const [viewedFriend, setViewedFriend] = useState(null); // { id: 'uuid', email: 'email@test.com' } 또는 null

  // 로그인 상태 변화 시 사용자별 데이터 로딩
  useEffect(() => {
    if (user) {
      if (isSupabaseConfigured()) {
        // public.profiles 에 유저 이메일 및 가입 이름 동기화 (Upsert)
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0];
        supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          name: fullName
        }, { onConflict: 'id' }).then(({ error }) => {
          if (error) console.warn('프로필 자동 등록 실패 (profiles 테이블이 없을 수 있음):', error);
        });
        
        fetchSupabaseData();
      } else {
        const userKey = `user_books_${user.id || 'demo'}`;
        const noteKey = `user_notes_${user.id || 'demo'}`;
        const sessionKey = `user_sessions_${user.id || 'demo'}`;

        const localB = localStorage.getItem(userKey);
        const localN = localStorage.getItem(noteKey);
        const localS = localStorage.getItem(sessionKey);

        setBooks(localB ? JSON.parse(localB) : []);
        setNotes(localN ? JSON.parse(localN) : []);
        setSessions(localS ? JSON.parse(localS) : []);
      }
    } else {
      setBooks([]);
      setNotes([]);
      setViewedFriend(null);
      setSessions([]);
    }
  }, [user]);

  // viewedFriend가 바뀌었을 때도 데이터 다시 로드
  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchSupabaseData();
    }
  }, [viewedFriend]);

  // 친구 서재 전환이 빠르게 일어날 때 늦게 도착한 이전 응답이 최신 데이터를 덮어쓰지 않도록 요청 번호로 구분
  const fetchSeqRef = useRef(0);

  const fetchSupabaseData = async () => {
    const seq = ++fetchSeqRef.current;
    try {
      // viewedFriend가 엮여 있으면 친구의 데이터를 로드하고, 아니면 본인 데이터 로드
      const targetUserId = viewedFriend ? viewedFriend.id : user.id;

      const [{ data: bData }, { data: nData }, { data: sData }] = await Promise.all([
        supabase.from('user_books').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }),
        supabase.from('book_notes').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }),
        // 독서 세션(타임라인)은 오직 본인 통계용이므로 친구 것은 불필요
        supabase.from('reading_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      if (seq !== fetchSeqRef.current) return;

      if (bData) {
        const orderKey = `user_book_order_${targetUserId}`;
        const savedOrderStr = localStorage.getItem(orderKey);
        if (savedOrderStr) {
          try {
            const savedOrderIds = JSON.parse(savedOrderStr);
            const bookMap = new Map(bData.map(b => [String(b.id), b]));
            const sortedBooks = [];
            
            savedOrderIds.forEach(id => {
              const b = bookMap.get(String(id));
              if (b) {
                sortedBooks.push(b);
                bookMap.delete(String(id));
              }
            });
            // 새로 추가되어 저장된 순서에 없는 최신 책들은 앞에 배치
            bookMap.forEach(b => sortedBooks.unshift(b));
            setBooks(sortedBooks);
          } catch (e) {
            setBooks(bData);
          }
        } else {
          setBooks(bData);
        }
      }
      if (nData) setNotes(nData);
      if (sData) setSessions(sData);
    } catch (e) {
      console.warn('Supabase fetch error:', e);
    }
  };

  // CRUD 핸들러
  const handleAddBook = async (newBook) => {
    let finalTotalPages = newBook.total_pages ? parseInt(newBook.total_pages) : 0;
    if (!finalTotalPages || finalTotalPages === 320) {
      // 도서 제목 해시 기반 보정 (200~550p)
      let hash = 0;
      const str = newBook.title || 'book';
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      finalTotalPages = 200 + (Math.abs(hash) % 350);
    }

    // DB 필드 구성
    const bookData = {
      title: newBook.title || '제목 정보 없음',
      author: newBook.author || '저자 미상',
      publisher: newBook.publisher || '',
      cover_url: newBook.cover_url || '',
      isbn: newBook.isbn || '',
      total_pages: finalTotalPages,
      current_pages: newBook.current_pages ? parseInt(newBook.current_pages) : 0,
      status: newBook.status || 'TO_READ',
      rating: newBook.rating ? Math.min(5, Math.max(0, parseFloat((parseFloat(newBook.rating) || 0).toFixed(1)))) : 0.0, 
      buy_link: newBook.buy_link || '',
      pub_date: newBook.pub_date || '',
      category: newBook.category || '일반'
    };

    const bookObj = {
      ...bookData,
      id: `b-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    const updated = [bookObj, ...books];
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      // pub_date 포함하여 insert 시도, 실패 시 pub_date 제외하고 재시도
      let { data: inserted, error } = await supabase.from('user_books').insert([{ ...bookData, user_id: user.id }]).select().single();
      if (error) {
        console.warn('Insert 실패 (pub_date 컬럼 미존재 가능), pub_date 제외 재시도:', error.message);
        const { pub_date: _pubDate, ...safeData } = bookData;
        ({ data: inserted, error } = await supabase.from('user_books').insert([{ ...safeData, user_id: user.id }]).select().single());
      }
      if (error) {
        console.error('도서 추가 실패:', error.message);
        return;
      }
      // 임시 id(b-...)를 DB가 발급한 실제 UUID로 교체해야 이후 수정/삭제가 DB에 반영된다
      replaceTempId(setBooks, bookObj.id, inserted);
    }
  };

  // 낙관적 업데이트로 넣어둔 임시 id 항목을 DB가 반환한 실제 행으로 교체
  const replaceTempId = (setter, tempId, dbRow) => {
    if (!dbRow) return;
    setter(prev => prev.map(item => item.id === tempId ? { ...item, ...dbRow } : item));
  };

  const handleUpdateStatus = async (bookId, newStatus, customCompletedAt = null) => {
    const isCompleted = newStatus === 'READ';
    const completedAt = isCompleted ? (customCompletedAt || new Date().toISOString()) : null;
    const updated = books.map(b => {
      if (b.id === bookId) {
        const totalP = parseInt(b.total_pages) || 300;
        const currentP = isCompleted ? totalP : b.current_pages;
        return { ...b, status: newStatus, completed_at: completedAt, current_pages: currentP };
      }
      return b;
    });
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      const targetBook = updated.find(b => b.id === bookId);
      const updateData = { status: newStatus, completed_at: completedAt };
      if (isCompleted && targetBook) {
        updateData.current_pages = targetBook.current_pages;
      }
      await supabase.from('user_books').update(updateData).eq('id', bookId);
    }
  };

  const handleUpdateBookDetails = async (bookId, updatedBookData) => {
    // Supabase user_books 테이블에 실제 존재하는 안전한 컬럼만 분리
    let dbSafeData = {
      title: updatedBookData.title || '제목 정보 없음',
      author: updatedBookData.author || '저자 미상',
      publisher: updatedBookData.publisher || '',
      cover_url: updatedBookData.cover_url || '',
      isbn: updatedBookData.isbn || '',
      total_pages: updatedBookData.total_pages ? parseInt(updatedBookData.total_pages) : 0,
      current_pages: updatedBookData.current_pages ? parseInt(updatedBookData.current_pages) : 0,
      status: updatedBookData.status || 'TO_READ',
      rating: parseFloat(updatedBookData.rating) || 0,
      buy_link: updatedBookData.buy_link || '',
      category: updatedBookData.category || '일반',
      completed_at: updatedBookData.status === 'READ' 
        ? (updatedBookData.completed_at || new Date().toISOString()) 
        : null
    };

    // 로컬 전용 필드 (Supabase에 존재하지 않을 수 있는 컬럼)
    const localOnlyData = {
      pub_date: updatedBookData.pub_date || '',
      review: updatedBookData.review || ''
    };
    
    const mergedData = { ...dbSafeData, ...localOnlyData };
    const updated = books.map(b => b.id === bookId ? { ...b, ...mergedData } : b);
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      // 먼저 DB-safe 필드만으로 업데이트 시도
      const { error } = await supabase.from('user_books').update(dbSafeData).eq('id', bookId);
      
      // DB-safe 필드 업데이트 성공 후, pub_date 등 추가 칼럼도 시도 (컬럼이 있으면 반영됨)
      if (!error) {
        const extraFields = {};
        if (updatedBookData.pub_date) extraFields.pub_date = updatedBookData.pub_date;
        if (updatedBookData.review) extraFields.review = updatedBookData.review;
        
        if (Object.keys(extraFields).length > 0) {
          const { error: extraError } = await supabase.from('user_books').update(extraFields).eq('id', bookId);
          if (extraError) {
            console.warn('추가 컬럼 업데이트 실패 (컬럼 미존재 가능):', extraError.message);
          }
        }
      } else {
        console.error('도서 정보 업데이트 실패:', error.message);
      }
    }
  };

  const handleDeleteBook = async (bookId) => {
    const updated = books.filter(b => b.id !== bookId);
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      await supabase.from('user_books').delete().eq('id', bookId);
    }
  };

  const handleAddNote = async (newNote) => {
    const noteObj = {
      ...newNote,
      id: `n-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    const updated = [noteObj, ...notes];
    setNotes(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_notes_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      const { data: inserted, error } = await supabase.from('book_notes').insert([{ ...newNote, user_id: user.id }]).select().single();
      if (error) {
        console.error('노트 저장 실패:', error.message);
        return;
      }
      replaceTempId(setNotes, noteObj.id, inserted);
    }
  };

  const handleDeleteNote = async (noteId) => {
    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_notes_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      await supabase.from('book_notes').delete().eq('id', noteId);
    }
  };

  const handleSaveSession = async (sessionData) => {
    const sessionObj = {
      ...sessionData,
      id: `s-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    const updated = [sessionObj, ...sessions];
    setSessions(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_sessions_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      // cumulative_pages 는 진행률 갱신용 값이라 reading_sessions 에 컬럼이 없을 수 있다 → 실패 시 제외하고 재시도
      let { data: inserted, error } = await supabase.from('reading_sessions').insert([{ ...sessionData, user_id: user.id }]).select().single();
      if (error) {
        console.warn('세션 Insert 실패 (cumulative_pages 컬럼 미존재 가능), 제외 후 재시도:', error.message);
        const { cumulative_pages: _cumulative, ...safeSession } = sessionData;
        ({ data: inserted, error } = await supabase.from('reading_sessions').insert([{ ...safeSession, user_id: user.id }]).select().single());
      }
      if (error) {
        console.error('독서 세션 저장 실패:', error.message);
      } else {
        replaceTempId(setSessions, sessionObj.id, inserted);
      }
    }

    // [핵심 기능] 몰입스튜디오에서 누적 읽은 페이지(cumulative_pages)를 입력하면 내 서재 도서의 current_pages와 % 진행률이 자동 갱신됨
    if (sessionData.book_id && sessionData.cumulative_pages !== undefined && sessionData.cumulative_pages > 0) {
      const targetBook = books.find(b => b.id === sessionData.book_id);
      if (targetBook) {
        const newCurrent = Math.min(targetBook.total_pages || 300, sessionData.cumulative_pages);
        const isRead = newCurrent >= (targetBook.total_pages || 300);
        const updatedBookData = {
          ...targetBook,
          current_pages: newCurrent,
          status: isRead ? 'READ' : targetBook.status,
          completed_at: isRead ? (targetBook.completed_at || new Date().toISOString()) : targetBook.completed_at
        };
        await handleUpdateBookDetails(targetBook.id, updatedBookData);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center align-center min-h-screen text-center">
        <div className="loading-spinner">
          <Library size={48} className="text-primary animate-bounce mb-3" />
          <p className="sub-text">지식의 서재를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const handleReorderBooks = (reorderedBooks) => {
    setBooks(reorderedBooks);
    const targetUserId = viewedFriend ? viewedFriend.id : user?.id || 'demo';
    const orderKey = `user_book_order_${targetUserId}`;
    const orderIds = reorderedBooks.map(b => String(b.id));
    localStorage.setItem(orderKey, JSON.stringify(orderIds));
    localStorage.setItem(`user_books_${targetUserId}`, JSON.stringify(reorderedBooks));
  };

  return (
    <div className={`app-container ${isNudgeShaking ? 'app-nudge-shake' : ''}`}>
      {/* 헤더 네비게이션 */}
      <header className="navbar">
        <div className="brand-logo cursor-pointer" onClick={() => setActiveTab('schedule')}>
          <Library size={28} className="text-primary" />
          <span>Library of Mind</span>
        </div>

        {user && (
          <nav className="navbar-tabs-container">
            {MAIN_TABS.map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                className={`nav-tab-capsule ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <TabIcon size={16} /> {label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex align-center gap-2" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
          {user && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPdfLibrary(true)}
              style={{ flexShrink: 0 }}
            >
              <FileText size={15} /> <span className="hide-mobile">PDF 서재</span>
            </button>
          )}

          <ThemePicker />

          <div className="hide-mobile"><WeatherWidget /></div>

          <button type="button" className="btn btn-secondary btn-sm user-profile-btn" onClick={() => setIsAuthOpen(true)}>
            <User size={15} style={{ flexShrink: 0 }} />
            <span className="user-email-text">{user ? (user.user_metadata?.full_name || user.email?.split('@')[0] || '내 프로필') : '로그인 / 회원가입'}</span>
          </button>
        </div>
      </header>

      {/* 뉴스 티커 (탭 상단) */}
      {user && <div className="hide-mobile"><NewsTicker /></div>}

      {/* 비로그인 시 강제 게이트키퍼 랜딩 화면 */}
      {!user ? (
        <div className="auth-gate-wrapper">
          <div className="auth-gate-card">
            <div className="gate-icon-box">
              <Lock size={40} className="text-warning" />
            </div>
            <h2>나만의 비주얼 서재에 오신 것을 환영합니다</h2>
            <p className="sub-text mt-2 max-w-md mx-auto">
              보안 인증을 통과해야 본인 전용 3D 서재 및 개인 독서 기록을 이용하실 수 있습니다.
            </p>

            <div className="gate-feature-badges mt-4">
              <span className="badge-pill">🔒 Supabase Auth 개인 데이터 보안</span>
              <span className="badge-pill">📚 실시간 도서 검색 & 베스트셀러</span>
              <span className="badge-pill">🎧 백색소음 몰입 스튜디오</span>
            </div>

            <button className="btn btn-primary btn-lg mt-5 w-full justify-center" onClick={() => setIsAuthOpen(true)}>
              <LogIn size={20} /> 서재 입장하기 (로그인 / 회원가입) <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* 로그인 후 접속 허용 메인 뷰 */
        <main className="main-content tab-enter" key={activeTab}>
          {activeTab === 'schedule' && (
            <ScheduleCalendarView userId={user?.id} />
          )}

          {activeTab === 'bookshelf' && (
            <BookshelfView
              books={books}
              notes={notes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onUpdateStatus={handleUpdateStatus}
              onDeleteBook={handleDeleteBook}
              onAddManualBook={handleAddBook}
              onUpdateBookDetails={handleUpdateBookDetails}
              onReorderBooks={handleReorderBooks}
              viewedFriend={viewedFriend}
              onBackToMyBookshelf={() => setViewedFriend(null)}
              userId={user?.id}
            />
          )}

          {activeTab === 'search' && (
            <BookSearch
              onAddBook={handleAddBook}
              existingBooks={books}
            />
          )}

          {activeTab === 'focus' && (
            <FocusStudio
              books={books}
              onSaveSession={handleSaveSession}
            />
          )}

          {activeTab === 'stats' && (
            <ReadingStats
              books={books}
              sessions={sessions}
            />
          )}

          {activeTab === 'social' && (
            <FriendManager
              user={user}
              onViewFriendBookshelf={(friendId, friendEmail, friendName) => {
                setViewedFriend({ id: friendId, email: friendEmail, name: friendName });
                setActiveTab('bookshelf');
              }}
              currentViewedFriend={viewedFriend}
              onBackToMyBookshelf={() => setViewedFriend(null)}
            />
          )}
        </main>
      )}

      {/* 핸드폰: 아래쪽 탭 바 (위쪽 탭은 CSS 로 숨김) */}
      {user && (
        <nav className="mobile-tabbar" aria-label="메뉴">
          {MOBILE_BAR_TABS.map(({ id, short, icon: TabIcon }) => (
            <button
              key={id}
              type="button"
              className={`mobile-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => { setActiveTab(id); setShowMoreMenu(false); window.scrollTo({ top: 0 }); }}
            >
              <TabIcon size={22} />
              <span>{short}</span>
            </button>
          ))}
          <button
            type="button"
            className={`mobile-tab ${showMoreMenu || MOBILE_MORE_TABS.some((t) => t.id === activeTab) ? 'active' : ''}`}
            onClick={() => setShowMoreMenu((v) => !v)}
            aria-expanded={showMoreMenu}
          >
            <MoreHorizontal size={22} />
            <span>더보기</span>
          </button>
        </nav>
      )}
      {user && showMoreMenu && (
        <div className="mobile-more-backdrop" onClick={() => setShowMoreMenu(false)}>
          <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
            {MOBILE_MORE_TABS.map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                type="button"
                className={`mobile-more-item ${activeTab === id ? 'active' : ''}`}
                onClick={() => { setActiveTab(id); setShowMoreMenu(false); window.scrollTo({ top: 0 }); }}
              >
                <TabIcon size={20} /> {label}
              </button>
            ))}
            <button type="button" className="mobile-more-item" onClick={() => { setShowPdfLibrary(true); setShowMoreMenu(false); }}>
              <FileText size={20} /> PDF 서재
            </button>
            <button type="button" className="mobile-more-item" onClick={() => { setIsAuthOpen(true); setShowMoreMenu(false); }}>
              <User size={20} /> 내 계정
            </button>
          </div>
        </div>
      )}

      {/* 인증 모달 */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setAuthModalMode('login');
        }}
        user={user}
        setUser={setUser}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminOpen(true)}
        mode={authModalMode}
        setMode={setAuthModalMode}
      />

      {/* 관리자 전용 회원 승인 관리 모달 */}
      <AdminApprovalModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        user={user}
      />

      {/* 독립 PDF 서재 보관함 모달 */}
      {showPdfLibrary && (
        <PdfLibraryModal onClose={() => setShowPdfLibrary(false)} />
      )}

      {/* 알림 바로가기 클릭 시 전역 자동 오픈되는 1:1 메모 모달 */}
      {activeMemoFriend && (
        <SharedLiveMemoModal
          user={user}
          friend={activeMemoFriend}
          onClose={() => setActiveMemoFriend(null)}
        />
      )}
    </div>
  );
}
