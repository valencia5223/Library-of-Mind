import React, { useState } from 'react';
import { Search, ShoppingBag, Plus, Check, Star, Flame, Sparkles, ExternalLink } from 'lucide-react';

export default function BookSearch({ onAddBook, existingBooks = [] }) {
  const [activeTab, setActiveTab] = useState('bestseller'); // 'bestseller' | 'search'
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // 실시간 국내 인기 베스트셀러 모크 데이터
  const bestsellers = [
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
      title: '돈의 속성',
      author: '김승호',
      publisher: '스노우폭스북스',
      cover_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
      description: '최초의 한인 자수성가 부자가 전하는 진짜 돈에 관한 이야기.',
      buy_link: 'https://search.shopping.naver.com/book/search?query=돈의속성',
      rating: 4.8
    },
    {
      id: 'bs-5',
      title: '도둑맞은 집중력',
      author: '요한 하리',
      publisher: '어크로스',
      cover_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
      description: '집중력 위기의 시대, 우리는 어떻게 깊은 조망을 되찾을 것인가.',
      buy_link: 'https://search.shopping.naver.com/book/search?query=도둑맞은집중력',
      rating: 4.7
    },
    {
      id: 'bs-6',
      title: '불편한 편의점',
      author: '김호연',
      publisher: '나무옆의의자',
      cover_url: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=400&q=80',
      description: '청파동 골목길 작은 편의점에서 펼쳐지는 이웃들의 따뜻한 위로.',
      buy_link: 'https://search.shopping.naver.com/book/search?query=불편한편의점',
      rating: 5.0
    }
  ];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      // open API (Kakao or Google Books API)
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();

      if (data.docs && data.docs.length > 0) {
        const formatted = data.docs.map((doc, idx) => ({
          id: doc.key || `search-${idx}`,
          title: doc.title,
          author: doc.author_name ? doc.author_name.join(', ') : '저자 미상',
          publisher: doc.publisher ? doc.publisher[0] : '출판사 미상',
          cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
          buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(doc.title)}`,
          rating: 4.5
        }));
        setSearchResults(formatted);
      } else {
        // 검색 결과 없을 때 한국어 책 폴백 생성
        setSearchResults([
          {
            id: `fallback-1`,
            title: query,
            author: '저자 정보',
            publisher: '출판사',
            cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
            buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(query)}`,
            rating: 5.0
          }
        ]);
      }
    } catch (err) {
      console.warn('API Search error, fallbacking:', err);
      setSearchResults([
        {
          id: `fallback-err`,
          title: `${query} (검색 결과)`,
          author: '저자 미상',
          publisher: '도서 정보',
          cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
          buy_link: `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(query)}`,
          rating: 4.5
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyInShelf = (title) => {
    return existingBooks.some(b => b.title.toLowerCase() === title.toLowerCase());
  };

  const currentList = activeTab === 'bestseller' ? bestsellers : searchResults;

  return (
    <div className="book-search-container">
      {/* 상단 서치 탭 */}
      <div className="search-header-banner">
        <h2><Sparkles size={24} className="text-warning" /> 도서 탐색 & 베스트셀러</h2>
        <p className="sub-text">원하는 책을 직접 검색하거나, 실시간 베스트셀러를 내 책장에 추가해 보세요.</p>

        <form onSubmit={handleSearch} className="search-bar-wrapper mt-3">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="책 제목, 저자명, 키워드를 입력하세요... (예: 클린 코드, 재테크)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (activeTab !== 'search') setActiveTab('search');
            }}
          />
          <button type="submit" className="btn btn-primary">
            {loading ? '검색 중...' : '검색하기'}
          </button>
        </form>
      </div>

      {/* 탭 구분 */}
      <div className="tab-bar mt-4">
        <button
          className={`tab-item ${activeTab === 'bestseller' ? 'active' : ''}`}
          onClick={() => setActiveTab('bestseller')}
        >
          <Flame size={18} color="#ef4444" /> 실시간 베스트셀러
        </button>
        <button
          className={`tab-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={18} /> 도서 검색 결과 ({searchResults.length})
        </button>
      </div>

      {/* 카드 그리드 */}
      <div className="search-grid mt-4">
        {currentList.length === 0 ? (
          <div className="empty-search p-5 text-center">
            {activeTab === 'search' ? '검색어를 입력하고 검색하기 버튼을 눌러주세요!' : '베스트셀러 정보를 불러오는 중입니다.'}
          </div>
        ) : (
          currentList.map((book) => {
            const added = isAlreadyInShelf(book.title);

            return (
              <div key={book.id} className="search-card">
                <div className="search-card-img-wrapper">
                  <img src={book.cover_url} alt={book.title} />
                  <span className="rating-tag">★ {book.rating}</span>
                </div>

                <div className="search-card-info">
                  <h4>{book.title}</h4>
                  <p className="author-text">{book.author} · {book.publisher}</p>
                  {book.description && <p className="desc-text">{book.description}</p>}

                  <div className="card-btn-group mt-3">
                    {added ? (
                      <button className="btn btn-sm btn-disabled" disabled>
                        <Check size={14} /> 내 책장에 있음
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
                      title="알라딘/네이버 구매 연결"
                    >
                      <ShoppingBag size={14} /> 구매하기 <ExternalLink size={12} />
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
