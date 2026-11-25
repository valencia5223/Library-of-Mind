// 흔들기 알림 문구: 업무 중 화면에 떠도 채팅인지 모르게 'AI 활용 교육' 홍보 문구로 보낸다.
// 보낼 때마다 AI 이름·제목·본문을 무작위로 골라 매번 조금씩 다르게 보인다.
const AIS = ['ChatGPT', 'GPT', 'Claude', 'Gemini', 'GPT-5', 'Claude AI', 'Google Gemini'];

const TITLES = [
  '📢 AI 시대, {ai} 교육 안내',
  '🎓 {ai} 실무 활용 과정 모집',
  '🚀 지금 시작하는 {ai} 교육',
  '💡 {ai}로 업무 시간 절반 줄이기',
  '📚 직장인 {ai} 특강 오픈',
  '✨ {ai} 활용법, 아직 모르세요?',
  '🔥 {ai} 교육 마감 임박',
];

const BODIES = [
  '{ai} 하나로 보고서·메일·기획서까지! 실무 활용 교육 신청 받는 중이에요.',
  '이제 AI 모르면 뒤처져요. {ai} 기초부터 실전까지 한 번에 배워 보세요.',
  '{ai} 프롬프트 작성법부터 업무 자동화까지, 직장인 맞춤 과정이에요.',
  '하루 2시간 아끼는 {ai} 활용법. 이번 기수 얼리버드 할인 중!',
  '{ai}·{ai2} 비교 실습으로 내 업무에 맞는 AI를 찾아 드려요.',
  '엑셀·PPT·문서 작업을 {ai}로 끝내는 법, 무료 체험 강의 열렸어요.',
  'AI 시대 필수 역량! {ai} 실무 교육 수강생 모집 중입니다.',
  '{ai} 처음이어도 괜찮아요. 왕초보 반부터 차근차근 알려 드려요.',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function randomNudgeMessage() {
  const ai = pick(AIS);
  let ai2 = pick(AIS);
  for (let i = 0; i < 5 && ai2.split(' ')[0] === ai.split(' ')[0]; i++) ai2 = pick(AIS);
  const fill = (s) => s.replaceAll('{ai2}', ai2).replaceAll('{ai}', ai);
  return { title: fill(pick(TITLES)), body: fill(pick(BODIES)) };
}

// 흔들기 한 번을 가리키는 번호. 실시간 알림·웹 푸시가 같은 번호를 가져 한 번만 띄운다
export const newNudgeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
