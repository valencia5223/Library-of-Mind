// AI 비서에 첨부한 엑셀 (사용자마다 1개, 이 브라우저의 IndexedDB 에 보관)
// 시트는 월별, 날짜는 C열. 업무마다 한 줄씩 늘어나는 파일을 날짜로 찾아 AI 에 넘긴다.
// Chrome·Edge 는 파일 위치(FileSystemFileHandle)도 기억해서 읽을 때마다 최신 내용을 다시 읽고,
// 권한이 없거나 지원하지 않는 브라우저는 마지막으로 읽은 사본을 쓴다.
const DB_NAME = 'lom_excel';
const STORE = 'files';
const DATE_COL = 2; // C열
const MAX_ROWS = 500;
const MAX_CHARS = 60000; // AI 에 넘기는 행 내용 합

let dbPromise = null;
const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 를 쓸 수 없습니다.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
};

const run = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const keyOf = (userId) => `excel_${userId || 'demo'}`;
const getRecord = (userId) => run('readonly', store => store.get(keyOf(userId)));
const putRecord = (rec) => run('readwrite', store => store.put(rec));

const pad = (n) => String(n).padStart(2, '0');
export const formatWhen = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 파일 위치를 기억할 수 있는 브라우저인지 (Chrome·Edge PC)
export const canKeepFileLink = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

export const EXCEL_ACCEPT = '.xlsx,.xlsm,.xls';

// 파일 고르기 창 (위치 기억). 취소하면 null
export const pickExcelHandle = async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: '엑셀 파일',
        accept: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
          'application/vnd.ms-excel': ['.xls']
        }
      }]
    });
    return handle || null;
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
};

let parsedCache = null; // { key, lastModified, data }

// 첨부: file 은 사본으로, handle 이 있으면 위치도 같이 보관
export const saveExcel = async (userId, file, handle = null) => {
  const bytes = await file.arrayBuffer();
  const data = await parseBytes(bytes); // 엑셀이 맞는지 먼저 확인
  if (data.rows.length === 0) {
    throw new Error('C열에서 날짜가 있는 줄을 찾지 못했습니다. 시트의 C열에 날짜가 있는지 확인해 주세요.');
  }
  const rec = { key: keyOf(userId), name: file.name, handle, bytes, lastModified: file.lastModified, savedAt: Date.now() };
  await putRecord(rec);
  parsedCache = { key: rec.key, lastModified: rec.lastModified, size: bytes.byteLength, data };
  return excelInfoOf(rec, data);
};

export const removeExcel = async (userId) => {
  await run('readwrite', store => store.delete(keyOf(userId)));
  parsedCache = null;
};

const excelInfoOf = (rec, data) => ({
  name: rec.name,
  lastModified: rec.lastModified,
  savedAt: rec.savedAt,
  linked: Boolean(rec.handle),
  ...(data ? { rowCount: data.rows.length, firstDate: data.rows[0]?.date, lastDate: data.rows[data.rows.length - 1]?.date } : {})
});

// 화면 표시용. permission: 'granted' | 'prompt' | 'denied' | null(위치 기억 안 함)
export const getExcelInfo = async (userId) => {
  const rec = await getRecord(userId);
  if (!rec) return null;
  let permission = null;
  if (rec.handle?.queryPermission) {
    try {
      permission = await rec.handle.queryPermission({ mode: 'read' });
    } catch {
      permission = 'denied';
    }
  }
  return { ...excelInfoOf(rec), permission };
};

