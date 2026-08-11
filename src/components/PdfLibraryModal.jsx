import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, BookOpen, Trash2, Plus, Clock, HardDrive, Eye } from 'lucide-react';
import PdfBookViewerModal from './PdfBookViewerModal';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

import { openPdfIDB, savePdfBlobToIDB, getPdfBlobFromIDB, deletePdfBlobFromIDB, getFreshPdfUrl } from '../utils/pdfStorage';

const STORAGE_KEY = 'standalone_pdf_library_v1';

export default function PdfLibraryModal({ onClose }) {
  const [pdfList, setPdfList] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadPdfList();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (!selectedPdf) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPdf, onClose]);

  const loadPdfList = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPdfList(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('PDF 목록 로드 경고:', e);
    }
  };

  const savePdfList = (newList) => {
    setPdfList(newList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
  };

  const handleOpenPdf = async (item) => {
    if (item.url && item.url.startsWith('http') && !item.url.startsWith('blob:')) {
      setSelectedPdf(item);
      return;
    }

    const storedBlob = await getPdfBlobFromIDB(item.id);
    if (storedBlob) {
      const freshUrl = URL.createObjectURL(storedBlob);
      setSelectedPdf({ ...item, url: freshUrl });
      return;
    }

    if (item.url) {
      setSelectedPdf(item);
    } else {
      alert('⚠️ 저장된 PDF 파일 데이터를 찾을 수 없습니다. 다시 등록해 주세요.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 첨부할 수 있습니다.');
      return;
    }

    setIsUploading(true);
    try {
      const pdfId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      // IndexedDB에 바이너리 파일 영구 저장
      await savePdfBlobToIDB(pdfId, file);

      const localObjectUrl = URL.createObjectURL(file);
      const newPdfItem = {
        id: pdfId,
        title: file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        url: localObjectUrl,
        hasIdbBlob: true,
        currentPage: 1,
        totalPages: 100,
        createdAt: new Date().toISOString()
      };

      const updatedList = [newPdfItem, ...pdfList];
      savePdfList(updatedList);

      // Supabase Storage 업로드 시도 (버킷 구성 시)
      if (isSupabaseConfigured()) {
        const filePath = `standalone_pdfs/${newPdfItem.id}.pdf`;
        supabase.storage.from('book-pdfs').upload(filePath, file).then(({ data, error }) => {
          if (!error && data) {
            const publicUrl = supabase.storage.from('book-pdfs').getPublicUrl(filePath).data.publicUrl;
            const finalizedList = updatedList.map(item =>
              item.id === newPdfItem.id ? { ...item, url: publicUrl } : item
            );
            savePdfList(finalizedList);
          }
        }).catch(() => {});
      }
    } catch (err) {
      alert('PDF 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePdf = async (id, title) => {
    if (window.confirm(`'${title}' PDF 문서를 삭제하시겠습니까?`)) {
      await deletePdfBlobFromIDB(id);
      const filtered = pdfList.filter(item => item.id !== id);
      savePdfList(filtered);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }}>
      <div
        className="modal-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '850px',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 1.75rem',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.85rem',
            marginBottom: '1rem',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                PDF 전자책 보관함
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                원하는 PDF 문서를 등록하고 내장 E-Book 뷰어로 읽어보세요.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#0284c7',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={15} />
              <span>{isUploading ? '업로드 중...' : '신규 PDF 등록'}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
            </label>

            <button
              onClick={onClose}
              title="닫기 (ESC)"
              style={{
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
                flexShrink: 0
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* PDF 문서 목록 콘텐츠 영역 (무조건 1행 1카드 세로 스택) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {pdfList.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                margin: '1rem 0',
                backgroundColor: '#f8fafc'
              }}
            >
              <FileText size={38} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8', display: 'block' }} />
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
                보관된 PDF 문서가 없습니다
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                우측 상단의 <b style={{ color: '#0284c7' }}>[+ 신규 PDF 등록]</b> 버튼을 눌러 PDF 파일을 첨부해보세요.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {pdfList.map((item) => {
                const progressPercent = Math.min(100, Math.round(((item.currentPage || 1) / (item.totalPages || 1)) * 100));

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* 좌측: 파일 아이콘 & 긴 파일 제목 및 메타 정보 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={20} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: '0.925rem',
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%'
                          }}
                          title={item.fileName}
                        >
                          {item.title}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#64748b', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500 }}><HardDrive size={11} style={{ display: 'inline', marginRight: '2px' }} /> {item.fileSize}</span>
                          <span>•</span>
                          <span><Clock size={11} style={{ display: 'inline', marginRight: '2px' }} /> {new Date(item.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>읽은 위치: <b style={{ color: '#0f172a' }}>{item.currentPage || 1}p</b></span>
                          <span style={{ fontWeight: 600, color: '#0284c7' }}>({progressPercent}% 완료)</span>
                        </div>
                      </div>
                    </div>

                    {/* 우측: 뷰어로 열기 및 삭제 버튼 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleOpenPdf(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#0284c7',
                          border: 'none',
                          color: '#ffffff',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '7px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <BookOpen size={14} /> E-Book 뷰어로 열기
                      </button>

                      <button
                        onClick={() => handleDeletePdf(item.id, item.title)}
                        title="삭제"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 내장 PDF 전자책 뷰어 모달 연결 */}
      {selectedPdf && (
        <PdfBookViewerModal
          book={{ id: selectedPdf.id, title: selectedPdf.title, author: '독립 PDF 문서' }}
          pdfData={selectedPdf}
          onClose={() => setSelectedPdf(null)}
          onProgressUpdate={(page, total) => {
            const updatedList = pdfList.map(item =>
              item.id === selectedPdf.id ? { ...item, currentPage: page, totalPages: total } : item
            );
            savePdfList(updatedList);
            setSelectedPdf(prev => prev ? { ...prev, currentPage: page, totalPages: total } : null);
          }}
        />
      )}
    </div>
  );
}
