import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, VolumeX, RotateCcw, Award, Heart, RefreshCw, Smartphone, Play, Star, CheckCircle, Music, Shield, Check, Info } from 'lucide-react';

// --- Web Audio API Synth Sound Generator (외부 파일 의존 없이 풍부한 사운드 합성) ---
class BabySoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop(freq = 440) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  playXylophone(freq = 523.25) { // C5, D5, E5...
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch (e) {}
  }

  playFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playXylophone(freq);
      }, idx * 100);
    });
  }

  playBubble() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  playYum() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // 2-step happy chime
    this.playXylophone(587.33); // D5
    setTimeout(() => this.playXylophone(880), 120); // A5
  }

  playChika() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      // Noise buffer for brushing sound
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
    } catch (e) {}
  }
}

const audioEngine = new BabySoundEngine();

// --- 25개월 데이터 정의 ---
const VEHICLES_ANIMALS = [
  { id: 'police', name: '경찰차 🚓', soundText: '삐뽀삐뽀!', type: 'vehicle', icon: '🚓', color: '#3b82f6', bg: '#dbeafe' },
  { id: 'fire', name: '소방차 🚒', soundText: '애웅애웅!', type: 'vehicle', icon: '🚒', color: '#ef4444', bg: '#fee2e2' },
  { id: 'bus', name: '타요 버스 🚌', soundText: '빵빵!', type: 'vehicle', icon: '🚌', color: '#eab308', bg: '#fef9c3' },
  { id: 'train', name: '칙칙폭폭 기차 🚂', soundText: '칙칙폭폭!', type: 'vehicle', icon: '🚂', color: '#8b5cf6', bg: '#f3e8ff' },
  { id: 'dog', name: '멍멍이 강아지 🐶', soundText: '멍멍! 왈왈!', type: 'animal', icon: '🐶', color: '#f97316', bg: '#ffedd5' },
  { id: 'cat', name: '야옹이 고양이 🐱', soundText: '야옹~ 야옹~', type: 'animal', icon: '🐱', color: '#ec4899', bg: '#fce7f3' },
  { id: 'lion', name: '어흥 사자 🦁', soundText: '어흥! 왕!', type: 'animal', icon: '🦁', color: '#d97706', bg: '#fef3c7' },
  { id: 'dino', name: '크앙 공룡 🦖', soundText: '크앙! 크앙!', type: 'animal', icon: '🦖', color: '#10b981', bg: '#d1fae5' }
];

const FOOD_ITEMS = [
  { id: 'apple', name: '빨간 사과', colorName: '빨간색', icon: '🍎', color: '#ef4444', bg: '#fee2e2' },
  { id: 'banana', name: '노란 바나나', colorName: '노란색', icon: '🍌', color: '#eab308', bg: '#fef9c3' },
  { id: 'grape', name: '보라 포도', colorName: '보라색', icon: '🍇', color: '#8b5cf6', bg: '#f3e8ff' },
  { id: 'broccoli', name: '초록 브로콜리', colorName: '초록색', icon: '🥦', color: '#10b981', bg: '#d1fae5' },
  { id: 'carrot', name: '주황 당근', colorName: '주황색', icon: '🥕', color: '#f97316', bg: '#ffedd5' },
  { id: 'strawberry', name: '새콤 딸기', colorName: '빨간색', icon: '🍓', color: '#f43f5e', bg: '#ffe4e6' }
];

const RAINBOW_PAINTS = [
  { name: '빨간색 🔴', color: '#ef4444', freq: 523.25 },
  { name: '주황색 🍊', color: '#f97316', freq: 587.33 },
  { name: '노란색 💛', color: '#eab308', freq: 659.25 },
  { name: '초록색 🍏', color: '#10b981', freq: 698.46 },
  { name: '파란색 💙', color: '#3b82f6', freq: 783.99 },
  { name: '남색 🌌', color: '#6366f1', freq: 880.00 },
  { name: '보라색 🔮', color: '#a855f7', freq: 987.77 }
];

