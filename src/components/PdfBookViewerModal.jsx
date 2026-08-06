import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, CheckCircle2, RotateCcw, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [zoomScale, setZoomScale] = useState(100); // 100% = Fit to Page
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [pageDirection, setPageDirection] = useState('next'); // 'next' | 'prev'

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const progressKey = `book_pdf_progress_${book.id || book.isbn || 'demo'}`;
  const notesKey = `book_pdf_notes_${book.id || book.isbn || 'demo'}`;

  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  const pageRenderingRef = useRef(pageRendering);
  const pdfDocRef = useRef(pdfDoc);

  useEffect(() => {
    currentPageRef.current = currentPage;
    totalPagesRef.current = totalPages;
    pageRenderingRef.current = pageRendering;
    pdfDocRef.current = pdfDoc;
  }, [currentPage, totalPages, pageRendering, pdfDoc]);

  // 1. PDF.js CDN 동적 로드 및 문법 로드
  useEffect(() => {
    let isMounted = true;

    const loadPdfEngine = async () => {
      setLoadingPdf(true);

      // PDF.js 라이브러리 비동기 동적 로드
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

        // 이전 보존 페이지 복원
        const savedPage = localStorage.getItem(progressKey);
        if (savedPage) {
          const p = Math.min(doc.numPages, Math.max(1, parseInt(savedPage, 10) || 1));
          setCurrentPage(p);
        }
      } catch (err) {
        console.warn('PDF.js 로드 경고 (폴백 사용):', err);
        setLoadingPdf(false);
      }
    };

    loadPdfEngine();

    // 메모 로드
    try {
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) setNotes(savedNotes);
    } catch (e) {}

    // 키보드 방향키 넘기기 & ESC 닫기 (useRef 기반 100% 실시간 최신값 바인딩)
    const handleKeyDown = (e) => {
      // textarea 입력 중일 때는 글 작성을 방해하지 않음
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
        if (e.key === 'Escape') onClose();
        return;
      }

      const cur = currentPageRef.current;
      const total = totalPagesRef.current;
      const rendering = pageRenderingRef.current;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (!rendering && cur < total) {
          handlePageChange(cur + 1, 'next');
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (!rendering && cur > 1) {
          handlePageChange(cur - 1, 'prev');
        }
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pdfData.url]);

  // 2. Canvas 렌더링 (Fit-to-Page A4 자동 뷰포트 맞춤)
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    let renderTask = null;

    const renderPage = async () => {
      try {
        setPageRendering(true);
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = containerRef.current;

        // A4 1페이지 전체가 한 화면 안에 쏙 들어오도록 비율 계산
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;

        const widthScale = containerWidth / unscaledViewport.width;
        const heightScale = containerHeight / unscaledViewport.height;

        // 기본 scale (Fit to Page) x 사용자 Zoom 비율
        const baseScale = Math.min(widthScale, heightScale);
        const finalScale = baseScale * (zoomScale / 100);

        const viewport = page.getViewport({ scale: finalScale });

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Canvas render error:', err);
        }
      } finally {
        setPageRendering(false);
      }
    };

    renderPage();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, zoomScale]);

  // 3. 페이지 전환 핸들러
  const handlePageChange = (newPage, dir = 'next') => {
    if (pageRendering || !pdfDoc) return;
    const targetPage = Math.max(1, Math.min(totalPages, newPage));
    if (targetPage === currentPage) return;

    setPageDirection(dir);
    setCurrentPage(targetPage);
    localStorage.setItem(progressKey, targetPage.toString());

    if (onProgressUpdate) {
      onProgressUpdate(targetPage, totalPages);
    }
  };

  const handleNotesChange = (text) => {
    setNotes(text);
    localStorage.setItem(notesKey, text);
  };

  const progressPercent = Math.min(100, Math.round((currentPage / (totalPages || 1)) * 100));

  return (
    <div className="modal-overlay modal-backdrop" style={{ zIndex: 100000 }} onClick={onClose}>
      <div
        className="modal-card pdf-viewer-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96%',
          maxWidth: showNotes ? '1420px' : '1120px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: '16px',
          transition: 'all 0.3s ease'
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
                <span className="text-xs px-2 py-0.5 rounded font-normal" style={{ backgroundColor: '#334155', color: '#94a3b8' }}>
                  E-Book Reader Mode
                </span>
              </h3>
              <div className="text-xs text-slate-400 flex align-center gap-2 mt-0.5">
                <span style={{ color: '#38bdf8' }}>진행률 {progressPercent}% 완료</span>
                <span>•</span>
                <span>방향키(←/→)로 책넘기기 가능</span>
              </div>
            </div>
          </div>

          {/* 리얼 책 넘김 네비게이터 */}
          <div className="flex align-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => handlePageChange(currentPage - 1, 'prev')}
              disabled={currentPage <= 1 || pageRendering}
              title="이전 페이지 (Left Arrow)"
              style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex align-center gap-1.5 text-xs font-bold px-2">
              <span className="text-sky-400 text-sm">{currentPage}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{totalPages}</span>
              <span className="text-slate-400 font-normal">p</span>
            </div>

            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => handlePageChange(currentPage + 1, 'next')}
              disabled={currentPage >= totalPages || pageRendering}
              title="다음 페이지 (Right Arrow)"
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* 우측 컨트롤 및 독서 메모 */}
          <div className="flex align-center gap-2">
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
                onClick={() => setZoomScale(Math.min(180, zoomScale + 15))}
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

            <button
              className={`btn btn-sm font-bold flex align-center gap-1.5 ${showNotes ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowNotes(!showNotes)}
              style={{
                backgroundColor: showNotes ? '#0284c7' : '#334155',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px'
              }}
            >
              <FileText size={15} />
              {showNotes ? '메모 닫기' : '독서 메모장'}
            </button>

            <button
              className="modal-close"
              onClick={onClose}
              title="닫기 (ESC)"
              style={{ backgroundColor: '#334155', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%' }}
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

        {/* E-Book 리더 본문 뷰포트 (진짜 종이 책 텍스처 & 넘김 구조) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* 좌측 이전 페이지 터치/클릭 영억 */}
          <div
            className="ebook-touch-left group"
            onClick={() => handlePageChange(currentPage - 1, 'prev')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '12%',
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

          {/* 중앙 1페이지 A4 종이 책 Canvas 영역 */}
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
              padding: '1.25rem',
              position: 'relative'
            }}
          >
            {loadingPdf ? (
              <div className="text-center p-8">
                <BookOpen size={48} className="mx-auto mb-3 text-sky-500 animate-bounce" />
                <p className="font-bold text-slate-300 text-base">E-Book 책 페이지를 읽어오는 중...</p>
              </div>
            ) : (
              <div
                className={`ebook-paper-frame ${pageDirection === 'next' ? 'flip-next' : 'flip-prev'}`}
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* 종이책 가장자리 그림자 효과 */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: '12px',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                />

                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
            )}
          </div>

          {/* 우측 다음 페이지 터치/클릭 영역 */}
          <div
            className="ebook-touch-right group"
            onClick={() => handlePageChange(currentPage + 1, 'next')}
            style={{
              position: 'absolute',
              right: showNotes ? '380px' : 0,
              top: 0,
              bottom: 0,
              width: '12%',
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
