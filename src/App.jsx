import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './components/AuthModal';
import BookshelfView from './components/BookshelfView';
import BookSearch from './components/BookSearch';
import ThoughtLedger from './components/ThoughtLedger';
import FocusStudio from './components/FocusStudio';
import ReadingStats from './components/ReadingStats';
import { BookOpen, Search, MessageSquare, Timer, Trophy, User, Library, Lock, Sparkles, LogIn, ArrowRight } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('bookshelf');
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // 로그인 상태 변화 시 사용자별 데이터 로딩
  useEffect(() => {
    if (user) {
      if (isSupabaseConfigured()) {
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
      setSessions([]);
    }
  }, [user]);

  const fetchSupabaseData = async () => {
    try {
      const { data: bData } = await supabase.from('user_books').select('*').order('created_at', { ascending: false });
      const { data: nData } = await supabase.from('book_notes').select('*').order('created_at', { ascending: false });
      const { data: sData } = await supabase.from('reading_sessions').select('*').order('created_at', { ascending: false });

      if (bData) setBooks(bData);
      if (nData) setNotes(nData);
      if (sData) setSessions(sData);
    } catch (e) {
      console.warn('Supabase fetch error:', e);
    }
  };

  // CRUD 핸들러
  const handleAddBook = async (newBook) => {
    // DB user_books 테이블 스키마에 정의된 컬럼만 안전하게 필터링하여 삽입
    const cleanBook = {
      title: newBook.title || '제목 정보 없음',
      author: newBook.author || '저자 미상',
      publisher: newBook.publisher || '',
      cover_url: newBook.cover_url || '',
      isbn: newBook.isbn || '',
      total_pages: newBook.total_pages ? parseInt(newBook.total_pages) : 320,
      current_pages: newBook.current_pages ? parseInt(newBook.current_pages) : 0,
      status: newBook.status || 'TO_READ',
      rating: newBook.rating ? Math.min(5, Math.max(0, Math.round(parseFloat(newBook.rating)))) : 0, 
      buy_link: newBook.buy_link || '',
      category: newBook.category || '일반'
    };

    const bookObj = {
      ...cleanBook,
      id: `b-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    const updated = [bookObj, ...books];
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      await supabase.from('user_books').insert([{ ...cleanBook, user_id: user.id }]);
    }
  };

  const handleUpdateStatus = async (bookId, newStatus) => {
    const updated = books.map(b => b.id === bookId ? { ...b, status: newStatus } : b);
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      await supabase.from('user_books').update({ status: newStatus }).eq('id', bookId);
    }
  };

  const handleUpdateBookDetails = async (bookId, updatedBookData) => {
    const updated = books.map(b => b.id === bookId ? { ...b, ...updatedBookData } : b);
    setBooks(updated);

    if (!isSupabaseConfigured()) {
      localStorage.setItem(`user_books_${user?.id || 'demo'}`, JSON.stringify(updated));
    } else if (user) {
      await supabase.from('user_books').update(updatedBookData).eq('id', bookId);
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

  return (
    <div className="app-container">
      {/* 상단 네비게이션 바 */}
      <header className="navbar">
        <div className="brand-logo cursor-pointer" onClick={() => setActiveTab('bookshelf')}>
          <Library size={28} className="text-primary" />
          <span>Library of Mind</span>
        </div>

        {user && (
          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'bookshelf' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookshelf')}
            >
              <BookOpen size={18} /> 내 서재
            </button>

            <button
              className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={18} /> 베스트셀러 / 탐색
            </button>

            <button
              className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <MessageSquare size={18} /> 생각 저장소
            </button>

            <button
              className={`nav-item ${activeTab === 'focus' ? 'active' : ''}`}
              onClick={() => setActiveTab('focus')}
            >
              <Timer size={18} /> 몰입 스튜디오
            </button>

            <button
              className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <Trophy size={18} /> 독서 리포트
            </button>
          </nav>
        )}

        <button className="btn btn-secondary" onClick={() => setIsAuthOpen(true)}>
          <User size={18} />
          {user ? (user.user_metadata?.full_name || user.email?.split('@')[0] || '내 프로필') : '로그인 / 회원가입'}
        </button>
      </header>

      {/* 비로그인 시 강제 게이트키퍼 랜딩 화면 */}
      {!user ? (
        <div className="auth-gate-wrapper">
          <div className="auth-gate-card">
            <div className="gate-icon-box">
              <Lock size={40} className="text-warning" />
            </div>
            <h2>나만의 비주얼 서재에 오신 것을 환영합니다</h2>
            <p className="sub-text mt-2 max-w-md mx-auto">
              보안 인증을 통과해야 본인 전용 3D 서재, 생각 저장소 및 개인 독서 기록을 이용하실 수 있습니다.
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
          {activeTab === 'bookshelf' && (
            <BookshelfView
              books={books}
              onUpdateStatus={handleUpdateStatus}
              onDeleteBook={handleDeleteBook}
              onAddManualBook={handleAddBook}
              onUpdateBookDetails={handleUpdateBookDetails}
            />
          )}

          {activeTab === 'search' && (
            <BookSearch
              onAddBook={handleAddBook}
              existingBooks={books}
            />
          )}

          {activeTab === 'ledger' && (
            <ThoughtLedger
              notes={notes}
              books={books}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
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
        </main>
      )}

      {/* 인증 모달 */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        setUser={setUser}
      />
    </div>
  );
}
