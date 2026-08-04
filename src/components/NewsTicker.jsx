import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

export default function NewsTicker() {
  // 즉시 렌더링을 위한 기본 주요 속보 뉴스 목록
  const [headlines, setHeadlines] = useState([
    { title: '📰 [속보] 한국은행, 기준금리 동결 발표… "물가 및 경제 상황 종합 고려"', link: 'https://n.news.naver.com' },
    { title: '🌐 글로벌 IT·AI 혁신 심포지엄 개막… "미래 기술 주도권 확보 총력"', link: 'https://n.news.naver.com' },
    { title: '☀️ 전국 대체로 흐리고 기온 상승… 내륙 곳곳 한때 소나기 예보', link: 'https://n.news.naver.com' },
    { title: '📈 코스피·코스닥 외국인 매수세에 힘입어 상승 출발', link: 'https://n.news.naver.com' },
    { title: '🚗 친환경차 보조금 확대 편성… 전기·수소차 보급 가속화', link: 'https://n.news.naver.com' },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const query = encodeURIComponent('속보 OR 주요뉴스 OR 종합');
        const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=10&sort=date`;
        
        // 1차: 고속 corsproxy.io 사용 (타임아웃 2.5초 설정)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        try {
          const fastProxyUrl = `https://corsproxy.io/?${encodeURIComponent(naverUrl)}`;
          const res = await fetch(fastProxyUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              const parsed = data.items.map(item => ({
                title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
                link: item.originallink || item.link,
                pubDate: item.pubDate
              }));
              setHeadlines(parsed);
              return;
            }
          }
        } catch (fastErr) {
          console.warn('고속 프록시 타임아웃/실패, allorigins 시도:', fastErr);
          // 2차: allorigins 프록시
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(naverUrl)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const wrapper = await res.json();
            const data = JSON.parse(wrapper.contents);
            if (data.items && data.items.length > 0) {
              const parsed = data.items.map(item => ({
                title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
                link: item.originallink || item.link,
                pubDate: item.pubDate
              }));
              setHeadlines(parsed);
            }
          }
        }
      } catch (err) {
        console.warn('네이버 뉴스 API 호출 중 오류:', err);
      }
    };

    fetchNews();
  }, []);

  // 자동 슬라이드 (4초 간격)
  useEffect(() => {
    if (headlines.length === 0) return;
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % headlines.length);
        setIsAnimating(false);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [headlines]);

  if (headlines.length === 0) return null;

  const current = headlines[currentIndex];

  const handleNewsClick = (e, url) => {
    e.preventDefault();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="news-ticker-container">
      <div className="news-ticker-badge">
        <Newspaper size={12} />
        <span>NEWS</span>
      </div>
      <div className="news-ticker-content">
        <a 
          href={current.link} 
          onClick={(e) => handleNewsClick(e, current.link)}
          target="_blank" 
          rel="noopener noreferrer"
          className={`news-ticker-headline ${isAnimating ? 'slide-out' : 'slide-in'}`}
          title="클릭 시 해당 뉴스 기사 원문 페이지로 이동합니다."
        >
          {current.title}
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
