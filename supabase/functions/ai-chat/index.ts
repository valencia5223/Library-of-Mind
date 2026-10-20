// supabase/functions/ai-chat/index.ts - 일정 비서 AI 채팅 (Claude API 중계)
//
// API 키는 소스에 두지 않고 Supabase Secrets 로만 주입한다
//   supabase secrets set ANTHROPIC_API_KEY=...
// 로그인한 사용자만 호출할 수 있다(config.toml 에서 verify_jwt = true).
// 도구(일정 찾기·노트 읽기·일정 추가/수정/삭제)는 이 함수가 아니라 브라우저가 사용자 권한으로 실행하고,
// 결과를 tool_result 로 다시 보내온다. 이 함수는 시스템 프롬프트·도구 정의를 고정하고 한 번의 호출만 중계한다.

import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 120; // 대화가 너무 길어지면 새 대화를 시작하도록

const SYSTEM_PROMPT = `당신은 'Library of Mind' 앱의 일정 비서입니다. 사용자의 달력 일정과, OneNote 에서 달력으로 가져온 노트(회의록·업무일지 등)를 도구로 읽고 다룹니다.

원칙:
- 일정·노트 내용은 반드시 도구로 확인한 것만 말합니다. 확인하지 않은 일정이나 노트 내용을 지어내지 않습니다.
- 노트를 요약·정리할 때는 search_schedules 로 노트를 찾은 뒤 read_note 로 본문 전체를 읽고 답합니다. 미리보기만 보고 요약하지 않습니다.
- 사용자 메시지 앞의 [오늘: ...] 줄이 현재 날짜입니다. '내일', '다음 주 화요일', '10/20' 같은 표현은 이 날짜를 기준으로 YYYY-MM-DD 로 바꿉니다. 연도가 없으면 올해(또는 문맥상 가장 가까운 날짜)로 봅니다.
- 일정을 추가할 때 시간이 없으면 시간 없이 넣고, 분류가 분명하지 않으면 PERSONAL 로 넣습니다. 분류: WORK(업무), READING(독서), PERSONAL(개인), IMPORTANT(중요).
- 일정 수정·삭제는 사용자가 분명히 요청했을 때만 합니다. 앱이 실행 전에 사용자에게 확인을 받습니다. 사용자가 거절하면 그대로 받아들입니다.
- OneNote 노트(is_onenote)는 OneNote 에서 다시 동기화되면 달력에서 고친 내용이 덮어써질 수 있다는 점을 수정 전에 알려 줍니다.
- 찾는 일정이나 노트가 없으면 없다고 말하고, 비슷한 후보가 있으면 보여 줍니다.
- 답은 한국어로, 짧고 읽기 쉽게 씁니다. 목록이 어울리면 '- ' 목록을 쓰고, 날짜는 'M/D(요일)' 형식으로 씁니다.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_schedules',
    description:
      '달력 일정과 OneNote 노트를 찾습니다. 날짜 범위·검색어·분류로 거를 수 있고, 각 항목의 id·날짜·제목·분류·OneNote 여부·메모 앞부분을 돌려줍니다. 노트 본문 전체가 필요하면 read_note 를 쓰세요.',
    input_schema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: '시작 날짜 YYYY-MM-DD (포함)' },
        date_to: { type: 'string', description: '끝 날짜 YYYY-MM-DD (포함)' },
        query: { type: 'string', description: '제목·메모에서 찾을 단어. 띄어쓰기로 여러 단어(모두 포함)' },
        category: { type: 'string', enum: ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'] },
        onenote_only: { type: 'boolean', description: 'true 면 OneNote 에서 가져온 노트만' },
        limit: { type: 'integer', description: '최대 개수 (기본 30, 최대 100)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_note',
    description: '일정 하나의 메모(OneNote 노트면 본문 전체)를 읽습니다. id 는 search_schedules 결과의 id 를 씁니다.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_schedule',
    description: '달력에 새 일정을 추가합니다.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        title: { type: 'string' },
        time: { type: 'string', description: 'HH:MM (24시간). 없으면 생략' },
        category: { type: 'string', enum: ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'] },
        memo: { type: 'string' },
      },
      required: ['date', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_schedule',
    description: '기존 일정의 날짜·시간·제목·분류·메모를 고칩니다(날짜를 바꾸면 일정 옮기기). 바꿀 항목만 넣습니다. 실행 전에 사용자 확인을 받습니다.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        title: { type: 'string' },
        time: { type: 'string', description: 'HH:MM (24시간). 시간을 지우려면 빈 문자열' },
        category: { type: 'string', enum: ['WORK', 'READING', 'PERSONAL', 'IMPORTANT'] },
        memo: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_schedule',
    description: '일정을 삭제합니다. 실행 전에 사용자 확인을 받습니다.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST 만 지원합니다.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다 (supabase secrets set 필요).' }, 500);

  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    ({ messages } = await req.json());
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages 가 필요합니다.' }, 400);
  if (messages.length > MAX_MESSAGES) return json({ error: '대화가 너무 길어졌습니다. 새 대화를 시작해 주세요.', code: 'too_long' }, 400);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // 안전 필터가 거절하면 Anthropic 이 권장하는 다른 모델로 같은 요청을 다시 실행
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' }, // 시스템 프롬프트·도구·이전 대화를 캐시
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    return json({ content: response.content, stop_reason: response.stop_reason, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: '요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도해 주세요.' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'Claude API 키가 올바르지 않습니다.' }, 500);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error('ai-chat bad request:', error.message);
      return json({ error: `요청 오류: ${error.message}` }, 400);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('ai-chat api error:', error.status, error.message);
      return json({ error: `Claude API 오류 (${error.status})` }, 502);
    }
    console.error('ai-chat error:', error);
    return json({ error: '알 수 없는 오류가 발생했습니다.' }, 500);
  }
});
