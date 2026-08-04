import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react';

export default function NewsTicker() {
  const [headlines, setHeadlines] = useState([
    { title: '📰 [속보] 실시간 주요 뉴스 수집 중...', link: 'https://news.google.com' }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');

  const fetchLiveNews = async () => {
    try {
      // 대한민국 최신 속보 종합 구글 뉴스 RSS (실시간 최신 뉴스 제공)
      const rssUrl = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}&timestamp=${Date.now()}`;
      
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const wrapper = await res.json();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(wrapper.contents, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');

        const parsed = Array.from(items).slice(0, 10).map(item => {
          let title = item.querySelector('title')?.textContent || '';
          // 구글 뉴스 출처 표기 정제 (예: " - 연합뉴스" 제거)
          title = title.replace(/\s*-\s*[^-]+$/, '').trim();
          
          let link = item.querySelector('link')?.textContent || 'https://news.google.com';
          return { title: `📰 ${title}`, link };
        }).filter(item => item.title.length > 5);

        if (parsed.length > 0) {
          setHeadlines(parsed);
          const now = new Date();
          setLastUpdatedTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (err) {
      console.warn('실시간 구글 뉴스 RSS 수집 실패:', err);
    }
  };

  useEffect(() => {
    fetchLiveNews();
    // 5분마다 최신 실시간 뉴스 자동 갱신
    const interval = setInterval(fetchLiveNews, 5 * 60 * 1000);
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
