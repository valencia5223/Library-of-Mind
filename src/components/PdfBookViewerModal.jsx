import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, FileText, CheckCircle2, Columns, Square, ZoomIn, ZoomOut, RotateCcw, Play, Pause } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PDFJS_CMAP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/';
const PDFJS_STANDARD_FONTS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [isTwoPageMode, setIsTwoPageMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoomScale, setZoomScale] = useState(100);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(2); // 1: 느림, 2: 보통, 3: 빠름
  const [textLines, setTextLines] = useState([]);
  const [lineIdx, setLineIdx] = useState(0);
  const [lineProgress, setLineProgress] = useState(0);

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
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (containerRef.current) {
          containerRef.current.scrollBy({ top: 140, behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (containerRef.current) {
          containerRef.current.scrollBy({ top: -140, behavior: 'smooth' });
        }
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
      setPdfError(null);
      if (!window.pdfjsLib) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = PDFJS_CDN;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        } catch (e) {
          if (isMounted) setPdfError('PDF.js 엔진 렌더러를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
          setLoadingPdf(false);
          return;
        }
      }
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      
      try {
        const doc = await window.pdfjsLib.getDocument({
          url: pdfData.url,
          cMapUrl: PDFJS_CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: PDFJS_STANDARD_FONTS_URL
        }).promise;
        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        const saved = localStorage.getItem(progressKey);
        if (saved) setCurrentPage(Math.min(doc.numPages, Math.max(1, parseInt(saved, 10) || 1)));
      } catch (err) {
        console.warn('PDF load error:', err);
        if (isMounted) {
          setPdfError('PDF 문서를 열 수 없습니다. (원인: 용량이 너무 크거나 파일 손상, 비밀번호 보안 설정 또는 외부 URL 접근 CORS 제한)');
        }
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
      
      // 양면 보기 시 글자가 가로 좁아짐으로 인해 흐려 보이는 것을 보정하는 1.15배 선명도 부스트
      const twoPageBoost = isTwoPageMode ? 1.15 : 1.0;
      const userZoomMultiplier = zoomScale / 100;
      const fitScale = (targetW / raw.width) * userZoomMultiplier * twoPageBoost;

      const viewport = page.getViewport({ scale: fitScale });

      try {
        // 1차 시도: 100% 벡터 품질 SVGGraphics 렌더링
        const opList = await page.getOperatorList();
        const svgG = new window.pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
        const svg = await svgG.getSVG(opList, viewport);

        svg.setAttribute('width', `${Math.floor(viewport.width)}px`);
        svg.setAttribute('height', `${Math.floor(viewport.height)}px`);
        svg.style.width = `${Math.floor(viewport.width)}px`;
        svg.style.height = `${Math.floor(viewport.height)}px`;
        svg.style.display = 'block';

        containerEl.innerHTML = '';
        containerEl.appendChild(svg);
      } catch (svgErr) {
        console.warn('SVGGraphics render failed for image/complex page, fallback to Canvas:', svgErr);
        // 2차 시0 (Fallback): 표지/고용량 이미지 페이지 전용 고해상도 Canvas 렌더링
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = Math.max(2.5, window.devicePixelRatio || 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.display = 'block';

        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;

        containerEl.innerHTML = '';
        containerEl.appendChild(canvas);
      }
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
        // 렌더링 후 SVG 텍스트 행(Line) 좌표 스캔
        setTimeout(() => {
          if (!alive) return;
          scanSvgTextLines();
        }, 150);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') console.warn('Render error:', err);
      } finally {
        if (alive) setPageRendering(false);
      }
    };

    const scanSvgTextLines = () => {
      const containerLeft = containerLeftRef.current;
      const containerRight = containerRightRef.current;
      const mainContainer = containerRef.current;
      if (!containerLeft || !mainContainer) return;

      const getLinesFromEl = (el) => {
        if (!el) return [];
        const svg = el.querySelector('svg');
        if (!svg) return [];

        const mainRect = mainContainer.getBoundingClientRect();
        const textEls = Array.from(svg.querySelectorAll('text, tspan'));
        const lineMap = new Map();

        textEls.forEach((t) => {
          const rect = t.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const top = rect.top - mainRect.top + mainContainer.scrollTop;
          const left = rect.left - mainRect.left + mainContainer.scrollLeft;
          const roundedY = Math.round(top / 16) * 16; // 16px 단위 Y축 행 그룹화

          if (!lineMap.has(roundedY)) {
            lineMap.set(roundedY, {
              top: top - 2,
              minX: left,
              maxX: left + rect.width,
              height: Math.max(22, rect.height + 4)
            });
          } else {
            const existing = lineMap.get(roundedY);
            existing.minX = Math.min(existing.minX, left);
            existing.maxX = Math.max(existing.maxX, left + rect.width);
            existing.height = Math.max(existing.height, rect.height + 4);
          }
        });

        return Array.from(lineMap.values()).sort((a, b) => a.top - b.top);
      };

      const leftLines = getLinesFromEl(containerLeft);
      const rightLines = getLinesFromEl(containerRight);
      // 양면 보기일 경우 반드시 왼쪽 페이지 완독 후 오른쪽 페이지 순서로 읽기 수행
      const allLines = isTwoPageMode ? [...leftLines, ...rightLines] : leftLines;

      setTextLines(allLines);
      setLineIdx(0);
      setLineProgress(0);
    };

    renderAll();
    return () => { alive = false; };
  }, [pdfDoc, currentPage, zoomScale, isTwoPageMode, totalPages]);

  // ★ 텍스트 기반 좌 ➔ 우 형광펜 긋기 (Sweep Highlighting) 타이머 엔진 ★
  useEffect(() => {
    if (!isAutoPlay || textLines.length === 0 || !containerRef.current) return;

    // 1x(느림): 한 줄당 약 3.3초 동안 그윽하고 천천히 이동
    // 2x(보통): 한 줄당 약 1.2초
    // 3x(빠름): 한 줄당 약 0.5초
    const speedStepMap = { 1: 1.2, 2: 3.5, 3: 8.0 };
    const stepPct = speedStepMap[autoSpeed] || 1.2;

    const timer = setInterval(() => {
      setLineProgress((prev) => {
        const nextPct = prev + stepPct;

        if (nextPct >= 100) {
          setLineIdx((curIdx) => {
            const nextIdx = curIdx + 1;

            if (nextIdx >= textLines.length) {
              // 해당 페이지의 모든 줄 칠하기 완료 -> 다음 페이지로 자동 이동!
              const cur = currentPageRef.current;
              const total = totalPagesRef.current;
              const step = isTwoPageModeRef.current ? 2 : 1;

              if (cur + step <= total) {
                changePage(cur + step);
                if (containerRef.current) containerRef.current.scrollTop = 0;
              } else {
                setIsAutoPlay(false);
              }
              return 0;
            }

            // 다음 줄로 이동 시 뷰포트 수직 스크롤 자동 동기화
            const nextLine = textLines[nextIdx];
            if (nextLine && containerRef.current) {
              const container = containerRef.current;
              const targetY = nextLine.top - container.clientHeight * 0.4;
              if (targetY > container.scrollTop) {
                container.scrollTo({ top: targetY, behavior: 'smooth' });
              }
            }
            return nextIdx;
          });
          return 0;
        }
        return nextPct;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [isAutoPlay, textLines, autoSpeed, changePage]);

  const toggleTwoPageMode = () => {
    const next = !isTwoPageMode;
    setIsTwoPageMode(next);
    localStorage.setItem(modeKey, next.toString());
  };

  const handleNotesChange = (t) => { setNotes(t); localStorage.setItem(notesKey, t); };
  const pct = Math.min(100, Math.round((currentPage / (totalPages || 1)) * 100));
  const step = isTwoPageMode ? 2 : 1;

  return (
    <div className="modal-overlay modal-backdrop" style={{ zIndex: 100000 }}>
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

            {/* 자동 읽기 (형광펜 가이드 스크롤) 컨트롤 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: isAutoPlay ? '#0284c7' : '#334155', borderRadius: '5px', padding: '2px 6px', border: '1px solid #475569' }}>
              <button onClick={() => setIsAutoPlay(!isAutoPlay)} title={isAutoPlay ? "일시정지" : "자동 읽기 시작"}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                {isAutoPlay ? <Pause size={13} /> : <Play size={13} />}
                <span>{isAutoPlay ? '일시정지' : '자동읽기'}</span>
              </button>
              {isAutoPlay && (
                <select value={autoSpeed} onChange={(e) => setAutoSpeed(Number(e.target.value))}
                  style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: 'none', borderRadius: '3px', fontSize: '0.7rem', padding: '1px 3px', cursor: 'pointer' }}>
                  <option value={1}>1x (느림)</option>
                  <option value={2}>2x (보통)</option>
                  <option value={3}>3x (빠름)</option>
                </select>
              )}
            </div>

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
            {/* 텍스트 파싱 기반 좌 ➔ 우 실시간 형광펜 긋기 오버레이 */}
            {isAutoPlay && textLines[lineIdx] && (
              <div style={{
                position: 'absolute',
                top: `${textLines[lineIdx].top}px`,
                left: `${textLines[lineIdx].minX}px`,
                width: `${Math.max(10, (textLines[lineIdx].maxX - textLines[lineIdx].minX) * (lineProgress / 100))}px`,
                height: `${textLines[lineIdx].height}px`,
                backgroundColor: 'rgba(250, 204, 21, 0.42)',
                borderBottom: '2.5px solid rgba(234, 179, 8, 0.95)',
                borderRadius: '4px',
                pointerEvents: 'none',
                transition: 'width 0.05s linear',
                zIndex: 30,
                boxShadow: '0 0 14px rgba(250, 204, 21, 0.6)'
              }} />
            )}
            {pdfError ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '2.5rem', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #ef4444', maxWidth: '520px' }}>
                <FileText size={48} style={{ color: '#ef4444', marginBottom: '1rem', margin: '0 auto' }} />
                <h4 style={{ fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>PDF 문서를 불러올 수 없습니다</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.25rem' }}>{pdfError}</p>
                <button onClick={onClose} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                  뷰어 닫기
                </button>
              </div>
            ) : loadingPdf ? (
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
