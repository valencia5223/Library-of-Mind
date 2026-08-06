import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, FileText, CheckCircle2, Columns, Square, ZoomIn, ZoomOut, RotateCcw, Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
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
  const [fitMode, setFitMode] = useState('page'); // 'page': 한 화면 맞춤 (스크롤 0%), 'width': 가로 폭 맞춤
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(2); // 1: 느림, 2: 보통, 3: 빠름
  const [textLines, setTextLines] = useState([]);
  const [leftLinesCount, setLeftLinesCount] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [lineProgress, setLineProgress] = useState(0);

  const containerLeftRef = useRef(null);
  const containerRightRef = useRef(null);
  const containerRef = useRef(null);
  const modalCardRef = useRef(null);

  // 컨테이너 실제 크기 변화를 감지해서 렌더링을 다시 트리거하기 위한 값.
  // 모달이 열리는 트랜지션 도중(아직 최종 크기가 아닐 때) 최초 렌더가 발생하면
  // 그때의 작은 clientWidth/clientHeight 기준으로 배율이 고정되어 버려서
  // 이후 계속 작고 흐리게 보이는 문제가 생긴다. ResizeObserver로 이를 방지한다.
  const [resizeTick, setResizeTick] = useState(0);

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

  // 컨테이너 크기(모달 열림 트랜지션, 브라우저 창 크기 변경, 메모장 열고 닫기 등)가
  // 바뀔 때마다 재렌더링을 트리거한다. 짧은 디바운스를 걸어 드래그 중 과도한 재렌더를 막는다.
  useEffect(() => {
    if (!containerRef.current) return;
    let debounceTimer = null;
    const ro = new ResizeObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setResizeTick((t) => t + 1);
      }, 120);
    });
    ro.observe(containerRef.current);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      ro.disconnect();
    };
  }, []);

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
   * ★ pdf.js 공식 HiDPI 패턴 기반 Canvas 렌더링 ★
   * - viewport는 "CSS 표시 크기" 기준으로 딱 한 번만 계산한다.
   * - 실제 캔버스 픽셀 수는 CSS 크기 * devicePixelRatio(정수/실수 상관없이 곱셈 한 번)로만 결정한다.
   * - viewport를 두 번 따로 계산해서 각각 Math.floor()로 반올림하면
   *   두 값 사이에 미세한 배율 오차가 생기고, 그 오차가 브라우저의 축소 리샘플링과 겹치며
   *   텍스트 획이 이중으로 겹쳐 보이는(고스팅) 원인이 된다. → transform으로 캔버스 내부에서 스케일업.
   * - 인위적으로 dpr을 2.5배 등으로 부풀리지 않는다. 실제 devicePixelRatio만 사용해야
   *   정수 배율이 보장되어 오차가 없다.
   */
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let alive = true;

    const renderPage = async (page, containerEl) => {
      if (!containerEl) return;

      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth - (isTwoPageMode ? 24 : 16);
      const maxH = container.clientHeight - 12; // 상하 여백 12px 밀착 계산으로 수직 스크롤바 0% 완전 제거
      const pageGap = 12;
      const raw = page.getViewport({ scale: 1.0 });
      const targetW = isTwoPageMode ? (maxW - pageGap) / 2 : maxW;

      const userZoomMultiplier = zoomScale / 100;

      // 화면에 표시될 CSS 비례 배율 (CSS Pixel Scale)
      const scaleX = targetW / raw.width;
      const scaleY = maxH / raw.height;

      const fitScale = (fitMode === 'page' || isTwoPageMode)
        ? Math.min(scaleX, scaleY) * userZoomMultiplier
        : scaleX * userZoomMultiplier;

      // viewport는 "CSS 표시 크기" 기준으로 단 한 번만 계산한다 (이중 계산 금지)
      const viewport = page.getViewport({ scale: fitScale });

      // 실제 기기 배율을 기본으로 쓰되, 일반 모니터(devicePixelRatio=1)에서도
      // 최소 2배로 오버샘플링해서 텍스트 안티앨리어싱 품질을 높인다.
      // ※ 지난번엔 viewport를 두 번 따로 계산해서(floor 두 번) 이 배율을 올렸다가
      //   반올림 오차로 텍스트가 겹쳐 보이는 버그가 생겼었다.
      //   지금은 viewport를 한 번만 계산하고 transform으로 캔버스 내부에서만 확대하므로
      //   배율을 몇 배로 올리든 오차 없이 안전하게 선명해진다.
      const outputScale = Math.max(2, window.devicePixelRatio || 1);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });

      // 캔버스 실제 픽셀 수 = CSS 크기 * outputScale.
      // CSS 크기는 소수점을 반올림하지 않고 그대로 사용(브라우저는 subpixel CSS 크기를 정확히 지원),
      // 픽셀(canvas.width/height)만 반올림해서 오차를 최소 1곳에서만 발생시킨다.
      canvas.width = Math.round(viewport.width * outputScale);
      canvas.height = Math.round(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 축소 리샘플링 없이 transform으로 캔버스 내부에서 직접 확대해서 그린다
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      await page.render({
        canvasContext: ctx,
        transform,
        viewport
      }).promise;

      if (!alive) return;
      containerEl.innerHTML = '';
      containerEl.appendChild(canvas);
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
        // 렌더링 후 텍스트 행(Line) 좌표 스캔 (자동읽기 하이라이트용)
        setTimeout(() => {
          if (!alive) return;
          scanTextLines();
        }, 150);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') console.warn('Render error:', err);
      } finally {
        if (alive) setPageRendering(false);
      }
    };

    /**
     * 자동읽기 하이라이트를 위한 텍스트 라인 좌표 스캔.
     * getTextContent()의 아이템 좌표를 그대로 쓰지 않고, 실제 렌더된 캔버스 크기 대비
     * 스케일을 계산해서 컨테이너 기준 좌표로 변환한다. (canvas 렌더링에는 DOM text 레이어가 없으므로
     * page.getTextContent()를 이용해 좌표를 직접 계산해야 한다)
     */
    const scanTextLines = async () => {
      const containerLeft = containerLeftRef.current;
      const containerRight = containerRightRef.current;
      const mainContainer = containerRef.current;
      if (!containerLeft || !mainContainer) return;

      const getLinesFromPage = async (page, containerEl) => {
        if (!page || !containerEl) return [];
        const canvas = containerEl.querySelector('canvas');
        if (!canvas) return [];

        const mainRect = mainContainer.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const offsetTop = canvasRect.top - mainRect.top + mainContainer.scrollTop;
        const offsetLeft = canvasRect.left - mainRect.left + mainContainer.scrollLeft;

        const raw = page.getViewport({ scale: 1.0 });
        // CSS 표시 크기 기준 스케일 (canvas.style.width 기준)
        const cssScale = canvasRect.width / raw.width;
        const textViewport = page.getViewport({ scale: cssScale });

        const textContent = await page.getTextContent();
        const lineMap = new Map();

        textContent.items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const tx = window.pdfjsLib.Util.transform(textViewport.transform, item.transform);
          const x = tx[4];
          const y = tx[5];
          const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
          const width = item.width * cssScale;

          const top = offsetTop + (y - fontHeight);
          const left = offsetLeft + x;
          const roundedY = Math.round(top / 16) * 16;

          if (!lineMap.has(roundedY)) {
            lineMap.set(roundedY, {
              top: top - 2,
              minX: left,
              maxX: left + width,
              height: Math.max(22, fontHeight + 4)
            });
          } else {
            const existing = lineMap.get(roundedY);
            existing.minX = Math.min(existing.minX, left);
            existing.maxX = Math.max(existing.maxX, left + width);
            existing.height = Math.max(existing.height, fontHeight + 4);
          }
        });

        return Array.from(lineMap.values()).sort((a, b) => a.top - b.top);
      };

      try {
        const p1 = await pdfDoc.getPage(currentPage);
        const leftLines = await getLinesFromPage(p1, containerLeft);

        let rightLines = [];
        if (isTwoPageMode && currentPage + 1 <= totalPages) {
          const p2 = await pdfDoc.getPage(currentPage + 1);
          rightLines = await getLinesFromPage(p2, containerRight);
        }

        const allLines = isTwoPageMode ? [...leftLines, ...rightLines] : leftLines;

        setLeftLinesCount(leftLines.length);
        setTextLines(allLines);
        setLineIdx(0);
        setLineProgress(0);
      } catch (e) {
        console.warn('Text line scan failed:', e);
      }
    };

    renderAll();
    return () => { alive = false; };
  }, [pdfDoc, currentPage, zoomScale, isTwoPageMode, fitMode, totalPages, resizeTick]);

  // ★ 텍스트 기반 좌 ➔ 우 형광펜 긋기 (Sweep Highlighting) 타이머 엔진 ★
  useEffect(() => {
    if (!isAutoPlay || textLines.length === 0 || !containerRef.current) return;

    // 1x(느림): 한 줄당 약 6.6초 동안 매우 그윽하고 천천히 이동
    // 2x(보통): 한 줄당 약 2.5초 (이전 대비 2배 더 천천히 독서)
    // 3x(빠름): 한 줄당 약 1.0초
    const speedStepMap = { 1: 0.6, 2: 1.6, 3: 4.0 };
    const stepPct = speedStepMap[autoSpeed] || 1.6;

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

            // 양면 보기 시 왼쪽 페이지 완독 후 오른쪽 페이지 1번째 줄로 전환되는 순간 스크롤 최상단 리셋!
            if (isTwoPageModeRef.current && leftLinesCount > 0 && nextIdx === leftLinesCount) {
              if (containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
              }
              return nextIdx;
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
  }, [isAutoPlay, textLines, leftLinesCount, autoSpeed, changePage]);

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
          width: '98vw', maxWidth: showNotes ? '2000px' : '1900px', height: '92vh', maxHeight: '1100px',
          display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden',
          backgroundColor: '#0f172a', color: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', borderRadius: '12px',
          outline: 'none'
        }}
      >
        {/* 슬림 상단 툴바 (YES24 뷰어 스타일 46px - 진행률 짤림 완전 차단) */}
        <div style={{
          padding: '0.25rem 0.85rem', backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '0.5rem', height: '46px', flexShrink: 0
        }}>
          <div className="flex align-center gap-2.5">
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#0284c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <BookOpen size={16} className="text-white" />
            </div>
            <div className="flex align-center gap-2" style={{ lineHeight: 1.2 }}>
              <h3 className="font-bold text-xs text-white flex align-center gap-1.5" style={{ margin: 0 }}>
                {book.title || 'PDF 전자책'}
                <span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ backgroundColor: '#0284c7', color: '#fff' }}>
                  {isTwoPageMode ? '📖 양면' : '📖 단면'}
                </span>
              </h3>
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-[11px] font-bold" style={{ color: '#38bdf8' }}>진행률 {pct}%</span>
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-[10px] text-slate-400">방향키 스크롤</span>
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
            <button onClick={() => setFitMode(fitMode === 'page' ? 'width' : 'page')} title={fitMode === 'page' ? "가로 폭에 맞추기" : "한 화면에 딱 맞추기 (스크롤 없음)"}
              style={{
                backgroundColor: fitMode === 'page' ? '#0284c7' : '#334155', color: '#fff',
                border: '1px solid #475569', padding: '0.3rem 0.5rem', borderRadius: '5px',
                display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}>
              {fitMode === 'page' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{fitMode === 'page' ? '한 화면 맞춤' : '폭 맞춤'}</span>
            </button>

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
            overflow: (isTwoPageMode || fitMode === 'page') ? 'hidden' : 'auto', padding: '0.25rem 0.5rem', position: 'relative', cursor: 'grab', userSelect: 'none'
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
