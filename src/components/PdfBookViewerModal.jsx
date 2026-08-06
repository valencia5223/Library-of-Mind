import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, CheckCircle2, RotateCcw, Columns, Square } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PDFJS_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [zoomScale, setZoomScale] = useState(100);
  const [isTwoPageMode, setIsTwoPageMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [pageDirection, setPageDirection] = useState('next');

  const canvasLeftRef = useRef(null);
  const canvasRightRef = useRef(null);
  const textLayerLeftRef = useRef(null);
  const textLayerRightRef = useRef(null);
  const containerRef = useRef(null);
  const modalCardRef = useRef(null);

  const progressKey = `book_pdf_progress_${book.id || book.isbn || 'demo'}`;
  const notesKey = `book_pdf_notes_${book.id || book.isbn || 'demo'}`;
  const modeKey = `book_pdf_twopage_${book.id || book.isbn || 'demo'}`;

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

  const changePage = useCallback((targetPage, dir = 'next') => {
    if (pageRenderingRef.current) return;
    const total = totalPagesRef.current;
    let nextPage = Math.max(1, Math.min(total, targetPage));
    if (nextPage === currentPageRef.current) return;
    setPageDirection(dir);
    setCurrentPage(nextPage);
    localStorage.setItem(progressKey, nextPage.toString());
    if (onProgressUpdate) onProgressUpdate(nextPage, total);
  }, [pdfDoc, progressKey, onProgressUpdate]);

  useEffect(() => {
    if (modalCardRef.current) modalCardRef.current.focus();
    try {
      const savedMode = localStorage.getItem(modeKey);
      if (savedMode !== null) setIsTwoPageMode(savedMode === 'true');
    } catch (e) {}

    const handleKeyDown = (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        if (e.key === 'Escape') onClose();
        return;
      }
      const cur = currentPageRef.current;
      const total = totalPagesRef.current;
      const step = isTwoPageModeRef.current ? 2 : 1;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (cur < total) changePage(cur + step, 'next');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (cur > 1) changePage(cur - step, 'prev');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [changePage, onClose, modeKey]);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      setLoadingPdf(true);

      // CSS 동적 로드
      if (!document.getElementById('pdfjs-viewer-css')) {
        const link = document.createElement('link');
        link.id = 'pdfjs-viewer-css';
        link.rel = 'stylesheet';
        link.href = PDFJS_CSS;
        document.head.appendChild(link);
      }

      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = PDFJS_CDN;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      if (!pdfData.url) { setLoadingPdf(false); return; }
      try {
        const doc = await window.pdfjsLib.getDocument(pdfData.url).promise;
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoadingPdf(false);
        const saved = localStorage.getItem(progressKey);
        if (saved) setCurrentPage(Math.min(doc.numPages, Math.max(1, parseInt(saved, 10) || 1)));
      } catch (err) {
        console.warn('PDF load error:', err);
        setLoadingPdf(false);
      }
    };
    loadPdf();
    try { const n = localStorage.getItem(notesKey); if (n) setNotes(n); } catch (e) {}
    return () => { isMounted = false; };
  }, [pdfData.url, progressKey, notesKey]);

  /**
   * ★ Dynamic GPU Safe-Scale + TextLayer 벡터 힌팅 복합 렌더링 엔진 ★
   */
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let alive = true;

    const renderPage = async (page, canvas, textLayerDiv) => {
      if (!canvas) return;

      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth - (isTwoPageMode ? 60 : 40);
      const maxH = container.clientHeight - 40;

      const raw = page.getViewport({ scale: 1.0 });
      const targetW = isTwoPageMode ? maxW / 2 : maxW;
      const fitScale = Math.min(targetW / raw.width, maxH / raw.height) * (zoomScale / 100);

      // 1) 화면 표시용 기본 viewport
      const viewport = page.getViewport({ scale: fitScale });

      // 2) GPU 4096px 한계선 마진 고려 최댓값 배율 동적 계산 (Safety GPU Safe-Scale)
      const MAX_GPU_DIMENSION = 4096;
      const dpr = Math.max(window.devicePixelRatio || 1, 2.0);
      const maxPossibleScaleX = MAX_GPU_DIMENSION / Math.max(1, viewport.width);
      const maxPossibleScaleY = MAX_GPU_DIMENSION / Math.max(1, viewport.height);
      const safeMaxScale = Math.min(maxPossibleScaleX, maxPossibleScaleY, 3.8);
      const outputScale = Math.max(dpr * 1.5, Math.min(3.8, safeMaxScale));

      // 3) 캔버스 물리 픽셀 세팅
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);

      // 4) CSS 표시 크기 고정
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // 5) 불투명 캔버스 + 폰트 힌팅 강화
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 6) transform 기반 고밀도 캔버스 렌더링
      const transform = [outputScale, 0, 0, outputScale, 0, 0];
      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        transform: transform
      }).promise;

      // 7) TextLayer 오버레이 (벡터 폰트 힌팅 & 또렷한 글꼴 정렬 보장)
      if (textLayerDiv && window.pdfjsLib) {
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
        textLayerDiv.style.setProperty('--scale-factor', fitScale);

        try {
          const textContent = await page.getTextContent();
          if (alive && window.pdfjsLib.renderTextLayer) {
            await window.pdfjsLib.renderTextLayer({
              textContent: textContent,
              container: textLayerDiv,
              viewport: viewport,
              textDivs: []
            }).promise;
          }
        } catch (e) {
          console.warn('TextLayer render note:', e);
        }
      }
    };

    const renderAll = async () => {
      try {
        setPageRendering(true);

        // 왼쪽 페이지
        const p1 = await pdfDoc.getPage(currentPage);
        if (!alive) return;
        await renderPage(p1, canvasLeftRef.current, textLayerLeftRef.current);

        // 오른쪽 페이지 (양면 모드)
        const canvasRight = canvasRightRef.current;
        const textLayerRight = textLayerRightRef.current;
        if (canvasRight) {
          if (isTwoPageMode && currentPage + 1 <= totalPages) {
            const p2 = await pdfDoc.getPage(currentPage + 1);
            if (!alive) return;
            await renderPage(p2, canvasRight, textLayerRight);
          } else {
            canvasRight.width = 0;
            canvasRight.height = 0;
            canvasRight.style.width = '0px';
            canvasRight.style.height = '0px';
            if (textLayerRight) textLayerRight.innerHTML = '';
          }
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') console.warn('Render error:', err);
      } finally {
        if (alive) setPageRendering(false);
      }
    };

    renderAll();
    return () => { alive = false; };
  }, [pdfDoc, currentPage, zoomScale, isTwoPageMode, totalPages]);

  const toggleTwoPageMode = () => {
    const next = !isTwoPageMode;
    setIsTwoPageMode(next);
    localStorage.setItem(modeKey, next.toString());
  };

  const handleNotesChange = (t) => { setNotes(t); localStorage.setItem(notesKey, t); };

  const pct = Math.min(100, Math.round((currentPage / (totalPages || 1)) * 100));
  const step = isTwoPageMode ? 2 : 1;

  return (
    <div className="modal-overlay modal-backdrop" style={{ zIndex: 100000 }} onClick={onClose}>
      <div
        ref={modalCardRef}
        tabIndex={0}
        className="modal-card pdf-viewer-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96vw', maxWidth: showNotes ? '1480px' : '1280px', height: '93vh',
          display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden',
          backgroundColor: '#0f172a', color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '16px',
          transition: 'all 0.3s ease', outline: 'none'
        }}
      >
        {/* 상단 툴바 */}
        <div style={{
          padding: '0.75rem 1.25rem', backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
        }}>
          <div className="flex align-center gap-3">
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#0284c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex align-center gap-2" style={{ margin: 0 }}>
                {book.title || 'PDF 전자책'}
                <span className="text-xs px-2 py-0.5 rounded font-normal" style={{ backgroundColor: '#0284c7', color: '#fff' }}>
                  {isTwoPageMode ? '📖📖 양면 펼침' : '📖 단면 보기'}
                </span>
              </h3>
              <div className="text-xs text-slate-400 flex align-center gap-2 mt-0.5">
                <span style={{ color: '#38bdf8' }}>진행률 {pct}%</span>
                <span>•</span>
                <span>방향키(←/→) 책넘기기</span>
              </div>
            </div>
          </div>

          <div className="flex align-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
            <button onClick={() => changePage(currentPage - step, 'prev')} disabled={currentPage <= 1 || pageRendering}
              style={{ opacity: currentPage <= 1 ? 0.4 : 1, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}>
              <ChevronLeft size={20} />
            </button>
            <div className="flex align-center gap-1.5 text-xs font-bold px-2">
              <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>
                {isTwoPageMode ? `${currentPage}-${Math.min(totalPages, currentPage + 1)}` : currentPage}
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{totalPages}</span>
              <span className="text-slate-400 font-normal">p</span>
            </div>
            <button onClick={() => changePage(currentPage + step, 'next')} disabled={currentPage >= totalPages || pageRendering}
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex align-center gap-2.5" style={{ flexShrink: 0 }}>
            <button onClick={toggleTwoPageMode} title="단면/양면 전환"
              style={{
                backgroundColor: isTwoPageMode ? '#0284c7' : '#334155', color: '#fff',
                border: '1px solid #475569', padding: '0.4rem 0.75rem', borderRadius: '6px',
                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
              }}>
              {isTwoPageMode ? <Columns size={15} /> : <Square size={15} />}
              <span>{isTwoPageMode ? '양면 보기' : '단면 보기'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '4px 8px', borderRadius: '6px', border: '1px solid #334155' }}>
              <button onClick={() => setZoomScale(Math.max(60, zoomScale - 15))}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px' }}>
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', minWidth: '40px', textAlign: 'center' }}>{zoomScale}%</span>
              <button onClick={() => setZoomScale(Math.min(220, zoomScale + 15))}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px' }}>
                <ZoomIn size={15} />
              </button>
              <button onClick={() => setZoomScale(100)} title="화면 맞춤"
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', marginLeft: '2px' }}>
                <RotateCcw size={13} />
              </button>
            </div>

            <button onClick={() => setShowNotes(!showNotes)}
              style={{
                backgroundColor: showNotes ? '#0284c7' : '#334155', color: '#fff', border: 'none',
                padding: '0.4rem 0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              <FileText size={15} />
              {showNotes ? '메모 닫기' : '독서 메모장'}
            </button>

            <button onClick={onClose} title="닫기 (ESC)"
              style={{
                backgroundColor: '#334155', color: '#fff', border: 'none', width: '32px', height: '32px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
              }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 프로그레스 바 */}
        <div style={{ height: '3px', backgroundColor: '#1e293b', width: '100%' }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#0284c7', transition: 'width 0.3s ease' }} />
        </div>

        {/* 본문 뷰포트 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* 좌측 클릭 영역 */}
          <div onClick={() => changePage(currentPage - step, 'prev')}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '8%', zIndex: 10,
              cursor: currentPage > 1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
              justifyContent: 'flex-start', paddingLeft: '1.25rem',
              background: 'linear-gradient(to right, rgba(0,0,0,0.3), transparent)', opacity: 0, transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
            {currentPage > 1 && (
              <div style={{ background: 'rgba(15,23,42,0.8)', color: '#fff', padding: '10px', borderRadius: '50%', border: '1px solid #334155' }}>
                <ChevronLeft size={24} />
              </div>
            )}
          </div>

          {/* 중앙 Canvas + TextLayer 오버레이 영역 */}
          <div ref={containerRef}
            style={{
              flex: 1, height: '100%', backgroundColor: '#020617', display: 'flex', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden', padding: '1rem', position: 'relative',
              WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility'
            }}>
            {loadingPdf ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <BookOpen size={48} style={{ color: '#0284c7', marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 700, color: '#cbd5e1' }}>책 페이지를 로딩하는 중...</p>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#ffffff', borderRadius: '6px', position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {/* 왼쪽 페이지 래퍼 */}
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                  <canvas ref={canvasLeftRef} style={{ display: 'block', backgroundColor: '#fff' }} />
                  <div ref={textLayerLeftRef} className="textLayer" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.95 }} />
                </div>

                {/* 중앙 제본선 그림자 */}
                {isTwoPageMode && (
                  <div style={{
                    width: '10px', alignSelf: 'stretch', flexShrink: 0, zIndex: 5,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.18) 100%)'
                  }} />
                )}

                {/* 오른쪽 페이지 래퍼 */}
                <div style={{ position: 'relative', overflow: 'hidden', display: isTwoPageMode ? 'block' : 'none' }}>
                  <canvas ref={canvasRightRef} style={{ display: isTwoPageMode ? 'block' : 'none', backgroundColor: '#fff' }} />
                  <div ref={textLayerRightRef} className="textLayer" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.95 }} />
                </div>
              </div>
            )}
          </div>

          {/* 우측 클릭 영역 */}
          <div onClick={() => changePage(currentPage + step, 'next')}
            style={{
              position: 'absolute', right: showNotes ? '380px' : 0, top: 0, bottom: 0, width: '8%', zIndex: 10,
              cursor: currentPage < totalPages ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
              justifyContent: 'flex-end', paddingRight: '1.25rem',
              background: 'linear-gradient(to left, rgba(0,0,0,0.3), transparent)', opacity: 0, transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
            {currentPage < totalPages && (
              <div style={{ background: 'rgba(15,23,42,0.8)', color: '#fff', padding: '10px', borderRadius: '50%', border: '1px solid #334155' }}>
                <ChevronRight size={24} />
              </div>
            )}
          </div>

          {/* 메모장 */}
          {showNotes && (
            <div style={{
              width: '380px', height: '100%', backgroundColor: '#1e293b', borderLeft: '1px solid #334155',
              display: 'flex', flexDirection: 'column', padding: '1rem', boxShadow: '-10px 0 25px rgba(0,0,0,0.3)', zIndex: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} style={{ color: '#38bdf8' }} /> 독서 메모장
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{currentPage}p 독서 중</span>
              </div>
              <textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="책을 읽으며 기억하고 싶은 문장이나 생각을 기록해보세요..."
                style={{
                  flex: 1, width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155',
                  borderRadius: '8px', padding: '0.85rem', fontSize: '0.9rem', lineHeight: '1.6', resize: 'none', outline: 'none'
                }} />
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} style={{ color: '#34d399' }} /> 자동 저장됨
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
