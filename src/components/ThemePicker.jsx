import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { THEMES, getTheme, setTheme } from '../utils/theme';

// 헤더의 🎨 테마 고르기 (선택은 이 브라우저에 저장)
export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getTheme);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id) => {
    setTheme(id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <div className="theme-picker" ref={boxRef}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="화면 테마 바꾸기"
      >
        <Palette size={15} />
        <span className="theme-picker-label">테마</span>
      </button>

      {open && (
        <div className="theme-picker-menu" role="menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={current === t.id}
              className={`theme-picker-item ${current === t.id ? 'active' : ''}`}
              onClick={() => choose(t.id)}
            >
              <span className="theme-swatch" style={{ background: t.swatch[0] }}>
                <span style={{ background: t.swatch[1] }} />
              </span>
              <span className="theme-picker-name">{t.name}</span>
              {current === t.id && <Check size={15} className="theme-picker-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
