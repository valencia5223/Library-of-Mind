import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Loader2, History, SquarePen, Trash2, ChevronLeft } from 'lucide-react';
import { runAssistantTurn, isAssistantAvailable } from '../utils/aiAssistant';
import {
  newConversationId,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  getActiveConversationId,
  setActiveConversationId
} from '../utils/aiChatStore';

const SUGGESTIONS = [
  '어제 업무일지 요약해줘',
  '이번 주 일정 알려줘',
  '다음 주 화요일 3시 팀 회의 업무로 추가해줘',
  '최근 회의록에서 할 일만 뽑아줘'
];

const pad = (n) => String(n).padStart(2, '0');
const whenLabel = (ms) => {
  const d = new Date(ms);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === new Date().toDateString()) return `오늘 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
};

// **굵게** 와 줄바꿈만 살려서 보여 줌 (HTML 로 넣지 않음)
const Inline = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{part}</React.Fragment>
    )}
  </>
);

// '### 제목' 은 굵은 줄로, '---' 구분선은 숨김, '`코드`' 는 따옴표 없이
const RichText = ({ text }) => {
  const lines = text.replace(/`([^`\n]+)`/g, '$1').split('\n').filter(line => !/^\s*(-{3,}|\*{3,})\s*$/.test(line));
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        return (
          <React.Fragment key={i}>
            {heading ? <strong><Inline text={heading[1].replace(/\*\*/g, '')} /></strong> : <Inline text={line} />}
            {i < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </>
  );
};

// 달력 옆에 열리는 일정 비서 채팅 (tools: createScheduleTools 결과)
// 대화는 이 브라우저(IndexedDB)에 보관: 다른 메뉴에 갔다 와도 마지막 대화를 이어서 보여 주고, 지난 대화 목록에서 다시 연다
export default function AiChatPanel({ open, onClose, tools, userId }) {
  const [items, setItems] = useState([]); // 화면에 보이는 말풍선
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'list'
  const [conversations, setConversations] = useState([]);
  // 지금 대화 { id, title, createdAt, items, history(Gemini 에 보내는 대화, 뒤에만 덧붙임) }
  // 답을 기다리는 중에 다른 메뉴로 가도 저장이 이어지도록 state 가 아닌 ref 에 둔다
  const convRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // 마지막으로 보던 대화 불러오기
  useEffect(() => {
    let cancelled = false;
    const id = getActiveConversationId(userId);
    if (id) {
      getConversation(id)
        .then(conv => {
          if (cancelled || !conv || convRef.current) return;
          convRef.current = conv;
          setItems(conv.items || []);
        })
        .catch(e => console.warn('AI 대화 불러오기 실패:', e));
    }
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (view === 'chat') listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy, view]);

  const persist = (conv) => {
    saveConversation({ ...conv, userId }).catch(e => console.warn('AI 대화 저장 실패:', e));
  };

  const refreshList = () => {
    listConversations(userId).then(setConversations).catch(() => setConversations([]));
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput('');
    // 첫 질문이면 새 대화로 보관 시작
    if (!convRef.current) {
      convRef.current = { id: newConversationId(), title: text.slice(0, 60), createdAt: Date.now(), items: [], history: [] };
      setActiveConversationId(userId, convRef.current.id);
    }
    const conv = convRef.current;
    const push = (item) => {
      conv.items = [...(conv.items || []), item];
      if (convRef.current === conv) setItems(conv.items);
      persist(conv);
    };
    push({ role: 'user', text });
    setBusy(true);
    try {
      const { messages, refused } = await runAssistantTurn({
        history: conv.history || [],
        userText: text,
        tools,
        onEvent: (ev) => push({ role: ev.type === 'tool' ? 'tool' : 'assistant', text: ev.text })
      });
      conv.history = messages;
      if (refused) push({ role: 'error', text: '이 요청에는 답할 수 없습니다. 다르게 질문해 주세요.' });
      else persist(conv);
    } catch (e) {
      push({ role: 'error', text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const showConversation = (conv) => {
    convRef.current = conv;
    setActiveConversationId(userId, conv?.id || null);
    setItems(conv?.items || []);
    setView('chat');
  };

  const newChat = () => {
    if (!busy) showConversation(null);
  };

  const openList = () => {
    if (busy) return;
    refreshList();
    setView('list');
  };

  const openConversation = async (id) => {
    const conv = await getConversation(id).catch(() => null);
    if (conv) showConversation(conv);
    else refreshList();
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('이 대화를 지울까요?')) return;
    await deleteConversation(id).catch(() => {});
    if (convRef.current?.id === id) {
      convRef.current = null;
      setActiveConversationId(userId, null);
      setItems([]);
    }
    refreshList();
  };

  return (
    <aside className={`ai-panel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="ai-panel-header">
        <div className="flex align-center gap-2">
          <span className="ai-panel-icon"><Sparkles size={16} /></span>
          <div>
            <div className="font-bold" style={{ fontSize: '0.95rem' }}>AI 일정 비서</div>
            <div className="text-xs sub-text">일정·OneNote 노트를 읽고 정리해 드려요</div>
          </div>
        </div>
        <div className="flex align-center gap-1">
          {view === 'list' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('chat')} title="대화로 돌아가기">
              <ChevronLeft size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={openList} disabled={busy} title="지난 대화">
              <History size={15} />
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={newChat} disabled={busy || (view === 'chat' && items.length === 0)} title="새 대화">
            <SquarePen size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} title="닫기">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="ai-panel-body" ref={listRef}>
        {view === 'list' ? (
          <div className="ai-history">
            <div className="text-xs sub-text">지난 대화 · 이 브라우저에 최근 50개까지 보관</div>
            {conversations.length === 0 && <p className="text-sm sub-text" style={{ padding: '1rem 0' }}>보관된 대화가 없습니다.</p>}
            {conversations.map(c => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className={`ai-history-item ${convRef.current?.id === c.id ? 'is-active' : ''}`}
                onClick={() => openConversation(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openConversation(c.id);
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ai-history-title">{c.title || '(제목 없음)'}</div>
                  <div className="text-xs sub-text">{whenLabel(c.updatedAt)} · 질문 {c.count}개</div>
                </div>
                <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => removeConversation(c.id, e)} title="대화 지우기">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : !isAssistantAvailable() ? (
          <p className="text-sm sub-text" style={{ padding: '1rem' }}>데모 모드에서는 AI 비서를 쓸 수 없습니다.</p>
        ) : items.length === 0 ? (
          <div className="ai-empty">
            <p className="text-sm sub-text">이렇게 물어보세요</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" className="btn btn-secondary btn-sm" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs sub-text" style={{ marginTop: '1rem', lineHeight: 1.6 }}>
              질문에 필요한 일정·노트 내용이 AI(Google Gemini)로 전송됩니다. 무료 등급은 보낸 내용이 Google 서비스 개선에 쓰일 수 있어요. 일정 수정·삭제는 실행 전에 확인을 받아요. 대화는 이 브라우저에 보관돼요.
            </p>
          </div>
        ) : (
          items.map((m, i) => (
            <div key={i} className={`ai-msg ai-msg-${m.role}`}>
              {m.role === 'tool' ? m.text : <RichText text={m.text} />}
            </div>
          ))
        )}
        {busy && view === 'chat' && (
          <div className="ai-msg ai-msg-tool">
            <Loader2 size={13} className="ai-spin" /> 생각하는 중…
          </div>
        )}
      </div>

      {view === 'chat' && (
        <form
          className="ai-panel-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="예: 10/20 업무일지 요약해줘"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy || !isAssistantAvailable()}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim() || !isAssistantAvailable()} title="보내기">
            <Send size={16} />
          </button>
        </form>
      )}
    </aside>
  );
}
