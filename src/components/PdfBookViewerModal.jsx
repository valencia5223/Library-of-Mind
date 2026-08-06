import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, CheckCircle2, RotateCcw, Columns, Square, FileCode } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [zoomScale, setZoomScale] = useState(100); // 100% = Fit to Page
  const [isTwoPageMode, setIsTwoPageMode] = useState(false); // 양면 보기 (2-Page Spread)
  const [renderEngine, setRenderEngine] = useState('native'); // 'native' (100% 원본 벡터) | 'canvas' (E-Book 모드)
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [pageDirection, setPageDirection] = useState('next'); // 'next' | 'prev'

  const canvasLeftRef = useRef(null);
  const canvasRightRef = useRef(null);
  const containerRef = useRef(null);
  const modalCardRef = useRef(null);

  const progressKey = `book_pdf_progress_${book.id || book.isbn || 'demo'}`;
  const notesKey = `book_pdf_notes_${book.id || book.isbn || 'demo'}`;
  const modeKey = `book_pdf_twopage_${book.id || book.isbn || 'demo'}`;
  const engineKey = `book_pdf_engine_${book.id || book.isbn || 'demo'}`;

  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  const pageRenderingRef = useRef(pageRendering);
  const isTwoPageModeRef = useRef(isTwoPageMode);

  useEffect(() => {
    currentPageRef.current = currentPage;
    totalPagesRef.current = totalPages;
    pageRenderingRef.current = pageRendering;
    isTwoPageModeRef.current = isTwoPageMode;
  }, [currentPage, totalPages, pageRendering, isTwoPageMode]);

  // 페이지 전환 함수
  const changePage = useCallback((targetPage, dir = 'next') => {
    const doc = pdfDoc;
    if (pageRenderingRef.current) return;

    const total = totalPagesRef.current;
    const step = isTwoPageModeRef.current ? 2 : 1;

    let nextPage = Math.max(1, Math.min(total, targetPage));
    if (nextPage === currentPageRef.current) return;

    setPageDirection(dir);
    setCurrentPage(nextPage);
    localStorage.setItem(progressKey, nextPage.toString());

    if (onProgressUpdate) {
      onProgressUpdate(nextPage, total);
    }
  }, [pdfDoc, progressKey, onProgressUpdate]);

  // 1. 모달 마운트 시 포커스 자동 지정 & 뷰어 키 이벤트 바인딩
  useEffect(() => {
    if (modalCardRef.current) {
      modalCardRef.current.focus();
    }

    try {
      const savedMode = localStorage.getItem(modeKey);
      if (savedMode !== null) setIsTwoPageMode(savedMode === 'true');

      const savedEngine = localStorage.getItem(engineKey);
      if (savedEngine) setRenderEngine(savedEngine);
    } catch (e) {}

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') {
        if (e.key === 'Escape') onClose();
        return;
      }

      const cur = currentPageRef.current;
      const total = totalPagesRef.current;
      const twoPage = isTwoPageModeRef.current;
      const step = twoPage ? 2 : 1;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (cur < total) changePage(cur + step, 'next');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (cur > 1) changePage(cur - step, 'prev');
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [changePage, onClose, modeKey, engineKey]);

  // 2. PDF.js CDN 동적 로드 및 문서 로드
  useEffect(() => {
    let isMounted = true;

    const loadPdfEngine = async () => {
      setLoadingPdf(true);

      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = PDFJS_CDN;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      }

      if (!pdfData.url) {
        setLoadingPdf(false);
        return;
      }

      try {
        const loadingTask = window.pdfjsLib.getDocument(pdfData.url);
        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoadingPdf(false);

        const savedPage = localStorage.getItem(progressKey);
        if (savedPage) {
          const p = Math.min(doc.numPages, Math.max(1, parseInt(savedPage, 10) || 1));
          setCurrentPage(p);
        }
      } catch (err) {
        console.warn('PDF.js 로드 경고:', err);
        setLoadingPdf(false);
      }
    };

    loadPdfEngine();

    try {
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) setNotes(savedNotes);
    } catch (e) {}

    return () => {
      isMounted = false;
    };
  }, [pdfData.url, progressKey, notesKey]);

  // 3. Canvas 렌더링 (부드러운 고해상도 안티앨리어싱 레티나 렌더링)
  useEffect(() => {
    if (!pdfDoc || !containerRef.current || renderEngine !== 'canvas') return;

    let isSubscribed = true;

    const renderPages = async () => {
      try {
        setPageRendering(true);
        const container = containerRef.current;
        if (!container) return;

        const maxAvailWidth = container.clientWidth - (isTwoPageMode ? 60 : 40);
        const maxAvailHeight = container.clientHeight - 40;

        // --- 왼쪽 페이지 렌더링 ---
        const page1 = await pdfDoc.getPage(currentPage);
        if (!isSubscribed) return;

        const canvasLeft = canvasLeftRef.current;
        if (canvasLeft) {
          const ctx1 = canvasLeft.getContext('2d');
          const unscaledViewport1 = page1.getViewport({ scale: 1.0 });

          const targetWidth = isTwoPageMode ? maxAvailWidth / 2 : maxAvailWidth;
          const widthScale = targetWidth / unscaledViewport1.width;
          const heightScale = maxAvailHeight / unscaledViewport1.height;

          const baseScale = Math.min(widthScale, heightScale);
          const displayScale = baseScale * (zoomScale / 100);

          // 3.0x 부드러운 고화질 픽셀 스케일링
          const renderScale = displayScale * 3.0;

          const renderViewport1 = page1.getViewport({ scale: renderScale });
          const displayViewport1 = page1.getViewport({ scale: displayScale });

          canvasLeft.width = Math.floor(renderViewport1.width);
          canvasLeft.height = Math.floor(renderViewport1.height);
          canvasLeft.style.width = `${Math.floor(displayViewport1.width)}px`;
          canvasLeft.style.height = `${Math.floor(displayViewport1.height)}px`;
          canvasLeft.style.imageRendering = 'auto';

          ctx1.imageSmoothingEnabled = true;
          ctx1.imageSmoothingQuality = 'high';

          await page1.render({
            canvasContext: ctx1,
            viewport: renderViewport1
          }).promise;
        }

        // --- 오른쪽 페이지 렌더링 (양면 모드일 경우) ---
        const canvasRight = canvasRightRef.current;
        if (canvasRight) {
          const ctx2 = canvasRight.getContext('2d');

          if (isTwoPageMode && currentPage + 1 <= totalPages) {
            const page2 = await pdfDoc.getPage(currentPage + 1);
            if (!isSubscribed) return;

            const unscaledViewport2 = page2.getViewport({ scale: 1.0 });
            const targetWidth = maxAvailWidth / 2;

            const widthScale = targetWidth / unscaledViewport2.width;
            const heightScale = maxAvailHeight / unscaledViewport2.height;

            const baseScale = Math.min(widthScale, heightScale);
            const displayScale = baseScale * (zoomScale / 100);
            const renderScale = displayScale * 3.0;

            const renderViewport2 = page2.getViewport({ scale: renderScale });
            const displayViewport2 = page2.getViewport({ scale: displayScale });

            canvasRight.width = Math.floor(renderViewport2.width);
            canvasRight.height = Math.floor(renderViewport2.height);
            canvasRight.style.width = `${Math.floor(displayViewport2.width)}px`;
            canvasRight.style.height = `${Math.floor(displayViewport2.height)}px`;
            canvasRight.style.imageRendering = 'auto';

            ctx2.imageSmoothingEnabled = true;
            ctx2.imageSmoothingQuality = 'high';

            await page2.render({
              canvasContext: ctx2,
              viewport: renderViewport2
            }).promise;
          } else {
            ctx2.clearRect(0, 0, canvasRight.width, canvasRight.height);
            canvasRight.style.width = '0px';
            canvasRight.style.height = '0px';
          }
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Canvas render error:', err);
        }
      } finally {
        if (isSubscribed) setPageRendering(false);
      }
    };

    renderPages();

    return () => {
      isSubscribed = false;
    };
  }, [pdfDoc, currentPage, zoomScale, isTwoPageMode, totalPages, renderEngine]);

  const toggleTwoPageMode = () => {
    const nextMode = !isTwoPageMode;
    setIsTwoPageMode(nextMode);
    localStorage.setItem(modeKey, nextMode.toString());
  };

  const toggleEngine = () => {
    const nextEngine = renderEngine === 'native' ? 'canvas' : 'native';
    setRenderEngine(nextEngine);
    localStorage.setItem(engineKey, nextEngine);
  };

  const handleNotesChange = (text) => {
    setNotes(text);
    localStorage.setItem(notesKey, text);
  };

  const progressPercent = Math.min(100, Math.round((currentPage / (totalPages || 1)) * 100));
  const pageStep = isTwoPageMode ? 2 : 1;

  return (
    <div className="modal-overlay modal-backdrop" style={{ zIndex: 100000 }} onClick={onClose}>
      <div
        ref={modalCardRef}
        tabIndex={0}
        className="modal-card pdf-viewer-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96vw',
          maxWidth: showNotes ? '1480px' : '1280px',
          height: '93vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: '16px',
          transition: 'all 0.3s ease',
          outline: 'none'
        }}
      >
        {/* 상단 툴바 */}
        <div
          className="pdf-toolbar"
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* 책 정보 */}
          <div className="flex align-center gap-3">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex align-center gap-2" style={{ margin: 0 }}>
                {book.title || 'PDF 전자책'}
                <span className="text-xs px-2 py-0.5 rounded font-normal" style={{ backgroundColor: '#0284c7', color: '#ffffff' }}>
                  {renderEngine === 'native' ? '📄 100% 원본 Vector' : '🖼️ Canvas E-Book'}
                </span>
              </h3>
              <div className="text-xs text-slate-400 flex align-center gap-2 mt-0.5">
                <span style={{ color: '#38bdf8' }}>진행률 {progressPercent}% 완료</span>
                <span>•</span>
                <span>키보드 방향키(←/→) 책넘기기 가능</span>
              </div>
            </div>
          </div>

          {/* 리얼 책 넘김 네비게이터 */}
          <div className="flex align-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => changePage(currentPage - pageStep, 'prev')}
              disabled={currentPage <= 1 || pageRendering}
              title="이전 페이지 (Left Arrow)"
              style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex align-center gap-1.5 text-xs font-bold px-2">
              <span className="text-sky-400 text-sm">
                {isTwoPageMode ? `${currentPage}-${Math.min(totalPages, currentPage + 1)}` : currentPage}
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{totalPages}</span>
              <span className="text-slate-400 font-normal">p</span>
            </div>

            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => changePage(currentPage + pageStep, 'next')}
              disabled={currentPage >= totalPages || pageRendering}
              title="다음 페이지 (Right Arrow)"
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* 우측 컨트롤 및 엔진 토글/양면보기 옵션 & 독서 메모 */}
          <div className="flex align-center gap-2.5" style={{ flexShrink: 0 }}>
            {/* 100% 원본 Vector vs Canvas 뷰어 전환 토글 */}
            <button
              className="btn btn-sm font-bold flex align-center gap-1.5"
              onClick={toggleEngine}
              title="100% 원본 Vector 화질과 Canvas 뷰어 간 렌더링 전환"
              style={{
                backgroundColor: renderEngine === 'native' ? '#0369a1' : '#334155',
                color: '#ffffff',
                border: '1px solid #38bdf8',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px'
              }}
            >
              <FileCode size={15} />
              <span>{renderEngine === 'native' ? '📄 원본 Vector' : '🖼️ Canvas 모드'}</span>
            </button>

            {/* 단면 / 양면 보기 옵션 토글 */}
            <button
              className="btn btn-sm font-bold flex align-center gap-1.5"
              onClick={toggleTwoPageMode}
              title="단면 1페이지 / 양면 2페이지 펼침 보기 전환"
              style={{
                backgroundColor: isTwoPageMode ? '#0284c7' : '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px'
              }}
            >
              {isTwoPageMode ? <Columns size={15} /> : <Square size={15} />}
              <span>{isTwoPageMode ? '양면 보기' : '단면 보기'}</span>
            </button>

            {renderEngine === 'canvas' && (
              <div className="flex align-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                <button
                  className="btn btn-icon btn-xs text-slate-300 hover:text-white"
                  onClick={() => setZoomScale(Math.max(60, zoomScale - 15))}
                  title="축소"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="text-xs font-bold px-1 text-slate-300" style={{ minWidth: '40px', textAlign: 'center' }}>
                  {zoomScale}%
                </span>
                <button
                  className="btn btn-icon btn-xs text-slate-300 hover:text-white"
                  onClick={() => setZoomScale(Math.min(220, zoomScale + 15))}
                  title="확대"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  className="btn btn-icon btn-xs text-slate-400 hover:text-white ml-1"
                  onClick={() => setZoomScale(100)}
                  title="100% 화면 맞춤 (Fit to Page)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}

            <button
              className={`btn btn-sm font-bold flex align-center gap-1.5 ${showNotes ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowNotes(!showNotes)}
              style={{
                backgroundColor: showNotes ? '#0284c7' : '#334155',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={15} />
              {showNotes ? '메모 닫기' : '독서 메모장'}
            </button>

            <button
              onClick={onClose}
              title="닫기 (ESC)"
              style={{
                position: 'static',
                backgroundColor: '#334155',
                color: '#ffffff',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 상단 프로그레스 바 */}
        <div style={{ height: '3px', backgroundColor: '#1e293b', width: '100%' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#0284c7',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {/* E-Book 리더 본문 뷰포트 (100% Native Vector PDF vs Canvas) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* 좌측 이전 페이지 터치/클릭 영역 */}
          <div
            className="ebook-touch-left group"
            onClick={() => changePage(currentPage - pageStep, 'prev')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '8%',
              zIndex: 10,
              cursor: currentPage > 1 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: '1.25rem',
              background: 'linear-gradient(to right, rgba(0,0,0,0.3), transparent)',
              opacity: 0,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            {currentPage > 1 && (
              <div className="bg-slate-900/80 text-white p-2.5 rounded-full shadow-lg border border-slate-700">
                <ChevronLeft size={24} />
              </div>
            )}
          </div>

          {/* 중앙 뷰포트 영역 */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: '#020617',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: renderEngine === 'native' ? '0' : '1rem',
              position: 'relative'
            }}
          >
            {loadingPdf ? (
              <div className="text-center p-8">
                <BookOpen size={48} className="mx-auto mb-3 text-sky-500 animate-bounce" />
                <p className="font-bold text-slate-300 text-base">E-Book 책 페이지를 읽어오는 중...</p>
              </div>
            ) : renderEngine === 'native' ? (
              /* 📄 100% 원본 Native Vector PDF 임베드 뷰어 (글자 무한 100% 선명도) */
              <object
                data={`${pdfData.url}#page=${currentPage}`}
                type="application/pdf"
                width="100%"
                height="100%"
                style={{ border: 'none', backgroundColor: '#0f172a' }}
              >
                <iframe
                  src={`${pdfData.url}#page=${currentPage}`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title="PDF Native Viewer"
                />
              </object>
            ) : (
              /* 🖼️ Canvas E-Book 모드 뷰어 */
              <div
                className={`ebook-paper-frame ${pageDirection === 'next' ? 'flip-next' : 'flip-prev'} flex align-center justify-center`}
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden',
                  gap: isTwoPageMode ? '2px' : '0'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: '10px',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                />

                <canvas ref={canvasLeftRef} style={{ display: 'block' }} />

                <div
                  style={{
                    width: '12px',
                    alignSelf: 'stretch',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.2) 100%)',
                    zIndex: 6,
                    flexShrink: 0,
                    display: isTwoPageMode ? 'block' : 'none'
                  }}
                />

                <canvas
                  ref={canvasRightRef}
                  style={{ display: isTwoPageMode ? 'block' : 'none' }}
                />
              </div>
            )}
          </div>

          {/* 우측 다음 페이지 터치/클릭 영역 */}
          <div
            className="ebook-touch-right group"
            onClick={() => changePage(currentPage + pageStep, 'next')}
            style={{
              position: 'absolute',
              right: showNotes ? '380px' : 0,
              top: 0,
              bottom: 0,
              width: '8%',
              zIndex: 10,
              cursor: currentPage < totalPages ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '1.25rem',
              background: 'linear-gradient(to left, rgba(0,0,0,0.3), transparent)',
              opacity: 0,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            {currentPage < totalPages && (
              <div className="bg-slate-900/80 text-white p-2.5 rounded-full shadow-lg border border-slate-700">
                <ChevronRight size={24} />
              </div>
            )}
          </div>

          {/* 우측 독서 메모장 스플릿 뷰 */}
          {showNotes && (
            <div
              style={{
                width: '380px',
                height: '100%',
                backgroundColor: '#1e293b',
                borderLeft: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                boxShadow: '-10px 0 25px rgba(0,0,0,0.3)',
                zIndex: 20
              }}
            >
              <div className="flex align-center justify-between mb-3 pb-2 border-b border-slate-700">
                <h4 className="font-bold text-sm text-slate-200 flex align-center gap-1.5" style={{ margin: 0 }}>
                  <FileText size={16} className="text-sky-400" />
                  독서 메모장
                </h4>
                <span className="text-xs text-slate-400">{currentPage}p 독서 중</span>
              </div>

              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="책을 읽으며 기억하고 싶은 문장이나 생각을 기록해보세요..."
                style={{
                  flex: 1,
                  width: '100%',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none'
                }}
              />

              <div className="mt-3 flex align-center justify-between text-xs text-slate-400">
                <span className="flex align-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-400" /> 자동 저장됨
                </span>
                <span>{notes.length}자</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
