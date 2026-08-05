import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Sparkles, Copy, Trash2, CheckCircle2, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

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
          maxWidth: '750px',
          width: '92vw',
          height: '82vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative'
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
            color: '#64748b'
          }}
        >
          <X size={18} />
        </button>

        {/* 상단 타이틀 및 상태 헤더 */}
        <div style={{ paddingBottom: '0.85rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
          <div className="flex align-center justify-between" style={{ paddingRight: '2.5rem' }}>
            <h3 className="flex align-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              <Zap size={22} className="text-primary" style={{ color: '#0078a6' }} />
              <span>{friend.name || friend.email}님과의 실시간 라이브 메모장</span>
            </h3>
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

        {/* 메인 메모 에디터 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {loading ? (
            <div className="empty-search p-5 text-center flex-1 flex flex-col align-center justify-center">
              <RefreshCw size={28} className="animate-spin text-primary mb-2" />
              <p>실시간 메모 보드를 불러오는 중입니다...</p>
            </div>
          ) : (
            <textarea
              value={memoContent}
              onChange={handleTextChange}
              placeholder={`여기에 메모를 입력해 보세요!\n${friend.name || friend.email}님 화면에도 0.1초 만에 실시간으로 글자가 나타나고 수정됩니다 ✨\n\n- 읽고 싶은 책 리스트 공유\n- 감명 깊은 구절 및 메모 공동 작성\n- 실시간 아이디어 스케치`}
              style={{
                width: '100%',
                flex: 1,
                padding: '1.2rem',
                fontSize: '1rem',
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
          )}
        </div>

        {/* 하단 푸터 바 (통계 및 툴바) */}
        <div
          className="mt-3 pt-3 flex justify-between align-center"
          style={{ borderTop: '1px solid #e2e8f0', background: 'transparent' }}
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
