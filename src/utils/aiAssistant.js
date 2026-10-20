// 일정 비서 AI 채팅: Supabase Edge Function(ai-chat)으로 Claude 를 부르고,
// Claude 가 요청한 도구(일정 찾기·노트 읽기·일정 추가/수정/삭제)는 브라우저에서 사용자 권한으로 실행한다.
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const MAX_STEPS = 10; // 한 번의 질문에서 도구를 부르고 다시 묻는 최대 횟수
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CATEGORIES = ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isAssistantAvailable = () => Boolean(isSupabaseConfigured());

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayLine = () => {
  const d = new Date();
  return `[오늘: ${ymd(d)} (${WEEKDAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}]`;
};
const isOneNoteId = (id = '') => id.replace(/^sh_/, '').startsWith('sch_onenote_');

// Edge Function 오류 응답에서 사람이 읽을 메시지 꺼내기
const errorMessage = async (error) => {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* 본문 없음 */ }
  return error?.message || 'AI 비서 호출에 실패했습니다.';
};

// 도구 실행기. ctx: { getSchedules, persistSchedule, removeSchedule, userId }
export const createScheduleTools = ({ getSchedules, persistSchedule, removeSchedule, userId }) => {
  const find = (id) => getSchedules().find(s => s.id === id);
  const summary = (s) => ({
    id: s.id,
    date: s.date,
    time: isOneNoteId(s.id) ? '' : (s.time || ''),
    title: s.title,
    category: s.category || 'PERSONAL',
    is_onenote: isOneNoteId(s.id),
    shared: Boolean(s.is_shared || s.shared_friend_id),
    completed: Boolean(s.is_completed)
  });
  const describe = (s) => `${s.date}${s.time && !isOneNoteId(s.id) ? ` ${s.time}` : ''} · ${s.title}`;

  const tools = {
    search_schedules: ({ date_from, date_to, query, category, onenote_only, limit } = {}) => {
      const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
      const matched = getSchedules()
        .filter(s => (!date_from || s.date >= date_from) && (!date_to || s.date <= date_to))
        .filter(s => !category || (s.category || 'PERSONAL') === category)
        .filter(s => !onenote_only || isOneNoteId(s.id))
        .filter(s => {
          if (terms.length === 0) return true;
          const hay = `${s.title || ''}\n${s.memo || ''}`.toLowerCase();
          return terms.every(t => hay.includes(t));
        })
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
      const max = Math.min(Math.max(Number(limit) || 30, 1), 100);
      return {
        total_matched: matched.length,
        items: matched.slice(0, max).map(s => ({
          ...summary(s),
          memo_preview: (s.memo || '').replace(/\s*\n\s*/g, ' / ').slice(0, 150),
          memo_length: (s.memo || '').length
        }))
      };
    },

    read_note: ({ id }) => {
      const s = find(id);
      if (!s) throw new Error(`id 가 ${id} 인 일정을 찾을 수 없습니다.`);
      return { ...summary(s), memo: s.memo || '' };
    },

    add_schedule: async ({ date, title, time, category, memo }) => {
      if (!DATE_RE.test(date || '')) throw new Error('date 는 YYYY-MM-DD 형식이어야 합니다.');
      if (!String(title || '').trim()) throw new Error('title 이 필요합니다.');
      if (time && !TIME_RE.test(time)) throw new Error('time 은 HH:MM(24시간) 형식이어야 합니다.');
      const schedule = {
        id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        shared_friend_id: null,
        is_shared: false,
        date,
        title: String(title).trim(),
        time: time || '',
        category: CATEGORIES.includes(category) ? category : 'PERSONAL',
        memo: String(memo || '').trim(),
        is_completed: false,
        created_at: new Date().toISOString()
      };
      await persistSchedule(schedule);
      return { ok: true, added: summary(schedule) };
    },

    update_schedule: async ({ id, date, title, time, category, memo }) => {
      const s = find(id);
      if (!s) throw new Error(`id 가 ${id} 인 일정을 찾을 수 없습니다.`);
      if (s.user_id && s.user_id !== userId) throw new Error('친구가 공유해 준 일정은 고칠 수 없습니다.');
      if (date !== undefined && !DATE_RE.test(date)) throw new Error('date 는 YYYY-MM-DD 형식이어야 합니다.');
      if (time && !TIME_RE.test(time)) throw new Error('time 은 HH:MM(24시간) 형식이어야 합니다.');
      if (category !== undefined && !CATEGORIES.includes(category)) throw new Error('category 가 올바르지 않습니다.');
      const next = {
        ...s,
        ...(date !== undefined ? { date } : {}),
        ...(title !== undefined ? { title: String(title).trim() || s.title } : {}),
        ...(time !== undefined ? { time } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(memo !== undefined ? { memo: String(memo) } : {})
      };
      const changes = [
        next.date !== s.date && `날짜 ${s.date} → ${next.date}`,
        (next.time || '') !== (s.time || '') && `시간 ${s.time || '없음'} → ${next.time || '없음'}`,
        next.title !== s.title && `제목 "${s.title}" → "${next.title}"`,
        next.category !== s.category && `분류 ${s.category || 'PERSONAL'} → ${next.category}`,
        next.memo !== s.memo && '메모 내용 변경'
      ].filter(Boolean);
      if (changes.length === 0) return { ok: true, unchanged: true };
      const warn = isOneNoteId(s.id) ? '\n\n※ OneNote 노트라 OneNote 에서 다시 동기화되면 덮어써질 수 있습니다.' : '';
      if (!window.confirm(`AI 비서가 일정을 고치려고 합니다.\n\n${describe(s)}\n- ${changes.join('\n- ')}${warn}\n\n진행할까요?`)) {
        return { ok: false, declined_by_user: true };
      }
      await persistSchedule(next);
      return { ok: true, updated: summary(next) };
    },

    delete_schedule: async ({ id }) => {
      const s = find(id);
      if (!s) throw new Error(`id 가 ${id} 인 일정을 찾을 수 없습니다.`);
      if (s.user_id && s.user_id !== userId) throw new Error('친구가 공유해 준 일정은 삭제할 수 없습니다.');
      if (!window.confirm(`AI 비서가 일정을 삭제하려고 합니다.\n\n${describe(s)}\n\n삭제할까요?`)) {
        return { ok: false, declined_by_user: true };
      }
      await removeSchedule(s.id);
      return { ok: true, deleted: summary(s) };
    }
  };

  return {
    run: async (name, input) => {
      const fn = tools[name];
      if (!fn) throw new Error(`알 수 없는 도구: ${name}`);
      return fn(input || {});
    },
    // 진행 표시용 문구
    label: (name, input = {}) => {
      if (name === 'search_schedules') return `🔎 일정 찾는 중${input.query ? ` · "${input.query}"` : ''}`;
      if (name === 'read_note') return `📓 노트 읽는 중${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      if (name === 'add_schedule') return `➕ 일정 추가 · ${input.date || ''} ${input.title || ''}`;
      if (name === 'update_schedule') return `✏️ 일정 수정${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      if (name === 'delete_schedule') return `🗑 일정 삭제${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      return name;
    }
  };
};

// 질문 하나 처리: 도구를 부르고 결과를 돌려주며 Claude 가 답을 마칠 때까지 반복
// history: 지금까지의 API 메시지(수정하지 않고 뒤에만 덧붙임). onEvent({ type: 'text'|'tool', ... })
// 반환: { messages: 새 history, refused }
export const runAssistantTurn = async ({ history, userText, tools, onEvent }) => {
  const messages = [...history, { role: 'user', content: `${todayLine()}\n${userText}` }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages } });
    if (error) throw new Error(await errorMessage(error));
    if (!data || data.error) throw new Error(data?.error || 'AI 비서 응답이 비어 있습니다.');

    // 안전 필터가 거절(대체 모델까지 거절): 이번 질문은 대화에서 빼고 알림
    if (data.stop_reason === 'refusal') return { messages: history, refused: true };

    // 받은 내용은 그대로(사고 과정 블록 포함) 다음 요청에 다시 보냄
    messages.push({ role: 'assistant', content: data.content });
    data.content
      .filter(b => b.type === 'text' && b.text.trim())
      .forEach(b => onEvent({ type: 'text', text: b.text }));

    if (data.stop_reason === 'pause_turn') continue;
    const uses = data.content.filter(b => b.type === 'tool_use');
    if (uses.length === 0) return { messages, refused: false };

    // 모든 도구 결과를 한 user 메시지로
    const results = [];
    for (const use of uses) {
      onEvent({ type: 'tool', text: tools.label(use.name, use.input) });
      try {
        const result = await tools.run(use.name, use.input);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: e.message || String(e), is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('단계가 너무 많아 멈췄습니다. 질문을 나눠서 다시 해 주세요.');
};
