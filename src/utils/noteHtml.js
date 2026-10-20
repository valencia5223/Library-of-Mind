// OneNote 페이지 HTML → 달력에서 보여 줄 서식 HTML (글꼴·크기·색·굵게·목록·표·띄어쓰기 유지)
// 저장할 때 한 번 정리하고, 보여 줄 때 다시 한 번 안전하게 거른다(공유받은 노트도 렌더링하므로).
import DOMPurify from 'dompurify';

const HTML_MAX = 300000;

// 남길 CSS: 글자 모양·색·정렬·들여쓰기·표 테두리. 위치·크기(OneNote 자유 배치)는 버림
const KEEP_CSS = new Set([
  'font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color', 'background',
  'text-decoration', 'text-align', 'vertical-align', 'margin-left', 'padding-left', 'line-height',
  'border', 'border-collapse', 'border-width', 'border-style', 'border-color', 'padding'
]);

const filterStyle = (style = '') =>
  style
    .split(';')
    .map(rule => rule.trim())
    .filter(rule => {
      const prop = rule.split(':')[0]?.trim().toLowerCase();
      return prop && KEEP_CSS.has(prop) && !/url\s*\(|expression/i.test(rule);
    })
    .join('; ');

const purify = (html) =>
  DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'img', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['id', 'class', 'src', 'srcset']
  });

// 할 일 태그 → ☐ / ☑
const markTodos = (doc) => {
  doc.body.querySelectorAll('[data-tag]').forEach(el => {
    const tags = el.getAttribute('data-tag') || '';
    if (/to-do/.test(tags)) el.prepend(doc.createTextNode(/to-do:completed/.test(tags) ? '☑ ' : '☐ '));
  });
};

// doc: DOMParser 로 읽은 OneNote 페이지. 반환: 정리된 HTML (너무 크면 null)
export const cleanOneNoteHtml = (doc) => {
  const body = doc.body;
  if (!body) return null;
  body.querySelectorAll('script, style, title, meta, link').forEach(el => el.remove());

  // 이미지·첨부는 Microsoft 로그인이 있어야 열려서 자리 표시만
  const placeholder = (label) => {
    const span = doc.createElement('span');
    span.textContent = label;
    span.setAttribute('style', 'color: #64748b');
    return span;
  };
  body.querySelectorAll('img').forEach(el => el.replaceWith(placeholder('🖼 [이미지]')));
  body.querySelectorAll('object, iframe, embed').forEach(el =>
    el.replaceWith(placeholder(`📎 [첨부${el.getAttribute('data-attachment') ? ` ${el.getAttribute('data-attachment')}` : ''}]`))
  );

  markTodos(doc);

  body.querySelectorAll('[style]').forEach(el => {
    const kept = filterStyle(el.getAttribute('style'));
    if (kept) el.setAttribute('style', kept);
    else el.removeAttribute('style');
  });
  body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name === 'id' || attr.name === 'lang') el.removeAttribute(attr.name);
    });
  });

  // 태그 사이 줄바꿈만 있는 텍스트는 지움 → 아래 pre-wrap 이 원본 띄어쓰기만 살림
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const blanks = [];
  while (walker.nextNode()) {
    if (/^\s*$/.test(walker.currentNode.nodeValue) && /\n/.test(walker.currentNode.nodeValue)) blanks.push(walker.currentNode);
  }
  blanks.forEach(node => node.remove());

  const wrapper = doc.createElement('div');
  const baseStyle = filterStyle(body.getAttribute('style') || '');
  wrapper.setAttribute('style', `${baseStyle ? `${baseStyle}; ` : ''}white-space: pre-wrap; word-break: break-word`);
  wrapper.innerHTML = body.innerHTML;

  const html = purify(wrapper.outerHTML);
  return html.length > HTML_MAX ? null : html;
};

// 취소선 글자를 텍스트에서도 알 수 있게 ~~글자~~ 로 감쌈 (OneNote 는 span style 의 line-through 로 줌)
const STRIKE_SELECTOR = 'del, s, strike, [style*="line-through"]';
const markStrikethrough = (doc) => {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue.trim() && node.parentElement?.closest(STRIKE_SELECTOR)) targets.push(node);
  }
  targets.forEach(node => {
    const [, lead, body, tail] = node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
    node.nodeValue = `${lead}~~${body}~~${tail}`;
  });
};

// OneNote 페이지(원본 또는 정리된 서식 HTML) → 일반 텍스트 (줄바꿈 유지, 취소선은 ~~ ~~). doc 은 바뀜
export const noteDocToText = (doc) => {
  if (!doc.body) return '';
  doc.querySelectorAll('title, style, script').forEach(el => el.remove());
  markTodos(doc);
  markStrikethrough(doc);
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr').forEach(el => el.append('\n'));
  return (doc.body.textContent || '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

// 보여 주기 직전에 한 번 더 거르기 (링크는 새 창으로)
export const sanitizeNoteHtml = (html) => {
  const clean = purify(html || '');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  doc.querySelectorAll('a[href]').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
};
