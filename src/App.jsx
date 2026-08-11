import React, { useState, useEffect } from 'react';
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
import DailyHabitBoardModal from './components/DailyHabitBoardModal';
import { BookOpen, Search, MessageSquare, Timer, BarChart2, User, Library, Lock, Sparkles, LogIn, ArrowRight, Users, ShieldCheck, Calendar as CalendarIcon, FileText, CheckSquare } from 'lucide-react';
import NewsTicker from './components/NewsTicker';
import WeatherWidget from './components/WeatherWidget';


export default function App() {
  const [activeTab, setActiveTab] = useState('schedule'); // 기본 메인화면: 일정관리
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showPdfLibrary, setShowPdfLibrary] = useState(false);
  const [showHabitBoardModal, setShowHabitBoardModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 관리자 권한 확인 (valencia5223@gmail.com 또는 admin 키워드)
  const isAdmin = user && (user.email === 'valencia5223@gmail.com' || user.email?.includes('admin') || !isSupabaseConfigured());

  // 데이터 상태 (사용자별 개별 데이터)
  const [books, setBooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  // 인증 및 세션 확인
  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
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
  const triggerTaskbarBlink = (senderEmail) => {
    const originalTitle = 'Library of Mind';
    const senderName = senderEmail ? senderEmail.split('@')[0] : '상대방';
    const alertTitle = `📢 [쪽지 도착] ${senderName}님이 채팅창을 흔듭니다!`;

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

  // 웹 데스크톱 알림 발송 (OS 작업표시줄 및 알림 센터에 팝업 노출)
  const triggerWebNotification = (senderEmail) => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const senderName = senderEmail ? senderEmail.split('@')[0] : '상대방';
        new Notification('💬 쪽지가 도착했습니다!', {
          body: `${senderName}님이 채팅창을 흔듭니다! ⚡`,
          icon: '/favicon.ico',
          requireInteraction: true
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  };

  // 로그인 시 메모창 미오픈 상태에서도 흔들기/알람 수신 가능한 전역 Supabase 채널 구독
  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      // 알림 권한 요청 (최초 1회)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const channel = supabase.channel(`global_user_nudge:${user.id}`)
        .on('broadcast', { event: 'nudge_received' }, (payload) => {
          // 1. 화면 전체 진동 애니메이션
          setIsNudgeShaking(true);
          setTimeout(() => {
            setIsNudgeShaking(false);
          }, 1400);

          // 2. 작업표시줄 & 브라우저 탭 제목 깜박임
          const senderEmail = payload.payload?.sender_email;
          triggerTaskbarBlink(senderEmail);

          // 3. 데스크톱 알림 (Windows 작업표시줄 팝업)
          triggerWebNotification(senderEmail);

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

  const fetchSupabaseData = async () => {
    try {
      // viewedFriend가 엮여 있으면 친구의 데이터를 로드하고, 아니면 본인 데이터 로드
      const targetUserId = viewedFriend ? viewedFriend.id : user.id;

      const { data: bData } = await supabase.from('user_books').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false });
      const { data: nData } = await supabase.from('book_notes').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false });
      
      // 독서 세션(타임라인)은 오직 본인 통계용이므로 친구 것은 불필요
      const { data: sData } = await supabase.from('reading_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

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
      const { error } = await supabase.from('user_books').insert([{ ...bookData, user_id: user.id }]);
      if (error) {
        console.warn('Insert 실패 (pub_date 컬럼 미존재 가능), pub_date 제외 재시도:', error.message);
        const { pub_date, ...safeData } = bookData;
        await supabase.from('user_books').insert([{ ...safeData, user_id: user.id }]);
      }
    }
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
      await supabase.from('book_notes').insert([{ ...newNote, user_id: user.id }]);
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
      await supabase.from('reading_sessions').insert([{ ...sessionData, user_id: user.id }]);
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
            <button
              className={`nav-tab-capsule ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <CalendarIcon size={16} /> 일정관리
            </button>

            <button
              className={`nav-tab-capsule ${activeTab === 'bookshelf' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookshelf')}
            >
              <BookOpen size={16} /> 내 서재
            </button>

            <button
              className={`nav-tab-capsule ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={16} /> 탐색
            </button>

            <button
              className={`nav-tab-capsule ${activeTab === 'focus' ? 'active' : ''}`}
              onClick={() => setActiveTab('focus')}
            >
              <Timer size={16} /> 몰입 스튜디오
            </button>

            <button
              className={`nav-tab-capsule ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <BarChart2 size={16} /> 독서 리포트
            </button>

            <button
              className={`nav-tab-capsule ${activeTab === 'social' ? 'active' : ''}`}
              onClick={() => setActiveTab('social')}
            >
              <Users size={16} /> 이웃 서재
            </button>
          </nav>
        )}

        <div className="flex align-center gap-2" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
          {user && (
            <>
              <button
                className="nav-tab-capsule"
                onClick={() => setShowHabitBoardModal(true)}
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                <CheckSquare size={16} /> ✅ 오늘의 할일
              </button>

              <button
                className="nav-tab-capsule"
                onClick={() => setShowPdfLibrary(true)}
                style={{
                  backgroundColor: 'rgba(2, 132, 199, 0.14)',
                  color: '#0284c7',
                  borderColor: 'rgba(2, 132, 199, 0.4)',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                <FileText size={16} /> PDF 서재
              </button>
            </>
          )}

          <WeatherWidget />

          <button className="btn btn-secondary user-profile-btn" onClick={() => setIsAuthOpen(true)}>
            <User size={16} style={{ flexShrink: 0 }} />
            <span className="user-email-text">{user ? (user.user_metadata?.full_name || user.email?.split('@')[0] || '내 프로필') : '로그인 / 회원가입'}</span>
          </button>
        </div>
      </header>

      {/* 뉴스 티커 (탭 상단) */}
      {user && <NewsTicker />}

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
        <main className="main-content">
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

      {/* 인증 모달 */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        setUser={setUser}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminOpen(true)}
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

      {/* 3D 포스트잇 오늘의 할 일 & 루틴 체크리스트 모달 */}
      <DailyHabitBoardModal
        isOpen={showHabitBoardModal}
        onClose={() => setShowHabitBoardModal(false)}
      />
    </div>
  );
}
