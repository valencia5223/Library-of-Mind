import { FISH_SPECIES, STAGE_NAMES } from './aquariumData.js';

// ═════════════════════════════════════════════════════════════════════════════
// 🎙️ 음성 안내 문장 모음
// 앱에서 말하는 모든 문장은 여기서 만든다. scripts/generate-voices.mjs 가 이 파일로
// 전체 문장 목록을 뽑아 남성 아나운서 음성 MP3(public/voice/<key>.mp3)를 미리 생성한다.
// 문장을 바꾸거나 동물/과일을 추가했으면 `npm run voices` 를 다시 실행할 것.
// (MP3가 없는 문장은 브라우저 기본 TTS로 대신 읽는다)
// ═════════════════════════════════════════════════════════════════════════════

// 한글 조사 자동 연결 헬퍼 (은/는, 이/가, 을/를, 과/와)
export function attachJosa(word, josaType) {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  const hasBatchim = (lastChar - 0xac00) % 28 > 0;
  if (josaType === '은/는') return word + (hasBatchim ? '은' : '는');
  if (josaType === '이/가') return word + (hasBatchim ? '이' : '가');
  if (josaType === '을/를') return word + (hasBatchim ? '을' : '를');
  if (josaType === '과/와') return word + (hasBatchim ? '과' : '와');
  if (josaType === '이에요/예요') return word + (hasBatchim ? '이에요' : '예요');
  return word;
}

