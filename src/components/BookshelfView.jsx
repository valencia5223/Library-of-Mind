import React, { useState } from 'react';
import { BookOpen, Star, ExternalLink, PlusCircle, CheckCircle, Clock, Bookmark, Trash2, Edit3, Grid, Layers, MessageSquare, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export default function BookshelfView({ 
  books, 
  onUpdateStatus, 
  onDeleteBook, 
  onAddManualBook, 
  onUpdateBookDetails, 
  viewedFriend = null, 
  onBackToMyBookshelf 
}) {
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'grid'
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  const [coverColors, setCoverColors] = useState({});
  const [syncingGoogleInfo, setSyncingGoogleInfo] = useState(false);

  // 1차: Google Books API (ISBN 기반)
  const fetchGooglePageCount = async (isbn) => {
    if (!isbn || isbn.startsWith('K')) return null;
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const pages = data.items[0].volumeInfo?.pageCount;
          if (pages && pages > 0) return parseInt(pages);
        }
      }
    } catch (e) {
      console.warn('Google Books API 페이지 조회 실패:', e);
    }
    return null;
  };

  // 2차: Open Library API (ISBN 기반)
  const fetchOpenLibraryPageCount = async (isbn) => {
    if (!isbn || isbn.startsWith('K')) return null;
    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      if (res.ok) {
        const data = await res.json();
        const bookData = data[`ISBN:${isbn}`];
        if (bookData && bookData.number_of_pages) {
          return parseInt(bookData.number_of_pages);
        }
      }
    } catch (e) {
      console.warn('Open Library API 페이지 조회 실패:', e);
    }
    return null;
  };

  // 3차: 알라딘 ItemLookUp API 헬퍼 (3중 CORS 프록시)
  const fetchPageCountFromAladin = async (itemId, idType = 'ItemId') => {
    const ttbKey = 'ttbcdw2341334001';
    const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${ttbKey}&itemIdType=${idType}&ItemId=${itemId}&Cover=Big&Version=20131101&output=js&OptResult=itemPage`;
    
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(aladinUrl)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(aladinUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${aladinUrl}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          let cleanText = '';
          if (proxyUrl.includes('allorigins')) {
            const wrapper = await res.json();
            cleanText = (wrapper.contents || '').trim().replace(/;$/, '');
          } else {
            const text = await res.text();
            cleanText = text.trim().replace(/;$/, '');
          }
          const data = JSON.parse(cleanText);
          if (data.item && data.item.length > 0) {
            const item = data.item[0];
            const p = item.subInfo?.itemPage || item.itemPage || null;
            if (p) return { pages: parseInt(p), pubDate: item.pubDate || null };
          }
        }
      } catch (e) {
        console.warn(`프록시 ${proxyUrl} 실패:`, e);
      }
    }

    return null;
  };

  // 페이지 수 수동 직관적 수정 함수
  const handleManualPageEdit = async () => {
    if (!selectedBook) return;
    const input = window.prompt('해당 도서의 실제 전체 페이지 수를 입력해주세요:', selectedBook.total_pages || 320);
    if (input !== null) {
      const pageNum = parseInt(input.trim());
      if (isNaN(pageNum) || pageNum <= 0) {
        alert('올바른 페이지 숫자를 입력해 주세요.');
        return;
      }

      const updated = { ...selectedBook, total_pages: pageNum };
      if (onUpdateBookDetails) {
        await onUpdateBookDetails(selectedBook.id, updated);
      }
      setSelectedBook(updated);
      alert(`✅ 페이지 수가 ${pageNum}p로 변경되었습니다!`);
    }
  };

  // [다중 API 연동 체인] Google Books -> Open Library -> Aladin 3단계 페이지 수 동기화
  const handleSyncBookInfo = async (book) => {
    if (!book || syncingGoogleInfo) return;
    setSyncingGoogleInfo(true);
    
    try {
      let fetchedPages = null;
      let fetchedPubDate = null;
      let source = '';
      const rawIsbn = (book.isbn || '').trim().replace(/-/g, '');
      const ttbKey = 'ttbcdw2341334001';

      if (rawIsbn) {
        // [1단계] Google Books API 시도
        const googlePages = await fetchGooglePageCount(rawIsbn);
        if (googlePages) {
          fetchedPages = googlePages;
          source = 'Google Books API';
        }

        // [2단계] Open Library API 시도
        if (!fetchedPages) {
          const openLibPages = await fetchOpenLibraryPageCount(rawIsbn);
          if (openLibPages) {
            fetchedPages = openLibPages;
            source = 'Open Library API';
          }
        }

        // [3단계] 알라딘 ItemLookUp API 시도 (ISBN/ItemId 기반)
        if (!fetchedPages) {
          let idType = 'ISBN13';
          if (rawIsbn.startsWith('K') || (rawIsbn.length >= 8 && rawIsbn.length <= 10 && !/^\d+$/.test(rawIsbn))) {
            idType = 'ItemId';
          } else if (rawIsbn.length === 10) {
            idType = 'ISBN';
          }

          const res = await fetchPageCountFromAladin(rawIsbn, idType);
          if (res && res.pages) {
            fetchedPages = res.pages;
            fetchedPubDate = res.pubDate;
            source = '알라딘 API (ItemLookUp)';
          }
        }
      }

      // [4단계] 제목 기반 알라딘 ItemSearch + ItemLookUp 2차 추적
      if (!fetchedPages && book.title) {
        try {
          const cleanTitle = (book.title || '').split('-')[0].split('(')[0].trim();
          const searchUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ttbKey}&Query=${encodeURIComponent(cleanTitle)}&QueryType=Title&MaxResults=1&SearchTarget=Book&output=js&Version=20131101`;
          
          let foundItemId = null;
          try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`;
            const sRes = await fetch(proxyUrl);
            if (sRes.ok) {
              const text = await sRes.text();
              const cleanText = text.trim().replace(/;$/, '');
              const sData = JSON.parse(cleanText);
              if (sData.item && sData.item.length > 0) {
                foundItemId = sData.item[0].itemId || sData.item[0].isbn13 || sData.item[0].isbn;
              }
            }
          } catch (se) {
            console.warn('corsproxy.io ItemSearch 실패, allorigins 폴백:', se);
            try {
              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
              const sRes = await fetch(proxyUrl);
              if (sRes.ok) {
                const wrapper = await sRes.json();
                const cleanText = (wrapper.contents || '').trim().replace(/;$/, '');
                const sData = JSON.parse(cleanText);
                if (sData.item && sData.item.length > 0) {
                  foundItemId = sData.item[0].itemId || sData.item[0].isbn13 || sData.item[0].isbn;
                }
              }
            } catch (se2) {}
          }

          if (foundItemId) {
            const res2 = await fetchPageCountFromAladin(foundItemId, 'ItemId');
            if (res2 && res2.pages) {
              fetchedPages = res2.pages;
              fetchedPubDate = res2.pubDate;
              source = '알라딘 도서 추적 (ItemSearch)';
            }
          }
        } catch (titleErr) {
          console.warn('제목 검색 2단계 동기화 실패:', titleErr);
        }
      }

      if (fetchedPages) {
        const updated = {
          ...book,
          total_pages: parseInt(fetchedPages),
          pub_date: fetchedPubDate || book.pub_date
        };

        if (onUpdateBookDetails) {
          await onUpdateBookDetails(book.id, updated);
        }
        setSelectedBook(updated);
        alert(`✅ 페이지 수 동기화 완료! (${source})\n실제 페이지 수: ${fetchedPages}p`);
      } else {
        alert('⚠️ 해당 도서의 실제 페이지 수 정보를 찾지 못했습니다.\nAPI 데이터베이스에 상세 페이지 수가 미등록되었거나 도서 정보가 불일치할 수 있습니다.');
      }
    } catch (err) {
      console.error('도서 정보 동기화 중 오류 발생:', err);
      alert('❌ 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSyncingGoogleInfo(false);
    }
  };

  // 1. URL로부터 실제 메인 대표 색상을 CORS 우회 추출하는 헬퍼 함수
  const extractMainColor = (bookId, coverUrl) => {
    if (!coverUrl || coverColors[bookId]) return;

    // CORS 우회 이미지 프록시 (weserv.nl)
    const cleanUrl = coverUrl.replace(/^https?:\/\//, '');
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=10&h=10`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = proxyUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        const rgbColor = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
        setCoverColors(prev => ({ ...prev, [bookId]: rgbColor }));
      } catch (err) {
        console.warn("표지 대표색 획득 실패 (CORS 또는 포맷 불가):", err);
      }
    };
  };

  // 2. 저자 3자 단명화 포맷터
  const formatAuthor = (author) => {
    if (!author) return '';
    const clean = author.split('(')[0].split('지음')[0].split('옮김')[0].split('저')[0].trim();
    if (clean.length > 3) {
      return clean.substring(0, 3) + '...';
    }
    return clean;
  };

  // 수정 리뷰 & 별점 폼
  const [editRating, setEditRating] = useState(0);
  const [editReview, setEditReview] = useState('');
  const [editTotalPages, setEditTotalPages] = useState(250);
  const [editCurrentPages, setEditCurrentPages] = useState(0);
  const [editCompletedAt, setEditCompletedAt] = useState('');

  // 별점 및 정보 독립화 동기화
  React.useEffect(() => {
    if (selectedBook) {
      setEditRating(selectedBook.rating ?? 0);
      setEditReview(selectedBook.review || '');
      setEditTotalPages(selectedBook.total_pages || 300);
      setEditCurrentPages(selectedBook.current_pages || 0);

      const todayISO = new Date().toISOString().split('T')[0];
      if (selectedBook.completed_at) {
        setEditCompletedAt(selectedBook.completed_at.split('T')[0]);
      } else {
        setEditCompletedAt(todayISO);
      }
    } else {
      setIsEditingReview(false);
    }
  }, [selectedBook]);

  // 수동 등록 폼
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newStatus, setNewStatus] = useState('TO_READ');
  const [newBuyLink, setNewBuyLink] = useState('');
  const [newTotalPages, setNewTotalPages] = useState(300);

  const statusCategories = [
    { key: 'READING', title: '📖 지금 읽고 있는 책', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    { key: 'READ', title: '🏆 완독한 보물상자', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { key: 'TO_READ', title: '✨ 읽고 싶은 위시리스트', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
  ];

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !newAuthor) return;

    onAddManualBook({
      title: newTitle,
      author: newAuthor,
      cover_url: newCover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
      status: newStatus,
      buy_link: newBuyLink || `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(newTitle)}`,
      rating: 0,
      total_pages: parseInt(newTotalPages) || 300,
      current_pages: newStatus === 'READ' ? parseInt(newTotalPages) || 300 : 0
    });

    setNewTitle('');
    setNewAuthor('');
    setNewCover('');
    setNewBuyLink('');
    setShowAddModal(false);
  };

  const handleOpenDetail = (book) => {
    setSelectedBook(book);
  };

  // 반/온 별점 렌더러 함수 추가
  const renderStars = (rating) => {
    const stars = [];
    const clampRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));
    for (let i = 1; i <= 5; i++) {
        if (clampRating >= i) {
          stars.push(<Star key={i} size={15} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline' }} />);
        } else if (clampRating >= i - 0.5) {
          stars.push(
            <span key={i} style={{ display: 'inline-flex', position: 'relative', width: '15px', height: '15px' }} className="me-0.5">
              <Star size={15} color="#f59e0b" style={{ position: 'absolute' }} />
              <span style={{ width: '7.5px', overflow: 'hidden', position: 'absolute', display: 'inline-block' }}>
                <Star size={15} fill="#f59e0b" color="#f59e0b" />
              </span>
            </span>
          );
        } else {
          stars.push(<Star key={i} size={15} fill="none" color="#f59e0b" style={{ display: 'inline' }} />);
        }
    }
    return stars;
  };

  const handleSaveReview = () => {
    if (!selectedBook) return;

    const isRead = selectedBook.status === 'READ' || editCurrentPages >= editTotalPages;
    const finalStatus = isRead ? 'READ' : selectedBook.status;
    
    let completedAt = null;
    if (finalStatus === 'READ') {
      completedAt = editCompletedAt ? new Date(editCompletedAt).toISOString() : new Date().toISOString();
    }

    const updated = {
      ...selectedBook,
      rating: editRating,
      review: editReview,
      total_pages: editTotalPages,
      current_pages: editCurrentPages,
      status: finalStatus,
      completed_at: completedAt
    };

    onUpdateBookDetails(selectedBook.id, updated);
    setSelectedBook(updated);
    setIsEditingReview(false);
  };

  const handleImgError = (e, fallbackUrl) => {
    e.target.onerror = null;
    e.target.src = fallbackUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80';
  };

  return (
    <div className="bookshelf-container">
      {/* 친구 서재 탐색 시 정보 배너 */}
      {viewedFriend && (
        <div className="friend-view-banner p-3 mb-4 rounded flex justify-between align-middle" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          <div className="flex align-middle font-medium">
            <span className="me-2">📢</span>
            <span>현재 <strong>{viewedFriend.email}</strong> 님의 서재를 둘러보고 있습니다. (읽기 전용 모드)</span>
          </div>
          <button className="btn btn-primary btn-sm px-3 py-1" onClick={onBackToMyBookshelf} style={{ fontSize: '0.8rem' }}>
            내 서재로 돌아가기
          </button>
        </div>
      )}

      {/* 헤더 컨트롤 */}
      <div className="bookshelf-header">
        <div>
          <h2>{viewedFriend ? `${viewedFriend.email.split('@')[0]} 님의 3D 비주얼 서재` : '나만의 3D 비주얼 서재'}</h2>
          <p className="sub-text">
            {viewedFriend 
              ? '친구의 책장에 꽂힌 양장본 도서들을 마우스 포인터로 움직여 관찰하고 클릭해 독평을 읽어보세요.'
              : '원목 책장에 꽂힌 책을 클릭하여 상태 변경, 별점 및 독서 리뷰를 남기세요.'}
          </p>
        </div>
        <div className="flex gap-2 align-center">
          <div className="toggle-group">
            <button
              className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
              <Layers size={16} /> 3D 책장
            </button>
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} /> 그리드 뷰
            </button>
          </div>

          {!viewedFriend && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <PlusCircle size={18} /> 수동 책 추가
            </button>
          )}
        </div>
      </div>

      {/* 서재 책장 층별 렌더링 */}
      {statusCategories.map((cat) => {
        const catBooks = books.filter((b) => b.status === cat.key);

        // 12권씩 한 층(선반)으로 구성 및 분배
        const chunks = [];
        const chunkSize = 12;
        for (let i = 0; i < catBooks.length; i += chunkSize) {
          chunks.push(catBooks.slice(i, i + chunkSize));
        }
        if (chunks.length === 0) {
          chunks.push([]); // 빈 선반 1개 표시 보장
        }

        return (
          <div key={cat.key} className="shelf-section">
            <div className="shelf-badge" style={{ borderColor: cat.color, color: cat.color, backgroundColor: cat.bg }}>
              <span>{cat.title}</span>
              <span className="shelf-count">{catBooks.length}권</span>
            </div>

            {viewMode === '3d' ? (
              chunks.map((shelfBooks, chunkIdx) => (
                <div key={`${cat.key}-shelf-${chunkIdx}`} className="wood-shelf" style={{ marginBottom: '2rem' }}>
                  <div className="shelf-surface">
                    {shelfBooks.length === 0 ? (
                      <div className="empty-shelf-text">이 책장은 비어 있습니다. 탐색 탭에서 책을 찾아 꽂아보세요!</div>
                    ) : (
                      <div className="spine-row">
                        {shelfBooks.map((book) => {
                          const spineHeight = Math.min(170, Math.max(130, 120 + ((book.total_pages || 300) / 10)));
                          const spineWidth = Math.min(54, Math.max(38, 32 + ((book.total_pages || 300) / 20)));

                          const charSum = (book.id || 'abc').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                          const isLeaning = charSum % 4 === 0;
                          const tiltAngle = isLeaning ? (charSum % 2 === 0 ? 5 : -5) : 0;

                          const spineStyle = getSpineStyle(book.cover_url, book.id);
                          if (book.cover_url && !coverColors[book.id]) {
                            extractMainColor(book.id, book.cover_url);
                          }
                          const finalBg = coverColors[book.id] || spineStyle.bg;

                          return (
                            <div
                              key={book.id}
                              className="book-3d-container"
                              onClick={() => handleOpenDetail(book)}
                              title={`${book.title} - ${book.author}`}
                              style={{
                                height: `${spineHeight}px`,
                                width: `${spineWidth}px`,
                                '--tilt-angle': `${tiltAngle}deg`
                              }}
                            >
                              <div className="book-3d-box">
                                {/* 3D 책등 책등 본연의 그라데이션 바탕과 세로 텍스트 정렬만 출력 */}
                                <div
                                  className="book-3d-spine"
                                  style={{
                                    background: finalBg
                                  }}
                                >
                                  <div className="spine-ridge"></div>
                                  <div className="spine-highlight"></div>
                                  <div className="spine-content">
                                    <span className="spine-author" style={{ color: spineStyle.authorColor, textShadow: spineStyle.textShadow }}>{formatAuthor(book.author)}</span>
                                    <span className="spine-title" style={{ color: spineStyle.titleColor, textShadow: spineStyle.textShadow }}>{book.title}</span>
                                  </div>
                                </div>

                                {/* 3D 책표지 (호버 시 회전하여 표지가 눈앞에 노출됨) */}
                                <div
                                  className="book-3d-cover"
                                  style={{
                                    width: `${spineHeight * 0.72}px`
                                  }}
                                >
                                  <img
                                    src={book.cover_url}
                                    alt={book.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleImgError(e, book.fallback_cover)}
                                  />
                                </div>

                                {/* 3D 종이속지 옆면 */}
                                <div
                                  className="book-3d-pages"
                                  style={{
                                    width: `${spineHeight * 0.7}px`
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="shelf-plank"></div>
                </div>
              ))
            ) : (
              <div className="book-grid mt-3">
                {catBooks.length === 0 ? (
                  <div className="empty-shelf-text p-4">등록된 도서가 없습니다.</div>
                ) : (
                  catBooks.map((book) => (
                    <div key={book.id} className="book-card" onClick={() => handleOpenDetail(book)}>
                      <div className="book-card-cover-wrapper">
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImgError(e, book.fallback_cover)}
                          className="book-card-cover"
                        />
                        <span className="rating-pill">
                          {renderStars(book.rating ?? 0)} <span className="ms-1" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{(book.rating ?? 0).toFixed ? (book.rating ?? 0).toFixed(1) : parseFloat(book.rating ?? 0).toFixed(1)}</span>
                        </span>
                      </div>
                      <div className="book-card-info">
                        <h4 className="book-title">{book.title}</h4>
                        <p className="book-author">{book.author}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 도서 상세 및 리뷰 모달 */}
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
                  onError={(e) => handleImgError(e, selectedBook.fallback_cover)}
                  className="detail-cover"
                />
                
                {/* 진행률 바 */}
                <div className="progress-box mt-3">
                  <div className="flex justify-between text-xs sub-text font-bold mb-1">
                    <span>독서 진행률</span>
                    <span>{Math.round(((isEditingReview ? editCurrentPages : (selectedBook.current_pages || 0)) / (isEditingReview ? editTotalPages : (selectedBook.total_pages || 300))) * 100) || 0}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, (((isEditingReview ? editCurrentPages : (selectedBook.current_pages || 0)) / (isEditingReview ? editTotalPages : (selectedBook.total_pages || 300))) * 100) || 0)}%` }}
                    ></div>
                  </div>
                  <span className="sub-text text-center block mt-1" style={{ fontSize: '0.8rem' }}>
                    {isEditingReview ? editCurrentPages : (selectedBook.current_pages || 0)} / {isEditingReview ? editTotalPages : (selectedBook.total_pages || 300)} 페이지
                  </span>
                </div>
              </div>

              <div className="detail-content">
                <h3>{selectedBook.title}</h3>
                <p className="detail-author">
                  {selectedBook.author} | {selectedBook.publisher || '출판사 정보'}
                  {selectedBook.pub_date ? (
                    <span className="ml-2 font-bold text-slate-600" style={{ marginLeft: '0.4rem', color: '#475569' }}>
                      · 📅 출간일: {selectedBook.pub_date}
                    </span>
                  ) : ''}
                </p>

                {!viewedFriend && (
                  <div className="mt-2 flex align-center gap-2 flex-wrap">
                    <button 
                      className="btn btn-sm btn-outline flex align-center gap-1"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px', color: '#0078a6', borderColor: '#cbd5e1' }}
                      onClick={() => handleSyncBookInfo(selectedBook)}
                      disabled={syncingGoogleInfo}
                      title="알라딘 API에서 실제 페이지 수 정보를 가져와 자동 동기화합니다."
                    >
                      <RefreshCw size={13} className={syncingGoogleInfo ? 'animate-spin' : ''} />
                      {syncingGoogleInfo ? '페이지 수 동기화 중...' : '📖 자동 페이지 수 동기화'}
                    </button>

                    <button 
                      className="btn btn-sm btn-outline flex align-center gap-1"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px', color: '#475569', borderColor: '#cbd5e1' }}
                      onClick={handleManualPageEdit}
                      title="전체 페이지 수를 직접 숫자로 입력하여 수정합니다."
                    >
                      ✏️ 페이지 수 수동 입력
                    </button>
                  </div>
                )}

                {/* 상태 선택 */}
                {!viewedFriend && (
                  <div className="status-selector mt-3">
                    <label className="sub-text">독서 상태 변경:</label>
                    <div className="btn-group mt-1">
                      <button
                        className={`btn btn-sm ${selectedBook.status === 'READING' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => { onUpdateStatus(selectedBook.id, 'READING'); setSelectedBook({ ...selectedBook, status: 'READING' }); }}
                      >
                        <Clock size={14} /> 읽는 중
                      </button>
                      <button
                        className={`btn btn-sm ${selectedBook.status === 'READ' ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => { onUpdateStatus(selectedBook.id, 'READ'); setSelectedBook({ ...selectedBook, status: 'READ' }); }}
                      >
                        <CheckCircle size={14} /> 완독함
                      </button>
                      <button
                        className={`btn btn-sm ${selectedBook.status === 'TO_READ' ? 'btn-warning' : 'btn-outline'}`}
                        onClick={() => { onUpdateStatus(selectedBook.id, 'TO_READ'); setSelectedBook({ ...selectedBook, status: 'TO_READ' }); }}
                      >
                        <Bookmark size={14} /> 읽고 싶음
                      </button>
                    </div>
                  </div>
                )}

                {/* 독서 리뷰 및 별점 섹션 */}
                <div className="review-section mt-4 p-3 border-card">
                  <div className="flex justify-between align-center">
                    <h4 className="flex align-center gap-1"><MessageSquare size={16} className="text-primary" /> 독서 평가 & 한줄평</h4>
                    {!isEditingReview && !viewedFriend && (
                      <button className="btn btn-sm btn-outline" onClick={() => setIsEditingReview(true)}>
                        <Edit3 size={14} /> {selectedBook.review ? '수정' : '작성'}
                      </button>
                    )}
                  </div>

                  {isEditingReview ? (
                    <div className="edit-review-box mt-2">
                      <div className="rating-select-row flex flex-col gap-1 mb-2">
                        <div className="flex align-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="sub-text font-bold" style={{ fontSize: '0.9rem' }}>별점 선택: <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>{editRating.toFixed(1)}점</strong></span>
                        </div>
                        {/* 0.5 단위 직관적인 별점 선택 칩 -> 대화형 반쪽/전체 클릭 별점으로 교체 */}
                        <div className="flex align-center gap-1 mt-1 justify-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div key={star} style={{ position: 'relative', width: '28px', height: '28px', cursor: 'pointer' }}>
                              {/* 반쪽 채우기 (왼쪽 50%) */}
                              <div 
                                style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', overflow: 'hidden', zIndex: 2 }}
                                onClick={() => setEditRating(star === 1 && editRating === 0.5 ? 0 : (star - 0.5))}
                                title={`${star - 0.5}점`}
                              >
                                <Star size={28} fill={editRating >= star - 0.5 ? "#f59e0b" : "none"} color={editRating > 0 && editRating >= star - 0.5 ? "#f59e0b" : "#cbd5e1"} strokeWidth={1.5} />
                              </div>
                              {/* 전체 채우기 */}
                              <div 
                                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 1 }}
                                onClick={() => setEditRating(star === editRating ? star - 0.5 : star)}
                                title={`${star}점`}
                              >
                                <Star size={28} fill={editRating >= star ? "#f59e0b" : "none"} color={editRating > 0 && editRating >= star - 0.5 ? "#f59e0b" : "#cbd5e1"} strokeWidth={1.5} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 mb-2" style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="flex-1" style={{ flex: 1 }}>
                          <label className="sub-text">현재 페이지</label>
                          <input
                            type="number"
                            value={editCurrentPages}
                            onChange={(e) => setEditCurrentPages(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex-1" style={{ flex: 1 }}>
                          <label className="sub-text">전체 페이지</label>
                          <input
                            type="number"
                            value={editTotalPages}
                            onChange={(e) => setEditTotalPages(parseInt(e.target.value) || 300)}
                          />
                        </div>
                      </div>

                      {/* 완독 일자 선택기 추가 (status가 READ이거나 완독 페이지 달성 시 표시) */}
                      {(selectedBook.status === 'READ' || editCurrentPages >= editTotalPages) && (
                        <div className="mb-2" style={{ marginTop: '0.5rem' }}>
                          <label className="sub-text font-bold" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🏆 완독 날짜 지정</label>
                          <input
                            type="date"
                            value={editCompletedAt}
                            onChange={(e) => setEditCompletedAt(e.target.value)}
                            max={new Date().toISOString().split('T')[0]} // 오늘 이후 날짜 지정 금지
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              outline: 'none'
                            }}
                          />
                        </div>
                      )}

                      <textarea
                        rows="3"
                        placeholder="이 책에 대한 한줄평 및 감상평을 기록하세요..."
                        value={editReview}
                        onChange={(e) => setEditReview(e.target.value)}
                      />

                      <div className="flex gap-2 mt-2">
                        <button className="btn btn-sm btn-primary" onClick={handleSaveReview}>
                          저장 완료
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setIsEditingReview(false)}>
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="saved-review-view mt-2">
                      <div className="flex align-center gap-1 mb-1" style={{ display: 'flex', alignItems: 'center' }}>
                        {renderStars(selectedBook.rating ?? 0)}
                        <span className="ms-2 font-bold" style={{ marginLeft: '0.5rem' }}>{parseFloat(selectedBook.rating ?? 0).toFixed(1)}</span>
                      </div>
                      {selectedBook.status === 'READ' && selectedBook.completed_at && (
                        <p className="sub-text font-bold mb-2" style={{ color: '#16a34a', fontSize: '0.8rem' }}>
                          🏆 완독 일자: {new Date(selectedBook.completed_at).toLocaleDateString()}
                        </p>
                      )}
                      <p className="review-text">{selectedBook.review || '아직 남긴 감상평이 없습니다. 수정 버튼을 눌러 적어보세요!'}</p>
                    </div>
                  )}
                </div>

                <div className="action-row mt-4 flex justify-between align-center">
                  {selectedBook.buy_link && (
                    <a
                      href={selectedBook.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-decoration-none"
                    >
                      <ExternalLink size={16} /> 구매 링크 연결
                    </a>
                  )}

                  {!viewedFriend && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        onDeleteBook(selectedBook.id);
                        setSelectedBook(null);
                      }}
                    >
                      <Trash2 size={16} /> 서재에서 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 수동 추가 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            <h3>새로운 책 서재에 등록</h3>

            <form onSubmit={handleManualSubmit} className="mt-3">
              <div className="form-group">
                <label>책 제목 *</label>
                <input
                  type="text"
                  placeholder="예: 클린 코드"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>저자 *</label>
                <input
                  type="text"
                  placeholder="예: 로버트 C. 마틴"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>전체 페이지 수</label>
                <input
                  type="number"
                  placeholder="예: 350"
                  value={newTotalPages}
                  onChange={(e) => setNewTotalPages(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>표지 이미지 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>독서 상태</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="TO_READ">읽고 싶은 책</option>
                  <option value="READING">읽는 중인 책</option>
                  <option value="READ">완독한 책</option>
                </select>
              </div>

              <div className="form-group">
                <label>구매 링크 (선택)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newBuyLink}
                  onChange={(e) => setNewBuyLink(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-3">
                서재에 꽂기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getSpineStyle(coverUrl, id) {
  if (!coverUrl) {
    return {
      bg: '#1e293b',
      titleColor: '#fef08a',
      authorColor: '#fde047',
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)'
    };
  }
  const source = coverUrl + (id || '');
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 40 + (Math.abs(hash >> 2) % 25); // 40% ~ 65%
  const lightness = 18 + (Math.abs(hash >> 4) % 20);   // 18% ~ 38%
  
  const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  let titleColor = '#ffffff';
  let authorColor = 'rgba(255, 255, 255, 0.85)';
  let textShadow = '0 1px 3px rgba(0, 0, 0, 0.8)';

  if (lightness < 25) {
    titleColor = '#fef08a';
    authorColor = '#fde047';
    textShadow = `0 1px 3px rgba(0,0,0,0.9), 0 0 4px hsl(${hue}, 80%, 70%)`;
  } else if (lightness >= 25 && lightness < 33) {
    titleColor = '#f8fafc';
    authorColor = '#e2e8f0';
    textShadow = '0 1px 3px rgba(0, 0, 0, 0.85)';
  } else {
    titleColor = '#0f172a';
    authorColor = '#334155';
    textShadow = '0 1px 2px rgba(255, 255, 255, 0.6)';
  }

  return { bg, titleColor, authorColor, textShadow };
}
