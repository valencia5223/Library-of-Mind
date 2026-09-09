import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Volume2, VolumeX, RotateCcw, Smartphone, X, Play, Pause, SkipForward, SkipBack, Music, Eraser } from 'lucide-react';
import duckImg from './assets/duck.jpg';
import strawberryImg from './assets/strawberry.jpg';
import tangerineImg from './assets/tangerine.jpg';
import peachImg from './assets/peach.jpg';
import melonImg from './assets/melon.jpg';
import pineappleImg from './assets/pineapple.jpg';

// --- 실제 동물 울음소리 MP3 재생 사운드 엔진 ---
class BabySoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.currentAudio = null;
    this.audioCache = new Map();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 앱 진입 시 모든 동물 울음소리를 백그라운드에서 사전 프리로드 및 메모리 캐싱 (딜레이 0초 달성)
  preloadItemSounds(items) {
    items.forEach(item => {
      const url = item.soundUrl || `/sounds/${item.id}.mp3`;
      if (url && !this.audioCache.has(url)) {
        try {
          const audio = new Audio(url);
          audio.preload = 'auto';
          audio.load();
          this.audioCache.set(url, audio);
        } catch (e) {}
      }
    });
  }

  // 실제 동물 녹음 MP3 파일 재생 (지연 없는 0초 반응)
  playItemSound(item) {
    if (this.muted) return;
    this.init();

    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      const id = item.id;
      const idCap = id.charAt(0).toUpperCase() + id.slice(1);
      const idUpper = id.toUpperCase();

      // soundUrl이 있으면 최우선(1순위)으로 직접 재생하여 불필요한 404 network delay 완전 방지
      const candidates = item.soundUrl
        ? [item.soundUrl, `/sounds/${id}.mp3`, `/sounds/${idCap}.mp3`, `/sounds/${idUpper}.mp3`]
        : [`/sounds/${id}.mp3`, `/sounds/${idCap}.mp3`, `/sounds/${idUpper}.mp3`, `/songs/${id}.mp3`].filter(Boolean);

      const tryNext = (index) => {
        if (index >= candidates.length) return;
        const src = candidates[index];
        let audio;

        if (this.audioCache.has(src)) {
          audio = this.audioCache.get(src).cloneNode(true);
        } else {
          audio = new Audio(src);
        }

        audio.volume = 0.85;
        audio.currentTime = 0;
        audio.play().then(() => {
          this.currentAudio = audio;
        }).catch(() => {
          tryNext(index + 1);
        });
      };
      tryNext(0);
    } catch (e) { }
  }

  stopAllSounds() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) { }
      this.currentAudio = null;
    }
  }

  playFreq(freq, type = 'sine', duration = 0.25, gainVal = 0.4) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) { }
  }

  playXylophone(freq = 523.25) {
    this.playFreq(freq, 'triangle', 0.45, 0.6);
  }

  playPopSound() {
    this.playFreq(800, 'sine', 0.08, 0.5);
    setTimeout(() => this.playFreq(1200, 'sine', 0.06, 0.4), 40);
  }

  playFanfare() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playXylophone(freq), idx * 110);
    });
    try {
      confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
    } catch (e) { }
  }

  stopAllSounds() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
  }

  playYum() {
    this.playFreq(587.33, 'triangle', 0.2, 0.5);
    setTimeout(() => this.playFreq(880, 'triangle', 0.2, 0.5), 120);
  }
}

const audioEngine = new BabySoundEngine();

// =============================================================================
// 20종 동물 – Pexels 실사 사진 + Mixkit 실제 동물 울음소리 MP3
// Pexels: 파일명에 동물명이 포함된 공인 사진  |  Mixkit: 브라우저 네트워크로 직접 검증한 실제 녹음 MP3
// =============================================================================
const REAL_ANIMALS = [
  {
    id: 'dog', name: '강아지', soundText: '멍멍! 왈왈!', icon: '🐶',
    img: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1/1-preview.mp3',
    color: '#f97316', bg: '#ffedd5', fitPos: 'center 30%'
  },

  {
    id: 'cat', name: '고양이', soundText: '야옹~ 야옹~', icon: '🐱',
    img: 'https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/93/93-preview.mp3',
    color: '#ec4899', bg: '#fce7f3', fitPos: 'center 20%'
  },

  {
    id: 'lion', name: '사자', soundText: '어흥! 어흥!', icon: '🦁',
    img: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/6/6-preview.mp3',
    color: '#d97706', bg: '#fef3c7', fitPos: 'center 30%'
  },

  {
    id: 'cow', name: '소', soundText: '음머어~!', icon: '🐮',
    img: 'https://images.pexels.com/photos/422218/pexels-photo-422218.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1751/1751-preview.mp3',
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center 30%'
  },

  {
    id: 'duck', name: '오리', soundText: '꽥꽥! 꽥꽥!', icon: '🦆',
    img: duckImg,
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/20/20-preview.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 30%'
  },

  {
    id: 'monkey', name: '원숭이', soundText: '우끼끼! 우끼끼!', icon: '🐵',
    img: 'https://images.pexels.com/photos/1207875/pexels-photo-1207875.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/monkey.mp3',
    color: '#854d0e', bg: '#fef3c7', fitPos: 'center 20%'
  },

  {
    id: 'horse', name: '말', soundText: '히힝~! 다닥다닥!', icon: '🐴',
    img: 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/76/76-preview.mp3',
    color: '#78350f', bg: '#fef3c7', fitPos: 'center 25%'
  },

  {
    id: 'chicken', name: '닭', soundText: '꼬꼬댁! 꼭끼오!', icon: '🐔',
    img: 'https://images.pexels.com/photos/1769279/pexels-photo-1769279.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3',
    color: '#dc2626', bg: '#fee2e2', fitPos: 'center 20%'
  },

  {
    id: 'panda', name: '판다', soundText: '우물우물~ 판다!', icon: '🐼',
    img: 'https://images.pexels.com/photos/3608263/pexels-photo-3608263.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/panda.mp3',
    color: '#0f172a', bg: '#f1f5f9', fitPos: 'center 20%'
  },

  {
    id: 'elephant', name: '코끼리', soundText: '뿌우우~!', icon: '🐘',
    img: 'https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/elephant.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 30%'
  },

  {
    id: 'tiger', name: '호랑이', soundText: '크아앙! 어흥!', icon: '🐯',
    img: 'https://images.pexels.com/photos/792381/pexels-photo-792381.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/tiger.mp3',
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },

  {
    id: 'pig', name: '돼지', soundText: '꿀꿀! 꿀꿀!', icon: '🐷',
    img: 'https://images.pexels.com/photos/1300361/pexels-photo-1300361.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/3/3-preview.mp3',
    color: '#f43f5e', bg: '#ffe4e6', fitPos: 'center 20%'
  },

  {
    id: 'rabbit', name: '토끼', soundText: '깡충 깡충!', icon: '🐰',
    img: 'https://images.pexels.com/photos/326012/pexels-photo-326012.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/rabbit.mp3',
    color: '#a855f7', bg: '#f3e8ff', fitPos: 'center 20%'
  },

  {
    id: 'sheep', name: '양', soundText: '음메~ 음메~', icon: '🐑',
    img: 'https://images.pexels.com/photos/288621/pexels-photo-288621.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/sheep.mp3',
    color: '#64748b', bg: '#f8fafc', fitPos: 'center 30%'
  },

  {
    id: 'frog', name: '개구리', soundText: '개굴개굴! 펄쩍!', icon: '🐸',
    img: 'https://images.pexels.com/photos/70083/frog-macro-amphibian-green-70083.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1241/1241-preview.mp3',
    color: '#15803d', bg: '#dcfce7', fitPos: 'center 20%'
  },

  {
    id: 'penguin', name: '펭귄', soundText: '뒤뚱뒤뚱~!', icon: '🐧',
    img: 'https://images.pexels.com/photos/86405/penguin-funny-blue-water-86405.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/penguin.mp3',
    color: '#0f172a', bg: '#f1f5f9', fitPos: 'center 20%'
  },

  {
    id: 'fox', name: '여우', soundText: '컹컹! 여우!', icon: '🦊',
    img: 'https://images.pexels.com/photos/247399/pexels-photo-247399.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/fox.mp3',
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },

  {
    id: 'bear', name: '곰', soundText: '크엉~ 곰!', icon: '🐻',
    img: 'https://images.pexels.com/photos/158109/kodiak-brown-bear-adult-portrait-wildlife-158109.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/bear.mp3',
    color: '#78350f', bg: '#fef3c7', fitPos: 'center 20%'
  },

  {
    id: 'owl', name: '부엉이', soundText: '부엉부엉~', icon: '🦉',
    img: 'https://images.pexels.com/photos/1904354/pexels-photo-1904354.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/owl.mp3',
    color: '#581c87', bg: '#f3e8ff', fitPos: 'center 30%'
  },

  {
    id: 'dolphin', name: '돌고래', soundText: '끼익끼익! 첨벙!', icon: '🐬',
    img: 'https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=600',
    soundUrl: '/sounds/dolphin.mp3',
    color: '#0284c7', bg: '#e0f2fe', fitPos: 'center 20%'
  }
];

