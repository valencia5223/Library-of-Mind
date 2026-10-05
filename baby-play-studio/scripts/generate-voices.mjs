// 🎙️ 남성 아나운서 음성 MP3 일괄 생성
// 사용법: npm run voices
// - src/voiceLines.js 의 collectVoiceLines() 로 앱의 모든 안내 문장을 모은다.
//   (데이터 배열은 Vite SSR로 App.jsx 를 불러와서 얻는다)
// - Microsoft Edge 온라인 TTS(ko-KR-InJoonNeural)로 public/voice/<key>.mp3 생성
// - 이미 있는 파일은 건너뛰고, 더 이상 쓰지 않는 파일은 지운다
// - src/voiceIndex.json 에 생성된 키 목록을 기록 (앱은 목록에 있는 문장만 MP3로 재생)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE_NAME = 'ko-KR-InJoonNeural';
const PROSODY = { rate: '-4%' };
const CONCURRENCY = 4;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'voice');
const indexFile = path.join(root, 'src', 'voiceIndex.json');

const DATA_NAMES = ['REAL_ANIMALS', 'REAL_FRUITS', 'REAL_VEHICLES', 'FEEDABLE_ANIMALS', 'ALL_FOOD_ITEMS', 'OCEAN_CREATURES', 'BABY_PUZZLES', 'SLEEP_ANIMAL_DATA'];

async function loadLines() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    // 개발 서버의 의존성 캐시(node_modules/.vite)를 건드리지 않도록 분리
    cacheDir: path.join(os.tmpdir(), 'baby-play-studio-voices-vite'),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      // App.jsx 의 데이터 배열을 이 스크립트에서만 꺼내 쓸 수 있도록 export 를 덧붙인다
      name: 'expose-voice-data',
      transform(code, id) {
        if (id.endsWith('/src/App.jsx')) return code + `\nexport const __voiceData = { ${DATA_NAMES.join(', ')} };\n`;
      }
    }]
  });
  try {
    const app = await server.ssrLoadModule('/src/App.jsx');
    const { collectVoiceLines, voiceKey, formatSpokenKoreanText } = await server.ssrLoadModule('/src/voiceLines.js');
    const d = app.__voiceData;
    const lines = collectVoiceLines({
      animals: d.REAL_ANIMALS, fruits: d.REAL_FRUITS, vehicles: d.REAL_VEHICLES,
      feedAnimals: d.FEEDABLE_ANIMALS, foods: d.ALL_FOOD_ITEMS, oceanCreatures: d.OCEAN_CREATURES,
      puzzles: d.BABY_PUZZLES, sleepAnimals: d.SLEEP_ANIMAL_DATA
    });
    const byKey = new Map();
    lines.forEach(l => byKey.set(voiceKey(l), formatSpokenKoreanText(l)));
    return byKey;
  } finally {
    await server.close();
  }
}

async function synth(text) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(text, PROSODY);
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

const byKey = await loadLines();
fs.mkdirSync(outDir, { recursive: true });

const todo = [...byKey].filter(([key]) => !fs.existsSync(path.join(outDir, `${key}.mp3`)));
console.log(`문장 ${byKey.size}개 / 새로 생성 ${todo.length}개 (${VOICE_NAME})`);

let done = 0;
const failed = [];
async function worker() {
  while (todo.length) {
    const [key, text] = todo.shift();
    let buf = null;
    for (let attempt = 0; attempt < 3 && !buf; attempt++) {
      try {
        const b = await synth(text);
        if (b.length > 1000) buf = b;
      } catch (e) { /* 재시도 */ }
    }
    if (buf) fs.writeFileSync(path.join(outDir, `${key}.mp3`), buf);
    else failed.push(text);
    done++;
    if (done % 50 === 0) console.log(`  ${done}개 완료`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 더 이상 쓰지 않는 파일 정리
fs.readdirSync(outDir).forEach(f => {
  if (f.endsWith('.mp3') && !byKey.has(f.slice(0, -4))) fs.unlinkSync(path.join(outDir, f));
});

const available = [...byKey.keys()].filter(k => fs.existsSync(path.join(outDir, `${k}.mp3`))).sort();
fs.writeFileSync(indexFile, JSON.stringify(available) + '\n');
console.log(`완료: MP3 ${available.length}개, 실패 ${failed.length}개`);
failed.forEach(t => console.log(`  ✗ ${t}`));
if (failed.length) process.exitCode = 1;
