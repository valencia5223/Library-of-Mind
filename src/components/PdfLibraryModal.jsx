import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, BookOpen, Trash2, Plus, Clock, HardDrive, Eye } from 'lucide-react';
import PdfBookViewerModal from './PdfBookViewerModal';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

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

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 첨부할 수 있습니다.');
      return;
    }

    setIsUploading(true);
    try {
      const localObjectUrl = URL.createObjectURL(file);
      const newPdfItem = {
        id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        url: localObjectUrl,
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

  const handleDeletePdf = (id, title) => {
    if (window.confirm(`'${title}' PDF 문서를 삭제하시겠습니까?`)) {
      const filtered = pdfList.filter(item => item.id !== id);
      savePdfList(filtered);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }} onClick={onClose}>
      <div
        className="modal-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '94%',
          maxWidth: '960px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          backgroundColor: '#ffffff'
        }}
      >
        {/* 모달 헤더 */}
        <div className="flex align-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex align-center gap-2.5">
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800" style={{ margin: 0 }}>
                📄 PDF 전자책 보관함
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                원하는 PDF 문서를 자유롭게 등록하고 내장 E-Book 뷰어로 독서해보세요.
              </p>
            </div>
          </div>

          <div className="flex align-center gap-2">
            <label
              className="btn btn-primary btn-sm font-bold flex align-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: '#0284c7',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: 'none',
                color: '#ffffff'
              }}
            >
              <Plus size={16} />
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
              className="modal-close"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF 문서 목록 콘텐츠 영역 */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {pdfList.length === 0 ? (
            <label className="block text-center py-12 px-4 border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-xl my-4 cursor-pointer transition-all bg-slate-50 hover:bg-sky-50">
              <FileText size={48} className="mx-auto mb-3 text-slate-300" />
              <h4 className="font-bold text-base text-slate-700">보관된 PDF 문서가 없습니다</h4>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                여기를 클릭하거나 오른쪽 상단의 <b>[신규 PDF 등록]</b> 버튼을 눌러 독서할 PDF 파일을 선택해보세요.
              </p>
              <span className="btn btn-primary btn-sm font-bold inline-flex align-center gap-1.5" style={{ backgroundColor: '#0284c7', border: 'none' }}>
                <Upload size={15} /> PDF 파일 선택하기
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfList.map((item) => {
                const progressPercent = Math.min(100, Math.round(((item.currentPage || 1) / (item.totalPages || 1)) * 100));

                return (
                  <div
                    key={item.id}
                    className="pdf-card p-4 rounded-xl border border-slate-200 hover:border-sky-400 transition-all flex flex-col justify-between"
                    style={{ backgroundColor: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}
                  >
                    <div>
                      <div className="flex align-start justify-between gap-2 mb-2">
                        <div className="flex align-center gap-2">
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              backgroundColor: '#e0f2fe',
                              color: '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-800 line-clamp-1" style={{ margin: 0 }} title={item.fileName}>
                              {item.title}
                            </h4>
                            <div className="flex align-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span className="flex align-center gap-1"><HardDrive size={11} /> {item.fileSize}</span>
                              <span>•</span>
                              <span className="flex align-center gap-1"><Clock size={11} /> {new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          className="text-slate-400 hover:text-rose-500 p-1"
                          onClick={() => handleDeletePdf(item.id, item.title)}
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* 진행률 바 */}
                      <div className="mt-3 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-sky-500 h-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex align-center justify-between text-xs text-slate-500 mt-1">
                        <span>읽은 위치: {item.currentPage || 1}p</span>
                        <span className="font-semibold text-sky-600">{progressPercent}% 완료</span>
                      </div>
                    </div>

                    {/* 읽기 버튼 */}
                    <button
                      className="btn btn-primary btn-sm font-bold w-100 mt-4 flex align-center justify-center gap-1.5"
                      onClick={() => setSelectedPdf(item)}
                      style={{
                        backgroundColor: '#0284c7',
                        border: 'none',
                        color: '#ffffff',
                        padding: '0.55rem',
                        borderRadius: '8px'
                      }}
                    >
                      <BookOpen size={16} /> 📖 E-Book 뷰어로 열기
                    </button>
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
