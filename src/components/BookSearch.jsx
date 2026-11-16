import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingBag, Plus, CheckCircle2, Flame, ExternalLink, RefreshCw, BookOpen, Sparkles, Star } from 'lucide-react';
import { fetchBestsellers, searchBooks, findBookDetail } from '../utils/yes24';
import BookDetailModal from './BookDetailModal';

// 예스24 분류 코드 (GET /v1/category/list 로 확인, '001' = 국내도서 종합)
const BESTSELLER_CATEGORIES = [
  { id: '001', name: '🌟 종합' },
  { id: '001001046', name: '📖 소설/시' },
  { id: '001001025', name: '📈 경제경영' },
  { id: '001001026', name: '💡 자기계발' },
  { id: '001001019', name: '🏛️ 인문' },
  { id: '001001002', name: '🔬 과학' },
  { id: '001001047', name: '✍️ 에세이' },
  { id: '001001008', name: '🎨 만화' },
  { id: '001001016', name: '👶 어린이' },
  { id: '001001009', name: '✈️ 여행' },
  { id: '001001001', name: '🍳 가정/살림' },
  { id: '001001015', name: '📝 수험서/자격증' }
];

const SEARCH_PAGE_SIZE = 30;

export default function BookSearch({ onAddBook, existingBooks = [] }) {
  const [activeTab, setActiveTab] = useState('bestseller');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bestsellerList, setBestsellerList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestsellerLoading, setBestsellerLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('001');

  // 페이지네이션 및 정렬 상태
  const [page, setPage] = useState(1);
  const [sortOption, setSortOption] = useState('DEFAULT');
  const [hasMore, setHasMore] = useState(false);

  // 1. 예스24 분야별 베스트셀러 (Edge Function 'yes24' 중계)
  const loadBestsellers = useCallback(async (catId = selectedCategory) => {
    setBestsellerLoading(true);
    setErrorMsg('');
    try {
      const list = await fetchBestsellers(catId, 20);
      setBestsellerList(list);
      if (list.length === 0) setErrorMsg('해당 분야의 베스트셀러 목록이 비어있습니다.');
    } catch (err) {
      console.warn('예스24 베스트셀러 오류:', err);
      setBestsellerList([]);
      setErrorMsg(err.message || '베스트셀러 데이터를 불러오지 못했습니다.');
    } finally {
      setBestsellerLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadBestsellers(selectedCategory);
  }, []);

  // 모달 팝업 오픈 시 배경 스크롤을 100% 잠그고, 닫히면 원래대로 복구
  useEffect(() => {
    if (selectedBook) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedBook]);

  // 2. 예스24 도서 검색
  const handleSearch = async (e, isLoadMore = false) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setActiveTab('search');

    const nextPage = isLoadMore ? page + 1 : 1;
    if (!isLoadMore) {
      setSearchResults([]);
    }

    try {
      // 가격순은 정확도순으로 받아 화면에서 정렬
      const apiSort = (sortOption === 'PriceLow' || sortOption === 'PriceHigh') ? 'DEFAULT' : sortOption;
      const { books, totalCount } = await searchBooks(query.trim(), { page: nextPage, pageSize: SEARCH_PAGE_SIZE, sort: apiSort });

      if (books.length > 0) {
        if (isLoadMore) {
          setSearchResults(prev => [...prev, ...books]);
        } else {
          setSearchResults(books);
        }
        setPage(nextPage);
        setHasMore(nextPage * SEARCH_PAGE_SIZE < totalCount && books.length === SEARCH_PAGE_SIZE);
      } else {
        if (!isLoadMore) {
          setSearchResults([]);
          setErrorMsg('검색 결과가 없습니다.');
        }
        setHasMore(false);
      }
    } catch (err) {
      console.warn('예스24 검색 오류:', err);
      setErrorMsg(err.message || '도서 검색 중 오류가 발생했습니다.');
      if (!isLoadMore) setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 서재에 도서를 추가 (예스24 상세에서 실제 쪽수·소개를 받아 함께 저장)
  const handleAddToShelf = async (book) => {
    let detail = null;
    if (!book.total_pages) {
      detail = await findBookDetail(book);
    }

    onAddBook({
      ...book,
      total_pages: detail?.total_pages || book.total_pages || 0,
      description: book.description || detail?.description || '',
      status: 'TO_READ',
      rating: 0
    });
  };

  const isAlreadyInShelf = (title) => {
    return existingBooks.some(b => b.title.toLowerCase().trim() === title.toLowerCase().trim());
  };

  // 클라이언트 단 가격 오름차순/내림차순 정렬 연산
  const getProcessedList = () => {
    const list = activeTab === 'bestseller' ? bestsellerList : searchResults;
    if (activeTab === 'search') {
      if (sortOption === 'PriceLow') {
        return [...list].sort((a, b) => {
          const valA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const valB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return valA - valB;
        });
      } else if (sortOption === 'PriceHigh') {
        return [...list].sort((a, b) => {
          const valA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const valB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return valB - valA;
        });
      }
    }
    return list;
  };

  const currentList = getProcessedList();

  // 정렬 조건 변경 이벤트 핸들러 및 자동 트리거
  useEffect(() => {
    if (activeTab === 'search' && query.trim()) {
      if (sortOption !== 'PriceLow' && sortOption !== 'PriceHigh') {
        setPage(1);
        handleSearch(null, false);
      }
    }
  }, [sortOption]);

  return (
    <div className="book-search-container">
      <div className="search-header-banner">
        <h2><Sparkles size={24} className="text-warning inline-block me-1" /> 예스24 국내 베스트셀러 & 도서 검색</h2>
        <p className="sub-text">국내 베스트셀러 및 다양한 분야의 도서를 검색하여 내 서재에 수집해 보세요.</p>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); handleSearch(e, false); }} className="search-bar-wrapper mt-3">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="국내 도서를 검색하세요 (예: 클린코드, 세이노의 가르침, 트렌드 코리아, 해리포터)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '검색 중...' : '도서 검색'}
          </button>
        </form>
      </div>

      <div className="tab-bar mt-4 flex justify-between align-center">
        <div className="flex gap-2">
          <button className={`tab-item ${activeTab === 'bestseller' ? 'active' : ''}`} onClick={() => setActiveTab('bestseller')}>
            <Flame size={18} color="#ef4444" /> 예스24 베스트셀러 TOP 20
          </button>
          <button className={`tab-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
            <Search size={18} /> 국내 도서 검색 ({searchResults.length})
          </button>
        </div>
        
        <div className="flex gap-2 align-center">
          {activeTab === 'search' && searchResults.length > 0 && (
            <div className="flex align-center gap-1">
              <span className="small-text font-bold" style={{ fontSize: '0.85rem', color: '#71717a' }}>정렬 기준:</span>
              <select
                className="select-sort"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                style={{
                  padding: '0.35rem 1.8rem 0.35rem 0.65rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #d4d4d8',
                  backgroundColor: '#ffffff',
                  color: '#3f3f46',
                  cursor: 'pointer',
                  outline: 'none',
                  fontWeight: 600,
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1em'
                }}
              >
                <option value="DEFAULT">정확도순</option>
                <option value="RECENT">신간순</option>
                <option value="PriceLow">가격 낮은순</option>
                <option value="PriceHigh">가격 높은순</option>
              </select>
            </div>
          )}

          {activeTab === 'bestseller' && (
            <button className="btn btn-sm btn-outline" onClick={() => loadBestsellers(selectedCategory)}>
              <RefreshCw size={14} className={bestsellerLoading ? 'animate-spin' : ''} /> 베스트셀러 갱신
            </button>
          )}
        </div>
      </div>

      {/* 분야별 베스트셀러 카테고리 필터 탭 (종합, 소설/시, 경제경영, 자기계발, 인문학, 과학, 에세이 등) */}
      {activeTab === 'bestseller' && (
        <div className="bestseller-category-bar mt-3 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {BESTSELLER_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setSelectedCategory(cat.id);
                loadBestsellers(cat.id);
              }}
              style={{ flexShrink: 0 }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 text-warning text-center mt-3 bg-opacity-10 bg-warning rounded-lg border border-warning">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="search-grid mt-4">
        {(activeTab === 'bestseller' && bestsellerLoading) || (activeTab === 'search' && loading && currentList.length === 0) ? (
          <div className="empty-search p-5 text-center w-full col-span-full">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-2" />
            <p>예스24에서 도서 정보를 불러오는 중입니다...</p>
          </div>
        ) : currentList.length === 0 && !errorMsg ? (
          <div className="empty-search p-5 text-center col-span-full">
            {activeTab === 'search' ? '검색 결과가 없습니다. 다른 키워드로 검색해 보세요.' : '베스트셀러를 불러오지 못했습니다. 새로고침을 눌러주세요.'}
          </div>
        ) : (
          currentList.map((book) => {
            const added = isAlreadyInShelf(book.title);
            return (
              <div key={book.id} className="search-card cursor-pointer" onClick={() => setSelectedBook(book)}>
                <div className="search-card-img-wrapper">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {book.bestRank && (
                    <span className="rank-tag">{book.bestRank}위</span>
                  )}
                  {book.rating && <span className="rating-tag">★ {book.rating}</span>}
                </div>
                <div className="search-card-info">
                  <h4 title={book.title}>{book.title}</h4>
                  <p className="author-text">{book.author}</p>
                  <p className="author-text">{book.publisher} {book.price && `· ${book.price}`}</p>
                  {book.description && (
                    <p className="desc-text">
                      {book.description.substring(0, 100)}
                      {book.description.length > 100 ? '...' : ''}
                    </p>
                  )}
                  <div className="card-btn-group mt-3" onClick={(e) => e.stopPropagation()}>
                    {added ? (
                      <button className="btn btn-sm btn-disabled" disabled><CheckCircle2 size={14} /> 내 책장에 있음</button>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => handleAddToShelf(book)}>
                        <Plus size={14} /> 책장에 담기
                      </button>
                    )}
                    <a href={book.buy_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline text-decoration-none">
                      <ShoppingBag size={14} /> 예스24 구매 <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 실시간 도서 무한 '결과 더보기' 페이지네이션 영역 */}
      {activeTab === 'search' && hasMore && (
        <div className="flex justify-center mt-5 mb-4">
          <button 
            className="btn btn-outline" 
            onClick={() => handleSearch(null, true)} 
            disabled={loading}
            style={{ minWidth: '220px', display: 'flex', justifyContent: 'center' }}
          >
            {loading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <BookOpen size={16} />
            )}
            {loading ? '검색 결과 가져오는 중...' : '검색 결과 더보기'}
          </button>
        </div>
      )}

      {/* 예스24 이용 조건: 도서 정보 출처 표기 */}
      <p className="sub-text text-center mt-4" style={{ fontSize: '0.8rem' }}>
        도서 정보 제공: <a href="https://www.yes24.com" target="_blank" rel="noopener noreferrer">예스24</a>
      </p>

      {/* 검색 및 베스트셀러 도서 상세 정보 모달 (공통 단일 모달 적용) */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          description={selectedBook.description}
          toc={selectedBook.toc}
          isAlreadyInShelf={isAlreadyInShelf(selectedBook.title)}
          onAddBook={handleAddToShelf}
        />
      )}
    </div>
  );
}
