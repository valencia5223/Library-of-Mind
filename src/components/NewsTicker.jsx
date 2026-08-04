import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

export default function NewsTicker() {
  const [headlines, setHeadlines] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // 네이버 뉴스 검색 API (CORS 프록시 경유)
        const query = encodeURIComponent('독서 OR 베스트셀러 OR 신간');
        const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=10&sort=date`;
        
        // allorigins CORS 프록시 사용
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(naverUrl)}`;
        const res = await fetch(proxyUrl);
        
        if (res.ok) {
          const wrapper = await res.json();
          const data = JSON.parse(wrapper.contents);
          
          if (data.items && data.items.length > 0) {
            const parsed = data.items.map(item => ({
              title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
              link: item.link,
              pubDate: item.pubDate
            }));
            setHeadlines(parsed);
            return;
          }
        }
      } catch (err) {
        console.warn('네이버 뉴스 API 호출 실패, 정적 헤드라인 사용:', err);
      }

      // 폴백: 정적 독서 관련 헤드라인
      setHeadlines([
        { title: '📚 올해의 베스트셀러 트렌드: 자기계발서와 에세이가 강세', link: 'https://www.aladin.co.kr' },
        { title: '📖 독서의 힘 — 하루 30분 독서가 뇌 건강에 미치는 영향', link: 'https://www.aladin.co.kr' },
        { title: '🏆 2026 상반기 도서 판매량 TOP 10 발표', link: 'https://www.aladin.co.kr' },
        { title: '⭐ 서울국제도서전 개막 — 올해 주목할 신간 도서 라인업', link: 'https://www.aladin.co.kr' },
        { title: '💡 AI 시대, 읽어야 할 필독서 5선', link: 'https://www.aladin.co.kr' },
      ]);
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

  return (
    <div className="news-ticker-container">
      <div className="news-ticker-badge">
        <Newspaper size={12} />
        <span>NEWS</span>
      </div>
      <div className="news-ticker-content">
        <a 
          href={current.link} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`news-ticker-headline ${isAnimating ? 'slide-out' : 'slide-in'}`}
        >
          {current.title}
          <ExternalLink size={10} style={{ marginLeft: '4px', opacity: 0.5 }} />
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
