import React, { useMemo } from 'react';
import { sanitizeNoteHtml } from '../utils/noteHtml';

// OneNote 원본 서식(글꼴·크기·색·띄어쓰기·목록·표)으로 노트를 보여 주는 읽기 전용 화면
export default function NoteRichView({ html, style }) {
  const clean = useMemo(() => sanitizeNoteHtml(html), [html]);
  return (
    <div
      className="input-field mt-1 onenote-rich-view"
      style={{
        overflowY: 'auto',
        padding: '1rem 1.1rem',
        backgroundColor: '#ffffff',
        fontSize: '0.95rem',
        lineHeight: 1.6,
        color: '#0f172a',
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
