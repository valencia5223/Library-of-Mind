import React, { useState } from 'react';
import { X, Send, Trash2, Heart, MessageCircle, Sparkles, User } from 'lucide-react';

export const POSTIT_COLORS = [
  { id: 'yellow', name: '🟡 파스텔 옐로우', bg: '#fef08a', border: '#eab308', text: '#713f12', shadow: 'rgba(234, 179, 8, 0.3)' },
  { id: 'pink', name: '🩷 핑크 러블리', bg: '#fbcfe8', border: '#ec4899', text: '#831843', shadow: 'rgba(236, 72, 153, 0.3)' },
  { id: 'mint', name: '🟢 마일드 민트', bg: '#a7f3d0', border: '#10b981', text: '#064e3b', shadow: 'rgba(16, 185, 129, 0.3)' },
  { id: 'purple', name: '🟣 바이올렛', bg: '#e9d5ff', border: '#a855f7', text: '#581c87', shadow: 'rgba(168, 85, 247, 0.3)' },
  { id: 'blue', name: '🔵 스카이 블루', bg: '#bae6fd', border: '#0284c7', text: '#0c4a6e', shadow: 'rgba(2, 132, 199, 0.3)' }
];

export default function ShelfGuestbookModal({
  isOpen,
  onClose,
  viewedFriend,
  guestbookNotes = [],
  onAddGuestbookNote,
  onDeleteGuestbookNote,
  currentUser
}) {
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [authorName, setAuthorName] = useState(
    currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '익명의 이웃'
  );

  if (!isOpen) return null;

  const targetOwnerName = viewedFriend 
    ? `${viewedFriend.email.split('@')[0]} 님` 
    : '나';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    onAddGuestbookNote({
      id: 'gb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      authorName: authorName.trim() || '익명의 이웃',
      authorEmail: currentUser?.email || 'guest@mind.com',
      content: content.trim(),
      color: selectedColor,
      createdAt: new Date().toISOString(),
      rotDeg: (Math.floor(Math.random() * 9) - 4) // -4deg ~ +4deg 임의 기울임
    });

    setContent('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '640px', maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={22} className="text-warning" style={{ color: '#f59e0b' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                {viewedFriend ? `${targetOwnerName} 서재 포스트잇 방명록` : '💌 내 서재 방명록 관리'}
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                {viewedFriend ? '책장에 남길 따뜻한 인사를 포스트잇에 적어보세요!' : '이웃들이 내 책장에 남겨둔 메시지들입니다.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 컨텐츠 (작성 폼 + 목록) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 작성 폼 (이웃 서재 방문 중이거나 테스트 작성 지원) */}
          <form onSubmit={handleSubmit} style={{
            backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MessageCircle size={16} style={{ color: '#0284c7' }} />
                {viewedFriend ? `${targetOwnerName}에게 포스트잇 남기기` : '내 서재에 방명록 메모 남기기'}
              </span>

              {/* 포스트잇 색상 선택 파렛트 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {POSTIT_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColor(c.id)}
                    title={c.name}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c.bg,
                      border: selectedColor === c.id ? `2.5px solid ${c.border}` : '1px solid #cbd5e1',
                      cursor: 'pointer', transform: selectedColor === c.id ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <User size={13} /> 작성자:
              </span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="닉네임 입력"
                style={{
                  padding: '0.35rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                  outline: 'none', backgroundColor: '#f1f5f9', fontWeight: 600, color: '#1e293b'
                }}
              />
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="따뜻한 인사말이나 감명 깊게 읽은 책 추천을 적어보세요..."
              rows={3}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem', lineHeight: '1.5', outline: 'none', resize: 'none',
                backgroundColor: POSTIT_COLORS.find(c => c.id === selectedColor)?.bg || '#fef08a',
                color: POSTIT_COLORS.find(c => c.id === selectedColor)?.text || '#713f12',
                fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={!content.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1.2rem',
                  backgroundColor: content.trim() ? '#0284c7' : '#94a3b8', color: '#ffffff',
                  border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: content.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: content.trim() ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none', transition: 'all 0.15s ease'
                }}
              >
                <Send size={15} /> 포스트잇 부착하기
              </button>
            </div>
          </form>

          {/* 남겨진 포스트잇 방명록 목록 그리드 */}
          <div>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Heart size={16} style={{ color: '#ef4444' }} />
              남겨진 포스트잇 목록 ({guestbookNotes.length}개)
            </h4>

            {guestbookNotes.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>아직 남겨진 포스트잇이 없습니다.</p>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem' }}>첫 번째 방명록 포스트잇을 붙여보세요!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                {guestbookNotes.map((note) => {
                  const colorObj = POSTIT_COLORS.find(c => c.id === note.color) || POSTIT_COLORS[0];
                  return (
                    <div
                      key={note.id}
                      style={{
                        backgroundColor: colorObj.bg,
                        color: colorObj.text,
                        border: `1.5px solid ${colorObj.border}`,
                        borderRadius: '12px',
                        padding: '1rem',
                        position: 'relative',
                        boxShadow: `3px 6px 12px ${colorObj.shadow}`,
                        transform: `rotate(${note.rotDeg || -2}deg)`,
                        transition: 'transform 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between',
                        minHeight: '130px'
                      }}
                    >
                      {/* 상단 테이프 연출 */}
                      <div style={{
                        position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%) rotate(1deg)',
                        width: '50px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.65)',
                        border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }} />

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={13} /> {note.authorName}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteGuestbookNote(note.id)}
                            title="방명록 삭제"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', opacity: 0.8 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 600 }}>
                          {note.content}
                        </p>
                      </div>

                      <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.7, textAlign: 'right' }}>
                        {new Date(note.createdAt).toLocaleDateString('kf-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
