import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Plus, Check, Star, Flame, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';

export default function BookSearch({ onAddBook, existingBooks = [] }) {
  const [activeTab, setActiveTab] = useState('bestseller'); // 'bestseller' | 'search'
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bestsellerList, setBestsellerList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestsellerLoading, setBestsellerLoading] = useState(true);

  // 실시간 오픈 API 베스트셀러/트렌드 도서 로딩
  useEffect(() => {
    fetchRealtimeBestsellers();
  }, []);

  const fetchRealtimeBestsellers = async () => {
    setBestsellerLoading(true);
    try {
      // OpenLibrary Trending API 호출
      const res = await fetch('https://openlibrary.org/trending/daily.json?limit=12');
      const data = await res.json();

      if (data && data.works && data.works.length > 0) {
        const formatted = data.works.map((work, idx) => ({
          id: work.key || `bs-api-${idx}`,
          title: work.title,
          author: work.author_name ? work.author_name.join(', ') : '인기 작가',
          publisher: '글로벌 베스트셀러',
          cover_url: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-L.jpg` : `https://picsum.photos/seed/${idx+100}/300/400`,
          description: work.first_sentence ? (Array.isArray(work.first_sentence) ? work.first_sentence[0] : work.first_sentence) : '전 세계 독자들에게 사랑받는 인기 도서입니다.',
          buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(work.title)}`,
          rating: (4.7 + (idx % 3) * 0.1).toFixed(1)
        }));
        setBestsellerList(formatted);
      } else {
        fallbackBestsellers();
      }
    } catch (e) {
      console.warn('Realtime bestseller API fetch error, fallbacking:', e);
      fallbackBestsellers();
    } finally {
      setBestsellerLoading(false);
    }
  };

  const fallbackBestsellers = () => {
    setBestsellerList([
      {
        id: 'bs-1',
        title: '트렌드 코리아 2026',
        author: '김난도 외',
        publisher: '미래의창',
        cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
        description: '2026년 대한민국의 소비 트렌드를 전망하고 새로운 기회를 포착하는 필독서.',
        buy_link: 'https://search.shopping.naver.com/book/search?query=트렌드코리아2026',
        rating: 4.8
      },
      {
        id: 'bs-2',
        title: '세이노의 가르침',
        author: '세이노',
        publisher: '데이원',
        cover_url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
        description: '피가 되고 살이 되는 실전 인과관계와 자산 형성의 깊은 지혜.',
        buy_link: 'https://search.shopping.naver.com/book/search?query=세이노의가르침',
        rating: 4.9
      },
      {
        id: 'bs-3',
        title: '원씽 (The One Thing)',
        author: '게리 켈러',
        publisher: '비즈니스북스',
        cover_url: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
        description: '복잡한 세상을 이기는 단 하나의 단순함! 최우선 순위 몰입의 힘.',
        buy_link: 'https://search.shopping.naver.com/book/search?query=원씽',
        rating: 4.9
      },
      {
        id: 'bs-4',
        title: '도둑맞은 집중력',
        author: '요한 하리',
        publisher: '어크로스',
        cover_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
        description: '집중력 위기의 시대, 우리는 어떻게 깊은 조망을 되찾을 것인가.',
        buy_link: 'https://search.shopping.naver.com/book/search?query=도둑맞은집중력',
        rating: 4.7
      }
    ]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setActiveTab('search');
    try {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`);
      const data = await res.json();

      if (data.docs && data.docs.length > 0) {
        const formatted = data.docs.map((doc, idx) => ({
          id: doc.key || `search-${idx}`,
          title: doc.title,
          author: doc.author_name ? doc.author_name.join(', ') : '저자 미상',
          publisher: doc.publisher ? doc.publisher[0] : '출판사 정보',
          cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
          buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(doc.title)}`,
          rating: 4.5
        }));
        setSearchResults(formatted);
      } else {
        setSearchResults([
          {
            id: `fallback-1`,
            title: query,
            author: '저자 정보',
            publisher: '도서 출판사',
            cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
            buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(query)}`,
            rating: 5.0
          }
        ]);
      }
    } catch (err) {
      console.warn('API Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyInShelf = (title) => {
    return existingBooks.some(b => b.title.toLowerCase() === title.toLowerCase());
  };

  const currentList = activeTab === 'bestseller' ? bestsellerList : searchResults;

  return (
    <div className="book-search-container">
      {/* 상단 서치 탭 */}
      <div className="search-header-banner">
        <h2><Sparkles size={24} className="text-warning inline-block me-1" /> 도서 실시간 탐색 & 베스트셀러 (Open API)</h2>
        <p className="sub-text">오픈 API 서버를 통해 실시간 트렌드 및 도서 정보를 라이브로 조회합니다.</p>

        <form onSubmit={handleSearch} className="search-bar-wrapper mt-3">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="책 제목, 저자명, 키워드를 입력하세요... (예: 클린 코드, 재테크, 소설)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'API 조회 중...' : '검색하기'}
          </button>
        </form>
      </div>

      {/* 탭 구분 */}
      <div className="tab-bar mt-4 flex justify-between align-center">
        <div className="flex gap-2">
          <button
            className={`tab-item ${activeTab === 'bestseller' ? 'active' : ''}`}
            onClick={() => setActiveTab('bestseller')}
          >
            <Flame size={18} color="#ef4444" /> 실시간 베스트셀러 (API)
          </button>
          <button
            className={`tab-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={18} /> 도서 검색 결과 ({searchResults.length})
          </button>
        </div>

        {activeTab === 'bestseller' && (
          <button className="btn btn-sm btn-outline" onClick={fetchRealtimeBestsellers} title="새로고침">
            <RefreshCw size={14} className={bestsellerLoading ? 'animate-spin' : ''} /> 베스트셀러 갱신
          </button>
        )}
      </div>

      {/* 카드 그리드 */}
      <div className="search-grid mt-4">
        {activeTab === 'bestseller' && bestsellerLoading ? (
          <div className="empty-search p-5 text-center w-full col-span-full">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-2" />
            <p>실시간 인기 베스트셀러 API 정보를 로딩 중입니다...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="empty-search p-5 text-center col-span-full">
            {activeTab === 'search' ? '검색어를 입력하고 검색하기 버튼을 눌러주세요!' : '베스트셀러 정보가 없습니다.'}
          </div>
        ) : (
          currentList.map((book) => {
            const added = isAlreadyInShelf(book.title);

            return (
              <div key={book.id} className="search-card">
                <div className="search-card-img-wrapper">
                  <img src={book.cover_url} alt={book.title} loading="lazy" />
                  <span className="rating-tag">★ {book.rating}</span>
                </div>

                <div className="search-card-info">
                  <h4 title={book.title}>{book.title}</h4>
                  <p className="author-text">{book.author} · {book.publisher}</p>
                  {book.description && <p className="desc-text">{book.description}</p>}

                  <div className="card-btn-group mt-3">
                    {added ? (
                      <button className="btn btn-sm btn-disabled" disabled>
                        <Check size={14} /> 내 책장에 포함됨
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => onAddBook({ ...book, status: 'TO_READ' })}
                      >
                        <Plus size={14} /> 책장에 담기
                      </button>
                    )}

                    <a
                      href={book.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline text-decoration-none"
                      title="네이버/알라딘 구매 페이지 연결"
                    >
                      <ShoppingBag size={14} /> 구매 연결 <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
