import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'library_news_cache_v2';
const CACHE_MAX_AGE_MS = 15 * 60 * 1000; // 15분 지나면 자동 만료 및 강제 실시간 재수집

export default function NewsTicker() {
  // 1. localStorage 로컬 캐시로부터 0ms 초고속 동기 초기화 (15분 이내 최신 캐시만 유지)
  const [headlines, setHeadlines] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.headlines && parsed.headlines.length > 0 && parsed.timestamp) {
          // 15분 미만 캐시만 즉시 사용
          if (Date.now() - parsed.timestamp < CACHE_MAX_AGE_MS) {
            return parsed.headlines;
          }
        }
      }
    } catch (e) {}
    return [
      { title: '📰 [속보] 실시간 주요 뉴스 수집 중...', link: 'https://news.google.com' }
    ];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.time || '';
      }
    } catch (e) {}
    return '';
  });

  // 실시간 최신 뉴스 수집 (CDN 캐시 무력화 타임스탬프 _t=Date.now() 적용)
  const fetchLiveNews = async () => {
    const nowTs = Date.now();
    // Google News RSS URL에 타임스탬프 파라미터를 결합하여 CDN 캐시 응답 완전 방지
    const rssUrl = `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko&_t=${nowTs}`;
    let xmlText = null;

    // 1차시도: corsproxy.io 고속 스트리밍 프록시 (타임아웃 2초 + cache: 'no-store')
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const fastUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
      const res = await fetch(fastUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      if (res.ok) {
        xmlText = await res.text();
      }
    } catch (fastErr) {
      // ignore & try fallback
    }

    // 2차시도: allorigins 프록시 폴백
    if (!xmlText) {
      try {
        const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}&timestamp=${nowTs}`;
        const res = await fetch(fallbackUrl, { cache: 'no-store' });
        if (res.ok) {
          const wrapper = await res.json();
          xmlText = wrapper.contents;
        }
      } catch (err) {
        console.warn('뉴스 수집 실패:', err);
      }
    }

    // XML 파싱 및 뉴스 업데이트
    if (xmlText) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');

        const parsed = Array.from(items).slice(0, 10).map(item => {
          let title = item.querySelector('title')?.textContent || '';
          title = title.replace(/\s*-\s*[^-]+$/, '').trim(); // 언론사 이름 정제
          let link = item.querySelector('link')?.textContent || 'https://news.google.com';
          return { title: `📰 ${title}`, link };
        }).filter(item => item.title.length > 5);

        if (parsed.length > 0) {
          setHeadlines(parsed);
          const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          setLastUpdatedTime(timeStr);

          // localStorage에 캐시하여 다음 접속 시 0ms 즉시 노출
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
              headlines: parsed,
              time: timeStr,
              timestamp: Date.now()
            }));
          } catch (e) {}
        }
      } catch (e) {
        console.warn('뉴스 XML 파싱 실패:', e);
      }
    }
  };

  useEffect(() => {
    fetchLiveNews();
    // 3분마다 최신 실시간 속보 자동 갱신
    const interval = setInterval(fetchLiveNews, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 자동 슬라이드 (4.5초 간격)
  useEffect(() => {
    if (headlines.length === 0) return;
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % headlines.length);
        setIsAnimating(false);
      }, 400);
    }, 4500);
    return () => clearInterval(timer);
  }, [headlines]);

  if (!headlines || headlines.length === 0) return null;

  const current = headlines[currentIndex] || headlines[0];
  if (!current) return null;

  const handleNewsClick = (e, url) => {
    e.preventDefault();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="news-ticker-container">
      <div className="news-ticker-badge" title={lastUpdatedTime ? `마지막 갱신: ${lastUpdatedTime}` : ''}>
        <Newspaper size={12} />
        <span>NEWS</span>
        {lastUpdatedTime && (
          <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: '4px' }}>
            ({lastUpdatedTime})
          </span>
        )}
      </div>
      <div className="news-ticker-content">
        <a 
          href={current.link || '#'} 
          onClick={(e) => handleNewsClick(e, current.link)}
          target="_blank" 
          rel="noopener noreferrer"
          className={`news-ticker-headline ${isAnimating ? 'slide-out' : 'slide-in'}`}
          title="클릭 시 해당 뉴스 기사 원문 페이지로 이동합니다."
        >
          {current.title || '뉴스 헤드라인'}
          <ExternalLink size={10} style={{ marginLeft: '6px', opacity: 0.7 }} />
        </a>
      </div>
      <div className="news-ticker-dots">
        {headlines.map((_, i) => (
          <span 
            key={i} 
            className={`ticker-dot ${i === currentIndex ? 'active' : ''}`}
            onClick={() => { setCurrentIndex(i); }}
          />
        ))}
      </div>
    </div>
  );
}