// =============================================================================
// 🍎 10종 싱싱 대표 과일 데이터셋 (소리 없음, 순수 실사 이미지 관찰 전용)
// =============================================================================
const REAL_FRUITS = [
  {
    id: 'apple', name: '사과', icon: '🍎',
    img: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#ef4444', bg: '#fee2e2', fitPos: 'center 30%'
  },
  {
    id: 'banana', name: '바나나', icon: '🍌',
    img: 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#d97706', bg: '#fef3c7', fitPos: 'center 30%'
  },
  {
    id: 'grape', name: '포도', icon: '🍇',
    img: 'https://images.pexels.com/photos/708777/pexels-photo-708777.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#7e22ce', bg: '#f3e8ff', fitPos: 'center 20%'
  },
  {
    id: 'watermelon', name: '수박', icon: '🍉',
    img: 'https://images.pexels.com/photos/1313267/pexels-photo-1313267.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#15803d', bg: '#dcfce7', fitPos: 'center 30%'
  },
  {
    id: 'strawberry', name: '딸기', icon: '🍓',
    img: strawberryImg,
    color: '#e11d48', bg: '#ffe4e6', fitPos: 'center 20%'
  },
  {
    id: 'tangerine', name: '귤', icon: '🍊',
    img: tangerineImg,
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center 20%'
  },
  {
    id: 'peach', name: '복숭아', icon: '🍑',
    img: peachImg,
    color: '#f43f5e', bg: '#ffe4e6', fitPos: 'center center'
  },
  {
    id: 'pineapple', name: '파인애플', icon: '🍍',
    img: pineappleImg,
    color: '#b45309', bg: '#fef3c7', fitPos: 'center center', objectFit: 'contain'
  },
  {
    id: 'melon', name: '멜론', icon: '🍈',
    img: melonImg,
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'cherry', name: '체리', icon: '🍒',
    img: 'https://images.pexels.com/photos/109274/pexels-photo-109274.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: '#be123c', bg: '#ffe4e6', fitPos: 'center 20%'
  }
];

const FOOD_ITEMS = [
  { id: 'apple', name: '사과', colorName: '빨간색', icon: '🍎', color: '#ef4444', bg: '#fee2e2' },
  { id: 'banana', name: '바나나', colorName: '노란색', icon: '🍌', color: '#eab308', bg: '#fef9c3' },
  { id: 'grape', name: '포도', colorName: '보라색', icon: '🍇', color: '#8b5cf6', bg: '#f3e8ff' },
  { id: 'broccoli', name: '브로콜리', colorName: '초록색', icon: '🥦', color: '#10b981', bg: '#d1fae5' },
  { id: 'carrot', name: '당근', colorName: '주황색', icon: '🥕', color: '#f97316', bg: '#ffedd5' },
  { id: 'strawberry', name: '딸기', colorName: '빨간색', icon: '🍓', color: '#f43f5e', bg: '#ffe4e6' }
];

// 🎵 Vite 동적 파일 스캐너: public/music/ 폴더 안의 모든 MP3 파일을 자동으로 감지하여 100% 실시간 리스트화!
const musicModules = import.meta.glob('/public/music/*.mp3', { query: '?url', eager: true });

const LOCAL_NURSERY_SONGS = Object.keys(musicModules).map((filePath, i) => {
  const fileName = filePath.split('/').pop();
  const decodedFileName = decodeURIComponent(fileName);
  const rawTitle = decodedFileName.replace(/\.mp3$/i, '').replace(/^\d+\s*/, '');
  return {
    id: `song_${i}_${fileName}`,
    fileName: decodedFileName,
    title: rawTitle,
    url: `/music/${encodeURIComponent(fileName)}`
  };
}).sort((a, b) => a.fileName.localeCompare(b.fileName, 'ko', { numeric: true }));

