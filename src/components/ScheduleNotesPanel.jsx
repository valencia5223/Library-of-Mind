import React, { useState, useMemo } from 'react';
import { X, Search, NotebookText, Users, CalendarDays } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const isOneNoteId = (id = '') => id.replace(/^sh_/, '').startsWith('sch_onenote_');

// 검색어(띄어쓰기로 여러 개 = 모두 포함)를 강조해서 보여 줌
const Highlight = ({ text, terms }) => {
  if (!text || terms.length === 0) return text || null;
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return parts.map((part, i) =>
    terms.some(t => part.toLowerCase() === t)
      ? <mark key={i} style={{ backgroundColor: '#fde68a', color: 'inherit', padding: '0 1px', borderRadius: '3px' }}>{part}</mark>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

// 메모에서 검색어 주변만 잘라 보여 줌 (검색어가 없으면 앞부분)
const snippetOf = (memo, terms) => {
  if (!memo) return '';
  const flat = memo.replace(/\s*\n\s*/g, ' · ');
  const lower = flat.toLowerCase();
  const hit = terms.map(t => lower.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  if (hit === undefined || hit < 40) return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
  const start = hit - 40;
  const end = Math.min(flat.length, hit + 100);
  return `…${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
};

// OneNote 노트(또는 전체 일정)를 날짜순으로 모아 보고 제목·메모로 찾는 창
export default function ScheduleNotesPanel({ schedules = [], onClose, onOpen, getCategoryBadge }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('onenote'); // 'onenote' | 'all'
  const [order, setOrder] = useState('desc'); // 'desc' 최근 날짜부터 | 'asc'

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const groups = useMemo(() => {
    const list = schedules
      .filter(s => scope === 'all' || isOneNoteId(s.id))
      .filter(s => {
        if (terms.length === 0) return true;
        const hay = `${s.title || ''}\n${s.memo || ''}`.toLowerCase();
        return terms.every(t => hay.includes(t));
      })
      .sort((a, b) => {
        const cmp = (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '');
        return order === 'desc' ? -cmp : cmp;
      });

    const byMonth = [];
    list.forEach(s => {
      const key = (s.date || '').slice(0, 7);
      const last = byMonth[byMonth.length - 1];
      if (last && last.key === key) last.items.push(s);
      else byMonth.push({ key, items: [s] });
    });
    return { byMonth, total: list.length };
  }, [schedules, scope, terms, order]);

  const oneNoteCount = useMemo(() => schedules.filter(s => isOneNoteId(s.id)).length, [schedules]);

  const monthLabel = (key) => {
    const [y, m] = key.split('-');
    return y && m ? `${y}년 ${Number(m)}월` : '날짜 없음';
  };

  const dayLabel = (dateStr) => {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    if (!y) return '';
    return `${m}/${d} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
  };

  return (
    <div className="modal-overlay modal-backdrop" onClick={onClose}>
      <div
        className="modal-card calendar-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '760px', width: '95%', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <h3 className="modal-title flex align-center gap-2">
            <NotebookText size={20} style={{ color: '#7719aa' }} />
            노트 모아보기
          </h3>
          <button className="modal-close" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '0.9rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="search"
              className="input-field"
              placeholder="제목이나 메모 내용으로 찾기 (띄어쓰기로 여러 단어)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>

          <div className="flex align-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
            <div className="flex gap-1">
              {[['onenote', `📓 OneNote 노트 (${oneNoteCount})`], ['all', `🗓 전체 일정 (${schedules.length})`]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm ${scope === key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setScope(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex align-center gap-2">
              <span className="text-xs sub-text">{groups.total}개</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOrder(o => (o === 'desc' ? 'asc' : 'desc'))}
              >
                {order === 'desc' ? '최근 날짜부터 ↓' : '오래된 날짜부터 ↑'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 'min(60vh, 620px)', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
            {groups.total === 0 && (
              <p className="text-sm sub-text" style={{ textAlign: 'center', padding: '2rem 0' }}>
                {terms.length > 0
                  ? '찾는 내용이 없습니다.'
                  : scope === 'onenote' ? '아직 가져온 OneNote 노트가 없습니다.' : '일정이 없습니다.'}
              </p>
            )}

            {groups.byMonth.map(group => (
              <div key={group.key} style={{ marginBottom: '1rem' }}>
                <div
                  className="text-xs font-bold"
                  style={{ position: 'sticky', top: 0, background: '#ffffff', color: '#475569', padding: '0.35rem 0', zIndex: 1, borderBottom: '1px solid #f1f5f9' }}
                >
                  {monthLabel(group.key)} · {group.items.length}개
                </div>
                {group.items.map(s => {
                  const badge = getCategoryBadge(s.category);
                  const oneNote = isOneNoteId(s.id);
                  const shared = s.is_shared || s.shared_friend_id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpen(s)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${oneNote ? '#7719aa' : badge.color}`,
                        borderRadius: '10px',
                        padding: '0.7rem 0.85rem',
                        marginTop: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="flex align-center gap-2" style={{ minWidth: 0 }}>
                        <span className="text-xs font-bold flex align-center gap-1" style={{ color: '#64748b', flexShrink: 0 }}>
                          <CalendarDays size={13} /> {dayLabel(s.date)}{!oneNote && s.time ? ` ${s.time}` : ''}
                        </span>
                        <span className="text-sm font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a', flex: 1, minWidth: 0 }}>
                          {oneNote && '📓 '}<Highlight text={s.title} terms={terms} />
                        </span>
                        {shared && <Users size={14} style={{ color: '#0284c7', flexShrink: 0 }} title="공유 일정" />}
                        {!oneNote && (
                          <span className="text-xs" style={{ color: badge.color, backgroundColor: badge.bg, borderRadius: '6px', padding: '0.05rem 0.4rem', flexShrink: 0 }}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      {s.memo && (
                        <div className="text-xs" style={{ color: '#475569', marginTop: '0.35rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <Highlight text={snippetOf(s.memo, terms)} terms={terms} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
