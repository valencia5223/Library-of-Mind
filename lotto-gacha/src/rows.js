// 동행복권 응답 한 건 → [회차, 'YYYYMMDD', n1..n6(오름차순), 보너스, 1~5등 당첨자 수, 총판매액]
// (scripts/update-draws.mjs 와 앱이 같이 씀)
export const toRow = (x) => [
  Number(x.ltEpsd),
  String(x.ltRflYmd),
  ...[1, 2, 3, 4, 5, 6].map(i => Number(x[`tm${i}WnNo`])).sort((a, b) => a - b),
  Number(x.bnsWnNo),
  ...[1, 2, 3, 4, 5].map(i => Number(x[`rnk${i}WnNope`]) || 0),
  Number(x.wholEpsdSumNtslAmt) || 0
];

export const ROUND_URL = (round) => `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${round}`;
