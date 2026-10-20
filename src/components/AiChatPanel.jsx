import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, RotateCcw, Loader2 } from 'lucide-react';
import { runAssistantTurn, isAssistantAvailable } from '../utils/aiAssistant';

const SUGGESTIONS = [
  '어제 업무일지 요약해줘',
  '이번 주 일정 알려줘',
  '다음 주 화요일 3시 팀 회의 업무로 추가해줘',
  '최근 회의록에서 할 일만 뽑아줘'
];

// **굵게** 와 줄바꿈만 살려서 보여 줌 (HTML 로 넣지 않음)
const RichText = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{part}</React.Fragment>
    )}
  </>
);

// 달력 옆에 열리는 일정 비서 채팅 (tools: createScheduleTools 결과)
export default function AiChatPanel({ open, onClose, tools }) {
  const [history, setHistory] = useState([]); // Gemini 에 보내는 대화 (뒤에만 덧붙임)
  const [items, setItems] = useState([]); // 화면에 보이는 말풍선
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy]);

  const push = (item) => setItems(prev => [...prev, item]);

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput('');
    push({ role: 'user', text });
    setBusy(true);
    try {
      const { messages, refused } = await runAssistantTurn({
        history,
        userText: text,
        tools,
        onEvent: (ev) => push({ role: ev.type === 'tool' ? 'tool' : 'assistant', text: ev.text })
      });
      setHistory(messages);
      if (refused) push({ role: 'error', text: '이 요청에는 답할 수 없습니다. 다르게 질문해 주세요.' });
    } catch (e) {
      push({ role: 'error', text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (busy) return;
    setHistory([]);
    setItems([]);
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={busy || items.length === 0} title="새 대화">
            <RotateCcw size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} title="닫기">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="ai-panel-body" ref={listRef}>
        {!isAssistantAvailable() ? (
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
              질문에 필요한 일정·노트 내용이 AI(Google Gemini)로 전송됩니다. 무료 등급은 보낸 내용이 Google 서비스 개선에 쓰일 수 있어요. 일정 수정·삭제는 실행 전에 확인을 받아요.
            </p>
          </div>
        ) : (
          items.map((m, i) => (
            <div key={i} className={`ai-msg ai-msg-${m.role}`}>
              {m.role === 'tool' ? m.text : <RichText text={m.text} />}
            </div>
          ))
        )}
        {busy && (
          <div className="ai-msg ai-msg-tool">
            <Loader2 size={13} className="ai-spin" /> 생각하는 중…
          </div>
        )}
      </div>

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
    </aside>
  );
}