// 텍스트를 자연스러운 구어체로 다듬고 기호/이모지/물결표 제거
export function formatSpokenKoreanText(text) {
  if (!text) return '';

  // 1. 이모지, 물결표(~), 특수 기호 제거 (TTS가 기호를 소리내어 읽는 현상 방지)
  let cleanText = text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[~～]/g, ' ')
    .replace(/[*#@^&_+={}\[\]<>"'`]/g, ' ')
    .replace(/["'""'']/g, '');

  // 2. 자연스러운 호흡 구분 및 어미 보정
  cleanText = cleanText
    .replace(/배고파요[!.,·…~～\s]*/g, '배고파요, ')
    .replace(/어디 있을까요\?/g, '어디에 있을까요?')
    .replace(/먹고 싶어요[!.]?/g, '먹고 싶대요!')
    .replace(/참 잘했어요[!.]?/g, '참 잘했어요! 대단해요!')
    .replace(/정말 최고예요[!.]?/g, '정말 최고예요!')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanText;
}

// 문장 → MP3 파일 키 (FNV-1a 32bit). 생성 스크립트와 앱이 같은 함수를 쓴다.
export function voiceKey(text) {
  const s = formatSpokenKoreanText(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const sleepBase = (animal) => (animal ? animal.name.replace('아기 ', '') : '동물');

export const FEED_PRAISE_COUNT = 3;

export const VOICE = {
  // 🌙 코 잘 시간
  sleepAsleep: (animal) => `${sleepBase(animal)}가 이불을 꼭 덮고 쿨쿨 잘 자고 있어요.`,
  sleepYawn: (animal) => `${sleepBase(animal)}가 하품을 해요. 포근한 이불을 덮어주세요~`,
  sleepBlanket: (animal, blanket) => `${sleepBase(animal)}에게 ${attachJosa(blanket.blanketName, '을/를')} 덮어줬어요.`,
  sleepWake: (animal) => `${sleepBase(animal)}가 이불이 걷히자 잠에서 깨어났어요!`,

  // 🧩 퍼즐
  puzzleWrong: () => '여기가 아니에요~ 제자리에 쏙 맞춰보세요!',
  puzzleStart: (theme) => `우리 ${attachJosa(theme.name, '을/를')} 퍼즐을 맞춰볼까요?`,
  puzzleDone: (theme) => `와아! 멋진 ${attachJosa(theme.name, '을/를')} 퍼즐을 완성했어요! 참 잘했어요~ 🌟`,

  // 🐠 내 어항 키우기
  aquaWelcome: () => '우리 어항에 온 걸 환영해요! 아기 물고기들을 잘 키워 주세요!',
  aquaWelcomeBack: () => '다시 왔네요! 물고기들이 기다리고 있었어요!',
  aquaHungry: () => '물고기들이 배고프대요! 밥을 주세요!',
  aquaDirty: () => '물이 더러워졌어요! 깨끗하게 청소해 주세요!',
  aquaFeed: () => '맛있는 밥이에요! 냠냠!',
  aquaWaterChange: () => '새 물로 갈아줬어요! 물고기들이 신나요!',
  aquaClean: () => '반짝반짝 깨끗해졌어요!',
  aquaPearl: () => '반짝반짝 조개를 찾았어요!',
  aquaNeedMore: () => '조개가 조금 더 필요해요!',
  aquaGrow: (species, stage) => `와아! ${attachJosa(species.name, '이/가')} ${stage === 'juvenile' ? '어린 물고기로' : '다 큰 물고기로'} 자랐어요!`,
  aquaNewFish: (species) => `새 친구 ${attachJosa(species.name, '이/가')} 왔어요! 잘 키워 주세요!`,
  aquaNewFriend: (creature) => `바다 친구 ${attachJosa(creature.name, '이/가')} 어항에 왔어요!`,
  aquaFishInfo: (species, stage) => `${attachJosa(species.name, '이에요/예요')} 지금은 ${attachJosa(STAGE_NAMES[stage], '이에요/예요')}`,
  aquaSadFish: (species) => `${attachJosa(species.name, '이/가')} 슬퍼요. 밥을 주고 물을 깨끗하게 해 주세요!`,

  // 📸 동물 · 탈것 · 바다생물 소리 / 🍎 과일
  itemSound: (item) => `${item.name}! ${item.soundText}`,
  tasty: (item) => `맛있는 ${item.name}!`,

  // ❓ 퀴즈
  quiz: (name, isVehicle) => `${attachJosa(name, '은/는')} ${isVehicle ? '어디 있을까요?' : '누구일까요?'}`,

  // 🦁 동물 과일 먹이기
  feedWish: (animal, food) => `배고파요, ${attachJosa(animal.name, '이/가')} 맛있는 ${attachJosa(food.name, '을/를')} 먹고 싶대요!`,
  feedPraise: (food, idx) => [
    `냠냠! ${food.name} 정말 맛있어요! 고마워요!`,
    `와아! ${food.name} 최고예요! 냠냠 맛있어요!`,
    `냠냠 꿀꺽! 달콤한 ${food.name} 맛있어요! 배가 든든해요!`
  ][idx],
  feedWrongFood: (animal, food) => `으응, 이거 말고! ${attachJosa(animal.name, '은/는')} ${attachJosa(food.name, '을/를')} 먹고 싶대요.`,
  feedWrongAnimal: (animal, food) => `나는 아니에요. ${animal.name}에게 ${attachJosa(food.name, '을/를')} 주세요!`
};

// 앱에서 나올 수 있는 모든 문장 목록 (MP3 생성 스크립트용)
export function collectVoiceLines({ animals, fruits, vehicles, feedAnimals, foods, oceanCreatures, puzzles, sleepAnimals }) {
  const lines = [VOICE.puzzleWrong()];
  sleepAnimals.forEach(a => {
    lines.push(VOICE.sleepAsleep(a), VOICE.sleepYawn(a), VOICE.sleepWake(a));
    sleepAnimals.forEach(b => lines.push(VOICE.sleepBlanket(a, b)));
  });
  puzzles.forEach(t => lines.push(VOICE.puzzleStart(t), VOICE.puzzleDone(t)));
  oceanCreatures.forEach(c => lines.push(VOICE.itemSound(c), VOICE.aquaNewFriend(c)));
  lines.push(VOICE.aquaWelcome(), VOICE.aquaWelcomeBack(), VOICE.aquaHungry(), VOICE.aquaDirty(), VOICE.aquaFeed(),
    VOICE.aquaWaterChange(), VOICE.aquaClean(), VOICE.aquaPearl(), VOICE.aquaNeedMore());
  FISH_SPECIES.forEach(sp => {
    lines.push(VOICE.aquaGrow(sp, 'juvenile'), VOICE.aquaGrow(sp, 'adult'), VOICE.aquaNewFish(sp), VOICE.aquaSadFish(sp));
    Object.keys(STAGE_NAMES).forEach(stage => lines.push(VOICE.aquaFishInfo(sp, stage)));
  });
  [...animals, ...fruits, ...vehicles].forEach(i => lines.push(i.soundText ? VOICE.itemSound(i) : VOICE.tasty(i)));
  fruits.forEach(i => lines.push(VOICE.tasty(i)));
  animals.forEach(i => lines.push(VOICE.quiz(i.name, false)));
  vehicles.forEach(i => lines.push(VOICE.quiz(i.name, true)));
  foods.forEach(f => {
    for (let i = 0; i < FEED_PRAISE_COUNT; i++) lines.push(VOICE.feedPraise(f, i));
    feedAnimals.forEach(a => lines.push(VOICE.feedWish(a, f), VOICE.feedWrongFood(a, f), VOICE.feedWrongAnimal(a, f)));
  });
  return [...new Set(lines)];
}
