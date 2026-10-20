// 동행복권 로또 6/45 당첨 결과를 받아 public/draws.json 에 저장 (이미 있는 회차는 건너뛰고 새 회차만)
// 실행: npm run update-data  (build 전에 자동 실행)
//
// 동행복권 사이트 개편 뒤의 조회 주소(공식 공개 API 아님, 바뀔 수 있음)
//   최신 회차:  /lt645/result 페이지의 <... id="opt_val" value="회차">
//   회차 결과:  /lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=N  → N 근처 10회차
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRow, ROUND_URL } from '../src/rows.js';

const BASE = 'https://www.dhlottery.co.kr';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'draws.json');
const HEADERS = { accept: 'application/json, text/html;q=0.9', 'user-agent': 'Mozilla/5.0 (lotto-gacha)' };
const DELAY_MS = 250; // 사이트에 부담 주지 않게

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const fetchLatestRound = async () => {
  const res = await fetch(`${BASE}/lt645/result`, { headers: HEADERS });
  if (!res.ok) throw new Error(`최신 회차 페이지 오류 ${res.status}`);
  const m = (await res.text()).match(/id="opt_val"[^>]*value="(\d+)"/i);
  if (!m) throw new Error('최신 회차 번호를 찾지 못했습니다 (사이트 구조가 바뀌었을 수 있음)');
  return Number(m[1]);
};

const fetchAround = async (round) => {
  const url = `${BASE}${ROUND_URL(round)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = (await res.json())?.data?.list;
      if (!Array.isArray(list)) throw new Error('응답 형식이 바뀌었습니다');
      return list.map(toRow);
    } catch (e) {
      if (attempt >= 3) throw new Error(`${round}회 근처 조회 실패: ${e.message}`);
      await sleep(1000 * attempt);
    }
  }
};

const main = async () => {
  let rows = [];
  try {
    rows = JSON.parse(await readFile(OUT, 'utf8')).draws || [];
  } catch { /* 처음 */ }
  const have = new Map(rows.map(r => [r[0], r]));

  let latest;
  try {
    latest = await fetchLatestRound();
  } catch (e) {
    // 네트워크가 안 되면 있는 데이터로 계속 (빌드가 실패하지 않게)
    console.warn(`[update-draws] ${e.message} → 기존 데이터(${rows.length}회차)를 그대로 씁니다.`);
    return;
  }

  const missing = [];
  for (let r = 1; r <= latest; r++) if (!have.has(r)) missing.push(r);
  if (missing.length === 0) {
    console.log(`[update-draws] 최신(${latest}회)까지 이미 있습니다.`);
    return;
  }
  console.log(`[update-draws] ${missing.length}회차 받는 중 (최신 ${latest}회)…`);

  // 빠진 회차를 10개 묶음 가운데로 조회
  while (missing.some(r => !have.has(r))) {
    const target = missing.find(r => !have.has(r));
    const center = Math.min(target + 5, latest);
    const got = await fetchAround(center);
    got.forEach(row => have.set(row[0], row));
    if (!got.some(row => row[0] === target)) {
      // 응답에 없으면 그 회차만 따로
      const single = (await fetchAround(target)).find(row => row[0] === target);
      if (!single) throw new Error(`${target}회 결과를 받지 못했습니다`);
      have.set(target, single);
    }
    process.stdout.write(`\r  ${have.size}/${latest}`);
    await sleep(DELAY_MS);
  }
  process.stdout.write('\n');

  const draws = [...have.values()].filter(r => r[0] <= latest).sort((a, b) => a[0] - b[0]);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    updatedAt: new Date().toISOString(),
    fields: ['round', 'date', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'bonus', 'w1', 'w2', 'w3', 'w4', 'w5', 'sales'],
    draws
  }));
  console.log(`[update-draws] 저장: ${draws.length}회차 → public/draws.json`);
};

main().catch(e => {
  console.error(`[update-draws] 실패: ${e.message}`);
  process.exitCode = 1;
});
