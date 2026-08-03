import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingBag, Plus, CheckCircle2, Flame, ExternalLink, RefreshCw, BookOpen, Sparkles, Star } from 'lucide-react';
import { supabase } from '../supabaseClient'; // Supabase 인스턴스 가져오기

export default function BookSearch({ onAddBook, existingBooks = [] }) {
  const [activeTab, setActiveTab] = useState('bestseller');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bestsellerList, setBestsellerList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestsellerLoading, setBestsellerLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);


  // 1. Supabase Database DB Proxy를 활용한 국내 베스트셀러 호출 (CORS & ORB 우회 완료)
  const fetchAladinBestsellers = useCallback(async () => {
    setBestsellerLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('aladin_bestseller_proxy');
      
      if (error) {
        // RPC 함수가 존재하지 않는 에러인 경우 사용자 가이드를 상정
        if (error.message && error.message.includes('does not exist')) {
          setErrorMsg('Supabase DB에 프록시 함수(SQL)를 등록해야 알라딘 API 호출이 가능합니다. 대화창의 가이드를 따라 SQL을 꼭 실행해 주세요!');
          return;
        }
        throw error;
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      if (data && data.item && data.item.length > 0) {
        setBestsellerList(parseAladinItems(data.item));
      } else {
        setErrorMsg('베스트셀러 목록이 비어있습니다.');
      }
    } catch (err) {
      console.warn('알라딘 베스트셀러 API 오류:', err);
      setErrorMsg(err.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setBestsellerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAladinBestsellers();
  }, [fetchAladinBestsellers]);

  // 2. Supabase Database DB Proxy를 활용한 실시간 국내 도서 검색 (CORS & ORB 우회 완료)
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setActiveTab('search');

    try {
      const { data, error } = await supabase.rpc('aladin_search_proxy', { search_query: query });
      
      if (error) {
        if (error.message && error.message.includes('does not exist')) {
          setErrorMsg('Supabase DB 프록시 함수 등록이 필요합니다. SQL 가이드를 실행해 주세요.');
          return;
        }
        throw error;
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      if (data && data.item && data.item.length > 0) {
        setSearchResults(parseAladinItems(data.item));
      } else {
        setSearchResults([]);
        setErrorMsg('검색 결과가 없습니다.');
      }
    } catch (err) {
      console.warn('알라딘 검색 API 오류:', err);
      setErrorMsg(err.message || '도서 검색 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 알라딘 응답 데이터 가공 및 고화질 표지 매핑
  const parseAladinItems = (items) => {
    return items.map((item) => {
      let coverUrl = item.cover || '';
      // coversum → cover500 교체하여 해상도 대폭 업그레이드
      coverUrl = coverUrl.replace('/coversum/', '/cover500/');

      return {
        id: `aladin-${item.itemId}`,
        title: item.title || '제목 정보 없음',
        author: item.author || '저자 미상',
        publisher: item.publisher || '출판사',
        cover_url: coverUrl,
        description: item.description || '',
        buy_link: item.link || `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${encodeURIComponent(item.title)}`,
        rating: item.customerReviewRank ? (item.customerReviewRank / 2).toFixed(1) : '4.8',
        total_pages: 320,
        price: item.priceSales ? `₩${item.priceSales.toLocaleString()}` : '',
        category: item.categoryName || '',
        bestRank: item.bestRank || null
      };
    });
  };

  const isAlreadyInShelf = (title) => {
    return existingBooks.some(b => b.title.toLowerCase().trim() === title.toLowerCase().trim());
  };

  const currentList = activeTab === 'bestseller' ? bestsellerList : searchResults;

  return (
    <div className="book-search-container">
      <div className="search-header-banner">
        <h2><Sparkles size={24} className="text-warning inline-block me-1" /> 알라딘 실시간 국내 베스트셀러 & 도서 검색</h2>
        <p className="sub-text">Supabase DB Proxy 방식을 통해 국내 도서 데이터와 100% 실제 물리 책 표지를 안전하고 안정적으로 제공합니다.</p>

        <form onSubmit={handleSearch} className="search-bar-wrapper mt-3">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="국내 도서를 검색하세요 (예: 클린코드, 세이노의 가르침, 트렌드 코리아, 해리포터)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '알라딘 검색 중...' : '도서 검색'}
          </button>
        </form>
      </div>

      <div className="tab-bar mt-4 flex justify-between align-center">
        <div className="flex gap-2">
          <button className={`tab-item ${activeTab === 'bestseller' ? 'active' : ''}`} onClick={() => setActiveTab('bestseller')}>
            <Flame size={18} color="#ef4444" /> 알라딘 실시간 베스트셀러 TOP 20
          </button>
          <button className={`tab-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
            <Search size={18} /> 국내 도서 검색 ({searchResults.length})
          </button>
        </div>
        {activeTab === 'bestseller' && (
          <button className="btn btn-sm btn-outline" onClick={fetchAladinBestsellers}>
            <RefreshCw size={14} className={bestsellerLoading ? 'animate-spin' : ''} /> 베스트셀러 갱신
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 text-warning text-center mt-3 bg-opacity-10 bg-warning rounded-lg border border-warning">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="search-grid mt-4">
        {(activeTab === 'bestseller' && bestsellerLoading) || (activeTab === 'search' && loading) ? (
          <div className="empty-search p-5 text-center w-full col-span-full">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-2" />
            <p>알라딘 도서 API에서 실시간 데이터를 불러오는 중입니다...</p>
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
                  <span className="rating-tag">★ {book.rating}</span>
                </div>
                <div className="search-card-info">
                  <h4 title={book.title}>{book.title}</h4>
                  <p className="author-text">{book.author}</p>
                  <p className="author-text">{book.publisher} {book.price && `· ${book.price}`}</p>
                  {book.description && <p className="desc-text">{book.description}</p>}
                  <div className="card-btn-group mt-3" onClick={(e) => e.stopPropagation()}>
                    {added ? (
                      <button className="btn btn-sm btn-disabled" disabled><CheckCircle2 size={14} /> 내 책장에 있음</button>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => onAddBook({ ...book, status: 'TO_READ' })}>
                        <Plus size={14} /> 책장에 담기
                      </button>
                    )}
                    <a href={book.buy_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline text-decoration-none">
                      <ShoppingBag size={14} /> 알라딘 구매 <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 검색 및 베스트셀러 도서 상세 정보 모달 */}
      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="modal-card book-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBook(null)}>✕</button>

            <div className="detail-grid">
              <div className="detail-cover-side">
                <img
                  src={selectedBook.cover_url}
                  alt={selectedBook.title}
                  referrerPolicy="no-referrer"
                  className="detail-cover"
                />
                
                {selectedBook.price && (
                  <div className="mt-3 text-center">
                    <span className="small-tag font-bold" style={{ fontSize: '0.9rem', padding: '0.35rem 0.8rem', background: 'rgba(0, 120, 166, 0.05)', color: 'var(--primary)', borderColor: 'rgba(0, 120, 166, 0.2)' }}>
                      판매가: {selectedBook.price}
                    </span>
                  </div>
                )}
                {selectedBook.rating && (
                  <div className="mt-2 text-center text-warning flex align-center justify-center gap-1 font-bold">
                    <Star size={16} fill="#f59e0b" color="#f59e0b" />
                    <span>평점 {selectedBook.rating} / 5.0</span>
                  </div>
                )}
              </div>

              <div className="detail-content">
                <h3>{selectedBook.title}</h3>
                <p className="detail-author">{selectedBook.author} | {selectedBook.publisher || '출판사 정보'}</p>

                {/* 도서 상세 설명 */}
                <div className="review-section mt-3 p-3 border-card" style={{ background: '#f8fafc', borderRadius: '8px', minHeight: '120px' }}>
                  <h4 className="flex align-center gap-1" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                    📖 도서 소개
                  </h4>
                  <p className="desc-text" style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedBook.description || '알라딘에 등록된 소개글 설명이 없습니다.'}
                  </p>
                </div>

                <div className="action-row mt-4 flex justify-between align-center">
                  {isAlreadyInShelf(selectedBook.title) ? (
                    <button className="btn btn-disabled" disabled>
                      <CheckCircle2 size={16} /> 이미 내 책장에 있음
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        onAddBook({ ...selectedBook, status: 'TO_READ' });
                        setSelectedBook(null);
                      }}
                    >
                      <Plus size={16} /> 내 책장에 담기
                    </button>
                  )}

                  {selectedBook.buy_link && (
                    <a
                      href={selectedBook.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-decoration-none"
                    >
                      <ShoppingBag size={16} /> 알라딘 구매 <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
