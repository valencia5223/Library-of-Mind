import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Sparkles, Copy, Trash2, CheckCircle2, RefreshCw, Zap, ShieldCheck, GripHorizontal, RotateCcw } from 'lucide-react';

export default function SharedLiveMemoModal({ user, friend, onClose }) {
  if (!user || !friend) return null;

  // 1:1 대화방 결정을 위한 고유 룸 ID (두 사용자 UUID 오름차순 정렬 연결)
  const sortedUserIds = [user.id, friend.friend_id].sort();
  const roomId = `${sortedUserIds[0]}_${sortedUserIds[1]}`;

  const [memoContent, setMemoContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingPartner, setTypingPartner] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // 글씨 폰트 크기 상태 (기본값: 16px, 숫자로 자유롭게 입력 및 localStorage 기억)
  const [fontSizePx, setFontSizePx] = useState(() => {
    const saved = localStorage.getItem('shared_memo_font_size_px');
    return saved ? parseInt(saved, 10) || 16 : 16;
  });

  const handleFontSizePxChange = (val) => {
    const num = Math.max(1, Math.min(100, parseInt(val, 10) || 16));
    setFontSizePx(num);
    localStorage.setItem('shared_memo_font_size_px', num.toString());
  };

  // 모달 창 마우스 드래그 이동 및 위치 localStorage 기억
  const [modalPos, setModalPos] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_memo_modal_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { x: 0, y: 0 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  const handleMouseDownHeader = (e) => {
    // 버튼, 인풋, 텍스트에리어 클릭 시 드래그 제외
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...modalPos };

    document.addEventListener('mousemove', handleMouseMoveWindow);
    document.addEventListener('mouseup', handleMouseUpWindow);
  };

  const handleMouseMoveWindow = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setModalPos({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy
    });
  };

  const handleMouseUpWindow = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMoveWindow);
      document.removeEventListener('mouseup', handleMouseUpWindow);

      setModalPos((latestPos) => {
        localStorage.setItem('shared_memo_modal_pos', JSON.stringify(latestPos));
        return latestPos;
      });
    }
  };

  // 메모 입력 창 (Textarea) 크기 조절 (드래그 resize & localStorage 기억)
  const [textareaSize, setTextareaSize] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_memo_textarea_size');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { width: 680, height: 380 };
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 680, height: 380 });

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: textareaSize.width,
      height: textareaSize.height
    };

    document.addEventListener('mousemove', handleMouseMoveResize);
    document.addEventListener('mouseup', handleMouseUpResize);
  };

  const handleMouseMoveResize = (e) => {
    if (!isResizingRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;
    const newWidth = Math.max(380, Math.min(window.innerWidth - 60, resizeStartRef.current.width + dx));
    const newHeight = Math.max(160, Math.min(window.innerHeight - 220, resizeStartRef.current.height + dy));

    setTextareaSize({ width: newWidth, height: newHeight });
  };

  const handleMouseUpResize = () => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMoveResize);
      document.removeEventListener('mouseup', handleMouseUpResize);

      setTextareaSize((latestSize) => {
        localStorage.setItem('shared_memo_textarea_size', JSON.stringify(latestSize));
        return latestSize;
      });
    }
  };

  // 창 위치 & 크기 초기화 버튼
  const handleResetPos = (e) => {
    e.stopPropagation();
    const defaultPos = { x: 0, y: 0 };
    const defaultSize = { width: 750, height: 600 };
    setModalPos(defaultPos);
    setModalSize(defaultSize);
    localStorage.removeItem('shared_memo_modal_pos');
    localStorage.removeItem('shared_memo_modal_size');
  };

  // ESC 키 누르면 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // 1. 기존 공유 메모 조회 및 초기화 (없으면 빈 레코드 생성)
    const initMemo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('shared_memos')
          .select('content, updated_at, last_updated_by')
          .eq('room_id', roomId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('공유 메모 조회 중 오류:', error);
        }

        if (data) {
          setMemoContent(data.content || '');
          if (data.updated_at) {
            setLastSavedTime(new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        } else {
          // 데이터가 없으면 최초 생성
          await supabase.from('shared_memos').insert({
            room_id: roomId,
            user1_id: sortedUserIds[0],
            user2_id: sortedUserIds[1],
            content: '',
            last_updated_by: user.id
          });
        }
      } catch (err) {
        console.error('메모 초기화 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    initMemo();

    // 2. Supabase Realtime 채널 실시간 구독 (0.1초 동기화)
    const channel = supabase
      .channel(`shared_memo:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_memos',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new && payload.new.last_updated_by !== user.id) {
            setMemoContent(payload.new.content || '');
            setTypingPartner(friend.name || friend.email);
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            // 1.5초 후 타이핑 상태 뱃지 해제
            setTimeout(() => {
              setTypingPartner(null);
            }, 1500);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [roomId, user.id, friend.friend_id]);

  // 키보드 입력 시 디바운스(350ms)로 Supabase DB 업서트
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setMemoContent(newText);
    setIsSaving(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('shared_memos')
          .upsert(
            {
              room_id: roomId,
              user1_id: sortedUserIds[0],
              user2_id: sortedUserIds[1],
              content: newText,
              last_updated_by: user.id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'room_id' }
          );

        if (error) throw error;
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        console.error('메모 실시간 저장 오류:', err);
      } finally {
        setIsSaving(false);
      }
    }, 350);
  };

  // 클립보드 전체 복사
  const handleCopyAll = () => {
    navigator.clipboard.writeText(memoContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // 내용 전체 지우기
  const handleClearAll = () => {
    if (window.confirm('실시간 메모의 전체 내용을 지우시겠습니까? (상대방 화면에서도 바로 지워집니다)')) {
      handleTextChange({ target: { value: '' } });
    }
  };

  const lineCount = memoContent ? memoContent.split('\n').length : 0;
  const charCount = memoContent.length;

  return (
    <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={onClose}>
      <div
        className="modal-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '96vw',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
          transition: isDraggingRef.current || isResizingRef.current ? 'none' : 'transform 0.05s ease-out'
        }}
      >
        {/* 모달 닫기 버튼 */}
        <button
          className="modal-close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.1rem',
            right: '1.1rem',
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
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        {/* 상단 타이틀 및 상태 헤더 (드래그 가능 헤더 영역, 고정 크기) */}
        <div
          onMouseDown={handleMouseDownHeader}
          style={{
            paddingBottom: '0.85rem',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '1rem',
            cursor: 'move',
            userSelect: 'none',
            flexShrink: 0
          }}
        >
          <div className="flex align-center justify-between" style={{ paddingRight: '4.5rem' }}>
            <h3 className="flex align-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              <GripHorizontal size={20} className="text-slate-400 me-1" />
              <Zap size={22} className="text-primary" style={{ color: '#0078a6' }} />
              <span>{friend.name || friend.email}님과의 실시간 라이브 메모장</span>
            </h3>

            {/* 폰트 크기 커스텀 숫자 입력 컨트롤러 (localStorage 자동 기억) */}
            <div className="flex align-center gap-1.5" style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span className="text-xs font-bold text-slate-600" style={{ fontSize: '0.78rem' }}>글씨 크기:</span>
              
              {/* - 버튼 */}
              <button
                type="button"
                onClick={() => handleFontSizePxChange(fontSizePx - 1)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#334155'
                }}
              >
                -
              </button>

              {/* 숫자로 직접 입력하는 인풋 */}
              <div className="flex align-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={fontSizePx}
                  onChange={(e) => handleFontSizePxChange(e.target.value)}
                  style={{
                    width: '42px',
                    height: '24px',
                    textAlign: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '5px',
                    outline: 'none',
                    background: '#ffffff',
                    padding: '0 2px'
                  }}
                />
                <span className="text-xs font-bold text-slate-500" style={{ fontSize: '0.75rem' }}>px</span>
              </div>

              {/* + 버튼 */}
              <button
                type="button"
                onClick={() => handleFontSizePxChange(fontSizePx + 1)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#334155'
                }}
              >
                +
              </button>

              {/* 빠른 프리셋 단추 */}
              <div className="flex align-center gap-1 ms-1 style-presets">
                {[14, 16, 19, 24].map((px) => (
                  <button
                    key={px}
                    type="button"
                    onClick={() => handleFontSizePxChange(px)}
                    style={{
                      padding: '1px 6px',
                      fontSize: '0.72rem',
                      fontWeight: fontSizePx === px ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: fontSizePx === px ? '#0284c7' : '#e2e8f0',
                      color: fontSizePx === px ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {px}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex align-center gap-3 mt-2" style={{ fontSize: '0.82rem', color: '#64748b' }}>
            <span className="flex align-center gap-1 font-semibold" style={{ color: isConnected ? '#059669' : '#d97706' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#f59e0b',
                  boxShadow: isConnected ? '0 0 8px #10b981' : 'none'
                }}
              />
              {isConnected ? '실시간 동기화 연결됨 (Realtime)' : '연결 준비 중...'}
            </span>

            {typingPartner && (
              <span className="animate-pulse flex align-center gap-1 font-bold text-primary" style={{ color: '#0284c7' }}>
                <Sparkles size={14} /> {typingPartner}님이 작성 중...
              </span>
            )}

            {isSaving ? (
              <span className="flex align-center gap-1 text-slate-500">
                <RefreshCw size={13} className="animate-spin" /> 자동 저장 중...
              </span>
            ) : lastSavedTime ? (
              <span className="text-slate-400">최근 동기화: {lastSavedTime}</span>
            ) : null}
          </div>
        </div>

        {/* 메인 메모 에디터 영역 (오직 메모 입력 박스만 조절됨) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0 }}>
          {loading ? (
            <div className="empty-search p-5 text-center flex-1 flex flex-col align-center justify-center" style={{ width: `${textareaSize.width}px`, height: `${textareaSize.height}px` }}>
              <RefreshCw size={28} className="animate-spin text-primary mb-2" />
              <p>실시간 메모 보드를 불러오는 중입니다...</p>
            </div>
          ) : (
            <div style={{ position: 'relative', width: `${textareaSize.width}px`, height: `${textareaSize.height}px`, maxWidth: '100%' }}>
              <textarea
                value={memoContent}
                onChange={handleTextChange}
                placeholder={`여기에 메모를 입력해 보세요!\n${friend.name || friend.email}님 화면에도 0.1초 만에 실시간으로 글자가 나타나고 수정됩니다 ✨\n\n- 읽고 싶은 책 리스트 공유\n- 감명 깊은 구절 및 메모 공동 작성\n- 실시간 아이디어 스케치`}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '1.2rem',
                  fontSize: `${fontSizePx}px`,
                  lineHeight: 1.75,
                  color: '#1e293b',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  outline: 'none',
                  resize: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              />

              {/* 메모 입력부 전용 우측 하단 크기 조절 손잡이 */}
              <div
                onMouseDown={handleMouseDownResize}
                title="드래그하여 메모 입력 박스 크기 변경 (localStorage 기억됨)"
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  width: '22px',
                  height: '22px',
                  cursor: 'nwse-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  background: '#f0f9ff',
                  borderRadius: '5px',
                  border: '1px solid #bae6fd',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  zIndex: 5,
                  userSelect: 'none'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M10 2L2 10M10 6L6 10M10 10H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* 하단 푸터 바 (통계 및 툴바, 고정 크기) */}
        <div
          className="mt-3 pt-3 flex justify-between align-center"
          style={{ borderTop: '1px solid #e2e8f0', background: 'transparent', flexShrink: 0 }}
        >
          <div className="flex align-center gap-3 text-slate-500" style={{ fontSize: '0.83rem', fontWeight: 500 }}>
            <span>줄 수: <b>{lineCount}</b></span>
            <span>글자 수: <b>{charCount}</b>자</span>
          </div>

          <div className="flex align-center gap-2">
            <button
              className="btn btn-outline btn-sm font-bold flex align-center gap-1"
              onClick={handleCopyAll}
              disabled={!memoContent}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px' }}
            >
              {copySuccess ? <CheckCircle2 size={15} color="#059669" /> : <Copy size={15} />}
              {copySuccess ? '복사 완료!' : '전체 복사'}
            </button>

            <button
              className="btn btn-outline btn-sm text-danger font-bold flex align-center gap-1"
              onClick={handleClearAll}
              disabled={!memoContent}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', borderColor: '#fca5a5', color: '#dc2626' }}
            >
              <Trash2 size={15} /> 지우기
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ padding: '0.45rem 1.1rem', borderRadius: '8px', fontWeight: 600 }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
