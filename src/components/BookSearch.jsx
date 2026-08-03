import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingBag, Plus, CheckCircle2, Flame, ExternalLink, RefreshCw, BookOpen, Sparkles } from 'lucide-react';

// 알라딘 TTB Open API (JSONP 방식 - CORS & Mixed Content 완벽 우회)
const ALADIN_TTB_KEY = 'ttbcdw2341334001';

// JSONP 호출 유틸리티 (크롬 nosniff 대응 및 호환성 보장)
function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `aladinCb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');

    // 타임아웃
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('인터넷 연결이 원활하지 않거나 API 응답이 지연되고 있습니다.'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    // 브라우저의 strict MIME type checking을 우회하기 위해 인위적으로 type 명시
    script.type = 'text/javascript';
    script.src = `${url}&output=js&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('도서 정보를 불러오는데 실패하였습니다.'));
    };

    document.head.appendChild(script);
  });
}

export default function BookSearch({ onAddBook, existingBooks = [] }) {
  const [activeTab, setActiveTab] = useState('bestseller');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bestsellerList, setBestsellerList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestsellerLoading, setBestsellerLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAladinBestsellers = useCallback(async () => {
    setBestsellerLoading(true);
    setErrorMsg('');
    try {
      const url = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${ALADIN_TTB_KEY}&QueryType=Bestseller&MaxResults=20&start=1&SearchTarget=Book&Cover=Big&Version=20131101`;
      const data = await fetchJsonp(url);

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setActiveTab('search');

    try {
      const url = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_TTB_KEY}&Query=${encodeURIComponent(query)}&MaxResults=20&start=1&SearchTarget=Book&Cover=Big&Version=20131101`;
      const data = await fetchJsonp(url);

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

  const parseAladinItems = (items) => {
    return items.map((item) => {
      let coverUrl = item.cover || '';
      coverUrl = coverUrl.replace('/coversum/', '/cover500/');

      return {
        id: `aladin-${item.itemId}`,
        title: item.title || '제목 정보 없음',
        author: item.author || '저자 미상',
        publisher: item.publisher || '출판사',
        cover_url: coverUrl,
        description: item.description ? `${item.description.substring(0, 100)}...` : '',
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
        <p className="sub-text">알라딘 공식 TTB Open API를 통해 국내 전체 도서 DB에서 실시간 검색하고, 100% 실제 책 표지를 제공합니다.</p>

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
        <div className="p-3 text-warning text-center mt-3 bg-opacity-10 bg-warning rounded-lg">
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
              <div key={book.id} className="search-card">
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
                  <div className="card-btn-group mt-3">
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
    </div>
  );
}
