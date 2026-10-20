// supabase/functions/ai-chat/index.ts - 일정 비서 AI 채팅 (Google Gemini API 중계)
//
// API 키는 소스에 두지 않고 Supabase Secrets 로만 주입한다
//   supabase secrets set GEMINI_API_KEY=...        (Google AI Studio 에서 발급, 무료 등급 가능)
//   supabase secrets set GEMINI_MODEL=...          (선택. 기본 gemini-3.5-flash. 쓸 수 있는 이름은 body { list_models: true } 로 확인)
// 로그인한 사용자만 호출할 수 있다(config.toml 에서 verify_jwt = true).
// 도구(일정 찾기·노트 읽기·일정 추가/수정/삭제)는 이 함수가 아니라 브라우저가 사용자 권한으로 실행하고,
// 결과를 functionResponse 로 다시 보내온다. 이 함수는 시스템 프롬프트·도구 정의를 고정하고 한 번의 호출만 중계한다.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// -latest/preview 모델은 무료 등급에서 몹시 붐벼 1분 넘게 걸리기도 해서 안정판 이름을 쓴다
const DEFAULT_MODEL = 'gemini-3.5-flash';
const BUSY_FALLBACK_MODEL = 'gemini-3.5-flash-lite'; // 기본 모델이 붐빌 때(503 등) 한 번 더 시도
const MAX_MESSAGES = 120; // 대화가 너무 길어지면 새 대화를 시작하도록

const SYSTEM_PROMPT = `당신은 'Library of Mind' 앱의 일정 비서입니다. 사용자의 달력 일정과, OneNote 에서 달력으로 가져온 노트(회의록·업무일지 등)를 도구로 읽고 다룹니다.

원칙:
- 일정·노트 내용은 반드시 도구로 확인한 것만 말합니다. 확인하지 않은 일정이나 노트 내용을 지어내지 않습니다.
- 노트를 요약·정리할 때는 본문 전체를 보고 답합니다. search_schedules 결과에 memo(본문 전체)가 있으면 그대로 쓰고, memo_preview(미리보기)만 있으면 read_note 로 본문을 읽습니다. 미리보기만 보고 요약하지 않습니다.
- 한 번에 할 수 있는 도구 호출은 한 응답에 같이 요청합니다(예: 노트 여러 개 읽기).
- 사용자 메시지 앞의 [오늘: ...] 줄이 현재 날짜입니다. '내일', '다음 주 화요일', '10/20' 같은 표현은 이 날짜를 기준으로 YYYY-MM-DD 로 바꿉니다. 연도가 없으면 올해(또는 문맥상 가장 가까운 날짜)로 봅니다.
- 일정을 추가할 때 시간이 없으면 시간 없이 넣고, 분류가 분명하지 않으면 PERSONAL 로 넣습니다. 분류: WORK(업무), READING(독서), PERSONAL(개인), IMPORTANT(중요).
- 일정 수정·삭제는 사용자가 분명히 요청했을 때만 합니다. 앱이 실행 전에 사용자에게 확인을 받습니다. 사용자가 거절하면 그대로 받아들입니다.
- OneNote 노트(is_onenote)는 OneNote 에서 다시 동기화되면 달력에서 고친 내용이 덮어써질 수 있다는 점을 수정 전에 알려 줍니다.
- 찾는 일정이나 노트가 없으면 없다고 말하고, 비슷한 후보가 있으면 보여 줍니다.
- 답은 한국어로, 짧고 읽기 쉽게 씁니다. 목록이 어울리면 '- ' 목록을 쓰고, 날짜는 'M/D(요일)' 형식으로 씁니다.`;

const CATEGORY = { type: 'STRING', enum: ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'] };

const FUNCTIONS = [
  {
    name: 'search_schedules',
    description:
      '달력 일정과 OneNote 노트를 찾습니다. 날짜 범위·검색어·분류로 거를 수 있고, 각 항목의 id·날짜·제목·분류·OneNote 여부를 돌려줍니다. 결과가 3개 이하로 적으면 memo(본문 전체)를, 많으면 memo_preview(앞부분)를 줍니다. memo_preview 만 있을 때 본문이 필요하면 read_note 를 쓰세요. 날짜 범위를 좁게 주면 더 빠릅니다.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_from: { type: 'STRING', description: '시작 날짜 YYYY-MM-DD (포함)' },
        date_to: { type: 'STRING', description: '끝 날짜 YYYY-MM-DD (포함)' },
        query: { type: 'STRING', description: '제목·메모에서 찾을 단어. 띄어쓰기로 여러 단어(모두 포함)' },
        category: CATEGORY,
        onenote_only: { type: 'BOOLEAN', description: 'true 면 OneNote 에서 가져온 노트만' },
        limit: { type: 'INTEGER', description: '최대 개수 (기본 30, 최대 100)' },
      },
    },
  },
  {
    name: 'read_note',
    description: '일정 하나의 메모(OneNote 노트면 본문 전체)를 읽습니다. id 는 search_schedules 결과의 id 를 씁니다.',
    parameters: {
      type: 'OBJECT',
      properties: { id: { type: 'STRING' } },
      required: ['id'],
    },
  },
  {
    name: 'add_schedule',
    description: '달력에 새 일정을 추가합니다.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        title: { type: 'STRING' },
        time: { type: 'STRING', description: 'HH:MM (24시간). 없으면 생략' },
        category: CATEGORY,
        memo: { type: 'STRING' },
      },
      required: ['date', 'title'],
    },
  },
  {
    name: 'update_schedule',
    description: '기존 일정의 날짜·시간·제목·분류·메모를 고칩니다(날짜를 바꾸면 일정 옮기기). 바꿀 항목만 넣습니다. 실행 전에 사용자 확인을 받습니다.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING' },
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        title: { type: 'STRING' },
        time: { type: 'STRING', description: 'HH:MM (24시간). 시간을 지우려면 빈 문자열' },
        category: CATEGORY,
        memo: { type: 'STRING' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_schedule',
    description: '일정을 삭제합니다. 실행 전에 사용자 확인을 받습니다.',
    parameters: {
      type: 'OBJECT',
      properties: { id: { type: 'STRING' } },
      required: ['id'],
    },
  },
];

