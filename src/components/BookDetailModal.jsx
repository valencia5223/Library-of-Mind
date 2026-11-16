import React, { useState, useEffect } from 'react';
import { ExternalLink, Plus, RefreshCw, Trash2, X, BookOpen, Layers, FileText, Upload, Eye } from 'lucide-react';
import PdfBookViewerModal from './PdfBookViewerModal';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { findBookDetail, yes24SearchUrl } from '../utils/yes24';
import { savePdfBlobToIDB, getFreshPdfUrl, deletePdfBlobFromIDB } from '../utils/pdfStorage';

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
  const [realPageCount, setRealPageCount] = useState(book.total_pages || book.itemPage || 0);

  const pdfStorageKey = `book_pdf_meta_${book.id || book.isbn || 'demo'}`;

  // 모달을 열 때 쪽수가 없으면 예스24 상세에서 실제 쪽수를 받아 보여 준다
  useEffect(() => {
    let isMounted = true;
    if (!book.total_pages && (book.isbn || book.title)) {
      findBookDetail(book).then((d) => {
        if (isMounted && d?.total_pages) {
          setRealPageCount(d.total_pages);
          book.total_pages = d.total_pages; // 서재에 담을 때 같은 값을 쓰도록
        }
      });
    }
    return () => { isMounted = false; };
  }, [book]);

  useEffect(() => {
    let isMounted = true;
    const restorePdf = async () => {
      try {
        const savedPdf = localStorage.getItem(pdfStorageKey);
        if (savedPdf) {
          const parsed = JSON.parse(savedPdf);
          const freshUrl = await getFreshPdfUrl(parsed);
          if (isMounted) {
            setPdfData({ ...parsed, url: freshUrl || parsed.url });
          }
        }
      } catch (e) {}
    };
    restorePdf();
    return () => { isMounted = false; };
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
      const pdfId = `pdf_book_${book.id || 'demo'}_${Date.now()}`;
      // IndexedDB에 바이너리 파일 영구 저장 (브라우저 새로고침/재부팅 후에도 100% 지속 보장)
      await savePdfBlobToIDB(pdfId, file);

      const localObjectUrl = URL.createObjectURL(file);
      const newPdfData = {
        id: pdfId,
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

  const handleRemovePdf = async () => {
    if (window.confirm('첨부된 PDF 파일을 제거하시겠습니까?')) {
      if (pdfData && pdfData.id) {
        await deletePdfBlobFromIDB(pdfData.id);
      }
      setPdfData(null);
      localStorage.removeItem(pdfStorageKey);
    }
  };

  const info = parseAuthorAndTranslator(book.author);
  const buyLink = book.buy_link || book.link || (book.title ? yes24SearchUrl(book.title) : null);

  return (
    <div className="modal-overlay" style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div
        className="modal-card book-detail-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '850px',
          width: '92vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 모달 닫기 버튼 */}
        <button type="button" className="modal-close book-detail-close" onClick={onClose} aria-label="닫기">
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
            />
            {book.price && (
              <div className="detail-price">판매가 {book.price}</div>
            )}

            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm detail-buy-btn"
              >
                <ExternalLink size={14} /> 예스24 구매 페이지
              </a>
            )}
          </div>

          {/* 우측: 메타 정보 뱃지 및 설명 / 목차 */}
          <div className="detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* 도서 제목 */}
            <div>
              <h3 className="detail-title">
                {book.title}
              </h3>

              {/* 뱃지 태그 메타 정보 (가로 단일 flex wrap) */}
              <div className="book-meta-badges">
                <span className="meta-chip">
                  ✍️ <b>지은이:</b> {info.author}
                </span>
                {info.translator && (
                  <span className="meta-chip">
                    🌐 <b>옮긴이:</b> {info.translator}
                  </span>
                )}
                {book.publisher && (
                  <span className="meta-chip">
                    🏢 <b>출판사:</b> {book.publisher}
                  </span>
                )}
                {book.pub_date && (
                  <span className="meta-chip">
                    📅 <b>출간일:</b> {book.pub_date}
                  </span>
                )}
                {(realPageCount || book.total_pages || book.itemPage) && (
                  <span className="meta-chip meta-chip-accent">
                    📄 <b>분량:</b> {realPageCount || book.total_pages || book.itemPage}쪽
                  </span>
                )}
              </div>
            </div>

            {/* 도서 상세 소개 박스 (시원하게 확장된 칼럼) */}
            <div className="review-section detail-section">
              <h4 className="detail-section-title">
                <BookOpen size={18} /> 도서 상세 소개
              </h4>
              <div className="desc-text detail-desc">
                {loadingDesc ? (
                  <span className="detail-loading">예스24에서 도서 상세 소개를 불러오는 중입니다...</span>
                ) : (
                  description || book.description || '등록된 도서 소개 정보가 없습니다.'
                )}
              </div>
            </div>

            {/* 목차 (TOC) 섹션 */}
            {toc && (
              <div className="toc-section detail-section detail-toc">
                <h4 className="detail-section-title">
                  <Layers size={17} /> 목차
                </h4>
                <div className="toc-text detail-toc-text">
                  {toc}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 푸터 버튼 영역 */}
        <div className="detail-footer">
          <div className="flex align-center gap-2 flex-wrap">
            {onAddBook && (
              <button
                className={`btn btn-sm font-bold flex align-center gap-1 ${isAlreadyInShelf ? 'btn-secondary' : 'btn-primary'}`}
                disabled={isAlreadyInShelf}
                onClick={() => onAddBook(book)}
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
                >
                  <BookOpen size={16} />
                  <span>📖 PDF 전자책 읽기</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 20%, transparent)' }}>
                    {pdfData.currentPage || 1}p
                  </span>
                </button>
                <button
                  className="btn btn-outline btn-sm text-xs"
                  onClick={handleRemovePdf}
                  title="첨부된 PDF 제거"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="btn btn-secondary btn-sm cursor-pointer">
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
              >
                <Trash2 size={15} /> 서재에서 삭제
              </button>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            닫기
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