const RAINBOW_PAINTS = [
  { name: '빨간색 🔴', color: '#ef4444', freq: 523.25 },
  { name: '주황색 🍊', color: '#f97316', freq: 587.33 },
  { name: '노란색 💛', color: '#eab308', freq: 659.25 },
  { name: '초록색 🍏', color: '#10b981', freq: 698.46 },
  { name: '파란색 💙', color: '#3b82f6', freq: 783.99 },
  { name: '남색 🌌', color: '#6366f1', freq: 880.00 },
  { name: '보라색 🔮', color: '#a855f7', freq: 987.77 }
];

// ✏️ 따라쓰기 템플릿 데이터 (숫자 0~9 SVG 가이드)
const TRACING_TEMPLATES = [
  { id: 'num0', label: '0', category: '숫자',
    paths: ['M 50 15 C 25 15 25 35 25 50 C 25 65 25 85 50 85 C 75 85 75 65 75 50 C 75 35 75 15 50 15 Z'], viewBox: '0 0 100 100' },
  { id: 'num1', label: '1', category: '숫자',
    paths: ['M 38 32 L 52 18 L 52 82 M 34 82 L 70 82'], viewBox: '0 0 100 100' },
  { id: 'num2', label: '2', category: '숫자',
    paths: ['M 25 32 Q 25 12 50 12 Q 75 12 75 32 Q 75 52 50 58 L 25 85 L 75 85'], viewBox: '0 0 100 100' },
  { id: 'num3', label: '3', category: '숫자',
    paths: ['M 25 15 L 72 15 L 46 46 Q 75 46 75 68 Q 75 90 45 90 Q 25 90 25 78'], viewBox: '0 0 100 100' },
  { id: 'num4', label: '4', category: '숫자',
    paths: ['M 62 85 L 62 12 L 20 62 L 78 62'], viewBox: '0 0 100 100' },
  { id: 'num5', label: '5', category: '숫자',
    paths: ['M 70 15 L 32 15 L 28 48 Q 50 36 72 48 Q 80 64 65 82 Q 48 92 25 80'], viewBox: '0 0 100 100' },
  { id: 'num6', label: '6', category: '숫자',
    paths: ['M 66 22 Q 35 15 28 48 Q 24 64 36 82 Q 52 90 68 82 Q 76 68 74 54 Q 70 42 50 42 Q 34 42 28 54'], viewBox: '0 0 100 100' },
  { id: 'num7', label: '7', category: '숫자',
    paths: ['M 25 18 L 75 18 L 42 85'], viewBox: '0 0 100 100' },
  { id: 'num8', label: '8', category: '숫자',
    paths: ['M 50 50 Q 28 50 28 32 Q 28 15 50 15 Q 72 15 72 32 Q 72 50 50 50 Q 28 50 28 68 Q 28 85 50 85 Q 72 85 72 68 Q 72 50 50 50'], viewBox: '0 0 100 100' },
  { id: 'num9', label: '9', category: '숫자',
    paths: ['M 72 48 Q 72 32 62 20 Q 48 12 34 22 Q 24 34 28 48 Q 36 60 52 60 Q 72 60 72 40 Z M 72 48 L 72 68 Q 70 84 48 88'], viewBox: '0 0 100 100' },
];

