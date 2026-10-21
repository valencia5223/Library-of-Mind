// 일정 비서 AI 채팅: Supabase Edge Function(ai-chat)으로 Google Gemini 를 부르고,
// Gemini 가 요청한 도구(일정 찾기·노트 읽기·일정 추가/수정/삭제·첨부 엑셀 찾기)는 브라우저에서 사용자 권한으로 실행한다.
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const MAX_STEPS = 10; // 한 번의 질문에서 도구를 부르고 다시 묻는 최대 횟수
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CATEGORIES = ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FULL_MEMO_ITEMS = 30; // 찾은 일정이 이만큼 이하이고
const FULL_MEMO_CHARS = 60000; // 메모 합이 이 길이 이하면 검색 결과에 본문 전체를 넣음 (기간 요약을 한 번에)
const READ_MAX = 20; // read_notes 한 번에 읽는 최대 개수

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
// loadNoteText(id): OneNote 노트를 원본 서식에서 다시 뽑은 텍스트(취소선 ~~ ~~ 포함). 없으면 null → 저장된 메모를 씀
export const createScheduleTools = ({ getSchedules, persistSchedule, removeSchedule, loadNoteText, userId }) => {
  const find = (id) => getSchedules().find(s => s.id === id);
  // 노트 본문 + 취소선 정보. OneNote 노트인데 원본 서식을 못 읽으면 format_unavailable
  const noteBody = async (s) => {
    let text = null;
    if (loadNoteText && isOneNoteId(s.id)) {
      try {
        text = await loadNoteText(s.id);
      } catch (e) {
        console.warn('AI 비서: 원본 서식 읽기 실패', e);
      }
    }
    const memo = text || s.memo || '';
    const struck = [...memo.matchAll(/~~([^~\n]+)~~/g)].map(m => m[1].trim()).filter(Boolean);
    return {
      memo,
      ...(struck.length ? { struck_items: struck } : {}),
      ...(isOneNoteId(s.id) && !text ? { format_unavailable: true } : {})
    };
  };
  const summary = (s) => ({
    id: s.id,
    date: s.date,
    time: isOneNoteId(s.id) ? '' : (s.time || ''),
    title: s.title,
    category: s.category || 'PERSONAL',
    is_onenote: isOneNoteId(s.id),
    ...(s.onenote_path ? { onenote_location: s.onenote_path } : {}),
    shared: Boolean(s.is_shared || s.shared_friend_id),
    completed: Boolean(s.is_completed)
  });
  const describe = (s) => `${s.date}${s.time && !isOneNoteId(s.id) ? ` ${s.time}` : ''} · ${s.title}`;

  const tools = {
    search_schedules: async ({ date_from, date_to, query, category, onenote_only, limit } = {}) => {
      const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
      const hayOf = (s) => `${s.title || ''}\n${s.memo || ''}\n${s.onenote_path || ''}`.toLowerCase();
      const inRange = getSchedules()
        .filter(s => (!date_from || s.date >= date_from) && (!date_to || s.date <= date_to))
        .filter(s => !category || (s.category || 'PERSONAL') === category)
        .filter(s => !onenote_only || isOneNoteId(s.id));
      // 단어별로 몇 개가 걸리는지 (여러 단어 AND 로 너무 좁아졌는지 AI 가 알 수 있게)
      const termCounts = terms.length > 1
        ? Object.fromEntries(terms.map(t => [t, inRange.filter(s => hayOf(s).includes(t)).length]))
        : null;
      const matched = inRange
        .filter(s => terms.every(t => hayOf(s).includes(t)))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
      const max = Math.min(Math.max(Number(limit) || 30, 1), 100);
      const items = matched.slice(0, max);
      // 결과가 적으면 본문 전체를 같이 줘서 read_note 왕복을 줄임
      const fullMemo = items.length <= FULL_MEMO_ITEMS &&
        items.reduce((n, s) => n + (s.memo || '').length, 0) <= FULL_MEMO_CHARS;
      const bodies = fullMemo ? await Promise.all(items.map(noteBody)) : [];
      return {
        total_matched: matched.length,
        ...(termCounts ? { matches_per_word: termCounts } : {}),
        ...(fullMemo ? {} : { note: 'memo_preview 만 있음. 요약하려면 read_notes 로 id 들을 한 번에 읽으세요.' }),
        items: items.map((s, i) => fullMemo
          ? { ...summary(s), ...bodies[i] }
          : {
            ...summary(s),
            memo_preview: (s.memo || '').replace(/\s*\n\s*/g, ' / ').slice(0, 150),
            memo_length: (s.memo || '').length
          })
      };
    },

    read_note: async ({ id }) => {
      const s = find(id);
      if (!s) throw new Error(`id 가 ${id} 인 일정을 찾을 수 없습니다.`);
      return { ...summary(s), ...(await noteBody(s)) };
    },

    read_notes: async ({ ids }) => {
      const list = (Array.isArray(ids) ? ids : []).slice(0, READ_MAX);
      if (list.length === 0) throw new Error('ids 가 필요합니다.');
      const notes = await Promise.all(list.map(async (id) => {
        const s = find(id);
        return s ? { ...summary(s), ...(await noteBody(s)) } : { id, error: '찾을 수 없음' };
      }));
      return { count: notes.length, notes, ...(ids.length > READ_MAX ? { truncated: `한 번에 ${READ_MAX}개까지만 읽었습니다. 나머지는 다시 요청하세요.` } : {}) };
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
    },

    // 첨부한 엑셀(업무 기록)에서 날짜별 줄 찾기. SheetJS 는 이때 처음 불러옴
    search_excel: async (args) => {
      const { searchExcel } = await import('./excelSource');
      return searchExcel(userId, args);
    }
  };

  return {
    run: async (name, input) => {
      const fn = tools[name];
      if (!fn) throw new Error(`알 수 없는 도구: ${name}`);
      return fn(input || {});
    },
    // 도구 실행 뒤 덧붙일 문구 (취소선 확인 결과)
    note: (name, result) => {
      if (name === 'search_excel') {
        return `↳ ${result?.file || '엑셀'} (수정 ${result?.file_modified || '?'}) · ${result?.total_matched ?? 0}줄 · ${result?.source || ''}`;
      }
      if (!['read_note', 'read_notes', 'search_schedules'].includes(name)) return null;
      const list = name === 'read_note' ? [result]
        : name === 'read_notes' ? (result?.notes || [])
          : (result?.items || []).filter(i => 'memo' in i);
      if (list.length === 0) return null;
      const struck = list.reduce((n, i) => n + (i?.struck_items?.length || 0), 0);
      if (list.some(i => i?.format_unavailable)) return '↳ 원본 서식을 못 읽어 취소선은 확인하지 못했어요';
      if (struck) return `↳ 취소선 ${struck}곳 확인`;
      return list.some(i => i?.is_onenote) ? '↳ 원본 서식에 취소선 없음' : null;
    },
    // 진행 표시용 문구
    label: (name, input = {}) => {
      if (name === 'search_schedules') return `🔎 일정 찾는 중${input.query ? ` · "${input.query}"` : ''}`;
      if (name === 'read_note') return `📓 노트 읽는 중${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      if (name === 'read_notes') return `📓 노트 ${(input.ids || []).length}개 읽는 중`;
      if (name === 'add_schedule') return `➕ 일정 추가 · ${input.date || ''} ${input.title || ''}`;
      if (name === 'update_schedule') return `✏️ 일정 수정${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      if (name === 'search_excel') {
        const range = input.date_from && input.date_to && input.date_from !== input.date_to
          ? `${input.date_from} ~ ${input.date_to}` : (input.date_from || input.date_to || '');
        return `📊 엑셀 읽는 중${range ? ` · ${range}` : ''}${input.query ? ` · "${input.query}"` : ''}`;
      }
      if (name === 'delete_schedule') return `🗑 일정 삭제${find(input.id) ? ` · ${find(input.id).title}` : ''}`;
      return name;
    }
  };
};

// 지난 질문에서 읽은 엑셀 내용은 지움: 그 사이 파일이 저장됐을 수 있어서 AI 가 옛 결과를 다시 쓰지 못하게
// (functionResponse 만 바꾸고 model parts·thoughtSignature 는 그대로)
const EXCEL_EXPIRED = { result: { expired: '지난 질문에서 읽은 엑셀 결과라 지웠습니다. 엑셀 내용이 필요하면 search_excel 을 다시 부르세요.' } };
const expireExcelResults = (history) => history.map(c => (
  c.role === 'user' && (c.parts || []).some(p => p.functionResponse?.name === 'search_excel' && !p.functionResponse.response?.result?.expired)
    ? { ...c, parts: c.parts.map(p => (p.functionResponse?.name === 'search_excel' ? { functionResponse: { ...p.functionResponse, response: EXCEL_EXPIRED } } : p)) }
    : c
));

// 질문 하나 처리: 도구를 부르고 결과를 돌려주며 Gemini 가 답을 마칠 때까지 반복
// history: 지금까지의 Gemini contents(수정하지 않고 뒤에만 덧붙임). onEvent({ type: 'text'|'tool', ... })
// contextLine: 날짜 줄 다음에 덧붙일 상황 안내 (예: 첨부 엑셀은 매번 다시 읽기)
// 반환: { messages: 새 history, refused }
export const runAssistantTurn = async ({ history, userText, tools, onEvent, contextLine = '' }) => {
  const head = contextLine ? `${todayLine()}\n${contextLine}` : todayLine();
  const contents = [...expireExcelResults(history), { role: 'user', parts: [{ text: `${head}\n${userText}` }] }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const { data, error } = await supabase.functions.invoke('ai-chat', { body: { contents } });
    if (error) throw new Error(await errorMessage(error));
    if (!data || data.error) throw new Error(data?.error || 'AI 비서 응답이 비어 있습니다.');

    // 안전 필터에 막힘: 이번 질문은 대화에서 빼고 알림
    if (data.blocked) return { messages: history, refused: true };

    const parts = Array.isArray(data.parts) ? data.parts : [];
    if (parts.length === 0) throw new Error('AI 비서가 답을 만들지 못했습니다. 다시 시도해 주세요.');

    // 받은 parts 는 그대로(thoughtSignature 포함) 다음 요청에 다시 보냄
    contents.push({ role: 'model', parts });
    // 한 응답의 글 조각들은 말풍선 하나로
    const text = parts
      .filter(p => typeof p.text === 'string' && !p.thought)
      .map(p => p.text)
      .join('')
      .trim();
    if (text) onEvent({ type: 'text', text });

    const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);
    if (calls.length === 0) return { messages: contents, refused: false };

    // 모든 도구 결과를 한 user 메시지로
    const results = [];
    for (const call of calls) {
      onEvent({ type: 'tool', text: tools.label(call.name, call.args || {}) });
      let response;
      try {
        const result = await tools.run(call.name, call.args || {});
        response = { result };
        const extra = tools.note?.(call.name, result);
        if (extra) onEvent({ type: 'tool', text: extra });
      } catch (e) {
        response = { error: e.message || String(e) };
      }
      results.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response } });
    }
    contents.push({ role: 'user', parts: results });
  }
  throw new Error('단계가 너무 많아 멈췄습니다. 질문을 나눠서 다시 해 주세요.');
};
