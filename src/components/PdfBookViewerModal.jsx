import React, { useState, useEffect } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, FileText, CheckCircle2, Save, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export default function PdfBookViewerModal({ book, pdfData, onClose, onProgressUpdate }) {
  if (!book || !pdfData) return null;

  const [currentPage, setCurrentPage] = useState(pdfData.currentPage || 1);
  const [totalPages, setTotalPages] = useState(pdfData.totalPages || 1);
  const [zoomScale, setZoomScale] = useState(100);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const progressKey = `book_pdf_progress_${book.id || book.isbn || 'demo'}`;
  const notesKey = `book_pdf_notes_${book.id || book.isbn || 'demo'}`;

  useEffect(() => {
    // 로컬 저장소 진행 위치 및 메모 로드
    try {
      const savedPage = localStorage.getItem(progressKey);
      if (savedPage) {
        setCurrentPage(parseInt(savedPage, 10) || 1);
      }
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) {
        setNotes(savedNotes);
      }
    } catch (e) {}

    // ESC 키로 모달 닫기
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [book, progressKey, notesKey, onClose]);

  // 페이지 및 메모 변경 시 실시간 보존
  const handlePageChange = (newPage) => {
    const pageNum = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(pageNum);
    localStorage.setItem(progressKey, pageNum.toString());

    if (onProgressUpdate) {
      onProgressUpdate(pageNum, totalPages);
    }

    // DB 동기화 시도
    if (isSupabaseConfigured() && book.id) {
      supabase.from('book_pdfs').upsert({
        book_id: book.id,
        current_page: pageNum,
        total_pages: totalPages,
        updated_at: new Date().toISOString()
      }).catch(err => console.warn('PDF 진행률 DB 저장 경고:', err));
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
          maxWidth: showNotes ? '1400px' : '1100px',
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
        {/* 상단 통합 컨트롤 툴바 */}
        <div
          className="pdf-toolbar"
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* 도서 타이틀 정보 */}
          <div className="flex align-center gap-3">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex align-center gap-2" style={{ margin: 0 }}>
                {book.title || 'PDF 전자책'}
                <span className="text-xs px-2 py-0.5 rounded font-normal" style={{ backgroundColor: '#334155', color: '#94a3b8' }}>
                  {pdfData.fileName || 'document.pdf'}
                </span>
              </h3>
              <div className="text-xs text-slate-400 flex align-center gap-2 mt-0.5">
                <span>{book.author || '저자 미상'}</span>
                <span>•</span>
                <span style={{ color: '#38bdf8' }}>진행률 {progressPercent}%</span>
              </div>
            </div>
          </div>

          {/* 페이지 컨트롤러 */}
          <div className="flex align-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              title="이전 페이지"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex align-center gap-1 text-xs font-bold px-1">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => handlePageChange(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: '45px',
                  textAlign: 'center',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '0.85rem'
                }}
              />
              <span className="text-slate-400">/</span>
              <input
                type="number"
                min={1}
                value={totalPages}
                onChange={(e) => setTotalPages(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{
                  width: '45px',
                  textAlign: 'center',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '0.85rem'
                }}
                title="총 페이지수 수정"
              />
              <span className="text-slate-400 font-normal ml-1">p</span>
            </div>
            <button
              className="btn btn-icon btn-sm text-slate-300 hover:text-white"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              title="다음 페이지"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Zoom 및 스플릿 메모 제어 */}
          <div className="flex align-center gap-2">
            <div className="flex align-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
              <button
                className="btn btn-icon btn-xs text-slate-300 hover:text-white"
                onClick={() => setZoomScale(Math.max(50, zoomScale - 10))}
                title="축소"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-bold px-1 text-slate-300" style={{ minWidth: '40px', textAlign: 'center' }}>
                {zoomScale}%
              </span>
              <button
                className="btn btn-icon btn-xs text-slate-300 hover:text-white"
                onClick={() => setZoomScale(Math.min(200, zoomScale + 10))}
                title="확대"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              className={`btn btn-sm font-bold flex align-center gap-1.5 ${showNotes ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowNotes(!showNotes)}
              style={{
                backgroundColor: showNotes ? '#2563eb' : '#334155',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px'
              }}
            >
              <FileText size={15} />
              {showNotes ? '독서 메모 닫기' : '독서 메모장'}
            </button>

            {pdfData.url && (
              <a
                href={pdfData.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary text-slate-300 hover:text-white flex align-center gap-1"
                title="새 탭에서 PDF 열기"
                style={{ padding: '0.4rem 0.6rem', backgroundColor: '#334155', border: 'none' }}
              >
                <ExternalLink size={15} />
              </a>
            )}

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

        {/* 상단 독서 진행률 프로그레스 바 */}
        <div style={{ height: '4px', backgroundColor: '#1e293b', width: '100%' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {/* 메인 뷰어 뷰포트 (좌측 PDF + 우측 스플릿 메모장) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* PDF 메인 프레임 */}
          <div
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: '#020617',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: '1rem'
            }}
          >
            <div
              style={{
                width: `${zoomScale}%`,
                height: '100%',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.2s ease'
              }}
            >
              {pdfData.url ? (
                <iframe
                  src={`${pdfData.url}#page=${currentPage}`}
                  title={book.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff'
                  }}
                />
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <FileText size={48} className="mx-auto mb-3 text-slate-600" />
                  <p className="font-bold text-lg text-slate-300">PDF 파일 미리보기 준비 완료</p>
                  <p className="text-xs mt-1 text-slate-500">첨부된 PDF 파일을 연동하여 읽는 중입니다.</p>
                </div>
              )}
            </div>
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
                boxShadow: '-10px 0 25px rgba(0,0,0,0.3)'
              }}
            >
              <div className="flex align-center justify-between mb-3 pb-2 border-b border-slate-700">
                <h4 className="font-bold text-sm text-slate-200 flex align-center gap-1.5" style={{ margin: 0 }}>
                  <FileText size={16} className="text-blue-400" />
                  독서 메모장
                </h4>
                <span className="text-xs text-slate-400">{currentPage}p 읽는 중</span>
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
