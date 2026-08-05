import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Sparkles, Copy, Trash2, CheckCircle2, RefreshCw, Zap, GripHorizontal } from 'lucide-react';

export default function SharedLiveMemoModal({ user, friend, onClose }) {
  if (!user || !friend) return null;

  // 1:1 대화방 결정을 위한 고유 룸 ID (두 사용자 UUID 오름차순 정렬 연결)
  const sortedUserIds = [user.id, friend.friend_id].sort();
  const roomId = `${sortedUserIds[0]}_${sortedUserIds[1]}`;

  const editorRef = useRef(null);
  const [memoContent, setMemoContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingPartner, setTypingPartner] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);

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
    // 버튼, 인풋, 에디터 영역 클릭 시 드래그 제외
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('[contenteditable="true"]')) return;

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

  // 메모 입력 창 크기 조절 (드래그 resize & localStorage 기억)
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
    return { width: 540, height: 280 };
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 540, height: 280 });

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
  const latestContentRef = useRef('');
  const isDirtyRef = useRef(false);

  // 에디터 DOM 내용 업기
  const updateEditorDOM = (htmlContent) => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent || '';
      }
      const text = editorRef.current.innerText || '';
      setIsEditorEmpty(!htmlContent || htmlContent === '<br>' || text.trim() === '');
    }
  };

  // DB에 즉시 동기화 저장 (Flush)
  const saveImmediately = async (htmlContent) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    isDirtyRef.current = false;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shared_memos')
        .upsert(
          {
            room_id: roomId,
            user1_id: sortedUserIds[0],
            user2_id: sortedUserIds[1],
            content: htmlContent,
            last_updated_by: user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'room_id' }
        );
      if (error) throw error;
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('메모 즉시 저장 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // 1. 기존 공유 메모 조회 및 초기화
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
          const content = data.content || '';
          setMemoContent(content);
          latestContentRef.current = content;
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
            const newHtml = payload.new.content || '';
            setMemoContent(newHtml);
            latestContentRef.current = newHtml;
            
            // 현재 사용자가 직접 작성 중이 아닐 때만 DOM 덮어쓰기 (입력 커서 튀김 방지)
            if (!editorRef.current || document.activeElement !== editorRef.current) {
              updateEditorDOM(newHtml);
            }
            
            setTypingPartner(friend.email);
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

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
      // 모달 닫힐 때 작성 중인 내용이 있으면 즉시 DB 저장 보장
      if (isDirtyRef.current) {
        saveImmediately(latestContentRef.current);
      } else if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, user.id, friend.friend_id, friend.email]);

  // loading 완료 후 에디터 DOM이 마운트되었을 때 memoContent 바인딩 보장
  useEffect(() => {
    if (!loading) {
      updateEditorDOM(memoContent);
    }
  }, [loading]);

  // 메모 내용 수정 시 DB 업서트 (디바운스 250ms)
  const triggerSave = (htmlContent) => {
    setMemoContent(htmlContent);
    latestContentRef.current = htmlContent;
    isDirtyRef.current = true;
    setIsSaving(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveImmediately(htmlContent);
    }, 250);
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    setIsEditorEmpty(!html || html === '<br>' || text.trim() === '');
    triggerSave(html);
  };

  const handleBlur = () => {
    if (isDirtyRef.current && editorRef.current) {
      saveImmediately(editorRef.current.innerHTML);
    }
  };

  // 클립보드 이미지 및 텍스트 붙여넣기 (Paste) 처리 핸들러
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith('image/')) {
        hasImage = true;
        e.preventDefault(); // 기본 텍스트 붙여넣기 방지
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target?.result;
          if (!base64Data) return;

          // 커서 위치에 inline <img> 요소 바로 생성 삽입
          const img = document.createElement('img');
          img.src = base64Data;
          img.alt = '클립보드 이미지';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '320px';
          img.style.borderRadius = '10px';
          img.style.margin = '8px 0';
          img.style.display = 'block';
          img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            
            // 이미지 뒤로 커서 이동
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
          } else if (editorRef.current) {
            editorRef.current.appendChild(img);
          }

          handleEditorInput();
        };
        reader.readAsDataURL(file);
        break;
      }
    }

    // 이미지가 아닌 서식 지정 텍스트 붙여넣기 시 텍스트만 깔끔히 삽입
    if (!hasImage && e.clipboardData) {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        handleEditorInput();
      }
    }
  };

  // 클립보드 전체 복사 (순수 텍스트 기준)
  const handleCopyAll = () => {
    const text = editorRef.current ? editorRef.current.innerText : memoContent;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // 내용 전체 지우기
  const handleClearAll = () => {
    if (window.confirm('실시간 메모의 전체 내용을 지우시겠습니까? (상대방 화면에서도 바로 지워집니다)')) {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      handleEditorInput();
    }
  };

  // 줄 수 및 글자 수 (텍스트 노드 기준 계산)
  const currentText = editorRef.current ? (editorRef.current.innerText || '') : '';
  const lineCount = currentText ? currentText.split('\n').length : 0;
  const charCount = currentText.length;

  return (
    <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={onClose}>
      <div
        className="modal-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'fit-content',
          minWidth: `${Math.max(420, textareaSize.width + 44)}px`,
          maxWidth: '96vw',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.2rem 1.35rem',
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
          title="닫기 (Esc)"
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
          <div className="flex align-center justify-between" style={{ paddingRight: '6.5rem' }}>
            <h3 className="flex align-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              <GripHorizontal size={20} className="text-slate-400 me-1" />
              <Zap size={22} className="text-primary" style={{ color: '#0078a6' }} />
              <span>실시간 라이브 메모장</span>
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
            </div>
          </div>

          {/* 상태 표시 1줄: 연결 상태 및 최근 저장 시간 */}
          <div className="flex align-center justify-between mt-2" style={{ fontSize: '0.82rem', color: '#64748b' }}>
            <span className="flex align-center gap-1 font-semibold flex-shrink-0" style={{ color: isConnected ? '#059669' : '#d97706' }}>
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

            {isSaving ? (
              <span className="flex align-center gap-1 text-slate-500 flex-shrink-0">
                <RefreshCw size={13} className="animate-spin" /> 자동 저장 중...
              </span>
            ) : lastSavedTime ? (
              <span className="text-slate-400 flex-shrink-0">최근 동기화: {lastSavedTime}</span>
            ) : null}
          </div>

          {/* 상태 표시 2줄: 전용 작성 중 안내 줄 (고정 높이 20px로 레이아웃 변동 완전 방지) */}
          <div style={{ height: '20px', marginTop: '4px', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
            {typingPartner ? (
              <span className="animate-pulse flex align-center gap-1 font-bold" style={{ color: '#0284c7' }}>
                <Sparkles size={13} /> {typingPartner}님이 작성 중...
              </span>
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
              {/* 비어 있을 때 가이드 텍스트 (Placeholder) */}
              {isEditorEmpty && (
                <div
                  style={{
                    position: 'absolute',
                    top: '1.2rem',
                    left: '1.2rem',
                    right: '1.2rem',
                    color: '#94a3b8',
                    fontSize: `${fontSizePx}px`,
                    lineHeight: 1.75,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 1,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {`여기에 메모를 입력하거나 클립보드 이미지(Ctrl+V)를 붙여넣어 보세요! 🖼️\n${friend.email}님 화면에도 0.1초 만에 실시간으로 글자와 이미지가 나타납니다 ✨\n\n- 읽고 싶은 책 리스트 공유\n- 감명 깊은 구절 및 메모 공동 작성\n- 클립보드 스크린샷 실시간 공통 캡처 공유`}
                </div>
              )}

              {/* contentEditable 기반 리치 메모장 에디터 */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onBlur={handleBlur}
                onPaste={handlePaste}
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
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
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
          <div className="flex flex-col gap-1 text-slate-500" style={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.35 }}>
            <div className="flex align-center gap-3">
              <span>줄 수: <b style={{ color: '#0f172a' }}>{lineCount}</b></span>
              <span>글자 수: <b style={{ color: '#0f172a' }}>{charCount}</b>자</span>
            </div>
            <div className="text-slate-500" style={{ fontSize: '0.75rem' }}>
              대상: <b style={{ color: '#0284c7', fontWeight: 600 }}>{friend.email}</b>
            </div>
          </div>

          <div className="flex align-center gap-2">
            <button
              className="btn btn-outline btn-sm font-bold flex align-center gap-1"
              onClick={handleCopyAll}
              disabled={isEditorEmpty}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px' }}
            >
              {copySuccess ? <CheckCircle2 size={15} color="#059669" /> : <Copy size={15} />}
              {copySuccess ? '복사 완료!' : '전체 복사'}
            </button>

            <button
              className="btn btn-outline btn-sm text-danger font-bold flex align-center gap-1"
              onClick={handleClearAll}
              disabled={isEditorEmpty}
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