// 원본 파일 읽기 권한 받기. 브라우저가 버튼 클릭 같은 사용자 동작 직후에만 물어볼 수 있어서
// 메시지를 보낼 때(또는 '연결' 버튼) 부른다. 이미 있으면 묻지 않음
export const ensureExcelPermission = async (userId) => {
  const rec = await getRecord(userId).catch(() => null);
  if (!rec?.handle?.queryPermission) return null;
  try {
    const state = await rec.handle.queryPermission({ mode: 'read' });
    if (state !== 'prompt') return state;
    return await rec.handle.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
};

// 최신 내용 읽기: 위치를 기억했고 권한이 있으면 원본에서, 아니면 사본에서
const loadLatest = async (userId) => {
  const rec = await getRecord(userId);
  if (!rec) return null;
  let live = false;
  let reason = rec.handle ? '' : '위치를 기억하지 않는 브라우저';
  if (rec.handle) {
    try {
      const state = await rec.handle.queryPermission({ mode: 'read' });
      if (state === 'granted') {
        const file = await rec.handle.getFile();
        live = true;
        if (file.lastModified !== rec.lastModified || file.size !== rec.bytes?.byteLength) {
          rec.bytes = await file.arrayBuffer();
          rec.lastModified = file.lastModified;
          rec.savedAt = Date.now();
          await putRecord(rec).catch(e => console.warn('엑셀 사본 저장 실패:', e));
        }
      } else {
        reason = '원본 파일 읽기 권한 없음';
      }
    } catch (e) {
      console.warn('엑셀 원본 읽기 실패:', e);
      reason = e?.name === 'NotFoundError' ? '원본 파일을 찾을 수 없음(옮겼거나 이름이 바뀜)' : '원본 파일을 읽지 못함(다른 프로그램이 쓰는 중일 수 있음)';
    }
  }
  return { rec, live, reason };
};

// ---------- 엑셀 해석 ----------

const validYmd = (y, m, d) => {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
};

// 연도가 없는 날짜: 시트 이름의 연도, 없으면 올해(두 달 넘게 미래면 작년)
const guessYear = (m, d, sheetYear) => {
  if (sheetYear) return sheetYear;
  const now = new Date();
  const y = now.getFullYear();
  return new Date(y, m - 1, d) - now > 62 * 86400000 ? y - 1 : y;
};

// 시트 이름에서 연도·월 ('10월', '2026년 10월', '2026.10', '26년10월', '10')
const sheetPeriod = (name) => {
  const s = String(name || '');
  const y4 = s.match(/(20\d{2})/);
  const y2 = !y4 && s.match(/(\d{2})\s*년/);
  const year = y4 ? Number(y4[1]) : y2 ? 2000 + Number(y2[1]) : null;
  const rest = y4 ? s.replace(y4[1], ' ') : y2 ? s.replace(y2[0], ' ') : s;
  const mm = rest.match(/(\d{1,2})\s*월/) || rest.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  const month = mm && Number(mm[1]) >= 1 && Number(mm[1]) <= 12 ? Number(mm[1]) : null;
  return { year, month };
};

const parseDateCell = (XLSX, raw, text, period) => {
  if (raw instanceof Date) return validYmd(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  if (typeof raw === 'number') {
    if (raw > 20000 && raw < 80000) {
      const p = XLSX.SSF.parse_date_code(raw);
      return p ? validYmd(p.y, p.m, p.d) : null;
    }
    // 월별 시트에 일(1~31)만 적은 경우
    if (Number.isInteger(raw) && period.month) return validYmd(guessYear(period.month, raw, period.year), period.month, raw);
    return null;
  }
  const s = String(text || raw || '').trim();
  if (!s) return null;
  let m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (m) return validYmd(2000 + Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    return validYmd(guessYear(mo, d, period.year), mo, d);
  }
  m = s.match(/^(\d{1,2})\s*일/) || s.match(/^(\d{1,2})$/);
  if (m && period.month) {
    const d = Number(m[1]);
    return validYmd(guessYear(period.month, d, period.year), period.month, d);
  }
  return null;
};

const cellText = (v) => String(v ?? '').replace(/\r\n?/g, '\n').trim();

// 업체명 칸이 이 값인 줄(예: '오늘 할 일' 메모 줄)은 업무 기록이 아니라서 아예 읽지 않음 (띄어쓰기 무시)
const SKIP_COMPANIES = ['오늘할일'];
const COMPANY_HEADER = /업체|고객|거래처/;
const isSkippedCompany = (v) => SKIP_COMPANIES.includes(cellText(v).replace(/\s+/g, ''));

// 시트마다: C열이 날짜인 줄을 업무 한 건으로. 날짜가 병합됐거나 비어 있으면 위 줄 날짜를 이어 씀
const parseBytes = async (bytes) => {
  const XLSX = await import('xlsx');
  let wb;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new Error('엑셀 파일을 읽지 못했습니다. 암호가 걸려 있거나 엑셀 파일이 아닐 수 있습니다.');
  }
  const rows = [];
  const sheets = [];
  wb.SheetNames.forEach((sheetName, sheetIndex) => {
    const ws = wb.Sheets[sheetName];
    if (!ws?.['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const c = DATE_COL - range.s.c;
    if (c < 0) return;
    const opts = { header: 1, defval: '', blankrows: true };
    const raws = XLSX.utils.sheet_to_json(ws, { ...opts, raw: true });
    const texts = XLSX.utils.sheet_to_json(ws, { ...opts, raw: false });
    // C열 병합 칸: 아래 칸들은 비어 있으므로 맨 위 값으로 채움
    (ws['!merges'] || []).forEach(mg => {
      if (mg.s.c > DATE_COL || mg.e.c < DATE_COL) return;
      for (let r = mg.s.r + 1; r <= mg.e.r; r++) {
        const i = r - range.s.r;
        if (raws[i] && raws[mg.s.r - range.s.r]) {
          raws[i][c] = raws[mg.s.r - range.s.r][c];
          texts[i][c] = texts[mg.s.r - range.s.r][c];
        }
      }
    });
    const period = sheetPeriod(sheetName);
    let header = null;
    let lastNonEmpty = null;
    let prevDate = null;
    let count = 0;
    texts.forEach((textRow, i) => {
      const rawRow = raws[i] || [];
      const date = parseDateCell(XLSX, rawRow[c], textRow[c], period);
      const others = textRow.map((v, j) => (j === c ? '' : cellText(v)));
      const hasContent = others.some(Boolean);
      if (!date && !header) {
        // 첫 날짜 줄 바로 위의 내용 있는 줄을 머리글로
        if (textRow.some(v => cellText(v))) lastNonEmpty = textRow.map(cellText);
        return;
      }
      if (!header) header = lastNonEmpty || [];
      const companyCol = header.findIndex((h, j) => j !== c && COMPANY_HEADER.test(cellText(h)));
      const rowDate = date || (cellText(textRow[c]) ? null : prevDate);
      if (date) prevDate = date;
      if (!rowDate || !hasContent) return;
      // 업체명 칸을 못 찾으면 어느 칸이든 그 값만 적힌 줄을 뺌
      if (companyCol >= 0 ? isSkippedCompany(others[companyCol]) : others.some(isSkippedCompany)) return;
      const used = new Set();
      const fields = [];
      others.forEach((v, j) => {
        if (!v) return;
        let name = cellText(header[j]) || XLSX.utils.encode_col(range.s.c + j);
        if (used.has(name)) name = `${name}(${XLSX.utils.encode_col(range.s.c + j)})`;
        used.add(name);
        fields.push(`${name}: ${v.replace(/\n+/g, ' / ')}`);
      });
      rows.push({ date: rowDate, sheet: sheetName, sheetIndex, row: range.s.r + i + 1, text: fields.join(' | ') });
      count++;
    });
    sheets.push({ name: sheetName, rows: count, columns: (header || []).filter((v, j) => v && j !== c) });
  });
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.sheetIndex - b.sheetIndex || a.row - b.row);
  return { rows, sheets };
};

const parsedOf = async (rec) => {
  if (parsedCache?.key === rec.key && parsedCache.lastModified === rec.lastModified && parsedCache.size === rec.bytes?.byteLength) {
    return parsedCache.data;
  }
  const data = await parseBytes(rec.bytes);
  parsedCache = { key: rec.key, lastModified: rec.lastModified, size: rec.bytes?.byteLength, data };
  return data;
};

// AI 도구 search_excel: 날짜 범위·검색어로 업무 줄 찾기
export const searchExcel = async (userId, { date_from, date_to, query, limit } = {}) => {
  const loaded = await loadLatest(userId);
  if (!loaded) throw new Error('첨부된 엑셀이 없습니다. AI 비서 창 위쪽의 엑셀 버튼으로 파일을 첨부해 주세요.');
  const { rec, live, reason } = loaded;
  const { rows, sheets } = await parsedOf(rec);
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matched = rows
    .filter(r => (!date_from || r.date >= date_from) && (!date_to || r.date <= date_to))
    .filter(r => terms.every(t => `${r.sheet}\n${r.text}`.toLowerCase().includes(t)));

  const max = Math.min(Math.max(Number(limit) || 300, 1), MAX_ROWS);
  const items = [];
  let chars = 0;
  for (const r of matched.slice(0, max)) {
    chars += r.text.length;
    if (chars > MAX_CHARS && items.length > 0) break;
    items.push({ date: r.date, sheet: r.sheet, row: r.row, text: r.text });
  }

  // 날짜별 건수 (찾는 날짜에 기록이 없을 때 가까운 기록을 알려 주려고)
  const counts = new Map();
  rows.forEach(r => counts.set(r.date, (counts.get(r.date) || 0) + 1));
  const allDates = [...counts.keys()];
  const nearby = matched.length > 0 ? null : (() => {
    const pivot = date_to || date_from;
    const before = pivot ? allDates.filter(d => d < (date_from || pivot)).slice(-3) : allDates.slice(-5);
    const after = pivot ? allDates.filter(d => d > pivot).slice(0, 2) : [];
    return [...before, ...after].map(d => ({ date: d, rows: counts.get(d) }));
  })();

  return {
    file: rec.name,
    file_modified: formatWhen(rec.lastModified),
    source: live ? '원본 파일(최신)' : `저장된 사본(${formatWhen(rec.savedAt)} 기준) - ${reason}`,
    sheets: sheets.map(s => `${s.name}(${s.rows}건)`).join(', '),
    columns: [...new Set(sheets.flatMap(s => s.columns))],
    date_range: allDates.length ? `${allDates[0]} ~ ${allDates[allDates.length - 1]}` : '',
    total_matched: matched.length,
    ...(items.length < matched.length ? { truncated: `${items.length}건만 넣었습니다. 기간을 나눠 다시 찾으세요.` } : {}),
    ...(nearby ? { nearby_dates_with_rows: nearby } : {}),
    rows: items
  };
};
