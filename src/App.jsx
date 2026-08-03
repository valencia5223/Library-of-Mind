import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './components/AuthModal';
import BookshelfView from './components/BookshelfView';
import BookSearch from './components/BookSearch';
import ThoughtLedger from './components/ThoughtLedger';
import FocusStudio from './components/FocusStudio';
import ReadingStats from './components/ReadingStats';
import { BookOpen, Search, MessageSquare, Timer, Trophy, User, Library, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('bookshelf'); // 'bookshelf'|'search'|'ledger'|'focus'|'stats'
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 데이터 상태
  const [books, setBooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);

  // 기본 더미 데모 데이터
  const initialBooks = [
    {
      id: 'demo-b1',
      title: '클린 코드 (Clean Code)',
      author: '로버트 C. 마틴',
      publisher: '인사이트',
      cover_url: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
      status: 'READING',
      rating: 5,
      buy_link: 'https://search.shopping.naver.com/book/search?query=클린코드'
    },
    {
      id: 'demo-b2',
      title: '원씽 (The One Thing)',
      author: '게리 켈러',
      publisher: '비즈니스북스',
      cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
      status: 'READ',
      rating: 5,
      buy_link: 'https://search.shopping.naver.com/book/search?query=원씽'
    },
    {
      id: 'demo-b3',
      title: '도둑맞은 집중력',
      author: '요한 하리',
      publisher: '어크로스',
      cover_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
      status: 'TO_READ',
      rating: 4,
      buy_link: 'https://search.shopping.naver.com/book/search?query=도둑맞은집중력'
    }
  ];

  const initialNotes = [
    {
      id: 'demo-n1',
      book_title: '원씽 (The One Thing)',
      quote: '단 하나의 일에 집중할 때 비로소 위대한 성과가 시작된다.',
      thought: '오늘 나의 최우선 과제는 무엇인가 돌아보게 만든 문장.',
      page_number: 58,
      tags: ['#동기부여', '#자기계발']
    }
  ];

  // 인증 및 초기 데이터 로딩
  useEffect(() => {
    // 1. Supabase Auth 감지
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
      // 2. Local Storage 데모 세션
      const savedUser = localStorage.getItem('demo_user');
      if (savedUser) setUser(JSON.parse(savedUser));
      setLoading(false);
    }
  }, []);

  // 데이터 수신 / 로컬스토리지 보관
  useEffect(() => {
    if (isSupabaseConfigured() && user) {
      // Supabase DB fetch
      fetchSupabaseData();
    } else {
      // LocalStorage fallback
      const localB = localStorage.getItem('user_books');
      const localN = localStorage.getItem('user_notes');
      const localS = localStorage.getItem('user_sessions');

      setBooks(localB ? JSON.parse(localB) : initialBooks);
      setNotes(localN ? JSON.parse(localN) : initialNotes);
      setSessions(localS ? JSON.parse(localS) : []);
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
      console.warn('Supabase fetch fail', e);
    }
  };

  // 핸들러 함수들 (CRUD)
  const handleAddBook = async (newBook) => {
    const bookObj = {
      ...newBook,
      id: `b-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    const updated = [bookObj, ...books];
    setBooks(updated);
    localStorage.setItem('user_books', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      await supabase.from('user_books').insert([{ ...newBook, user_id: user.id }]);
    }
  };

  const handleUpdateStatus = async (bookId, newStatus) => {
    const updated = books.map(b => b.id === bookId ? { ...b, status: newStatus } : b);
    setBooks(updated);
    localStorage.setItem('user_books', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      await supabase.from('user_books').update({ status: newStatus }).eq('id', bookId);
    }
  };

  const handleDeleteBook = async (bookId) => {
    const updated = books.filter(b => b.id !== bookId);
    setBooks(updated);
    localStorage.setItem('user_books', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
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
    localStorage.setItem('user_notes', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      await supabase.from('book_notes').insert([{ ...newNote, user_id: user.id }]);
    }
  };

  const handleDeleteNote = async (noteId) => {
    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);
    localStorage.setItem('user_notes', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
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
    localStorage.setItem('user_sessions', JSON.stringify(updated));

    if (isSupabaseConfigured() && user) {
      await supabase.from('reading_sessions').insert([{ ...sessionData, user_id: user.id }]);
    }
  };

  return (
    <div className="app-container">
      {/* 상단 네비게이션 바 */}
      <header className="navbar">
        <div className="brand-logo cursor-pointer" onClick={() => setActiveTab('bookshelf')}>
          <Library size={28} className="text-primary" />
          <span>Library of Mind</span>
        </div>

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

        <button className="btn btn-secondary" onClick={() => setIsAuthOpen(true)}>
          <User size={18} />
          {user ? (user.user_metadata?.full_name || '내 프로필') : '로그인 / 회원가입'}
        </button>
      </header>

      {/* 메인 뷰 컴포넌트 라우팅 */}
      <main className="main-content">
        {activeTab === 'bookshelf' && (
          <BookshelfView
            books={books}
            onUpdateStatus={handleUpdateStatus}
            onDeleteBook={handleDeleteBook}
            onAddManualBook={handleAddBook}
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
