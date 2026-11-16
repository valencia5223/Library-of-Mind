// src/utils/useIsMobile.js - 핸드폰 화면(기본 640px 이하)인지. index.css 의 '핸드폰 화면' 구역과 같은 기준
import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 640px)';

export default function useIsMobile(query = MOBILE_QUERY) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return Boolean(match);
}