// 답하기 전 '생각' 시간을 줄여 응답을 빠르게. 모델마다 받는 설정이 달라서(2.5: thinkingBudget, 3: thinkingLevel)
// 차례로 시도하고, 처음 통한 설정을 기억해 다음부터 바로 쓴다.
const THINKING_OPTIONS: (Record<string, unknown> | null)[] = [
  { thinkingLevel: 'low' },
  { thinkingBudget: 0 },
  { thinkingBudget: 512 },
  null, // 설정 없이(모델 기본값)
];
const thinkingChoice = new Map<string, number>(); // 모델 → THINKING_OPTIONS 번호

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST 만 지원합니다.' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY 가 설정되지 않았습니다 (supabase secrets set 필요).' }, 500);
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

  // contents: Gemini 형식 대화 [{ role: 'user'|'model', parts: [...] }]
  let contents: unknown[];
  let listModels = false;
  try {
    ({ contents, list_models: listModels } = await req.json());
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  // 관리용: 이 키로 쓸 수 있는 모델 이름 목록 (GEMINI_MODEL 고를 때)
  if (listModels) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey } });
    const body = await r.json().catch(() => null);
    const names = (body?.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''));
    return json({ current: model, models: names });
  }
  if (!Array.isArray(contents) || contents.length === 0) return json({ error: 'contents 가 필요합니다.' }, 400);
  if (contents.length > MAX_MESSAGES) return json({ error: '대화가 너무 길어졌습니다. 새 대화를 시작해 주세요.', code: 'too_long' }, 400);

  const callGemini = (thinkingConfig: Record<string, unknown> | null, useModel = model) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(useModel)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: FUNCTIONS }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { maxOutputTokens: 8192, ...(thinkingConfig ? { thinkingConfig } : {}) },
      }),
    });

  let res: Response | undefined;
  let data: any = null;
  try {
    for (let i = thinkingChoice.get(model) ?? 0; i < THINKING_OPTIONS.length; i++) {
      res = await callGemini(THINKING_OPTIONS[i]);
      data = await res.json().catch(() => null);
      // 이 모델이 받지 않는 생각 설정이면 다음 설정으로
      const thinkingRejected = res.status === 400 && /thinking/i.test(data?.error?.message || '');
      if (!thinkingRejected) {
        if (res.ok) thinkingChoice.set(model, i);
        break;
      }
    }
  } catch (error) {
    console.error('ai-chat fetch error:', error);
    return json({ error: 'Gemini 서버에 연결하지 못했습니다.' }, 502);
  }
  if (!res) return json({ error: 'Gemini 호출에 실패했습니다.' }, 502);

  // 서버가 붐비면 가벼운 모델로 한 번 더
  if ([500, 503, 504].includes(res.status) && model !== BUSY_FALLBACK_MODEL) {
    console.warn('ai-chat busy, fallback:', res.status, data?.error?.message);
    try {
      res = await callGemini(THINKING_OPTIONS[thinkingChoice.get(BUSY_FALLBACK_MODEL) ?? 0], BUSY_FALLBACK_MODEL);
      data = await res.json().catch(() => null);
    } catch (error) {
      console.error('ai-chat fallback fetch error:', error);
      return json({ error: 'Gemini 서버에 연결하지 못했습니다.' }, 502);
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || res.statusText;
    console.error('ai-chat gemini error:', res.status, message);
    if (res.status === 429) return json({ error: '무료 사용 한도에 걸렸습니다. 잠시(1분쯤) 뒤 다시 시도해 주세요.' }, 429);
    if (res.status === 401 || res.status === 403 || /API key/i.test(message)) {
      return json({ error: 'Gemini API 키가 올바르지 않습니다.' }, 500);
    }
    if (res.status === 404) return json({ error: `Gemini 모델(${model})을 찾을 수 없습니다. GEMINI_MODEL 을 확인해 주세요.` }, 500);
    if (res.status === 400) return json({ error: `요청 오류: ${message}` }, 400);
    if (res.status === 503) return json({ error: 'Gemini 서버가 붐빕니다. 잠시 뒤 다시 시도해 주세요.' }, 503);
    return json({ error: `Gemini API 오류 (${res.status})` }, 502);
  }

  // 질문 자체가 안전 필터에 막힘
  if (data?.promptFeedback?.blockReason) return json({ parts: [], finish_reason: 'BLOCKED', blocked: true, model });

  const candidate = data?.candidates?.[0];
  const finish = candidate?.finishReason || 'STOP';
  const blocked = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(finish);
  return json({ parts: candidate?.content?.parts || [], finish_reason: finish, blocked, model });
});