export default function BabyPlayStudio() {
  const [activeTab, setActiveTab] = useState('vehicle'); // 'vehicle' | 'food' | 'paint' | 'teeth' | 'stickers'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // iPad Pro 12.9인치 뷰포트 시뮬레이션 토글
  const [isIpadFrame, setIsIpadFrame] = useState(true);

  // --- 스티커 보상 상태 ---
  const [stickers, setStickers] = useState([
    { id: 's1', name: '참 잘했어요 참새 🐤', icon: '🐤', date: '오늘' },
    { id: 's2', name: '최고야 별님 🌟', icon: '🌟', date: '오늘' }
  ]);

  // --- 1. 탈것 & 동물 모듈 상태 ---
  const [activeVehicleAnim, setActiveVehicleAnim] = useState(null);
  const [quizTarget, setQuizTarget] = useState(null);
  const [quizSuccess, setQuizSuccess] = useState(false);

  // --- 2. 곰돌이 먹이기 모듈 상태 ---
  const [wantedFood, setWantedFood] = useState(FOOD_ITEMS[1]); // 바나나
  const [bearMood, setBearMood] = useState('hungry'); // 'hungry' | 'happy'
  const [feedScore, setFeedScore] = useState(0);

  // --- 3. 무지개 물감 팡팡 모듈 상태 ---
  const [paintSplashes, setPaintSplashes] = useState([]);

  // --- 4. 치카치카 양치 모듈 상태 ---
  const [teethDirt, setTeethDirt] = useState([true, true, true, true, true, true]);
  const [brushingCount, setBrushingCount] = useState(0);

  useEffect(() => {
    audioEngine.muted = !soundEnabled;
  }, [soundEnabled]);

  // 스티커 추가 헬퍼
  const addRewardSticker = (name, icon) => {
    audioEngine.playFanfare();
    const newSticker = { id: `stk_${Date.now()}`, name, icon, date: '방금 획득!' };
    setStickers(prev => [newSticker, ...prev]);
  };

  // 1. 탈것/동물 터치
  const handleTouchVehicle = (item) => {
    setActiveVehicleAnim(item.id);
    audioEngine.playPop(523.25);
    setTimeout(() => setActiveVehicleAnim(null), 1200);

    if (quizTarget && quizTarget.id === item.id) {
      setQuizSuccess(true);
      audioEngine.playFanfare();
      addRewardSticker(`${item.name} 짝꿍 스티커`, item.icon);
      setTimeout(() => {
        setQuizSuccess(false);
        setQuizTarget(null);
      }, 2000);
    }
  };

  // 퀴즈 시작
  const startQuiz = () => {
    const randomItem = VEHICLES_ANIMALS[Math.floor(Math.random() * VEHICLES_ANIMALS.length)];
    setQuizTarget(randomItem);
    setQuizSuccess(false);
    audioEngine.playXylophone(659.25);
  };

  // 2. 곰돌이 먹이기 터치
  const handleFeedBear = (food) => {
    if (food.id === wantedFood.id) {
      audioEngine.playYum();
      setBearMood('happy');
      setFeedScore(prev => prev + 1);

      if ((feedScore + 1) % 3 === 0) {
        addRewardSticker(`${food.name} 맛있는 스티커`, food.icon);
      }

      setTimeout(() => {
        setBearMood('hungry');
        const nextFood = FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)];
        setWantedFood(nextFood);
      }, 1500);
    } else {
      audioEngine.playPop(300);
    }
  };

  // 3. 물감 팡팡 터치
  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paint = RAINBOW_PAINTS[Math.floor(Math.random() * RAINBOW_PAINTS.length)];
    audioEngine.playXylophone(paint.freq);

    const newSplash = {
      id: Date.now() + Math.random(),
      x,
      y,
      color: paint.color,
      name: paint.name,
      size: Math.floor(Math.random() * 60) + 80
    };

    setPaintSplashes(prev => [...prev.slice(-15), newSplash]);
  };

  // 4. 치카치카 양치 쓱싹
  const handleBrushTeeth = (idx) => {
    if (!teethDirt[idx]) return;

    audioEngine.playChika();
    const updated = [...teethDirt];
    updated[idx] = false;
    setTeethDirt(updated);
    setBrushingCount(prev => prev + 1);

    if (updated.every(d => !d)) {
      audioEngine.playFanfare();
      addRewardSticker('반짝반짝 이닦기 영웅 🦷', '🦷');
    }
  };

  const resetTeeth = () => {
    setTeethDirt([true, true, true, true, true, true]);
    setBrushingCount(0);
    audioEngine.playBubble();
  };

  return (
    <div style={{
      width: '100%',
      minHeight: 'calc(100vh - 70px)',
      background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #e0f2fe 100%)',
      padding: isIpadFrame ? '1.5rem 1rem' : '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none'
    }}>
      {/* 1. 상단 아기자람 헤더바 */}
      <div style={{
        width: '100%',
        maxWidth: '1366px', // iPad 12.9인치 가로 해상도 (1366px)
        background: '#ffffff',
        borderRadius: '24px',
        padding: '0.8rem 1.4rem',
        boxShadow: '0 10px 25px -5px rgba(251, 146, 60, 0.25)',
        border: '3.5px solid #fdba74',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '2rem',
            background: '#ffedd5',
            padding: '8px',
            borderRadius: '20px',
            lineHeight: 1,
            boxShadow: '0 4px 10px rgba(0,0,0,0.06)'
          }}>
            👶
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ea580c', margin: 0 }}>
                25개월 아기 자람 놀이터
              </h2>
              <span style={{
                background: '#ffedd5',
                color: '#c2410c',
                fontSize: '0.8rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1.5px solid #fed7aa'
              }}>
                만 2세 (25개월) 맞춤 🎈
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#78350f', margin: 0, fontWeight: 700 }}>
              iPad 12.9인치 대화면 최적화 | 큰 아이콘 & 감각 사운드 자극
            </p>
          </div>
        </div>

        {/* 우측 컨트롤 도구: 사운드 토글 & iPad 프레임 시뮬레이터 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsIpadFrame(!isIpadFrame)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '16px',
              border: isIpadFrame ? '2.5px solid #0284c7' : '2px solid #cbd5e1',
              background: isIpadFrame ? '#e0f2fe' : '#ffffff',
              color: isIpadFrame ? '#0369a1' : '#475569',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}
          >
            <Smartphone size={18} /> {isIpadFrame ? 'iPad 12.9" 뷰포트' : '전체화면'}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '16px',
              border: soundEnabled ? '2.5px solid #16a34a' : '2px solid #cbd5e1',
              background: soundEnabled ? '#dcfce7' : '#f1f5f9',
              color: soundEnabled ? '#15803d' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {soundEnabled ? '소리 켜짐 🔊' : '음소거 🔇'}
          </button>
        </div>
      </div>

      {/* 2. iPad Pro 12.9인치 규격 캔버스 컨테이너 (1366px x 900px 비율) */}
      <div style={{
        width: '100%',
        maxWidth: isIpadFrame ? '1366px' : '100%',
        minHeight: isIpadFrame ? '860px' : 'auto',
        background: '#ffffff',
        borderRadius: '32px',
        border: isIpadFrame ? '6px solid #fb923c' : '2px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 아기용 커다란 메인 탭 네비게이션바 (최소 높이 80px) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          padding: '12px',
          background: '#fff7ed',
          borderBottom: '3px solid #fed7aa'
        }}>
          {[
            { id: 'vehicle', label: '🚗 탈것 & 동물', sub: '소리 / 짝꿍 놀이', color: '#ea580c' },
            { id: 'food', label: '🍌 곰돌이 얌얌', sub: '색깔 & 먹이기', color: '#d97706' },
            { id: 'paint', label: '🎨 무지개 물감', sub: '터치 감각 미술', color: '#0284c7' },
            { id: 'teeth', label: '🪥 치카치카', sub: '반짝 양치 습관', color: '#16a34a' },
            { id: 'stickers', label: '🌟 칭찬 스티커', sub: `보상 (${stickers.length}개)`, color: '#a855f7' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  audioEngine.playPop(500);
                }}
                style={{
                  padding: '12px 6px',
                  borderRadius: '20px',
                  border: isActive ? `3.5px solid ${tab.color}` : '2px solid #fed7aa',
                  background: isActive ? tab.color : '#ffffff',
                  color: isActive ? '#ffffff' : '#475569',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 8px 20px rgba(0,0,0,0.15)' : 'none',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>{tab.label}</span>
                <span style={{ fontSize: '0.75rem', opacity: isActive ? 0.95 : 0.7, fontWeight: 700 }}>{tab.sub}</span>
              </button>
            );
          })}
        </div>

        {/* 3. 모듈별 놀이 캔버스 영역 */}
        <div style={{ flex: 1, padding: '1.5rem', position: 'relative', background: '#fafafa', overflowY: 'auto' }}>
          
          {/* --- 모듈 1: 🚗 탈것 & 동물 소리 놀이 --- */}
          {activeTab === 'vehicle' && (
            <div>
              {/* 퀴즈 제안 바 */}
              <div style={{
                background: '#ffedd5',
                borderRadius: '20px',
                padding: '1rem 1.4rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '2px solid #fed7aa'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#9a3412', margin: 0 }}>
                    {quizTarget ? `❓ "${quizTarget.name}" 카드를 눌러보세요!` : '💡 아래 무늬 카드를 터치하면 신나는 소리가 나요!'}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: '#c2410c', margin: '4px 0 0 0', fontWeight: 700 }}>
                    25개월 어휘 폭발기! 사물 이름과 울음소리를 함께 익혀요.
                  </p>
                </div>
                <button
                  onClick={startQuiz}
                  style={{
                    background: '#ea580c',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '16px',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(234,88,12,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles size={18} /> {quizTarget ? '새 퀴즈 받기' : '퀴즈 시작하기!'}
                </button>
              </div>

              {/* 퀴즈 성공 팡파르 팝업 */}
              {quizSuccess && (
                <div style={{
                  background: '#dcfce7',
                  border: '3px solid #22c55e',
                  borderRadius: '20px',
                  padding: '1rem',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  color: '#15803d',
                  animation: 'bounce 0.6s infinite'
                }}>
                  🎉 우와!! 정답이에요! 참 잘했어요! 스티커 획득! 🌟
                </div>
              )}

              {/* 8종 카드 그리드 (iPad 12.9인치 4x2 대형 그리드 레이아웃) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1.2rem'
              }}>
                {VEHICLES_ANIMALS.map(item => {
                  const isAnim = activeVehicleAnim === item.id;
                  const isTarget = quizTarget && quizTarget.id === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleTouchVehicle(item)}
                      style={{
                        background: item.bg,
                        border: isTarget ? `4px solid #ef4444` : `3.5px solid ${item.color}`,
                        borderRadius: '28px',
                        padding: '1.8rem 1rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transform: isAnim ? 'scale(1.12) rotate(3deg)' : 'scale(1)',
                        transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                        position: 'relative'
                      }}
                    >
                      <div style={{ fontSize: '4.2rem', marginBottom: '8px', lineHeight: 1 }}>
                        {item.icon}
                      </div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}>
                        {item.name}
                      </h4>
                      <span style={{
                        background: item.color,
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        padding: '4px 12px',
                        borderRadius: '14px',
                        display: 'inline-block'
                      }}>
                        {item.soundText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- 모듈 2: 🍌 곰돌이야 얌얌 먹자! --- */}
          {activeTab === 'food' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                background: '#fef3c7',
                border: '2px solid #fde047',
                borderRadius: '20px',
                padding: '0.8rem 1.2rem',
                display: 'inline-block',
                marginBottom: '1.5rem',
                fontWeight: 900,
                color: '#854d0e',
                fontSize: '1.1rem'
              }}>
                🎯 점수: {feedScore}점 | 곰돌이에게 원하는 음식을 터치해서 전해주세용!
              </div>

              {/* 곰돌이 캐릭터 반응 박스 */}
              <div style={{
                background: '#fffbebfb',
                border: '4px solid #f59e0b',
                borderRadius: '32px',
                padding: '2.5rem',
                maxWidth: '480px',
                margin: '0 auto 2rem auto',
                boxShadow: '0 15px 30px rgba(245, 158, 11, 0.2)',
                transform: bearMood === 'happy' ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.2s ease'
              }}>
                <div style={{ fontSize: '6.5rem', marginBottom: '10px', lineHeight: 1 }}>
                  {bearMood === 'happy' ? '🐻💖' : '🐻'}
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#78350f', marginBottom: '8px' }}>
                  {bearMood === 'happy' ? '성공! 냠냠 꿀꺽! 맛있어~ 🥰' : `배고파요! "${wantedFood.name}" 주세요!`}
                </h3>
                <span style={{
                  background: wantedFood.bg,
                  color: wantedFood.color,
                  border: `2px solid ${wantedFood.color}`,
                  padding: '6px 16px',
                  borderRadius: '16px',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  원하는 색깔: {wantedFood.colorName} ({wantedFood.icon})
                </span>
              </div>

              {/* 과일/채소 6종 선택 터치판 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.2rem',
                maxWidth: '800px',
                margin: '0 auto'
              }}>
                {FOOD_ITEMS.map(food => (
                  <div
                    key={food.id}
                    onClick={() => handleFeedBear(food)}
                    style={{
                      background: food.bg,
                      border: `3.5px solid ${food.color}`,
                      borderRadius: '24px',
                      padding: '1.4rem',
                      cursor: 'pointer',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                      transition: 'transform 0.1s ease'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.94)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ fontSize: '3.5rem', marginBottom: '4px' }}>{food.icon}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{food.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- 모듈 3: 🎨 무지개 물감 팡팡 --- */}
          {activeTab === 'paint' && (
            <div>
              <div style={{
                background: '#e0f2fe',
                border: '2px solid #bae6fd',
                borderRadius: '18px',
                padding: '0.8rem 1.2rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0369a1' }}>
                  🎨 캔버스 아무 곳이나 터치/클릭해보세요! 예쁜 무지개 물감과 실로폰 소리가 팡팡!
                </span>
                <button
                  onClick={() => setPaintSplashes([])}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={16} /> 캔버스 지우기
                </button>
              </div>

              {/* 인터랙티브 무지개 물감 캔버스 뷰 영역 */}
              <div
                onClick={handleCanvasClick}
                style={{
                  width: '100%',
                  height: '520px',
                  background: '#ffffff',
                  borderRadius: '28px',
                  border: '3.5px dashed #38bdf8',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'crosshair',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.03)'
                }}
              >
                {paintSplashes.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>
                    <Sparkles size={48} className="text-sky-400 mb-2 animate-bounce" />
                    <p style={{ fontSize: '1.3rem', fontWeight: 900 }}>화면을 손가락으로 콕콕 눌러보세요!</p>
                  </div>
                )}

                {paintSplashes.map(s => (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: s.x - s.size / 2,
                      top: s.y - s.size / 2,
                      width: s.size,
                      height: s.size,
                      borderRadius: '50%',
                      background: s.color,
                      opacity: 0.82,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.85rem',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                      animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- 모듈 4: 🪥 치카치카 양치 습관 --- */}
          {activeTab === 'teeth' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                background: '#dcfce7',
                border: '2px solid #86efac',
                borderRadius: '18px',
                padding: '0.8rem 1.4rem',
                display: 'inline-block',
                marginBottom: '1.5rem',
                fontSize: '1.1rem',
                fontWeight: 900,
                color: '#166534'
              }}>
                🪥 아기 공룡의 얼룩진 이빨을 칫솔로 콕콕 눌러 뽀득뽀득 닦아주세요! ({brushingCount}번 쓱싹)
              </div>

              {/* 공룡 양치 캐릭터 박스 */}
              <div style={{
                background: '#ecfdf5',
                border: '4px solid #10b981',
                borderRadius: '32px',
                padding: '2rem',
                maxWidth: '620px',
                margin: '0 auto 1.5rem auto',
                boxShadow: '0 15px 30px rgba(16, 185, 129, 0.15)'
              }}>
                <div style={{ fontSize: '5.5rem', marginBottom: '10px' }}>🦖</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', marginBottom: '1.2rem' }}>
                  {teethDirt.every(d => !d) ? '🎉 우와! 공룡 이빨이 반짝반짝 100점 뽀득뽀득!' : '이빨에 묻은 얼룩을 문질러주세요!'}
                </h3>

                {/* 6개 이빨 터치 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '10px',
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '20px',
                  border: '2px solid #a7f3d0'
                }}>
                  {teethDirt.map((dirty, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleBrushTeeth(idx)}
                      style={{
                        padding: '1.2rem 0.5rem',
                        borderRadius: '16px',
                        border: dirty ? '3px solid #f59e0b' : '3px solid #3b82f6',
                        background: dirty ? '#fef3c7' : '#e0f2fe',
                        cursor: 'pointer',
                        fontSize: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{dirty ? '🦷💩' : '🦷✨'}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: dirty ? '#b45309' : '#0369a1' }}>
                        {dirty ? '치카필요' : '깨끗해요'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={resetTeeth}
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '16px',
                  fontWeight: 900,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={18} /> 다시 치카치카 하기
              </button>
            </div>
          )}

          {/* --- 모듈 5: 🌟 칭찬 스티커 북 --- */}
          {activeTab === 'stickers' && (
            <div>
              <div style={{
                background: '#f3e8ff',
                border: '2px solid #d8b4fe',
                borderRadius: '20px',
                padding: '1rem 1.4rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#6b21a8', margin: 0 }}>
                    🌟 참 잘했어요! 아기 칭찬 스티커 북 ({stickers.length}개 수집)
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: '#7e22ce', margin: '4px 0 0 0', fontWeight: 700 }}>
                    놀이를 하나씩 잘 마칠 때마다 스티커를 받아서 컬렉션을 완성해요!
                  </p>
                </div>
                <button
                  onClick={() => addRewardSticker('사랑해요 아기 칭찬 ⭐', '⭐')}
                  style={{
                    background: '#9333ea',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '16px',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Award size={18} /> 칭찬 스티커 하나 선물하기
                </button>
              </div>

              {/* 스티커 북 컬렉션 판 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1.2rem'
              }}>
                {stickers.map(stk => (
                  <div
                    key={stk.id}
                    style={{
                      background: '#ffffff',
                      border: '3px solid #c084fc',
                      borderRadius: '24px',
                      padding: '1.5rem 1rem',
                      textAlign: 'center',
                      boxShadow: '0 8px 20px rgba(168, 85, 247, 0.12)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ fontSize: '4.5rem', marginBottom: '8px', lineHeight: 1 }}>
                      {stk.icon}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#4c1d95' }}>
                      {stk.name}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#9333ea', fontWeight: 700 }}>
                      {stk.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
