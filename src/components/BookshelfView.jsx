import React, { useState } from 'react';
import { BookOpen, Star, ExternalLink, PlusCircle, CheckCircle, Clock, Bookmark, Trash2, Edit3, Grid, Layers } from 'lucide-react';

export default function BookshelfView({ books, onUpdateStatus, onDeleteBook, onAddManualBook }) {
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'grid'
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 수동 등록 폼
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newStatus, setNewStatus] = useState('TO_READ');
  const [newBuyLink, setNewBuyLink] = useState('');

  const statusCategories = [
    { key: 'READING', title: '📖 지금 읽고 있는 책', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    { key: 'READ', title: '🏆 완독한 보물상자', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { key: 'TO_READ', title: '✨ 읽고 싶은 위시리스트', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
  ];

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !newAuthor) return;

    onAddManualBook({
      title: newTitle,
      author: newAuthor,
      cover_url: newCover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
      status: newStatus,
      buy_link: newBuyLink || `https://search.shopping.naver.com/book/search?query=${encodeURIComponent(newTitle)}`,
      rating: 5
    });

    setNewTitle('');
    setNewAuthor('');
    setNewCover('');
    setNewBuyLink('');
    setShowAddModal(false);
  };

  return (
    <div className="bookshelf-container">
      {/* 헤더 컨트롤 */}
      <div className="bookshelf-header">
        <div>
          <h2>나만의 3D 비주얼 서재</h2>
          <p className="sub-text">서재의 책들을 클릭하여 독서 상태를 관리하고 메모를 확인하세요.</p>
        </div>
        <div className="flex gap-2 align-center">
          <div className="toggle-group">
            <button
              className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
              <Layers size={16} /> 3D 책장
            </button>
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} /> 그리드 뷰
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={18} /> 직접 책 추가
          </button>
        </div>
      </div>

      {/* 서재 책장 층별 렌더링 */}
      {statusCategories.map((cat) => {
        const catBooks = books.filter((b) => b.status === cat.key);

        return (
          <div key={cat.key} className="shelf-section">
            <div className="shelf-badge" style={{ borderColor: cat.color, color: cat.color, backgroundColor: cat.bg }}>
              <span>{cat.title}</span>
              <span className="shelf-count">{catBooks.length}권</span>
            </div>

            {viewMode === '3d' ? (
              <div className="wood-shelf">
                <div className="shelf-surface">
                  {catBooks.length === 0 ? (
                    <div className="empty-shelf-text">이 책장은 비어 있습니다. 검색해서 책을 꽂아보세요!</div>
                  ) : (
                    <div className="spine-row">
                      {catBooks.map((book) => (
                        <div
                          key={book.id}
                          className="book-spine-item"
                          onClick={() => setSelectedBook(book)}
                          title={`${book.title} - ${book.author}`}
                        >
                          <div className="spine-3d" style={{ backgroundColor: getSpineColor(book.id) }}>
                            <div className="spine-content">
                              <span className="spine-author">{book.author}</span>
                              <span className="spine-title">{book.title}</span>
                            </div>
                          </div>
                          <img src={book.cover_url} alt={book.title} className="spine-cover-hover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shelf-plank"></div>
              </div>
            ) : (
              <div className="book-grid mt-3">
                {catBooks.length === 0 ? (
                  <div className="empty-shelf-text p-4">등록된 도서가 없습니다.</div>
                ) : (
                  catBooks.map((book) => (
                    <div key={book.id} className="book-card" onClick={() => setSelectedBook(book)}>
                      <div className="book-card-cover-wrapper">
                        <img src={book.cover_url} alt={book.title} className="book-card-cover" />
                        <span className="rating-pill">
                          <Star size={12} fill="#f59e0b" color="#f59e0b" /> {book.rating || 5}.0
                        </span>
                      </div>
                      <div className="book-card-info">
                        <h4 className="book-title">{book.title}</h4>
                        <p className="book-author">{book.author}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 도서 상세 모달 */}
      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="modal-card book-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBook(null)}>✕</button>

            <div className="detail-grid">
              <img src={selectedBook.cover_url} alt={selectedBook.title} className="detail-cover" />
              <div className="detail-content">
                <h3>{selectedBook.title}</h3>
                <p className="detail-author">{selectedBook.author} | {selectedBook.publisher || '출판사 미상'}</p>

                <div className="status-selector mt-3">
                  <label className="sub-text">독서 상태 변경:</label>
                  <div className="btn-group mt-1">
                    <button
                      className={`btn btn-sm ${selectedBook.status === 'READING' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { onUpdateStatus(selectedBook.id, 'READING'); setSelectedBook({ ...selectedBook, status: 'READING' }); }}
                    >
                      <Clock size={14} /> 읽는 중
                    </button>
                    <button
                      className={`btn btn-sm ${selectedBook.status === 'READ' ? 'btn-success' : 'btn-outline'}`}
                      onClick={() => { onUpdateStatus(selectedBook.id, 'READ'); setSelectedBook({ ...selectedBook, status: 'READ' }); }}
                    >
                      <CheckCircle size={14} /> 완독함
                    </button>
                    <button
                      className={`btn btn-sm ${selectedBook.status === 'TO_READ' ? 'btn-warning' : 'btn-outline'}`}
                      onClick={() => { onUpdateStatus(selectedBook.id, 'TO_READ'); setSelectedBook({ ...selectedBook, status: 'TO_READ' }); }}
                    >
                      <Bookmark size={14} /> 읽고 싶음
                    </button>
                  </div>
                </div>

                <div className="action-row mt-4">
                  {selectedBook.buy_link && (
                    <a
                      href={selectedBook.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-decoration-none"
                    >
                      <ExternalLink size={16} /> 구매 링크 연결
                    </a>
                  )}

                  <button
                    className="btn btn-danger btn-sm ms-auto"
                    onClick={() => {
                      onDeleteBook(selectedBook.id);
                      setSelectedBook(null);
                    }}
                  >
                    <Trash2 size={16} /> 삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 수동 추가 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            <h3>새로운 책 서재에 등록</h3>

            <form onSubmit={handleManualSubmit} className="mt-3">
              <div className="form-group">
                <label>책 제목 *</label>
                <input
                  type="text"
                  placeholder="예: 클린 코드"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>저자 *</label>
                <input
                  type="text"
                  placeholder="예: 로버트 C. 마틴"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>표지 이미지 URL (선택)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>독서 상태</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="TO_READ">읽고 싶은 책</option>
                  <option value="READING">읽는 중인 책</option>
                  <option value="READ">완독한 책</option>
                </select>
              </div>

              <div className="form-group">
                <label>구매 링크 (선택)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newBuyLink}
                  onChange={(e) => setNewBuyLink(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-3">
                서재에 꽂기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 3D 책등 그라데이션 하드코딩 패턴
function getSpineColor(id) {
  const colors = [
    'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
    'linear-gradient(180deg, #b91c1c 0%, #7f1d1d 100%)',
    'linear-gradient(180deg, #047857 0%, #064e3b 100%)',
    'linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%)',
    'linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)',
    'linear-gradient(180deg, #c2410c 0%, #9a3412 100%)',
  ];
  const charSum = (id || 'abc').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}
