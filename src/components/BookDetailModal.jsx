import React, { useState, useEffect } from 'react';
import { ExternalLink, Plus, RefreshCw, Trash2, X, BookOpen, Layers, FileText, Upload, Eye } from 'lucide-react';
import PdfBookViewerModal from './PdfBookViewerModal';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

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

export default function BookDetailModal({
  book,
  onClose,
  description = '',
  toc = '',
  loadingDesc = false,
  onAddBook,
  onDeleteBook,
  onSyncInfo,
  isAlreadyInShelf = false,
  syncing = false
}) {
  if (!book) return null;

  const [pdfData, setPdfData] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const pdfStorageKey = `book_pdf_meta_${book.id || book.isbn || 'demo'}`;

  useEffect(() => {
    try {
      const savedPdf = localStorage.getItem(pdfStorageKey);
      if (savedPdf) {
        setPdfData(JSON.parse(savedPdf));
      }
    } catch (e) {}
  }, [book, pdfStorageKey]);

  const handlePdfUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 첨부할 수 있습니다.');
      return;
    }

    setIsUploading(true);
    try {
      const localObjectUrl = URL.createObjectURL(file);
      const newPdfData = {
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        url: localObjectUrl,
        currentPage: 1,
        totalPages: 100,
        uploadedAt: new Date().toISOString()
      };

      setPdfData(newPdfData);
      localStorage.setItem(pdfStorageKey, JSON.stringify(newPdfData));

      // Supabase Storage 업로드 시도 (버킷 생성 시)
      if (isSupabaseConfigured() && book.id) {
        const filePath = `user_pdfs/${book.id}_${Date.now()}.pdf`;
        supabase.storage.from('book-pdfs').upload(filePath, file).then(({ data, error }) => {
          if (!error && data) {
            const publicUrl = supabase.storage.from('book-pdfs').getPublicUrl(filePath).data.publicUrl;
            const updated = { ...newPdfData, url: publicUrl };
            setPdfData(updated);
            localStorage.setItem(pdfStorageKey, JSON.stringify(updated));
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('PDF 업로드 처리 경고:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePdf = () => {
    if (window.confirm('첨부된 PDF 파일을 제거하시겠습니까?')) {
      setPdfData(null);
      localStorage.removeItem(pdfStorageKey);
    }
  };

  const info = parseAuthorAndTranslator(book.author);
  const buyLink = book.buy_link || book.link || (book.title ? `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${encodeURIComponent(book.title)}` : null);

  return (
    <div className="modal-overlay" style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} onClick={onClose}>
      <div
        className="modal-card book-detail-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '850px',
          width: '92vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* 모달 닫기 버튼 */}
        <button
          className="modal-close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={18} />
        </button>

        {/* 그리드 본문 컨테이너 */}
        <div
          className="detail-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 200px) 1fr',
            gap: '1.5rem',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: '4px'
          }}
        >
          {/* 좌측: 도서 표지 및 가격 */}
          <div className="detail-cover-side" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={book.cover_url || book.cover}
              alt={book.title}
              referrerPolicy="no-referrer"
              className="detail-cover"
              style={{
                width: '100%',
                maxHeight: '270px',
                objectFit: 'cover',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            />
            {book.price && (
              <div className="mt-3 text-center" style={{ width: '100%' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '100%',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.6rem',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}
                >
                  판매가: {book.price}
                </span>
              </div>
            )}

            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm mt-3 w-100 flex align-center justify-center gap-1"
                style={{
                  fontSize: '0.82rem',
                  padding: '0.45rem',
                  borderRadius: '8px',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={14} /> 알라딘 구매 페이지
              </a>
            )}
          </div>

          {/* 우측: 메타 정보 뱃지 및 설명 / 목차 */}
          <div className="detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* 도서 제목 */}
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.35, marginBottom: '0.5rem' }}>
                {book.title}
              </h3>

              {/* 뱃지 태그 메타 정보 (가로 단일 flex wrap) */}
              <div className="book-meta-badges flex flex-wrap gap-2" style={{ fontSize: '0.85rem' }}>
                <span style={{ background: '#f1f5f9', color: '#334155', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                  ✍️ <b>지은이:</b> {info.author}
                </span>
                {info.translator && (
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                    🌐 <b>옮긴이:</b> {info.translator}
                  </span>
                )}
                {book.publisher && (
                  <span style={{ background: '#f1f5f9', color: '#334155', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                    🏢 <b>출판사:</b> {book.publisher}
                  </span>
                )}
                {book.pub_date && (
                  <span style={{ background: '#f1f5f9', color: '#334155', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                    📅 <b>출간일:</b> {book.pub_date}
                  </span>
                )}
                {(book.total_pages || book.itemPage) && (
                  <span style={{ background: '#ecfdf5', color: '#047857', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                    📄 <b>분량:</b> {book.total_pages || book.itemPage}쪽
                  </span>
                )}
              </div>
            </div>

            {/* 도서 상세 소개 박스 (시원하게 확장된 칼럼) */}
            <div
              className="review-section"
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: '340px'
              }}
            >
              <h4 className="flex align-center gap-1 mb-3" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary, #0078a6)' }}>
                <BookOpen size={18} /> 도서 상세 소개
              </h4>
              <div
                className="desc-text"
                style={{
                  fontSize: '0.96rem',
                  color: '#334155',
                  lineHeight: 1.8,
                  whiteSpace: 'pre-line',
                  maxHeight: '480px',
                  overflowY: 'auto',
                  paddingRight: '6px',
                  flex: 1
                }}
              >
                {loadingDesc ? (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>알라딘 API에서 도서 상세 소개를 불러오는 중입니다...</span>
                ) : (
                  description || book.description || '등록된 도서 소개 정보가 없습니다.'
                )}
              </div>
            </div>

            {/* 목차 (TOC) 섹션 */}
            {toc && (
              <div
                className="toc-section"
                style={{
                  background: '#fffbe3',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  border: '1px solid #fef08a'
                }}
              >
                <h4 className="flex align-center gap-1 mb-2" style={{ fontSize: '0.98rem', fontWeight: 700, color: '#854d0e' }}>
                  <Layers size={17} /> 목차 (Table of Contents)
                </h4>
                <div
                  className="toc-text"
                  style={{
                    fontSize: '0.9rem',
                    color: '#713f12',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-line',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '6px'
                  }}
                >
                  {toc}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 푸터 버튼 영역 */}
        <div
          className="mt-4 pt-3 flex justify-between align-center flex-wrap gap-2"
          style={{ borderTop: '1px solid #e2e8f0', background: '#fff', paddingTop: '1rem' }}
        >
          <div className="flex align-center gap-2 flex-wrap">
            {onAddBook && (
              <button
                className={`btn btn-sm font-bold flex align-center gap-1 ${isAlreadyInShelf ? 'btn-secondary' : 'btn-primary'}`}
                disabled={isAlreadyInShelf}
                onClick={() => onAddBook(book)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}
              >
                <Plus size={16} /> {isAlreadyInShelf ? '이미 서재에 있음' : '내 서재에 추가하기'}
              </button>
            )}

            {/* PDF 전자책 열기 / 첨부 섹션 */}
            {pdfData ? (
              <div className="flex align-center gap-1.5">
                <button
                  className="btn btn-primary btn-sm font-bold flex align-center gap-1.5"
                  onClick={() => setShowPdfViewer(true)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <BookOpen size={16} />
                  <span>📖 PDF 전자책 읽기</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    {pdfData.currentPage || 1}p
                  </span>
                </button>
                <button
                  className="btn btn-outline btn-sm text-xs"
                  onClick={handleRemovePdf}
                  title="첨부된 PDF 제거"
                  style={{ padding: '0.5rem', borderRadius: '8px', color: '#94a3b8', borderColor: '#e2e8f0' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                className="btn btn-outline btn-sm font-bold flex align-center gap-1.5 cursor-pointer"
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  backgroundColor: '#f0f9ff'
                }}
              >
                <Upload size={15} />
                <span>{isUploading ? '업로드 중...' : '📄 PDF 도서 첨부'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            {onDeleteBook && (
              <button
                className="btn btn-danger btn-sm font-bold flex align-center gap-1"
                onClick={() => onDeleteBook(book.id)}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px' }}
              >
                <Trash2 size={15} /> 서재에서 삭제
              </button>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 600 }}
          >
            확인 닫기
          </button>
        </div>

        {/* 내장 PDF 전자책 뷰어 모달 */}
        {showPdfViewer && pdfData && (
          <PdfBookViewerModal
            book={book}
            pdfData={pdfData}
            onClose={() => setShowPdfViewer(false)}
            onProgressUpdate={(page, total) => {
              const updated = { ...pdfData, currentPage: page, totalPages: total };
              setPdfData(updated);
              localStorage.setItem(pdfStorageKey, JSON.stringify(updated));
            }}
          />
        )}
      </div>
    </div>
  );
}
