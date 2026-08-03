import React, { useState } from 'react';
import { Quote, Tag, PlusCircle, Trash2, Search, BookOpen, MessageSquare } from 'lucide-react';

export default function ThoughtLedger({ notes = [], books = [], onAddNote, onDeleteNote }) {
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 새 노트 입력 폼
  const [bookTitle, setBookTitle] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [thoughtText, setThoughtText] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [tagInput, setTagInput] = useState('#동기부여, #인문학');

  // 등록된 모든 태그 추출
  const allTags = ['ALL', ...Array.from(new Set(notes.flatMap(n => n.tags || [])))];

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!quoteText) return;

    const tagsArray = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    onAddNote({
      book_title: bookTitle || '자유 기록',
      quote: quoteText,
      thought: thoughtText,
      page_number: pageNumber ? parseInt(pageNumber) : null,
      tags: tagsArray.length > 0 ? tagsArray : ['#기록']
    });

    setBookTitle('');
    setQuoteText('');
    setThoughtText('');
    setPageNumber('');
    setShowAddModal(false);
  };

  const filteredNotes = notes.filter(n => {
    const matchesTag = selectedTag === 'ALL' || (n.tags && n.tags.includes(selectedTag));
    const matchesSearch = (n.quote || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (n.thought || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (n.book_title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div className="thought-ledger-container">
      {/* 타이틀 및 헤더 */}
      <div className="thought-header">
        <div>
          <h2><MessageSquare className="text-primary inline-block me-2" size={24} /> 생각 저장소 (Thought Ledger)</h2>
          <p className="sub-text">책을 읽으며 가슴을 뛰게 한 문장과 나의 통찰을 기록하고 엮어보세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <PlusCircle size={18} /> 새 문장 수집
        </button>
      </div>

      {/* 태그 및 서치 바 */}
      <div className="thought-filter-bar mt-4">
        <div className="tag-pills-row">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
            >
              <Tag size={12} /> {tag === 'ALL' ? '전체 보기' : tag}
            </button>
          ))}
        </div>

        <div className="search-input-sm">
          <Search size={16} />
          <input
            type="text"
            placeholder="수집한 문장/메모 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 노트 카드 리스트 */}
      <div className="note-cards-grid mt-4">
        {filteredNotes.length === 0 ? (
          <div className="empty-notes-box text-center p-5">
            <Quote size={36} className="sub-text mb-2" />
            <p>아직 수집된 문장이 없습니다. 마음에 드는 문장을 기록해보세요!</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div key={note.id} className="thought-card">
              <div className="thought-card-header">
                <span className="book-badge">
                  <BookOpen size={14} /> {note.book_title} {note.page_number && `(p.${note.page_number})`}
                </span>
                <button
                  className="btn-icon-danger"
                  onClick={() => onDeleteNote(note.id)}
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="quote-body">
                <Quote size={20} className="quote-icon" />
                <blockquote className="quote-text">{note.quote}</blockquote>
              </div>

              {note.thought && (
                <div className="thought-insight">
                  <strong>💡 나의 생각:</strong> {note.thought}
                </div>
              )}

              {note.tags && note.tags.length > 0 && (
                <div className="note-tags mt-3">
                  {note.tags.map((t, idx) => (
                    <span key={idx} className="small-tag">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 문장 작성 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            <h3>인상 깊은 문장 수집하기</h3>

            <form onSubmit={handleAddSubmit} className="mt-3">
              <div className="form-group">
                <label>도서 선택 / 제목</label>
                <select
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                >
                  <option value="">직접 입력 또는 내 서재 선택</option>
                  {books.map(b => (
                    <option key={b.id} value={b.title}>{b.title} - {b.author}</option>
                  ))}
                </select>
                {!books.some(b => b.title === bookTitle) && (
                  <input
                    type="text"
                    className="mt-2"
                    placeholder="책 제목을 직접 입력하세요..."
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group">
                <label>마음에 남는 문장 (Quote) *</label>
                <textarea
                  rows="3"
                  placeholder="책 속의 잊혀지지 않는 최고의 한 줄을 적어보세요."
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>나의 한 줄 생각 / 감상 (선택)</label>
                <textarea
                  rows="2"
                  placeholder="이 문장을 읽었을 때 느낀 깨달음이나 다짐을 남겨보세요."
                  value={thoughtText}
                  onChange={(e) => setThoughtText(e.target.value)}
                />
              </div>

              <div className="form-row flex gap-2">
                <div className="form-group flex-1">
                  <label>페이지 (선택)</label>
                  <input
                    type="number"
                    placeholder="예: 142"
                    value={pageNumber}
                    onChange={(e) => setPageNumber(e.target.value)}
                  />
                </div>

                <div className="form-group flex-2">
                  <label>태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    placeholder="#동기부여, #인문학"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-3">
                문장 저장하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