// 🎈 퐁퐁 풍선 데이터
const INITIAL_BALLOONS = [
  { id: 1, color: '#ef4444', icon: '🐶', name: '강아지', left: 15, size: 90 },
  { id: 2, color: '#3b82f6', icon: '🐱', name: '고양이', left: 35, size: 100 },
  { id: 3, color: '#10b981', icon: '🦁', name: '사자', left: 55, size: 85 },
  { id: 4, color: '#f59e0b', icon: '🐮', name: '소', left: 75, size: 110 },
  { id: 5, color: '#ec4899', icon: '🐰', name: '토끼', left: 25, size: 95 },
  { id: 6, color: '#8b5cf6', icon: '🐼', name: '판다', left: 65, size: 105 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('animal');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIpadFrame, setIsIpadFrame] = useState(true);

  const [selectedRealItem, setSelectedRealItem] = useState(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const [wantedFood, setWantedFood] = useState(FOOD_ITEMS[1]);
  const [bearMood, setBearMood] = useState('hungry');
  const [feedScore, setFeedScore] = useState(0);
  const [isBearModalOpen, setIsBearModalOpen] = useState(false);

  // 🐻 곰돌이 과일 먹이기 드래그 앤 드롭 상태
  const bearBoxRef = useRef(null);
  const draggingFoodRef = useRef(null);
  const [draggingFood, setDraggingFood] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isOverBear, setIsOverBear] = useState(false);

  const handleStartDragFood = (e, food) => {
    e.preventDefault();
    draggingFoodRef.current = food;
    setDraggingFood(food);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    setDragPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    if (!isBearModalOpen) return;

    const handleWindowPointerMove = (e) => {
      if (!draggingFoodRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      setDragPos({ x, y });

      if (bearBoxRef.current) {
        const rect = bearBoxRef.current.getBoundingClientRect();
        const isOver = (
          x >= rect.left - 20 &&
          x <= rect.right + 20 &&
          y >= rect.top - 20 &&
          y <= rect.bottom + 20
        );
        setIsOverBear(isOver);
      }
    };

    const handleWindowPointerUp = (e) => {
      if (!draggingFoodRef.current) return;
      const food = draggingFoodRef.current;
      const x = e.clientX;
      const y = e.clientY;

      let isOver = false;
      if (bearBoxRef.current) {
        const rect = bearBoxRef.current.getBoundingClientRect();
        isOver = (
          x >= rect.left - 20 &&
          x <= rect.right + 20 &&
          y >= rect.top - 20 &&
          y <= rect.bottom + 20
        );
      }

      if (isOver) {
        handleFeedBear(food);
      } else {
        // 단일 클릭 시에도 먹여지도록 처리
        handleFeedBear(food);
      }

      draggingFoodRef.current = null;
      setDraggingFood(null);
      setIsOverBear(false);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isBearModalOpen, wantedFood]);

  const [strokes, setStrokes] = useState([]);
  const [brushSize, setBrushSize] = useState('medium');
  const [tracingMode, setTracingMode] = useState(null); // null = 자유그리기, template object = 따라쓰기

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const lastSoundTimeRef = useRef(0);

  // 동요 MP3 재생 관련 상태 및 Audio Ref
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [isAutoPlayNext, setIsAutoPlayNext] = useState(true); // 자동 연속 재생
  const [isShuffle, setIsShuffle] = useState(false); // 셔플 랜덤 재생
  const songAudioRef = useRef(null);

  // 풍선
  const [balloons, setBalloons] = useState(INITIAL_BALLOONS);
  const [popScore, setPopScore] = useState(0);

  useEffect(() => {
    audioEngine.muted = !soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    audioEngine.preloadItemSounds(REAL_ANIMALS);
    [...REAL_ANIMALS, ...REAL_FRUITS].forEach(item => {
      if (item.img) {
        const img = new Image();
        img.src = item.img;
      }
    });
  }, []);

  // 동요 탭 변경 시 오디오 정지 및 재생 처리
  useEffect(() => {
    if (activeTab !== 'song' && songAudioRef.current) {
      songAudioRef.current.pause();
      setIsSongPlaying(false);
    }
  }, [activeTab]);

  const playSelectedSong = (idx) => {
    setCurrentSongIdx(idx);
    const song = LOCAL_NURSERY_SONGS[idx];
    if (!song) return;

    if (songAudioRef.current) {
      songAudioRef.current.pause();
    }

    const audio = new Audio(song.url);
    audio.volume = 0.85;
    audio.play().then(() => {
      setIsSongPlaying(true);
    }).catch(() => {
      setIsSongPlaying(false);
    });

    audio.onended = () => {
      const nextIdx = (idx + 1) % LOCAL_NURSERY_SONGS.length;
      playSelectedSong(nextIdx);
    };

    songAudioRef.current = audio;
  };

  const togglePlaySong = () => {
    if (isSongPlaying && songAudioRef.current) {
      songAudioRef.current.pause();
      setIsSongPlaying(false);
    } else {
      playSelectedSong(currentSongIdx);
    }
  };

  const handleNextSong = () => {
    const nextIdx = (currentSongIdx + 1) % LOCAL_NURSERY_SONGS.length;
    playSelectedSong(nextIdx);
  };

  const handlePrevSong = () => {
    const prevIdx = (currentSongIdx - 1 + LOCAL_NURSERY_SONGS.length) % LOCAL_NURSERY_SONGS.length;
    playSelectedSong(prevIdx);
  };

  const openRealDetailModal = (item) => {
    setSelectedRealItem(item);
    setTimeout(() => {
      if (item.soundUrl) audioEngine.playItemSound(item);
    }, 0);
  };

  const closeItemModal = () => {
    audioEngine.stopAllSounds();
    setSelectedRealItem(null);
  };

  const speakQuizQuestion = (name) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const lastChar = name.charCodeAt(name.length - 1);
      const hasBatchim = (lastChar - 0xac00) % 28 > 0;
      const particle = hasBatchim ? '은' : '는';
      const text = `${name}${particle} 누구일까요?`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateQuizQuestion = () => {
    audioEngine.stopAllSounds();
    const target = REAL_ANIMALS[Math.floor(Math.random() * REAL_ANIMALS.length)];
    const others = REAL_ANIMALS.filter(i => i.id !== target.id);
    const shuffledOthers = [...others].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [target, ...shuffledOthers].sort(() => 0.5 - Math.random());
    setQuizQuestion({ target, options });
    setQuizFeedback(null);
    speakQuizQuestion(target.name);
  };

  const startQuizModal = () => {
    setIsQuizModalOpen(true);
    generateQuizQuestion();
  };

  const handleAnswerQuiz = (option) => {
    if (!quizQuestion || quizFeedback) return;
    if (option.id === quizQuestion.target.id) {
      setQuizFeedback('correct');
      audioEngine.playFanfare();
      if (quizQuestion.target.soundUrl) {
        setTimeout(() => {
          audioEngine.playItemSound(quizQuestion.target);
        }, 300);
      }
      setTimeout(() => {
        audioEngine.stopAllSounds();
        generateQuizQuestion();
      }, 3000);
    } else {
      setQuizFeedback('wrong');
      audioEngine.playFreq(200, 'sawtooth', 0.3);
      setTimeout(() => setQuizFeedback(null), 1000);
    }
  };

  const speakBearWish = (food) => {
    const targetFood = food || wantedFood || FOOD_ITEMS[0];
    if (!targetFood) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `${targetFood.name} 먹고싶어요`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const openBearModal = () => {
    const initialFood = wantedFood || FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)];
    setWantedFood(initialFood);
    setIsBearModalOpen(true);
    speakBearWish(initialFood);
  };

  const handleFeedBear = (food) => {
    const currentWanted = wantedFood || FOOD_ITEMS[0];
    if (food.id === currentWanted.id) {
      audioEngine.playYum();
      setBearMood('happy');
      setFeedScore(prev => prev + 1);
      setTimeout(() => {
        setBearMood('hungry');
        const nextFood = FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)];
        setWantedFood(nextFood);
        speakBearWish(nextFood);
      }, 1500);
    } else {
      audioEngine.playFreq(250, 'sawtooth', 0.2);
    }
  };

  const BRUSH_SIZES = { small: { width: 6, label: '슬림 연필' }, medium: { width: 14, label: '색연필' }, large: { width: 24, label: '굵은 붓' } };

  const handlePointerDown = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const paint = RAINBOW_PAINTS[Math.floor(Math.random() * RAINBOW_PAINTS.length)];
    audioEngine.playXylophone(paint.freq);
    lastSoundTimeRef.current = Date.now();

    const newStroke = {
      id: Date.now() + Math.random(),
      color: paint.color,
      width: BRUSH_SIZES[brushSize].width,
      points: [{ x, y }]
    };

    currentStrokeRef.current = newStroke;
    setStrokes(prev => [...prev.slice(-40), newStroke]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const stroke = currentStrokeRef.current;
    const lastPt = stroke.points[stroke.points.length - 1];

    if (lastPt) {
      const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
      if (dist < 4) return; // 미세 반응은 묶어서 매끄럽게 처리
    }

    stroke.points.push({ x, y });

    const now = Date.now();
    if (now - lastSoundTimeRef.current > 120) {
      const paint = RAINBOW_PAINTS[Math.floor(Math.random() * RAINBOW_PAINTS.length)];
      audioEngine.playXylophone(paint.freq);
      lastSoundTimeRef.current = now;
    }

    setStrokes(prev => prev.map(s => s.id === stroke.id ? { ...stroke, points: [...stroke.points] } : s));
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #fffbebf8 0%, #fef3c7 40%, #d1fae5 100%)',
      padding: isIpadFrame ? '1.5rem 1rem' : '1rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none',
      overflow: 'hidden'
    }}>
      {/* 짱구 스타일 헤더 */}
      <header style={{
        width: '100%', maxWidth: '1366px', background: '#ffffff', borderRadius: '24px',
        padding: '1rem 1.8rem', boxShadow: '0 12px 28px -6px rgba(239, 68, 68, 0.22)',
        border: '4px solid #ef4444', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#fff1f2', border: '3px solid #f87171',
            padding: '6px 12px', borderRadius: '22px', display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}>
            <img src="/shinchan_sticker.png" alt="짱구" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#dc2626', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              유나의 짱구 발달 놀이터 🖍️
            </h1>
            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#047857', background: '#d1fae5', padding: '2px 10px', borderRadius: '12px', display: 'inline-block', marginTop: '2px' }}>
              ✨ 짱구와 함께하는 신나는 놀이 세상!
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setIsIpadFrame(!isIpadFrame)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '16px',
            border: isIpadFrame ? '2.5px solid #0284c7' : '2px solid #cbd5e1',
            background: isIpadFrame ? '#e0f2fe' : '#ffffff',
            color: isIpadFrame ? '#0369a1' : '#475569', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
          }}>
            <Smartphone size={18} /> {isIpadFrame ? 'iPad 12.9" 규격뷰' : '전체화면'}
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '16px',
            border: soundEnabled ? '2.5px solid #10b981' : '2px solid #cbd5e1',
            background: soundEnabled ? '#d1fae5' : '#f1f5f9',
            color: soundEnabled ? '#047857' : '#64748b', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
          }}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {soundEnabled ? '소리 켜짐 🔊' : '음소거 🔇'}
          </button>
        </div>
      </header>

      {/* 메인 */}
      <main style={{
        width: '100%', maxWidth: isIpadFrame ? '1366px' : '100%',
        flex: 1, minHeight: 0, background: '#ffffff', borderRadius: '32px',
        border: isIpadFrame ? '6px solid #ef4444' : '2px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        {/* 탭 네비게이션 (짱구 테마 컬러) */}
        <nav style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
          padding: '14px', background: '#fff1f2', borderBottom: '3.5px solid #fca5a5'
        }}>
          {[
            { id: 'animal', label: '📸 생생 동물', sub: '울음소리 탐험', color: '#ef4444' },
            { id: 'fruit', label: '🍎 싱싱 과일', sub: '고화질 실사 관찰', color: '#10b981' },
            { id: 'paint', label: '🎨 무지개 물감', sub: '터치 감각 미술', color: '#3b82f6' },
            { id: 'song', label: '🎵 동요 재생', sub: `한국 동요 (${LOCAL_NURSERY_SONGS.length}곡)`, color: '#f97316' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); audioEngine.playFreq(520, 'sine', 0.15); }} style={{
                padding: '14px 8px', borderRadius: '22px',
                border: isActive ? `4px solid ${tab.color}` : '2px solid #fed7aa',
                background: isActive ? tab.color : '#ffffff',
                color: isActive ? '#ffffff' : '#475569', fontWeight: 900, cursor: 'pointer',
                boxShadow: isActive ? '0 10px 22px rgba(0,0,0,0.18)' : 'none',
                transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>{tab.label}</span>
                <span style={{ fontSize: '0.8rem', opacity: isActive ? 0.95 : 0.7, fontWeight: 800 }}>{tab.sub}</span>
              </button>
            );
          })}
        </nav>

        {/* 캔버스 영역 */}
        <div style={{ flex: 1, padding: activeTab === 'paint' ? '1rem 1.8rem' : '1.8rem', position: 'relative', background: '#fafafa', overflowY: activeTab === 'paint' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* ===== 모듈 1: 20종 동물 실사 ===== */}
          {activeTab === 'animal' && (
            <div>
              <div style={{
                background: '#ffedd5', borderRadius: '24px', padding: '1.2rem 1.6rem', marginBottom: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '2.5px solid #fed7aa', flexWrap: 'wrap', gap: '14px'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9a3412', margin: 0 }}>
                  📸 카드를 누르면 진짜 동물 울음소리가 들려요!
                </h2>
                <button onClick={startQuizModal} style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff',
                  border: 'none', padding: '12px 24px', borderRadius: '18px', fontWeight: 900,
                  fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(239,68,68,0.35)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={22} /> 🎯 동물 퀴즈!
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.4rem' }}>
                {REAL_ANIMALS.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `4px solid ${item.color}`, borderRadius: '28px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '210px', overflow: 'hidden', background: '#f8fafc' }}>
                      <img
                        src={item.img}
                        alt={item.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          if (item.id === 'duck') e.target.src = 'https://images.pexels.com/photos/2695703/pexels-photo-2695703.jpeg?auto=compress&cs=tinysrgb&w=800';
                        }}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          objectPosition: item.fitPos || 'center 20%'
                        }}
                      />
                    </div>
                    <div style={{ padding: '1.1rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>{item.name}</h3>
                      {item.soundUrl ? (
                        <span style={{
                          background: item.color, color: '#ffffff', fontSize: '0.85rem', fontWeight: 900,
                          padding: '4px 12px', borderRadius: '14px', display: 'inline-block'
                        }}>🔊 {item.soundText}</span>
                      ) : (
                        <span style={{
                          background: '#94a3b8', color: '#ffffff', fontSize: '0.85rem', fontWeight: 900,
                          padding: '4px 12px', borderRadius: '14px', display: 'inline-block'
                        }}>🔇 소리 준비 중</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 2: 🍎 10종 싱싱 과일 관찰 ===== */}
          {activeTab === 'fruit' && (
            <div>
              <div style={{
                background: '#fee2e2', borderRadius: '24px', padding: '1.2rem 1.6rem', marginBottom: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '2.5px solid #fecdd3', flexWrap: 'wrap', gap: '14px'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9f1239', margin: 0 }}>
                  🍎 싱싱한 과일 카드를 콕콕 눌러보세요! 커다란 고화질 사진이 보여요!
                </h2>
                <button onClick={openBearModal} style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff',
                  border: 'none', padding: '12px 24px', borderRadius: '18px', fontWeight: 900,
                  fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={22} /> 🐻 곰돌이 과일 먹이기!
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.2rem' }}>
                {REAL_FRUITS.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `4px solid ${item.color}`, borderRadius: '26px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '170px', overflow: 'hidden', background: '#f8fafc', padding: item.objectFit === 'contain' ? '10px' : '0' }}>
                      <img
                        src={item.img}
                        alt={item.name}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: item.objectFit || 'cover',
                          objectPosition: item.fitPos || 'center center'
                        }}
                      />
                    </div>
                    <div style={{ padding: '1rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{item.icon} {item.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 3: 무지개 물감 ===== */}
          {activeTab === 'paint' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* 상단 툴바 */}
              <div style={{
                background: '#e0f2fe', border: '2.5px solid #bae6fd', borderRadius: '20px',
                padding: '0.7rem 1.2rem', marginBottom: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0369a1' }}>
                  {tracingMode ? `✏️ "${tracingMode.label}" 따라쓰기 모드` : '🎨 캔버스를 콕콕 눌러보세요!'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 브러시 크기 선택 */}
                  {[{ key: 'small', label: '작게', sz: 16 }, { key: 'medium', label: '보통', sz: 24 }, { key: 'large', label: '크게', sz: 34 }].map(b => (
                    <button key={b.key} onClick={() => setBrushSize(b.key)} style={{
                      background: brushSize === b.key ? '#3b82f6' : '#ffffff',
                      color: brushSize === b.key ? '#ffffff' : '#334155',
                      border: brushSize === b.key ? '3px solid #1d4ed8' : '2px solid #cbd5e1',
                      borderRadius: '14px', padding: '6px 12px', fontWeight: 900, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem'
                    }}>
                      <span style={{ width: b.sz, height: b.sz, borderRadius: '50%', background: brushSize === b.key ? '#93c5fd' : '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                      {b.label}
                    </button>
                  ))}

                  {/* 구분선 */}
                  <span style={{ width: '2px', height: '28px', background: '#bae6fd', borderRadius: '2px' }} />

                  {/* 따라쓰기 모드 토글 */}
                  <button onClick={() => { setTracingMode(tracingMode ? null : TRACING_TEMPLATES[0]); setStrokes([]); }} style={{
                    background: tracingMode ? '#f59e0b' : '#ffffff',
                    color: tracingMode ? '#ffffff' : '#92400e',
                    border: tracingMode ? '3px solid #d97706' : '2px solid #fcd34d',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    fontSize: '0.88rem'
                  }}>
                    ✏️ {tracingMode ? '자유그리기' : '따라쓰기'}
                  </button>

                  <button onClick={() => setStrokes([])} style={{
                    background: '#ef4444', color: '#ffffff', border: 'none', padding: '8px 14px',
                    borderRadius: '14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.88rem',
                    boxShadow: '0 3px 10px rgba(239,68,68,0.25)'
                  }}><Eraser size={18} /> 지우기</button>
                </div>
              </div>

              {/* 따라쓰기 글자 선택 (따라쓰기 모드일 때만) */}
              {tracingMode && (
                <div style={{
                  display: 'flex', gap: '6px', marginBottom: '0.6rem', flexWrap: 'wrap',
                  flexShrink: 0, alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#92400e', marginRight: '4px' }}>글자 선택:</span>
                  {TRACING_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setTracingMode(t); setStrokes([]); }} style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: tracingMode.id === t.id ? '#fbbf24' : '#fffbeb',
                      border: tracingMode.id === t.id ? '3px solid #d97706' : '2px solid #fcd34d',
                      fontSize: '1.2rem', fontWeight: 900,
                      color: tracingMode.id === t.id ? '#78350f' : '#92400e',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{t.label}</button>
                  ))}
                </div>
              )}

              {/* 캔버스 (flex: 1로 남은 공간 전부 사용, 연필 stroke 드로잉) */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  width: '100%', flex: 1, minHeight: 0, background: '#ffffff', borderRadius: '24px',
                  border: '4px dashed #38bdf8', position: 'relative', overflow: 'hidden', cursor: 'crosshair',
                  touchAction: 'none'
                }}
              >
                {/* 따라쓰기 가이드 실선 (배경) */}
                {tracingMode && (
                  <svg viewBox={tracingMode.viewBox} style={{
                    position: 'absolute', inset: '8%', width: '84%', height: '84%',
                    pointerEvents: 'none', opacity: 0.35
                  }}>
                    {tracingMode.paths.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="12"
                        strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                  </svg>
                )}

                {/* 사용자가 그린 연필 브러시 스트로크 선 (SVG Vector Lines) */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                  {strokes.map(s => {
                    if (!s.points || s.points.length === 0) return null;
                    const d = s.points.length === 1
                      ? `M ${s.points[0].x} ${s.points[0].y} L ${s.points[0].x + 0.1} ${s.points[0].y + 0.1}`
                      : s.points.reduce((acc, p, idx) => acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');

                    return (
                      <path
                        key={s.id}
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={s.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.9 }}
                      />
                    );
                  })}
                </svg>

                {strokes.length === 0 && !tracingMode && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8', pointerEvents: 'none'
                  }}>
                    <Sparkles size={56} style={{ color: '#38bdf8', marginBottom: '12px' }} />
                    <p style={{ fontSize: '1.4rem', fontWeight: 900 }}>화면에 연필처럼 쓱쓱 자유롭게 그려보세요!</p>
                  </div>
                )}
                {strokes.length === 0 && tracingMode && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#92400e', pointerEvents: 'none'
                  }}>
                    <p style={{ fontSize: '1.3rem', fontWeight: 900, opacity: 0.6 }}>✏️ 점선을 따라 연필처럼 쓱쓱 그려보세요!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 모듈 4: 🎵 한국 동요 MP3 플레이어 ===== */}
          {activeTab === 'song' && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{
                background: '#dcfce7', border: '2.5px solid #86efac', borderRadius: '20px',
                padding: '0.6rem 1.4rem', display: 'inline-flex', alignItems: 'center', gap: '16px', marginBottom: '1rem',
                fontSize: '1.05rem', fontWeight: 900, color: '#166534', flexWrap: 'wrap', justifyContent: 'center'
              }}>
                <span>🎵 유나와 함께 들어요! 총 {LOCAL_NURSERY_SONGS.length}곡의 신나는 동요 🎶</span>
                
                {/* 연속 / 셔플 자동 재생 토글 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setIsAutoPlayNext(!isAutoPlayNext)} style={{
                    background: isAutoPlayNext ? '#16a34a' : '#ffffff',
                    color: isAutoPlayNext ? '#ffffff' : '#475569',
                    border: isAutoPlayNext ? '2px solid #15803d' : '2px solid #cbd5e1',
                    borderRadius: '14px', padding: '5px 12px', fontWeight: 900, cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}>
                    🔂 연속 재생 {isAutoPlayNext ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => setIsShuffle(!isShuffle)} style={{
                    background: isShuffle ? '#9333ea' : '#ffffff',
                    color: isShuffle ? '#ffffff' : '#475569',
                    border: isShuffle ? '2px solid #7e22ce' : '2px solid #cbd5e1',
                    borderRadius: '14px', padding: '5px 12px', fontWeight: 900, cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}>
                    🔀 셔플 {isShuffle ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* 가로 슬림 콤팩트 MP3 플레이어 컨트롤러 */}
              <div style={{
                maxWidth: '780px', margin: '0 auto 1rem auto', background: '#ffffff',
                borderRadius: '24px', border: '4px solid #16a34a', padding: '1rem 1.6rem',
                boxShadow: '0 10px 24px rgba(22, 163, 74, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
              }}>
                <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '2.8rem', lineHeight: 1 }}>
                    {isSongPlaying ? '🎵💃🎶' : '📻'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {LOCAL_NURSERY_SONGS[currentSongIdx]?.title || '동요 선택'}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 700, margin: '2px 0 0 0' }}>
                      {currentSongIdx + 1} / {LOCAL_NURSERY_SONGS.length} 곡 {isShuffle ? '(셔플 모드)' : ''}
                    </p>
                  </div>
                </div>

                {/* 컨트롤 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={handlePrevSong} style={{
                    background: '#f1f5f9', color: '#1e293b', border: 'none', borderRadius: '18px',
                    padding: '10px 16px', fontSize: '0.98rem', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}><SkipBack size={20} /> 이전곡</button>

                  <button onClick={togglePlaySong} style={{
                    background: isSongPlaying ? '#ef4444' : '#16a34a', color: '#ffffff', border: 'none',
                    borderRadius: '22px', padding: '12px 28px', fontSize: '1.15rem', fontWeight: 900,
                    cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    {isSongPlaying ? <Pause size={24} /> : <Play size={24} />}
                    {isSongPlaying ? '일시정지' : '노래 시작'}
                  </button>

                  <button onClick={handleNextSong} style={{
                    background: '#f1f5f9', color: '#1e293b', border: 'none', borderRadius: '18px',
                    padding: '10px 16px', fontSize: '0.98rem', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>다음곡 <SkipForward size={20} /></button>
                </div>
              </div>

              {/* 85곡 동요 목록 넓은 그리드 (maxHeight 600px로 대폭 확장) */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.8rem', maxWidth: '1060px', margin: '0 auto', maxHeight: '600px', overflowY: 'auto',
                padding: '14px', background: '#f8fafc', borderRadius: '24px', border: '2px solid #e2e8f0'
              }}>
                {LOCAL_NURSERY_SONGS.map((song, idx) => (
                  <div key={song.id} onClick={() => playSelectedSong(idx)} style={{
                    background: currentSongIdx === idx ? '#dcfce7' : '#ffffff',
                    border: currentSongIdx === idx ? '3px solid #16a34a' : '2px solid #e2e8f0',
                    borderRadius: '18px', padding: '12px 14px', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
                  }}>
                    <span style={{
                      background: currentSongIdx === idx ? '#16a34a' : '#f1f5f9',
                      color: currentSongIdx === idx ? '#ffffff' : '#64748b',
                      borderRadius: '50%', width: '28px', height: '28px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900,
                      flexShrink: 0
                    }}>{idx + 1}</span>
                    <span style={{
                      fontSize: '0.98rem', fontWeight: 800,
                      color: currentSongIdx === idx ? '#15803d' : '#334155',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>{song.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== 동물 & 과일 관찰 대형 팝업 모달 ===== */}
      {selectedRealItem && (
        <div onClick={closeItemModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999, padding: '1.5rem', cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: '36px', maxWidth: '620px', width: '100%',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: `6px solid ${selectedRealItem.color}`, position: 'relative', cursor: 'default'
          }}>
            <button onClick={closeItemModal} style={{
              position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.6)',
              color: '#ffffff', border: 'none', borderRadius: '50%', width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
            }}><X size={26} /></button>

            <div style={{
              width: '100%', height: '360px', overflow: 'hidden', background: '#f1f5f9',
              padding: selectedRealItem.objectFit === 'contain' ? '16px' : '0'
            }}>
              <img src={selectedRealItem.img} alt={selectedRealItem.name} style={{
                width: '100%', height: '100%',
                objectFit: selectedRealItem.objectFit || 'cover',
                objectPosition: selectedRealItem.fitPos || 'center center'
              }} />
            </div>

            <div style={{ padding: '2rem', textAlign: 'center', background: selectedRealItem.bg }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', margin: selectedRealItem.soundUrl ? '0 0 14px 0' : '0' }}>
                {selectedRealItem.icon ? `${selectedRealItem.icon} ` : ''}{selectedRealItem.name}
              </h2>
              {selectedRealItem.soundUrl && (
                <button onClick={() => audioEngine.playItemSound(selectedRealItem)} style={{
                  background: selectedRealItem.color, color: '#ffffff', border: 'none',
                  padding: '14px 28px', borderRadius: '22px', fontSize: '1.3rem', fontWeight: 900,
                  cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  display: 'inline-flex', alignItems: 'center', gap: '10px'
                }}>
                  <Volume2 size={26} /> 울음소리 다시 듣기 🔊
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 퀴즈 모달 ===== */}
      {isQuizModalOpen && quizQuestion && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '36px', maxWidth: '850px', width: '100%',
            padding: '2.2rem', border: '6px solid #ef4444',
            boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)', position: 'relative'
          }}>
            <button onClick={() => { setIsQuizModalOpen(false); audioEngine.stopAllSounds(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }} style={{
              position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: '50%', width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}><X size={26} /></button>

            <div style={{
              background: '#fff1f2', border: '3.5px solid #fecdd3', borderRadius: '24px',
              padding: '1.4rem', textAlign: 'center', marginBottom: '1.8rem'
            }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#9f1239', margin: '0 0 10px 0' }}>
                ❓ {quizQuestion.target.name}는(은) 누구일까요?
              </h2>
              <button onClick={() => speakQuizQuestion(quizQuestion.target.name)} style={{
                background: '#be123c', color: '#ffffff', border: 'none', padding: '10px 22px',
                borderRadius: '16px', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(190, 18, 60, 0.25)'
              }}><Volume2 size={22} /> 🔊 음성 다시 듣기</button>
            </div>

            {quizFeedback === 'correct' && (
              <div style={{
                background: '#dcfce7', border: '3.5px solid #22c55e', borderRadius: '20px',
                padding: '1rem', textAlign: 'center', marginBottom: '1.2rem',
                fontSize: '1.4rem', fontWeight: 900, color: '#15803d'
              }}>🎉 정답이에요!! 참 잘했어요! 🌟</div>
            )}
            {quizFeedback === 'wrong' && (
              <div style={{
                background: '#fee2e2', border: '3.5px solid #ef4444', borderRadius: '20px',
                padding: '1rem', textAlign: 'center', marginBottom: '1.2rem',
                fontSize: '1.3rem', fontWeight: 900, color: '#991b1b'
              }}>😮 다시 한번 찾아볼까요? 화이팅! 💪</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
              {quizQuestion.options.map(opt => (
                <div key={opt.id} onClick={() => handleAnswerQuiz(opt)} style={{
                  background: '#ffffff', border: '4px solid #cbd5e1', borderRadius: '24px',
                  overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                }}>
                  <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}>
                    <img src={opt.img} alt={opt.name} style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      objectPosition: opt.fitPos || 'center 20%'
                    }} />
                  </div>
                  <div style={{ padding: '0.9rem', textAlign: 'center', fontWeight: 900, fontSize: '1.15rem', color: '#1e293b' }}>
                    {opt.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 🐻 곰돌이 과일 먹이기 놀이 모달 (드래그 앤 드롭 지원) ===== */}
      {isBearModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: '1.5rem', userSelect: 'none'
          }}
        >
          <div style={{
            background: '#fffbeb', borderRadius: '36px', maxWidth: '720px', width: '100%',
            padding: '2rem', border: '6px solid #f59e0b',
            boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.35)', position: 'relative', textAlign: 'center'
          }}>
            <button onClick={() => setIsBearModalOpen(false)} style={{
              position: 'absolute', top: '18px', right: '18px', background: '#fef3c7', color: '#78350f',
              border: '2px solid #fde68a', borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
            }}><X size={24} /></button>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fef3c7', padding: '6px 18px', borderRadius: '20px', marginBottom: '1rem', border: '2px solid #fde68a' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#92400e' }}>⭐ 먹인 과일: {feedScore}개</span>
            </div>

            {/* 🐻 곰돌이 캐릭터 & 드롭 영역 (bearBoxRef) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div
                onClick={() => speakBearWish(wantedFood)}
                title="콕 누르면 곰돌이가 목소리로 다시 말해요!"
                style={{
                  background: '#ffffff', border: '3.5px solid #fbbf24', borderRadius: '24px',
                  padding: '1rem 1.6rem', marginBottom: '1rem', boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                  cursor: 'pointer'
                }}
              >
                <p style={{ fontSize: '1.45rem', fontWeight: 900, color: '#78350f', margin: 0 }}>
                  {bearMood === 'happy'
                    ? '💖 🐻 "아구아구 냠냠! 너무 맛있다! 🥰"'
                    : isOverBear
                      ? '😮 🐻 "아~~ 입 벌리고 있어! 과일을 쏙 넣어줘!"'
                      : `🐻 "${(wantedFood || FOOD_ITEMS[0])?.name || '사과'} 먹고 싶어요! ${(wantedFood || FOOD_ITEMS[0])?.icon || '🍎'}"`}
                </p>
              </div>

              {/* 곰돌이 드롭 영역 (표정 이모지 세분화) */}
              <div
                ref={bearBoxRef}
                style={{
                  fontSize: '6.5rem', lineHeight: 1, padding: '1rem 2rem', borderRadius: '32px',
                  border: isOverBear ? '4px dashed #f59e0b' : '4px solid transparent',
                  background: isOverBear ? '#fef3c7' : 'transparent',
                  transform: isOverBear ? 'scale(1.2)' : bearMood === 'happy' ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease, background 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {bearMood === 'happy' ? (
                  <span>🐻🥰</span>
                ) : isOverBear ? (
                  <span>🐻😮</span>
                ) : (
                  <span>🐻</span>
                )}
              </div>
            </div>

            <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#92400e', marginBottom: '1rem' }}>
              👇 과일을 손가락으로 끌어다(Drag) 곰돌이 입에 쏙 넣어주세요!
            </p>

            {/* 과일 선택 카드 목록 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {FOOD_ITEMS.map(food => (
                <button
                  key={food.id}
                  onPointerDown={(e) => handleStartDragFood(e, food)}
                  onClick={() => handleFeedBear(food)}
                  style={{
                    background: (wantedFood?.id || FOOD_ITEMS[0].id) === food.id ? '#fef3c7' : '#ffffff',
                    border: (wantedFood?.id || FOOD_ITEMS[0].id) === food.id ? '4px solid #f59e0b' : '2px solid #e2e8f0',
                    borderRadius: '20px', padding: '12px 8px', cursor: 'grab',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)', touchAction: 'none',
                    opacity: draggingFood?.id === food.id ? 0.4 : 1
                  }}
                >
                  <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{food.icon}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{food.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 손가락/마우스를 따라 움직이는 드래그 과일 이펙트 */}
          {draggingFood && (
            <div style={{
              position: 'fixed', left: dragPos.x, top: dragPos.y,
              transform: 'translate(-50%, -50%) scale(1.3)',
              zIndex: 2000, pointerEvents: 'none', fontSize: '4.5rem',
              filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.35))'
            }}>
              {draggingFood.icon}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
