import React, { useState } from 'react';
import { BookOpen, Star, ExternalLink, PlusCircle, CheckCircle, Clock, Bookmark, Trash2, Edit3, Grid, Layers, MessageSquare } from 'lucide-react';

export default function BookshelfView({ books, onUpdateStatus, onDeleteBook, onAddManualBook, onUpdateBookDetails }) {
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'grid'
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // 수정 리뷰 & 별점 폼
  const [editRating, setEditRating] = useState(5);
  const [editReview, setEditReview] = useState('');
  const [editTotalPages, setEditTotalPages] = useState(250);
  const [editCurrentPages, setEditCurrentPages] = useState(0);

  // 수동 등록 폼
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newStatus, setNewStatus] = useState('TO_READ');
  const [newBuyLink, setNewBuyLink] = useState('');
  const [newTotalPages, setNewTotalPages] = useState(300);

  const statusCategories = [
    { key: 'READING', title: '📖 지금 읽고 있는 책', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    { key: 'READ', title: '🏆 완독한 보물상자', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { key: 'TO_READ', title: '✨ 읽고 싶은 위시리스트', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
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
      rating: 5,
      total_pages: parseInt(newTotalPages) || 300,
      current_pages: newStatus === 'READ' ? parseInt(newTotalPages) || 300 : 0
    });

    setNewTitle('');
    setNewAuthor('');
    setNewCover('');
    setNewBuyLink('');
    setShowAddModal(false);
  };

  const handleOpenDetail = (book) => {
    setSelectedBook(book);
    setEditRating(book.rating || 5);
    setEditReview(book.review || '');
    setEditTotalPages(book.total_pages || 300);
    setEditCurrentPages(book.current_pages || 0);
    setIsEditingReview(false);
  };

  const handleSaveReview = () => {
    if (!selectedBook) return;

    const updated = {
      ...selectedBook,
      rating: editRating,
      review: editReview,
      total_pages: editTotalPages,
      current_pages: editCurrentPages
    };

    onUpdateBookDetails(selectedBook.id, updated);
    setSelectedBook(updated);
    setIsEditingReview(false);
  };

  const handleImgError = (e, fallbackUrl) => {
    e.target.onerror = null;
    e.target.src = fallbackUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80';
  };

  return (
    <div className="bookshelf-container">
      {/* 헤더 컨트롤 */}
      <div className="bookshelf-header">
        <div>
          <h2>나만의 3D 비주얼 서재</h2>
          <p className="sub-text">원목 책장에 꽂힌 책을 클릭하여 상태 변경, 별점 및 독서 리뷰를 남기세요.</p>
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
            <PlusCircle size={18} /> 수동 책 추가
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
                    <div className="empty-shelf-text">이 책장은 비어 있습니다. 탐색 탭에서 책을 찾아 꽂아보세요!</div>
                  ) : (
                    <div className="spine-row">
                      {catBooks.map((book) => {
                        const spineHeight = Math.min(170, Math.max(130, 120 + ((book.total_pages || 300) / 10)));
                        const spineWidth = Math.min(54, Math.max(38, 32 + ((book.total_pages || 300) / 20)));

                        return (
                          <div
                            key={book.id}
                            className="book-spine-item"
                            onClick={() => handleOpenDetail(book)}
                            title={`${book.title} - ${book.author}`}
                          >
                            <div
                              className="spine-3d"
                              style={{
                                background: getSpineColor(book.id),
                                height: `${spineHeight}px`,
                                width: `${spineWidth}px`
                              }}
                            >
                              <div className="spine-ridge"></div>
                              <div className="spine-highlight"></div>
                              <div className="spine-content">
                                <span className="spine-author">{book.author}</span>
                                <span className="spine-title">{book.title}</span>
                              </div>
                            </div>
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImgError(e, book.fallback_cover)}
                              className="spine-cover-hover"
                            />
                          </div>
                        );
                      })}
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
                    <div key={book.id} className="book-card" onClick={() => handleOpenDetail(book)}>
                      <div className="book-card-cover-wrapper">
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImgError(e, book.fallback_cover)}
                          className="book-card-cover"
                        />
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

      {/* 도서 상세 및 리뷰 모달 */}
      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="modal-card book-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBook(null)}>✕</button>

            <div className="detail-grid">
              <div className="detail-cover-side">
                <img
                  src={selectedBook.cover_url}
                  alt={selectedBook.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImgError(e, selectedBook.fallback_cover)}
                  className="detail-cover"
                />
                
                {/* 진행률 바 */}
                <div className="progress-box mt-3">
                  <div className="flex justify-between text-xs sub-text font-bold mb-1">
                    <span>독서 진행률</span>
                    <span>{Math.round(((selectedBook.current_pages || 0) / (selectedBook.total_pages || 300)) * 100)}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, ((selectedBook.current_pages || 0) / (selectedBook.total_pages || 300)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="sub-text text-center block mt-1">
                    {selectedBook.current_pages || 0} / {selectedBook.total_pages || 300} 페이지
                  </span>
                </div>
              </div>

              <div className="detail-content">
                <h3>{selectedBook.title}</h3>
                <p className="detail-author">{selectedBook.author} | {selectedBook.publisher || '출판사 정보'}</p>

                {/* 상태 선택 */}
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

                {/* 독서 리뷰 및 별점 섹션 */}
                <div className="review-section mt-4 p-3 border-card">
                  <div className="flex justify-between align-center">
                    <h4 className="flex align-center gap-1"><MessageSquare size={16} className="text-primary" /> 독서 평가 & 한줄평</h4>
                    {!isEditingReview && (
                      <button className="btn btn-sm btn-outline" onClick={() => setIsEditingReview(true)}>
                        <Edit3 size={14} /> {selectedBook.review ? '수정' : '작성'}
                      </button>
                    )}
                  </div>

                  {isEditingReview ? (
                    <div className="edit-review-box mt-2">
                      <div className="rating-select-row flex align-center gap-2 mb-2">
                        <span className="sub-text">내 별점:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            className="star-btn"
                            type="button"
                            onClick={() => setEditRating(star)}
                          >
                            <Star size={18} fill={star <= editRating ? '#f59e0b' : 'none'} color="#f59e0b" />
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <label className="sub-text">현재 페이지</label>
                          <input
                            type="number"
                            value={editCurrentPages}
                            onChange={(e) => setEditCurrentPages(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="sub-text">전체 페이지</label>
                          <input
                            type="number"
                            value={editTotalPages}
                            onChange={(e) => setEditTotalPages(parseInt(e.target.value) || 300)}
                          />
                        </div>
                      </div>

                      <textarea
                        rows="3"
                        placeholder="이 책에 대한 한줄평 및 감상평을 기록하세요..."
                        value={editReview}
                        onChange={(e) => setEditReview(e.target.value)}
                      />

                      <div className="flex gap-2 mt-2">
                        <button className="btn btn-sm btn-primary" onClick={handleSaveReview}>
                          저장 완료
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setIsEditingReview(false)}>
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="saved-review-view mt-2">
                      <div className="flex align-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={16} fill={star <= (selectedBook.rating || 5) ? '#f59e0b' : 'none'} color="#f59e0b" />
                        ))}
                        <span className="ms-2 font-bold">{selectedBook.rating || 5}.0</span>
                      </div>
                      <p className="review-text">{selectedBook.review || '아직 남긴 감상평이 없습니다. 수정 버튼을 눌러 적어보세요!'}</p>
                    </div>
                  )}
                </div>

                <div className="action-row mt-4 flex justify-between align-center">
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
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      onDeleteBook(selectedBook.id);
                      setSelectedBook(null);
                    }}
                  >
                    <Trash2 size={16} /> 서재에서 삭제
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
                <label>전체 페이지 수</label>
                <input
                  type="number"
                  placeholder="예: 350"
                  value={newTotalPages}
                  onChange={(e) => setNewTotalPages(e.target.value)}
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

function getSpineColor(id) {
  const colors = [
    'linear-gradient(180deg, #182230 0%, #0d1520 100%)', // 엔틱 다크챠콜
    'linear-gradient(180deg, #6b1212 0%, #3f0a0a 100%)', // 딤 버건디
    'linear-gradient(180deg, #0f3d3d 0%, #0a2929 100%)', // 클래식 딥틸
    'linear-gradient(180deg, #112d4e 0%, #0b1d32 100%)', // 로열 딥블루
    'linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)', // 황실 다크퍼플
    'linear-gradient(180deg, #6c3b0c 0%, #462507 100%)', // 골드브라운 레더
    'linear-gradient(180deg, #581c0c 0%, #371007 100%)', // 마호가니 목판
    'linear-gradient(180deg, #0b453a 0%, #072c25 100%)', // 포레스트 다크그린
    'linear-gradient(180deg, #27272a 0%, #18181b 100%)', // 흑돌 그래파이트
  ];
  const charSum = (id || 'abc').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}
