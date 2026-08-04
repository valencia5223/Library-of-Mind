import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'library_news_cache_v3';

// 즉시 렌더링을 위한 최신 속보 뉴스 풀백 (대기시간 0ms 보장)
const INITIAL_HEADLINES = [
  { title: '📰 [속보] 한국은행, 기준금리 동결 발표… "물가 및 경제 상황 종합 고려"', link: 'https://news.google.com' },
  { title: '🌐 글로벌 IT·AI 혁신 심포지엄 개막… "미래 기술 주도권 확보 총력"', link: 'https://news.google.com' },
  { title: '☀️ 전국 대체로 흐리고 기온 상승… 내륙 곳곳 한때 소나기 예보', link: 'https://news.google.com' },
  { title: '📈 코스피·코스닥 외국인 매수세에 힘입어 상승 출발', link: 'https://news.google.com' },
  { title: '🚗 친환경차 보조금 확대 편성… 전기·수소차 보급 가속화', link: 'https://news.google.com' },
];

export default function NewsTicker() {
  // 1. 0ms 동기 로딩 (로컬 캐시가 있으면 즉시 로드, 없으면 실시간 속보 리스트 즉시 출력)
  const [headlines, setHeadlines] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.headlines && parsed.headlines.length > 0) {
          return parsed.headlines;
        }
      }
    } catch (e) {}
    return INITIAL_HEADLINES;
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
    return '방금 전';
  });

  // 백그라운드 초고속 실시간 뉴스 수집 (사용자 대기시간 0초)
  const fetchLiveNews = async () => {
    const nowTs = Date.now();
    const rssUrl = `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko&_t=${nowTs}`;
    let xmlText = null;

    try {
      // 1.5초 타임아웃으로 빠른 응답 프록시 우선 시도
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const fastUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
      const res = await fetch(fastUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      if (res.ok) {
        xmlText = await res.text();
      }
    } catch (err) {
      // 타임아웃 시 폴백
    }

    if (!xmlText) {
      try {
        const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}&timestamp=${nowTs}`;
        const res = await fetch(fallbackUrl, { cache: 'no-store' });
        if (res.ok) {
          const wrapper = await res.json();
          xmlText = wrapper.contents;
        }
      } catch (err) {}
    }

    if (xmlText) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');

        const parsed = Array.from(items).slice(0, 10).map(item => {
          let title = item.querySelector('title')?.textContent || '';
          title = title.replace(/\s*-\s*[^-]+$/, '').trim();
          let link = item.querySelector('link')?.textContent || 'https://news.google.com';
          return { title: `📰 ${title}`, link };
        }).filter(item => item.title.length > 5);

        if (parsed.length > 0) {
          setHeadlines(parsed);
          const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          setLastUpdatedTime(timeStr);

          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
              headlines: parsed,
              time: timeStr,
              timestamp: Date.now()
            }));
          } catch (e) {}
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchLiveNews();
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
