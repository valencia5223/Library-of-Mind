import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, FileText, CheckCircle2, Columns, Square, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [isTwoPageMode, setIsTwoPageMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoomScale, setZoomScale] = useState(100);

  const containerLeftRef = useRef(null);
  const containerRightRef = useRef(null);
  const containerRef = useRef(null);
  const modalCardRef = useRef(null);

  const progressKey = `book_pdf_progress_${book.id || book.isbn || 'demo'}`;
  const notesKey = `book_pdf_notes_${book.id || book.isbn || 'demo'}`;
  const modeKey = `book_pdf_twopage_${book.id || book.isbn || 'demo'}`;

  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  const pageRenderingRef = useRef(pageRendering);
  const isTwoPageModeRef = useRef(isTwoPageMode);

  // 드래그 스크롤(패닝) 상태 관리
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0, sTop: 0, sLeft: 0 });

  const onMouseDown = (e) => {
    if (e.button !== 0 || !containerRef.current) return;
    isDragging.current = true;
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      sTop: containerRef.current.scrollTop,
      sLeft: containerRef.current.scrollLeft
    };
    containerRef.current.style.cursor = 'grabbing';
  };

  const onMouseUpOrLeave = () => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  };

  const onMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    containerRef.current.scrollTop = startPos.current.sTop - (e.clientY - startPos.current.y);
    containerRef.current.scrollLeft = startPos.current.sLeft - (e.clientX - startPos.current.x);
  };

  useEffect(() => {
    currentPageRef.current = currentPage;
    totalPagesRef.current = totalPages;
    pageRenderingRef.current = pageRendering;
    isTwoPageModeRef.current = isTwoPageMode;
  }, [currentPage, totalPages, pageRendering, isTwoPageMode]);

  const changePage = useCallback((targetPage) => {
    if (pageRenderingRef.current) return;
    const total = totalPagesRef.current;
    let nextPage = Math.max(1, Math.min(total, targetPage));
    if (nextPage === currentPageRef.current) return;
    setCurrentPage(nextPage);
    localStorage.setItem(progressKey, nextPage.toString());
    if (onProgressUpdate) onProgressUpdate(nextPage, total);
  }, [progressKey, onProgressUpdate]);

  useEffect(() => {
    if (modalCardRef.current) modalCardRef.current.focus();
    try {
      const savedMode = localStorage.getItem(modeKey);
      if (savedMode !== null) setIsTwoPageMode(savedMode === 'true');
      const n = localStorage.getItem(notesKey);
      if (n) setNotes(n);
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
        if (cur < total) changePage(cur + step);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (cur > 1) changePage(cur - step);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [changePage, onClose, modeKey, notesKey]);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      setLoadingPdf(true);
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
      
      try {
        const doc = await window.pdfjsLib.getDocument(pdfData.url).promise;
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        const saved = localStorage.getItem(progressKey);
        if (saved) setCurrentPage(Math.min(doc.numPages, Math.max(1, parseInt(saved, 10) || 1)));
      } catch (err) {
        console.warn('PDF load error:', err);
      } finally {
        if (isMounted) setLoadingPdf(false);
      }
    };
    if (pdfData.url) loadPdf();
    return () => { isMounted = false; };
  }, [pdfData.url, progressKey]);

  /**
   * ★ 완벽한 비율의 Canvas 회귀 렌더링 ★
   * - Iframe은 본질적으로 페이지 전환 시 번쩍임(Reload Flash)과 확대 시 깨짐 발생.
   * - Canvas로 회귀하되, 브라우저가 안티앨리어싱 필터를 왜곡하는 4x 스케일링을 폐기!
   * - 1:1 완벽 정매칭 DPR 혹은 최소 2배수로만 그리기 (글씨 뭉개짐(Smudge) 완전 차단)
   */
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let alive = true;

    const renderPage = async (page, containerEl) => {
      if (!containerEl) return;

      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth - (isTwoPageMode ? 60 : 40);
      const pageGap = 10;
      const raw = page.getViewport({ scale: 1.0 });
      const targetW = isTwoPageMode ? (maxW - pageGap) / 2 : maxW;
      
      const userZoomMultiplier = zoomScale / 100;
      const fitScale = (targetW / raw.width) * userZoomMultiplier;

      const viewport = page.getViewport({ scale: fitScale });

      // PDF.js SVGGraphics를 활용한 100% 벡터 DOM 렌더링 (글씨 깨짐 0%)
      const svgG = new window.pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
      const svg = await svgG.getSVG(page, viewport);

      svg.style.width = `${Math.floor(viewport.width)}px`;
      svg.style.height = `${Math.floor(viewport.height)}px`;
      svg.style.display = 'block';

      containerEl.innerHTML = '';
      containerEl.appendChild(svg);
    };

    const renderAll = async () => {
      try {
        setPageRendering(true);

        const p1 = await pdfDoc.getPage(currentPage);
        if (!alive) return;
        await renderPage(p1, containerLeftRef.current);

        const containerRight = containerRightRef.current;
        if (containerRight) {
          if (isTwoPageMode && currentPage + 1 <= totalPages) {
            const p2 = await pdfDoc.getPage(currentPage + 1);
            if (!alive) return;
            await renderPage(p2, containerRight);
            containerRight.style.display = 'block';
          } else {
            containerRight.innerHTML = '';
            containerRight.style.display = 'none';
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
          width: '94vw', maxWidth: showNotes ? '1500px' : '1380px', height: '99vh',
          display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden',
          backgroundColor: '#0f172a', color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '12px',
          transition: 'all 0.3s ease', outline: 'none'
        }}
      >
        {/* 초소형 상단 툴바 (스크롤 확보용) */}
        <div style={{
          padding: '0.35rem 0.85rem', backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap'
        }}>
          <div className="flex align-center gap-2">
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#0284c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-white flex align-center gap-1.5" style={{ margin: 0 }}>
                {book.title || 'PDF 전자책'}
                <span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ backgroundColor: '#0284c7', color: '#fff' }}>
                  {isTwoPageMode ? '📖 양면' : '📖 단면'}
                </span>
              </h3>
              <div className="text-[10px] text-slate-400 flex align-center gap-2 mt-0.5" style={{ lineHeight: 1 }}>
                <span style={{ color: '#38bdf8' }}>진행률 {pct}%</span>
                <span>• 방향키 넘기기</span>
              </div>
            </div>
          </div>

          <div className="flex align-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
            <button onClick={() => changePage(currentPage - step)} disabled={currentPage <= 1 || pageRendering}
              style={{ opacity: currentPage <= 1 ? 0.4 : 1, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px' }}>
              <ChevronLeft size={18} />
            </button>
            <div className="flex align-center gap-1 text-[11px] font-bold px-1.5">
              <span style={{ color: '#38bdf8', fontSize: '12px' }}>
                {isTwoPageMode ? `${currentPage}-${Math.min(totalPages, currentPage + 1)}` : currentPage}
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{totalPages}</span>
            </div>
            <button onClick={() => changePage(currentPage + step)} disabled={currentPage >= totalPages || pageRendering}
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex align-center gap-2" style={{ flexShrink: 0 }}>
            <button onClick={toggleTwoPageMode} title="단면/양면 전환"
              style={{
                backgroundColor: isTwoPageMode ? '#0284c7' : '#334155', color: '#fff',
                border: '1px solid #475569', padding: '0.3rem 0.5rem', borderRadius: '5px',
                display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}>
              {isTwoPageMode ? <Columns size={13} /> : <Square size={13} />}
              <span>{isTwoPageMode ? '양면 보기' : '단면 보기'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '2px 6px', borderRadius: '5px', border: '1px solid #334155' }}>
               <button onClick={() => setZoomScale(Math.max(60, zoomScale - 15))}
                 style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '1px' }}>
                 <ZoomOut size={13} />
               </button>
               <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1', minWidth: '34px', textAlign: 'center' }}>{zoomScale}%</span>
               <button onClick={() => setZoomScale(Math.min(220, zoomScale + 15))}
                 style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '1px' }}>
                 <ZoomIn size={13} />
               </button>
               <button onClick={() => setZoomScale(100)} title="화면 맞춤"
                 style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '1px', marginLeft: '2px' }}>
                 <RotateCcw size={11} />
               </button>
            </div>

            <button onClick={() => setShowNotes(!showNotes)}
              style={{
                backgroundColor: showNotes ? '#0284c7' : '#334155', color: '#fff', border: 'none',
                padding: '0.3rem 0.5rem', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '4px',
                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              <FileText size={13} />
              {showNotes ? '메모 닫기' : '메모장'}
            </button>

            <button onClick={onClose} title="닫기 (ESC)"
              style={{
                backgroundColor: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
              }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 프로그레스 바 */}
        <div style={{ height: '3px', backgroundColor: '#1e293b', width: '100%' }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#0284c7', transition: 'width 0.3s ease' }} />
        </div>

        {/* 본문 뷰포트 (완벽 제어 Canvas 엔진) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* 중앙 Canvas (스크롤 가능 래퍼) */}
          <div ref={containerRef} 
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUpOrLeave} onMouseLeave={onMouseUpOrLeave}
            style={{
            flex: 1, height: '100%', backgroundColor: '#020617', display: 'flex', flexDirection: 'column',
            overflow: 'auto', padding: '1rem', position: 'relative', cursor: 'grab', userSelect: 'none'
          }}>
            {loadingPdf ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '2rem' }}>
                <BookOpen size={48} style={{ color: '#0284c7', marginBottom: '0.75rem', margin: '0 auto' }} />
                <p style={{ fontWeight: 700, color: '#cbd5e1' }}>책 페이지를 로딩하는 중...</p>
              </div>
            ) : (
              <div style={{
                margin: 'auto', /* 플렉스 오버플로우 시 위쪽 짤림 방지 (Safe Centering) */
                backgroundColor: '#ffffff', borderRadius: '6px', position: 'relative', overflow: 'visible',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 'max-content'
              }}>
                <div ref={containerLeftRef} style={{ display: 'block', flexShrink: 0, backgroundColor: '#fff', opacity: pageRendering ? 0.7 : 1 }} />

                {isTwoPageMode && (
                  <div style={{
                    width: '10px', alignSelf: 'stretch', flexShrink: 0, zIndex: 5,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.18) 100%)'
                  }} />
                )}

                <div ref={containerRightRef} style={{ display: isTwoPageMode ? 'block' : 'none', flexShrink: 0, backgroundColor: '#fff', opacity: pageRendering ? 0.7 : 1 }} />
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
