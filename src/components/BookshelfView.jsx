import React, { useState, useEffect } from 'react';
import { BookOpen, Star, ExternalLink, PlusCircle, Plus, CheckCircle, Clock, Bookmark, Trash2, Edit3, Grid, Layers, MessageSquare, RefreshCw, X, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import BookDetailModal from './BookDetailModal';
import ThoughtLedger from './ThoughtLedger';
import ShelfGuestbookModal, { POSTIT_COLORS } from './ShelfGuestbookModal';

export default function BookshelfView({ 
  books, 
  notes = [],
  onAddNote,
  onDeleteNote,
  onUpdateStatus, 
  onDeleteBook, 
  onAddManualBook, 
  onUpdateBookDetails, 
  onReorderBooks = null,
  viewedFriend = null, 
  onBackToMyBookshelf,
  userId = null
}) {
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'grid'
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThoughtLedgerModal, setShowThoughtLedgerModal] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // 이웃 서재 3D 포스트잇 방명록 상태 관리
  const ownerKey = viewedFriend ? (viewedFriend.id || viewedFriend.email) : (userId || 'my_shelf');
  const guestbookStorageKey = `shelf_guestbook_${ownerKey}`;

  const [guestbookNotes, setGuestbookNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(guestbookStorageKey);
      return saved ? JSON.parse(saved) : [
        {
          id: 'sample_gb_1',
          authorName: '달빛 독서가 🌙',
          content: '서재 분위기가 너무 아늑하네요! 추천 책 잘 구경하고 갑니다 📚✨',
          color: 'yellow',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          rotDeg: -3
        },
        {
          id: 'sample_gb_2',
          authorName: '클래식 본문 📜',
          content: '3D 원목 서재 감성 최고네요! 자주 놀러올게요 😊',
          color: 'pink',
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          rotDeg: 2
        }
      ];
    } catch (e) {
      return [];
    }
  });

  const [showGuestbookModal, setShowGuestbookModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(guestbookStorageKey);
      if (saved) setGuestbookNotes(JSON.parse(saved));
    } catch (e) {}
  }, [guestbookStorageKey]);

  const handleAddGuestbookNote = (newNote) => {
    setGuestbookNotes((prev) => {
      const updated = [newNote, ...prev];
      try {
        localStorage.setItem(guestbookStorageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleDeleteGuestbookNote = (noteId) => {
    setGuestbookNotes((prev) => {
      const updated = prev.filter(n => n.id !== noteId);
      try {
        localStorage.setItem(guestbookStorageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // 3D 책장 드래그 앤 드롭 순서 재배치 상태
  const [draggedBookId, setDraggedBookId] = useState(null);
  const [dragOverBookId, setDragOverBookId] = useState(null);

  const handleDragStart = (e, book) => {
    e.dataTransfer.setData('text/plain', String(book.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBookId(book.id);
  };

  const handleDragOver = (e, book) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBookId !== book.id) {
      setDragOverBookId(book.id);
    }
  };

  const handleDragLeave = (e, book) => {
    if (dragOverBookId === book.id) {
      setDragOverBookId(null);
    }
  };

  const handleDrop = (e, targetBook) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBookId(null);

    if (!draggedBookId || draggedBookId === targetBook.id) return;

    const currentBooks = [...books];
    const sourceIdx = currentBooks.findIndex((b) => String(b.id) === String(draggedBookId));
    const targetIdx = currentBooks.findIndex((b) => String(b.id) === String(targetBook.id));

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [movedBook] = currentBooks.splice(sourceIdx, 1);
      currentBooks.splice(targetIdx, 0, movedBook);

      if (onReorderBooks) {
        onReorderBooks(currentBooks);
      }
    }
    setDraggedBookId(null);
  };

  const handleDragEnd = () => {
    setDraggedBookId(null);
    setDragOverBookId(null);
  };

  // 유저별 책장 테마 상태 (classic, dark, sepia, forest)
  const [shelfTheme, setShelfTheme] = useState(() => {
    const key = `user_shelf_theme_${userId || 'demo'}`;
    return localStorage.getItem(key) || 'classic';
  });

  // 유저 변경 시 해당 유저의 서재 테마 불러오기
  React.useEffect(() => {
    const key = `user_shelf_theme_${userId || 'demo'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setShelfTheme(saved);
    }
  }, [userId]);

  const handleShelfThemeChange = (newTheme) => {
    setShelfTheme(newTheme);
    const key = `user_shelf_theme_${userId || 'demo'}`;
    localStorage.setItem(key, newTheme);
  };

  const [coverColors, setCoverColors] = useState(() => {
    try {
      const cached = localStorage.getItem('library_book_cover_colors');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  });
  const [syncingGoogleInfo, setSyncingGoogleInfo] = useState(false);

  // 책 상세 모달 내 도서 소개 연동 상태
  const [bookDescription, setBookDescription] = useState('');
  const [bookToc, setBookToc] = useState('');
  const [showDescModal, setShowDescModal] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(false);

  // 저자 및 옮긴이(역자) 분리 파싱 헬퍼 함수
  const parseAuthorAndTranslator = (authorStr = '') => {
    if (!authorStr) return { author: '저자 미상', translator: null };

    const parts = authorStr.split(',');
    let authorList = [];
    let translatorList = [];

    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.includes('(옮긴이)') || trimmed.includes('(역자)')) {
        translatorList.push(trimmed.replace(/\((옮긴이|역자)\)/g, '').trim());
      } else if (trimmed.includes('(지은이)') || trimmed.includes('(저자)') || trimmed.includes('(글)')) {
        authorList.push(trimmed.replace(/\((지은이|저자|글)\)/g, '').trim());
      } else {
        authorList.push(trimmed);
      }
    });

    return {
      author: authorList.join(', ') || authorStr,
      translator: translatorList.length > 0 ? translatorList.join(', ') : null
    };
  };

  // 모달 팝업 오픈 시 배경 스크롤을 100% 잠그고, 닫히면 원래대로 복구
  React.useEffect(() => {
    if (selectedBook || showDescModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setBookDescription('');
      setBookToc('');
      setShowDescModal(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedBook, showDescModal]);

  // 알라딘 API 프록시 & ItemLookUp을 활용한 도서 상세 전문 및 목차 수집 함수
  const handleFetchBookDescription = async (book) => {
    if (!book) return;

    // 즉시 기존 도서 소개글이 존재하면 먼저 보여주고, 로딩바는 소개글이 없을 때만 표시
    setBookDescription(book.description || '');
    setLoadingDesc(!book.description);
    setShowDescModal(true);

    try {
      const rawIsbn = (book.isbn || '').trim().replace(/-/g, '');
      const cleanIsbn = rawIsbn.replace(/^K/i, '');
      let fetchedDesc = null;
      let fetchedToc = null;

      // 1단계: ISBN 또는 ItemId가 존재할 때 알라딘 ItemLookUp API 직접 호출 (전문 소개글 & 목차 획득)
      if (cleanIsbn) {
        const idType = rawIsbn.startsWith('K') || cleanIsbn.length < 10 ? 'ItemId' : cleanIsbn.length === 10 ? 'ISBN' : 'ISBN13';
        const lookUpUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=ttbcdw2341334001&itemIdType=${idType}&ItemId=${cleanIsbn}&Cover=Big&Version=20131101&output=js&OptResult=description,fulldescription,toc,story,authors`;
        
        let data = await fetchAladinJsonp(lookUpUrl);
        if (!data || !data.item) {
          data = await fetchJsonWithProxyFallback(lookUpUrl);
        }

        if (data && data.item && data.item.length > 0) {
          const item = data.item[0];
          fetchedDesc = item.fullDescription || item.fulldescription || item.subInfo?.fullDescription || item.description || item.story || item.subInfo?.story;
          fetchedToc = item.toc || item.subInfo?.toc;
        }
      }

      // 2단계: ItemLookUp으로 부족하거나 없을 때 제목 기반 검색 프록시 수행
      let targetItemId = cleanIsbn;
      if (!fetchedDesc && book.title) {
        const cleanTitle = (book.title || '')
          .split('-')[0]
          .split('(')[0]
          .replace(/[^\w\s가-힣]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        let response;
        try {
          response = await supabase.rpc('aladin_search_proxy', {
            search_query: cleanTitle,
            start_page: 1,
            sort_option: 'Accuracy'
          });
        } catch (err) {
          console.warn('aladin_search_proxy 호출 오류, HTTP 프록시 폴백:', err);
        }

        if (!response || !response.data || !response.data.item) {
          const searchUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=ttbcdw2341334001&Query=${encodeURIComponent(cleanTitle)}&QueryType=Title&MaxResults=1&SearchTarget=Book&output=js&Version=20131101&OptResult=description,fulldescription,toc,story`;
          const sData = await fetchJsonWithProxyFallback(searchUrl);
          if (sData && sData.item && sData.item.length > 0) {
            response = { data: sData };
          }
        }

        if (response && response.data && response.data.item && response.data.item.length > 0) {
          const item = response.data.item.find(i => i.title && i.title.includes(cleanTitle.slice(0, 4))) || response.data.item[0];
          fetchedDesc = item.fullDescription || item.fulldescription || item.subInfo?.fullDescription || item.description || item.story;
          fetchedToc = item.toc || item.subInfo?.toc;
          targetItemId = item.itemId || item.isbn13 || targetItemId;
        }
      }

      // 2.5단계: 웹 상품 페이지에서 풍부한 전체 줄거리/소개글(편집장의 선택/출판사 서평 등) 보완 추출
      if (targetItemId) {
        try {
          const webUrl = `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${targetItemId}`;
          const webHtml = await fetchJsonWithProxyFallback(webUrl);
          if (typeof webHtml === 'string' && webHtml.length > 1000) {
            const extraBlocks = [];
            const regexR = /<div[^>]*class="[^"]*Ere_prod_mconts_R[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            let matchR;
            while ((matchR = regexR.exec(webHtml)) !== null) {
              let text = matchR[1]
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?[^>]+(>|$)/g, '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&quot;/gi, '"')
                .replace(/&gt;/gi, '>')
                .replace(/&lt;/gi, '<')
                .replace(/&amp;/gi, '&')
                .trim();

              text = text.split('$j(')[0].split('var swiper')[0].trim();

              if (text.length > 50 && !text.startsWith('- 알라딘')) {
                extraBlocks.push(text);
              }
            }

            if (extraBlocks.length > 0) {
              const fullWebText = extraBlocks.join('\n\n');
              if (fullWebText.length > (fetchedDesc || '').length) {
                fetchedDesc = fullWebText;
              }
            }
          }
        } catch (webErr) {
          console.warn('알라딘 웹 전체 소개글 추출 실패:', webErr);
        }
      }

      // 3단계: 도서 소개 전문 및 목차 통합 정제
      let fullText = (fetchedDesc || book.description || '알라딘에 등록된 상세 소개글이 없습니다.')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .trim();

      if (fetchedToc) {
        const cleanToc = String(fetchedToc)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, '')
          .trim();
        setBookToc(cleanToc);
      } else {
        setBookToc('');
      }

      setBookDescription(fullText);
    } catch (e) {
      console.warn('도서 상세 소개 조회 실패:', e);
      setBookDescription(book.description || '도서 상세 소개 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingDesc(false);
    }
  };

  // 헬퍼: 브라우저 네이티브 JSONP 스크립트 주입 (CORS 프록시 100% 우회)
  const fetchAladinJsonp = (baseUrl) => {
    return new Promise((resolve) => {
      const callbackName = 'aladin_cb_' + Math.random().toString(36).substring(2, 9);
      const script = document.createElement('script');
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 4000);

      const cleanup = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      const hasQuery = baseUrl.includes('?');
      script.src = `${baseUrl}${hasQuery ? '&' : '?'}callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        resolve(null);
      };

      document.body.appendChild(script);
    });
  };

  // 헬퍼: 3중 CORS 프록시 회선 (JSONP 실패 시 폴백)
  const fetchJsonWithProxyFallback = async (targetUrl) => {
    const proxyList = [
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${targetUrl}`
    ];

    for (const proxyUrl of proxyList) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          let text = '';
          if (proxyUrl.includes('allorigins.win/get')) {
            const wrapper = await res.json();
            text = wrapper.contents || '';
          } else {
            text = await res.text();
          }

          const cleanText = text.trim().replace(/^window\.[^(]+\(|\);?$/g, '').replace(/;$/, '');
          if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
            try {
              return JSON.parse(cleanText);
            } catch (e) {}
          }
          if (cleanText.length > 0) {
            return cleanText;
          }
        }
      } catch (e) {
        console.warn(`프록시 (${proxyUrl}) 통신 실패:`, e);
      }
    }

    return null;
  };

  // 알라딘 ItemLookUp 조회를 통한 페이지 수 및 상세 정보 파싱 (Supabase RPC 1순위 -> JSONP/프록시 2순위)
  const fetchPageCountFromAladin = async (itemId, idType = 'ItemId') => {
    const cleanId = String(itemId || '').replace(/^K/i, '').trim();
    if (!cleanId) return null;

    // 1차: Supabase Database RPC (aladin_lookup_proxy) 서버사이드 직접 호출 (Mixed Content/CORS 100% 방지)
    try {
      const { data, error } = await supabase.rpc('aladin_lookup_proxy', {
        item_id: cleanId,
        id_type: idType
      });
      if (!error && data && data.item && data.item.length > 0) {
        const item = data.item[0];
        const p = item.subInfo?.itemPage || item.itemPage || null;
        if (p) return { pages: parseInt(p), pubDate: item.pubDate || null, item };
      }
    } catch (rpcErr) {
      console.warn('aladin_lookup_proxy RPC 시도 실패:', rpcErr);
    }

    // 2차: 브라우저 JSONP 및 CORS 프록시 폴백
    const ttbKey = 'ttbcdw2341334001';
    const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${ttbKey}&itemIdType=${idType}&ItemId=${cleanId}&Cover=Big&Version=20131101&output=js&OptResult=itemPage,description,fulldescription,toc`;
    
    let data = await fetchAladinJsonp(aladinUrl);
    if (!data || data.errorCode) {
      data = await fetchJsonWithProxyFallback(aladinUrl);
    }

    if (data && data.item && data.item.length > 0) {
      const item = data.item[0];
      const p = item.subInfo?.itemPage || item.itemPage || null;
      if (p) return { pages: parseInt(p), pubDate: item.pubDate || null, item };
    }

    // 3차: 알라딘 웹 상품 페이지 직접 스크레이핑 (412쪽 등의 실제 물리 페이지 수 100% 감지 보장)
    try {
      const webUrl = `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${cleanId}`;
      const webHtml = await fetchJsonWithProxyFallback(webUrl);
      if (typeof webHtml === 'string' && webHtml.length > 1000) {
        const pageMatch = webHtml.match(/(\d{2,4})\s*쪽/i);
        if (pageMatch && parseInt(pageMatch[1]) > 0) {
          return { pages: parseInt(pageMatch[1]), pubDate: null, item: null };
        }
      }
    } catch (webErr) {
      console.warn('알라딘 웹 페이지 스크레이핑 폴백 실패:', webErr);
    }

    return null;
  };

  // 1차: Google Books API (무료 공공 API, Quota 제한 고려)
  const fetchGooglePageCount = async (isbn) => {
    const cleanIsbn = String(isbn || '').replace(/^K/i, '').trim();
    if (!cleanIsbn) return null;
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
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
    const cleanIsbn = String(isbn || '').replace(/^K/i, '').trim();
    if (!cleanIsbn) return null;
    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
      if (res.ok) {
        const data = await res.json();
        const bookData = data[`ISBN:${cleanIsbn}`];
        if (bookData && bookData.number_of_pages) {
          return parseInt(bookData.number_of_pages);
        }
      }
    } catch (e) {
      console.warn('Open Library API 페이지 조회 실패:', e);
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

  // 1. URL로부터 표지의 가장 주류인 메인 대표 색상을 정확히 추출하는 헬퍼 함수 (평균 색상 섞기 제거)
  const extractMainColor = (bookId, coverUrl) => {
    if (!coverUrl || coverColors[bookId]) return;

    // CORS 우회 이미지 프록시 (weserv.nl)
    const cleanUrl = coverUrl.replace(/^https?:\/\//, '');
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=40&h=40`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = proxyUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 12;
        canvas.height = 12;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 12, 12);
        
        const imgData = ctx.getImageData(0, 0, 12, 12).data;
        const colorBuckets = {};

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];

          // 채도 계산 (가장 선명하고 주류인 메인 색상 가중치 부여)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max - min;

          // 지나치게 밝은 단색 무채색(흰색)이나 극단적 무채색은 우충충함 방지를 위해 채도 높은 색상 우선
          const satWeight = sat > 25 ? (1 + sat / 40) : 0.6;

          // 24단계 색상 버킷 양자화
          const qR = Math.round(r / 24) * 24;
          const qG = Math.round(g / 24) * 24;
          const qB = Math.round(b / 24) * 24;
          const key = `${qR},${qG},${qB}`;

          if (!colorBuckets[key]) {
            colorBuckets[key] = { r: qR, g: qG, b: qB, score: 0 };
          }
          colorBuckets[key].score += satWeight;
        }

        // 가장 점수가 높은 주류 메인 색상 1개 선정
        let dominant = null;
        let maxScore = -1;
        Object.values(colorBuckets).forEach(bucket => {
          if (bucket.score > maxScore) {
            maxScore = bucket.score;
            dominant = bucket;
          }
        });

        if (!dominant) {
          dominant = { r: 180, g: 30, b: 30 }; // 기본 강렬한 크림슨 레드
        }

        const { r, g, b } = dominant;
        const luminance = (r * 299 + g * 587 + b * 114) / 1000;
        const isDark = luminance < 140;

        // 선명한 단일 메인 색상 기반 단색 단일 톤 그라데이션 (탁한 색 섞기 완전 차단)
        const darkR = Math.max(0, Math.round(r * 0.78));
        const darkG = Math.max(0, Math.round(g * 0.78));
        const darkB = Math.max(0, Math.round(b * 0.78));

        const bg = `linear-gradient(180deg, rgb(${r},${g},${b}) 0%, rgb(${darkR},${darkG},${darkB}) 100%)`;
        const titleColor = isDark ? '#ffffff' : '#0f172a';
        const authorColor = isDark ? '#fde047' : '#1e293b';
        const textShadow = isDark ? '0px 1px 3px rgba(0,0,0,0.95)' : '0px 1px 2px rgba(255,255,255,0.85)';

        setCoverColors(prev => {
          const updated = {
            ...prev,
            [bookId]: { bg, titleColor, authorColor, textShadow }
          };
          try {
            localStorage.setItem('library_book_cover_colors', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      } catch (err) {
        console.warn("표지 대표색 획득 실패:", err);
      }
    };
  };

  // [다중 API 연동 체인] Supabase RPC 알라딘 연동 -> 알라딘 JSONP -> Google Books -> Open Library
  const handleSyncBookInfo = async (book) => {
    if (!book || syncingGoogleInfo) return;
    setSyncingGoogleInfo(true);
    
    try {
      let fetchedPages = null;
      let fetchedPubDate = null;
      let source = '';
      const rawIsbn = (book.isbn || '').trim().replace(/-/g, '');
      const cleanIsbn = rawIsbn.replace(/^K/i, '');
      const ttbKey = 'ttbcdw2341334001';

      // [1단계] 알라딘 API (ISBN 또는 ItemId 직접 조회) - ItemId, ISBN13, ISBN 순차 시도
      if (rawIsbn) {
        const idTypesToTry = rawIsbn.startsWith('K')
          ? ['ItemId', 'ISBN13', 'ISBN']
          : rawIsbn.length === 10
          ? ['ISBN', 'ItemId', 'ISBN13']
          : ['ISBN13', 'ItemId', 'ISBN'];

        for (const type of idTypesToTry) {
          const res = await fetchPageCountFromAladin(cleanIsbn, type);
          if (res && res.pages) {
            fetchedPages = res.pages;
            fetchedPubDate = res.pubDate;
            source = `알라딘 API (${type})`;
            break;
          }
        }
      }

      // [2단계] Supabase Database RPC (aladin_search_proxy) 활용 - 서버사이드 100% 성공 보장
      if (!fetchedPages && book.title) {
        try {
          const cleanTitle = (book.title || '')
            .split('-')[0]
            .split('(')[0]
            .replace(/[^\w\s가-힣]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          let foundItemId = null;

          // 2-1: Supabase RPC 우선 시도 (CORS 및 프록시 에러 100% 우회)
          try {
            const { data, error } = await supabase.rpc('aladin_search_proxy', { search_query: cleanTitle });
            if (!error && data && data.item && data.item.length > 0) {
              const firstItem = data.item[0];
              const p = firstItem.subInfo?.itemPage || firstItem.itemPage;
              if (p && parseInt(p) > 0) {
                fetchedPages = parseInt(p);
                fetchedPubDate = firstItem.pubDate || book.pub_date;
                source = '알라딘 도서 검색 (aladin_search_proxy)';
              } else {
                foundItemId = firstItem.itemId || firstItem.isbn13 || firstItem.isbn;
              }
            }
          } catch (rpcErr) {
            console.warn('Supabase RPC 알라딘 검색 실패, HTTP 프록시 폴백:', rpcErr);
          }

          // 2-2: HTTP 프록시 폴백 또는 ItemLookUp 추적
          if (!fetchedPages && foundItemId) {
            const res2 = await fetchPageCountFromAladin(foundItemId, 'ItemId');
            if (res2 && res2.pages) {
              fetchedPages = res2.pages;
              fetchedPubDate = res2.pubDate;
              source = '알라딘 도서 추적 (ItemLookUp)';
            }
          }

          if (!fetchedPages && !foundItemId) {
            const searchUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ttbKey}&Query=${encodeURIComponent(cleanTitle)}&QueryType=Title&MaxResults=1&SearchTarget=Book&output=js&Version=20131101&OptResult=itemPage`;
            const sData = await fetchJsonWithProxyFallback(searchUrl);
            if (sData && sData.item && sData.item.length > 0) {
              const item = sData.item[0];
              const p = item.subInfo?.itemPage || item.itemPage;
              if (p && parseInt(p) > 0) {
                fetchedPages = parseInt(p);
                fetchedPubDate = item.pubDate || book.pub_date;
                source = '알라딘 도서 프록시 (ItemSearch)';
              }
            }
          }
        } catch (titleErr) {
          console.warn('제목 검색 2단계 동기화 실패:', titleErr);
        }
      }

      // [3단계] Google Books API 시도
      if (!fetchedPages && rawIsbn) {
        const googlePages = await fetchGooglePageCount(rawIsbn);
        if (googlePages) {
          fetchedPages = googlePages;
          source = 'Google Books API';
        }
      }

      // [4단계] Open Library API 시도
      if (!fetchedPages && rawIsbn) {
        const openLibPages = await fetchOpenLibraryPageCount(rawIsbn);
        if (openLibPages) {
          fetchedPages = openLibPages;
          source = 'Open Library API';
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
        alert('⚠️ 해당 도서의 실제 페이지 수 정보를 찾지 못했습니다.\n도서 정보가 미등록되었거나 일시적 프록시 지연일 수 있습니다. 옆의 [✏️ 수동 입력] 버튼으로도 수정하실 수 있습니다.');
      }
    } catch (err) {
      console.error('도서 정보 동기화 중 오류 발생:', err);
      alert('❌ 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSyncingGoogleInfo(false);
    }
  };



  // 2. 저자 포맷터 (최대 14자 보장으로 '히가시노 게이고' 등 저자 풀네임 완전 노출)
  const formatAuthor = (author) => {
    if (!author) return '';
    const clean = author.split('(')[0].split('지음')[0].split('옮김')[0].split('저')[0].trim();
    if (clean.length > 14) {
      return clean.substring(0, 14) + '..';
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
      const safeRating = parseFloat(selectedBook.rating);
      setEditRating(isNaN(safeRating) ? 0 : Math.min(5, Math.max(0, safeRating)));
      setEditReview(typeof selectedBook.review === 'string' ? selectedBook.review : '');
      setEditTotalPages(parseInt(selectedBook.total_pages) || 300);
      setEditCurrentPages(parseInt(selectedBook.current_pages) || 0);

      const todayISO = new Date().toISOString().split('T')[0];
      if (selectedBook.completed_at && typeof selectedBook.completed_at === 'string') {
        setEditCompletedAt(selectedBook.completed_at.split('T')[0] || todayISO);
      } else if (selectedBook.completed_at) {
        try {
          const parsed = new Date(selectedBook.completed_at);
          if (!isNaN(parsed.getTime())) {
            setEditCompletedAt(parsed.toISOString().split('T')[0]);
          } else {
            setEditCompletedAt(todayISO);
          }
        } catch {
          setEditCompletedAt(todayISO);
        }
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
              <Star size={15} color="#cbd5e1" style={{ position: 'absolute' }} />
              <span style={{ width: '7.5px', overflow: 'hidden', position: 'absolute', display: 'inline-block' }}>
                <Star size={15} fill="#f59e0b" color="#f59e0b" />
              </span>
            </span>
          );
        } else {
          stars.push(<Star key={i} size={15} fill="none" color="#cbd5e1" style={{ display: 'inline' }} />);
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
            <span>현재 <strong>{viewedFriend.name ? `${viewedFriend.name} (${viewedFriend.email})` : viewedFriend.email}</strong> 님의 서재를 둘러보고 있습니다. (읽기 전용 모드)</span>
          </div>
          <button className="btn btn-primary btn-sm px-3 py-1" onClick={onBackToMyBookshelf} style={{ fontSize: '0.8rem' }}>
            내 서재로 돌아가기
          </button>
        </div>
      )}

      {/* 헤더 컨트롤 */}
      <div className="bookshelf-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{viewedFriend ? `${viewedFriend.email.split('@')[0]} 님의 3D 비주얼 서재` : '나만의 3D 비주얼 서재'}</h2>
          <p className="sub-text" style={{ margin: '0.25rem 0 0 0' }}>
            {viewedFriend 
              ? '친구의 책장에 꽂힌 양장본 도서들을 마우스 포인터로 움직여 관찰하고 클릭해 독평을 읽어보세요.'
              : '원목 책장에 꽂힌 책을 클릭하여 상태 변경, 별점 및 독서 리뷰를 남기세요.'}
          </p>
        </div>

        {/* 우측 정렬 툴바 제어 수평 행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* 1. 3D / 그리드 뷰 토글 모듈 */}
          <div className="toggle-group" style={{ height: '38px', display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' }}>
            <button
              className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
              style={{ whiteSpace: 'nowrap', height: '100%', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.75rem', fontSize: '0.825rem' }}
            >
              <Layers size={15} /> 3D 클래식 서재
            </button>
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              style={{ whiteSpace: 'nowrap', height: '100%', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.75rem', fontSize: '0.825rem' }}
            >
              <Grid size={15} /> 그리드 뷰
            </button>
          </div>

          {/* 2. 책장 테마 셀렉트 드롭다운 */}
          {viewMode === '3d' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
              <select
                value={shelfTheme}
                onChange={(e) => handleShelfThemeChange(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 0.75rem',
                  fontSize: '0.825rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              >
                <optgroup label="✨ 캐릭터 테마">
                  <option value="pochacco">🐾 포장마차 파스텔 블루</option>
                  <option value="kitty">🎀 안녕고양이 러블리 핑크</option>
                </optgroup>
                <optgroup label="☀️ 밝고 산뜻한 파스텔 테마">
                  <option value="maple">🥛 화이트 메이플</option>
                  <option value="blossom">🌸 체리블라썸 핑크</option>
                  <option value="vanilla">🍦 바닐라 샌드</option>
                  <option value="sky">🧊 파스텔 스카이</option>
                  <option value="mint">🌱 마일드 민트</option>
                </optgroup>
                <optgroup label="🪵 클래식 & 내추럴 원목">
                  <option value="classic">🪵 클래식 원목</option>
                  <option value="sepia">📜 빈티지 세피아</option>
                  <option value="cherry">🏺 고대 체리목</option>
                </optgroup>
                <optgroup label="🌙 딥 & 무드 분위기">
                  <option value="dark">🌙 미드나잇 다크</option>
                  <option value="rose">🎨 모던 로즈골드</option>
                  <option value="forest">🍃 세이지 그리너리</option>
                  <option value="ocean">🌊 마린 브리즈</option>
                  <option value="violet">💜 로얄 바이올렛</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* 3. 이웃 방명록 & 독서 기록장 & 수동 책 추가 액션 버튼 */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', whiteSpace: 'nowrap' }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowGuestbookModal(true)}
              style={{
                height: '38px',
                padding: '0 0.9rem',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#d97706',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                fontWeight: 700,
                fontSize: '0.825rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderRadius: '8px',
                boxSizing: 'border-box'
              }}
            >
              <Sparkles size={15} /> {viewedFriend ? '📌 이웃 방명록 남기기' : `💌 내 방명록 (${guestbookNotes.length})`}
            </button>

            {!viewedFriend && (
              <>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowThoughtLedgerModal(true)}
                  style={{
                    height: '38px',
                    padding: '0 0.9rem',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7',
                    borderColor: 'rgba(2, 132, 199, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '8px',
                    boxSizing: 'border-box'
                  }}
                >
                  <MessageSquare size={15} /> 📝 독서 기록장 (문장 & 생각)
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    height: '38px',
                    padding: '0 0.9rem',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '8px',
                    boxSizing: 'border-box'
                  }}
                >
                  <PlusCircle size={15} /> 수동 책 추가
                </button>
              </>
            )}
          </div>
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
                <div key={`${cat.key}-shelf-${chunkIdx}`} className={`wood-shelf shelf-theme-${shelfTheme}`} style={{ marginBottom: '2rem', position: 'relative' }}>
                  {/* 3D 원목 선반 위 3D 손글씨 포스트잇 방명록 연출 */}
                  {chunkIdx === 0 && guestbookNotes.length > 0 && (
                    <div style={{ position: 'absolute', top: '-38px', right: '140px', display: 'flex', gap: '12px', zIndex: 14, pointerEvents: 'auto' }}>
                      {guestbookNotes.slice(0, 3).map((note, noteIdx) => {
                        const colorObj = POSTIT_COLORS.find(c => c.id === note.color) || POSTIT_COLORS[0];
                        return (
                          <div
                            key={note.id}
                            onClick={() => setShowGuestbookModal(true)}
                            title={`${note.authorName}: ${note.content}`}
                            style={{
                              backgroundColor: colorObj.bg,
                              color: colorObj.text,
                              border: `1.5px solid ${colorObj.border}`,
                              borderRadius: '7px',
                              padding: '0.3rem 0.55rem',
                              width: '105px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              boxShadow: `2px 4px 10px ${colorObj.shadow}`,
                              transform: `rotate(${note.rotDeg || (noteIdx % 2 === 0 ? -3 : 3)}deg)`,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              userSelect: 'none',
                              lineHeight: '1.3'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = `rotate(0deg) scale(1.12)`;
                              e.currentTarget.style.zIndex = '20';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = `rotate(${note.rotDeg || (noteIdx % 2 === 0 ? -3 : 3)}deg) scale(1)`;
                              e.currentTarget.style.zIndex = '14';
                            }}
                          >
                            {/* 포스트잇 테이프 연출 */}
                            <div style={{
                              position: 'absolute', top: '-5px', left: '50%', transform: 'translateX(-50%)',
                              width: '30px', height: '9px', backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)'
                            }} />
                            <div style={{ fontSize: '0.68rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              📌 {note.authorName}
                            </div>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                              {note.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 포차코 & 헬로키티 캐릭터 전용 귀여운 3D 데코 스티커 */}
                  {shelfTheme === 'pochacco' && (
                    <div className="pochacco-decor" style={{ position: 'absolute', top: '-24px', right: '18px', zIndex: 12, background: 'rgba(255,255,255,0.95)', padding: '4px 10px', borderRadius: '16px', border: '2px solid #5ba8b7', boxShadow: '0 6px 14px rgba(0,0,0,0.12)', fontWeight: 800, fontSize: '0.82rem', color: '#2c6e7a', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                      <img src="/assets/pochacco_sticker.png" alt="Pojangmacha" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '50%' }} />
                      <span>POJANGMACHA 🐾</span>
                    </div>
                  )}
                  {shelfTheme === 'kitty' && (
                    <div className="kitty-decor" style={{ position: 'absolute', top: '-24px', right: '18px', zIndex: 12, background: 'rgba(255,255,255,0.95)', padding: '4px 10px', borderRadius: '16px', border: '2px solid #f472b6', boxShadow: '0 6px 14px rgba(0,0,0,0.12)', fontWeight: 800, fontSize: '0.82rem', color: '#be123c', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                      <img src="/assets/hello_kitty_sticker.png" alt="Annyeong Kitty" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '50%' }} />
                      <span>ANNYEONG KITTY 🎀</span>
                    </div>
                  )}

                  <div className="shelf-surface" style={{ position: 'relative', overflow: 'hidden' }}>
                    {/* 책장 안쪽 벽면 포차코 & 헬로키티 은은한 워터마크 캐릭터 배경 벽지 */}
                    {shelfTheme === 'pochacco' && (
                      <div
                        className="shelf-wall-character pochacco-wall"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -55%)',
                          width: '180px',
                          height: '180px',
                          backgroundImage: 'url(/assets/pochacco_sticker.png)',
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          opacity: 0.28,
                          pointerEvents: 'none',
                          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.15))',
                          zIndex: 1
                        }}
                      />
                    )}
                    {shelfTheme === 'kitty' && (
                      <div
                        className="shelf-wall-character kitty-wall"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -55%)',
                          width: '180px',
                          height: '180px',
                          backgroundImage: 'url(/assets/hello_kitty_sticker.png)',
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          opacity: 0.28,
                          pointerEvents: 'none',
                          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.15))',
                          zIndex: 1
                        }}
                      />
                    )}
                    {shelfBooks.length === 0 ? (
                      <div className="empty-shelf-text">이 책장은 비어 있습니다. 탐색 탭에서 책을 찾아 꽂아보세요!</div>
                    ) : (
                      <div className="spine-row">
                        {shelfBooks.map((book) => {
                          const spineHeight = Math.min(190, Math.max(145, 135 + ((book.total_pages || 300) / 10)));
                          const spineWidth = Math.min(64, Math.max(44, 38 + ((book.total_pages || 300) / 18)));

                          const bookIdStr = String(book.id || 'abc');
                          const charSum = bookIdStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                          const isLeaning = charSum % 4 === 0;
                          const tiltAngle = isLeaning ? (charSum % 2 === 0 ? 5 : -5) : 0;

                          const spineStyle = getSpineStyle(book.cover_url, bookIdStr);
                          if (book.cover_url && !coverColors[bookIdStr]) {
                            extractMainColor(bookIdStr, book.cover_url);
                          }
                          
                          const extracted = coverColors[bookIdStr];
                          const finalBg = (extracted && extracted.bg) ? extracted.bg : (typeof extracted === 'string' ? extracted : spineStyle.bg);
                          const titleColor = (extracted && extracted.titleColor) ? extracted.titleColor : spineStyle.titleColor;
                          const authorColor = (extracted && extracted.authorColor) ? extracted.authorColor : spineStyle.authorColor;
                          const textShadow = (extracted && extracted.textShadow) ? extracted.textShadow : spineStyle.textShadow;

                          return (
                            <div
                              key={book.id}
                              className={`book-3d-container ${draggedBookId === book.id ? 'is-dragging' : ''} ${dragOverBookId === book.id ? 'drag-over-target' : ''}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, book)}
                              onDragOver={(e) => handleDragOver(e, book)}
                              onDragLeave={(e) => handleDragLeave(e, book)}
                              onDrop={(e) => handleDrop(e, book)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleOpenDetail(book)}
                              title={`${book.title} - ${book.author} (드래그하여 위치 이동 가능)`}
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
                                    <span className="spine-author" style={{ color: authorColor, textShadow: textShadow }}>{formatAuthor(book.author)}</span>
                                    <span className="spine-title" style={{ color: titleColor, textShadow: textShadow }}>{book.title}</span>
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
                        {viewedFriend && (
                          <button
                            className="btn btn-primary btn-sm w-full mt-2 font-bold flex justify-center align-center gap-1"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem', borderRadius: '6px' }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onAddManualBook) {
                                await onAddManualBook({
                                  title: book.title,
                                  author: book.author,
                                  publisher: book.publisher,
                                  cover_url: book.cover_url,
                                  isbn: book.isbn,
                                  total_pages: book.total_pages,
                                  status: 'TO_READ',
                                  buy_link: book.buy_link,
                                  pub_date: book.pub_date,
                                  description: book.description
                                });
                                alert(`✅ '${book.title}' 도서가 내 서재에 성공적으로 추가되었습니다!`);
                              }
                            }}
                          >
                            <Plus size={14} /> 내 서재 담기
                          </button>
                        )}
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
                  <button 
                    className="btn btn-sm btn-outline inline-flex align-center gap-1"
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.15rem 0.55rem', 
                      borderRadius: '6px', 
                      marginLeft: '0.5rem', 
                      color: 'var(--primary)', 
                      borderColor: 'rgba(0, 120, 166, 0.3)',
                      background: 'rgba(0, 120, 166, 0.05)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleFetchBookDescription(selectedBook)}
                    title="클릭 시 도서 상세 소개글 팝업창을 엽니다."
                  >
                    📖 도서소개 팝업 {loadingDesc ? <RefreshCw size={12} className="animate-spin" /> : '🔍'}
                  </button>
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
                        onClick={() => {
                          const totalP = parseInt(selectedBook.total_pages) || 300;
                          onUpdateStatus(selectedBook.id, 'READ');
                          setSelectedBook({ ...selectedBook, status: 'READ', current_pages: totalP });
                          setEditCurrentPages(totalP);
                        }}
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
                            max={new Date().toISOString().split('T')[0]}
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
                        {renderStars(parseFloat(selectedBook.rating) || 0)}
                        <span className="ms-2 font-bold" style={{ marginLeft: '0.5rem', color: (parseFloat(selectedBook.rating) || 0) > 0 ? '#f59e0b' : '#94a3b8' }}>
                          {(parseFloat(selectedBook.rating) || 0).toFixed(1)}점 {(parseFloat(selectedBook.rating) || 0) === 0 ? '(미평가)' : ''}
                        </span>
                      </div>
                      {selectedBook.status === 'READ' && selectedBook.completed_at && (
                        <p className="sub-text font-bold mb-2" style={{ color: '#16a34a', fontSize: '0.8rem' }}>
                          🏆 완독 일자: {(() => {
                            try {
                              const d = new Date(selectedBook.completed_at);
                              return isNaN(d.getTime()) ? String(selectedBook.completed_at) : d.toLocaleDateString();
                            } catch {
                              return String(selectedBook.completed_at);
                            }
                          })()}
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
                      <ExternalLink size={16} /> 알라딘 구매
                    </a>
                  )}

                  {viewedFriend ? (
                    <button
                      className="btn btn-primary font-bold flex align-center gap-1"
                      style={{ padding: '0.5rem 1rem' }}
                      onClick={async () => {
                        if (onAddManualBook) {
                          await onAddManualBook({
                            title: selectedBook.title,
                            author: selectedBook.author,
                            publisher: selectedBook.publisher,
                            cover_url: selectedBook.cover_url,
                            isbn: selectedBook.isbn,
                            total_pages: selectedBook.total_pages,
                            status: 'TO_READ',
                            buy_link: selectedBook.buy_link,
                            pub_date: selectedBook.pub_date,
                            description: selectedBook.description
                          });
                          alert(`✅ '${selectedBook.title}' 도서가 내 서재에 성공적으로 추가되었습니다!`);
                          setSelectedBook(null);
                        }
                      }}
                    >
                      <Plus size={16} /> 내 서재에 추가하기
                    </button>
                  ) : (
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

      {/* 알라딘 도서 소개 전용 단일 공통 팝업 모달 */}
      {showDescModal && selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setShowDescModal(false)}
          description={bookDescription}
          toc={bookToc}
          loadingDesc={loadingDesc}
          onAddBook={viewedFriend ? (async () => {
            if (onAddManualBook && selectedBook) {
              await onAddManualBook({
                title: selectedBook.title,
                author: selectedBook.author,
                publisher: selectedBook.publisher,
                cover_url: selectedBook.cover_url,
                isbn: selectedBook.isbn,
                total_pages: selectedBook.total_pages,
                status: 'TO_READ',
                buy_link: selectedBook.buy_link,
                pub_date: selectedBook.pub_date,
                description: selectedBook.description || bookDescription
              });
              alert(`✅ '${selectedBook.title}' 도서가 내 서재에 추가되었습니다!`);
              setShowDescModal(false);
              setSelectedBook(null);
            }
          }) : null}
          onDeleteBook={!viewedFriend && selectedBook.id ? ((id) => {
            onDeleteBook(id);
            setShowDescModal(false);
            setSelectedBook(null);
          }) : null}
          onSyncInfo={async (bookToSync) => {
            await fetchPageCountFromAladin(bookToSync);
          }}
          syncing={syncingGoogleInfo}
        />
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

      {/* 📝 독서 기록장 (문장 & 생각) 모달 */}
      {showThoughtLedgerModal && (
        <div className="modal-overlay" onClick={() => setShowThoughtLedgerModal(false)} style={{ zIndex: 1100 }}>
          <div
            className="modal-card animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '92%',
              maxWidth: '920px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowThoughtLedgerModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                zIndex: 10
              }}
            >
              <X size={20} />
            </button>

            <ThoughtLedger
              notes={notes}
              books={books}
              onAddNote={onAddNote}
              onDeleteNote={onDeleteNote}
            />
          </div>
        </div>
      )}

      {/* 3D 이웃 서재 포스트잇 방명록 모달 */}
      <ShelfGuestbookModal
        isOpen={showGuestbookModal}
        onClose={() => setShowGuestbookModal(false)}
        viewedFriend={viewedFriend}
        guestbookNotes={guestbookNotes}
        onAddGuestbookNote={handleAddGuestbookNote}
        onDeleteGuestbookNote={handleDeleteGuestbookNote}
      />
    </div>
  );
}

function getSpineStyle(coverUrl, id) {
  // 표지 색상 로딩 전 플래시 현상 차단을 위한 품격 있는 차콜 세일트 톤 폴백
  return {
    bg: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
    titleColor: '#ffffff',
    authorColor: '#fde047',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)'
  };
}
