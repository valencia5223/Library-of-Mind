import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Volume2, VolumeX, RotateCcw, Smartphone, X, Play, Pause, SkipForward, SkipBack, Music, Eraser } from 'lucide-react';
import duckImg from './assets/duck.jpg';
import appleImg from './assets/apple.jpg';
import bananaImg from './assets/banana.jpg';
import grapeImg from './assets/grape.jpg';
import watermelonImg from './assets/watermelon.jpg';
import strawberryImg from './assets/strawberry.jpg';
import tangerineImg from './assets/tangerine.jpg';
import peachImg from './assets/peach.jpg';
import melonImg from './assets/melon.jpg';
import pineappleImg from './assets/pineapple.jpg';
import cherryImg from './assets/cherry.jpg';
import blueberryImg from './assets/blueberry.jpg';
import carrotImg from './assets/carrot.jpg';
import broccoliImg from './assets/broccoli.jpg';
import cornImg from './assets/corn.jpg';
import sweetPotatoImg from './assets/sweet_potato.jpg';
import potatoImg from './assets/potato.jpg';
import tomatoImg from './assets/tomato.jpg';
import cucumberImg from './assets/cucumber.jpg';
import eggplantImg from './assets/eggplant.jpg';

// --- 실제 동물 울음소리 MP3 재생 사운드 엔진 ---
class BabySoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.currentAudio = null;
    this.audioCache = new Map();
    this.voiceBufferCache = new Map();
    this.currentVoiceSource = null;
    this.currentVoiceAudio = null;
    this.voicePlayToken = 0;
    this.isAudioUnlocked = false;

    // 📱 iOS Safari 비동기 타이머 오디오 차단 원천 해결용 전역 싱글톤 Audio 객체
    if (typeof window !== 'undefined') {
      try {
        this.sharedVoiceAudio = new Audio();
        this.sharedVoiceAudio.preload = 'auto';
      } catch (e) {
        this.sharedVoiceAudio = null;
      }
    } else {
      this.sharedVoiceAudio = null;
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // 📱 iOS Safari 제스처 언락 (사용자 터치 시 1회 무음 활성화)
    if (this.sharedVoiceAudio && !this.isAudioUnlocked) {
      try {
        this.sharedVoiceAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const p = this.sharedVoiceAudio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this.isAudioUnlocked = true;
            this.sharedVoiceAudio.pause();
          }).catch(() => { });
        }
      } catch (e) { }
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
        } catch (e) { }
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

  // 🎙️ 현재 재생 중인 음성 사운드 즉시 정지
  stopVoice() {
    this.voicePlayToken++;
    if (this.currentVoiceSource) {
      try {
        this.currentVoiceSource.onended = null;
        this.currentVoiceSource.stop();
      } catch (e) { }
      this.currentVoiceSource = null;
    }
    if (this.sharedVoiceAudio) {
      try {
        this.sharedVoiceAudio.onended = null;
        this.sharedVoiceAudio.pause();
        this.sharedVoiceAudio.currentTime = 0;
      } catch (e) { }
    }
    if (this.currentVoiceAudio && this.currentVoiceAudio !== this.sharedVoiceAudio) {
      try {
        this.currentVoiceAudio.onended = null;
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
      } catch (e) { }
      this.currentVoiceAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { }
    }
  }

  // 🎙️ Safari / iOS WebKit 호환 decodeAudioData 헬퍼 (Promise + Callback 듀얼 지원)
  async decodeAudio(arrayBuffer) {
    if (!this.ctx) return null;
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const onSuccess = (decoded) => {
        if (!isSettled) {
          isSettled = true;
          resolve(decoded);
        }
      };
      const onError = (err) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      try {
        // Safari는 원본 ArrayBuffer를 detach할 수 있으므로 slice(0) 사본 전달
        const copy = arrayBuffer.slice(0);
        const res = this.ctx.decodeAudioData(copy, onSuccess, onError);
        if (res && typeof res.then === 'function') {
          res.then(onSuccess).catch(onError);
        }
      } catch (err) {
        onError(err);
      }
    });
  }

  // 🎙️ Web Audio API 버퍼 캐싱 및 디코딩 (아이패드 딜레이 0초 보장)
  async getVoiceBuffer(url) {
    if (this.voiceBufferCache.has(url)) {
      return this.voiceBufferCache.get(url);
    }
    this.init();
    if (!this.ctx) return null;
    try {
      const fullUrl = (typeof window !== 'undefined' && url.startsWith('/') && !url.startsWith('//'))
        ? (window.location.origin + url)
        : url;
      const resp = await fetch(fullUrl, { cache: 'force-cache' });
      if (!resp.ok) return null;
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await this.decodeAudio(arrayBuffer);
      if (audioBuffer) {
        this.voiceBufferCache.set(url, audioBuffer);
        return audioBuffer;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // 🎙️ 아이패드/iOS WebKit 비동기 타이머에서도 절대 여성 음성(TTS)으로 튕기지 않는 완벽한 MP3 재생 엔진
  async playVoice(url, fallbackFn = null, onEnded = null) {
    if (this.muted) return;
    this.stopVoice();
    this.init();

    const token = ++this.voicePlayToken;
    const fullUrl = (typeof window !== 'undefined' && url.startsWith('/') && !url.startsWith('//'))
      ? (window.location.origin + url)
      : url;

    // 1순위: Web Audio API 버퍼 재생 (iOS Safari 비동기 100% 허용)
    if (this.ctx) {
      try {
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }
        const buffer = await this.getVoiceBuffer(url);
        if (this.voicePlayToken !== token) return;

        if (buffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.ctx.destination);
          this.currentVoiceSource = source;

          source.onended = () => {
            if (this.voicePlayToken === token) {
              this.currentVoiceSource = null;
              if (onEnded) onEnded();
            }
          };

          source.start(0);
          return;
        }
      } catch (e) { }
    }

    if (this.voicePlayToken !== token) return;

    // 2순위: 사용자 터치로 사전 언락된 전역 sharedVoiceAudio 재생 (아이패드 비동기 타이머 100% 재생 성공)
    if (this.sharedVoiceAudio) {
      try {
        const audio = this.sharedVoiceAudio;
        this.currentVoiceAudio = audio;
        audio.onended = () => {
          if (this.voicePlayToken === token) {
            this.currentVoiceAudio = null;
            if (onEnded) onEnded();
          }
        };
        audio.src = fullUrl;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            this.isAudioUnlocked = true;
          }).catch(() => {
            // sharedVoiceAudio가 차단되었을 때만 3순위 신규 Audio 시도
            this.tryNewAudioElement(fullUrl, token, fallbackFn, onEnded);
          });
          return;
        }
        return;
      } catch (e) { }
    }

    // 3순위: 신규 Audio 엘리먼트 fallback
    this.tryNewAudioElement(fullUrl, token, fallbackFn, onEnded);
  }

  tryNewAudioElement(url, token, fallbackFn, onEnded) {
    try {
      const audio = new Audio(url);
      this.currentVoiceAudio = audio;
      audio.onended = () => {
        if (this.voicePlayToken === token) {
          this.currentVoiceAudio = null;
          if (onEnded) onEnded();
        }
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          if (this.voicePlayToken === token && fallbackFn) {
            fallbackFn();
          }
        });
      }
    } catch (e) {
      if (this.voicePlayToken === token && fallbackFn) fallbackFn();
    }
  }

  stopAllSounds() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) { }
      this.currentAudio = null;
    }
    this.stopVoice();
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



  playYum() {
    this.playFreq(587.33, 'triangle', 0.2, 0.5);
    setTimeout(() => this.playFreq(880, 'triangle', 0.2, 0.5), 120);
  }

  playBubble() {
    if (this.muted) return;
    const notes = [440, 587, 880, 1174];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playFreq(freq + Math.random() * 60, 'sine', 0.08, 0.45);
      }, idx * 45);
    });
  }

  playSnap() {
    if (this.muted) return;
    this.playFreq(784, 'triangle', 0.09, 0.65);
    setTimeout(() => this.playFreq(1046.5, 'sine', 0.12, 0.55), 50);
  }

  // 🎵 영롱한 오르골(Music Box) 벨 사운드
  playMusicBox(freq, volume = 0.45) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 기본음 (맑은 사인파)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      gain1.gain.setValueAtTime(volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.6);

      // 옥타브 배음 (오르골 쇳소리 광택감)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);
      gain2.gain.setValueAtTime(volume * 0.35, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.9);
    } catch (e) { }
  }

  // 🌙 브람스 자장가 오르골 루프 플레이어
  startLullaby() {
    this.stopLullaby();
    this.init();
    if (this.muted || !this.ctx) return;
    this.isLullabyPlaying = true;

    // 브람스 자장가 멜로디 음계 & 박자 정의 [freq, durationMs]
    const melody = [
      [329.63, 600], [329.63, 600], [392.00, 1100], // 미 미 솔
      [329.63, 600], [329.63, 600], [392.00, 1100], // 미 미 솔
      [329.63, 400], [392.00, 400], [523.25, 800], [493.88, 600], [440.00, 600], [440.00, 600], [392.00, 1200], // 미 솔 도' 시 라 라 솔
      [293.66, 400], [329.63, 400], [349.23, 800], [293.66, 400], // 레 미 파 레
      [293.66, 400], [349.23, 400], [493.88, 800], [440.00, 600], [392.00, 600], [493.88, 600], [523.25, 1400] // 레 파 시 라 솔 시 도'
    ];

    let noteIdx = 0;
    const playNext = () => {
      if (!this.isLullabyPlaying) return;
      const [freq, dur] = melody[noteIdx];
      this.playMusicBox(freq, 0.38);
      noteIdx = (noteIdx + 1) % melody.length;
      this.lullabyTimer = setTimeout(playNext, dur);
    };

    playNext();
  }

  stopLullaby() {
    this.isLullabyPlaying = false;
    if (this.lullabyTimer) {
      clearTimeout(this.lullabyTimer);
      this.lullabyTimer = null;
    }
  }

  // 🐶🐱🐸 동물 합창단 및 실로폰 음계 연주기 (실제 녹음된 동물 소리 피치 변조)
  async playChoirNote(instrument, freq) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (instrument === 'xylophone') {
      this.playMusicBox(freq, 0.55);
      return;
    }

    // 실제 동물 울음소리 MP3 음원 (로컬 검증 고음질 사운드: 딜레이 0초)
    const soundUrls = {
      dog: '/sounds/dog.mp3',
      cat: '/sounds/cat.mp3',
      frog: '/sounds/frog.mp3'
    };

    const url = soundUrls[instrument];
    const baseFreq = 261.63; // C4 (도) 기준 기본 주파수
    const playbackRate = Math.max(0.6, Math.min(2.6, freq / baseFreq));

    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      if (url) {
        const buffer = await this.getVoiceBuffer(url);
        if (buffer && this.ctx) {
          const source = this.ctx.createBufferSource();
          const gainNode = this.ctx.createGain();
          source.buffer = buffer;
          source.playbackRate.value = playbackRate;

          // 실제 동물 소리의 귀여운 타격감과 리듬감을 살리면서 자연스러운 재생
          const now = this.ctx.currentTime;
          const playDuration = Math.min(buffer.duration / playbackRate, 0.9);

          gainNode.gain.setValueAtTime(0.9, now);
          gainNode.gain.setValueAtTime(0.9, now + Math.max(0.1, playDuration - 0.15));
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + playDuration);

          source.connect(gainNode);
          gainNode.connect(this.ctx.destination);

          source.start(now);
          source.stop(now + playDuration);
          return;
        }
      }
    } catch (e) { }

    // 음원 로딩 중이거나 예외 시 동물별 개성 있는 사운드 백업
    if (instrument === 'frog') {
      this.playFreq(freq * 0.8, 'sawtooth', 0.18, 0.6);
    } else {
      this.playFreq(freq, 'triangle', 0.22, 0.5);
    }
  }

  // 동물 합창단 음원 사전 로딩 (아이패드 딜레이 0초 보장)
  preloadChoirBuffers() {
    const urls = [
      '/sounds/dog.mp3',
      '/sounds/cat.mp3',
      '/sounds/frog.mp3'
    ];
    urls.forEach(u => this.getVoiceBuffer(u).catch(() => {}));
  }
}

const audioEngine = new BabySoundEngine();

// 📱 iOS Safari / 아이패드 첫 사용자 제스처 시 Web Audio API AudioContext 즉시 언락
if (typeof window !== 'undefined') {
  const unlockAudioContext = () => {
    audioEngine.init();
    ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
      window.removeEventListener(evt, unlockAudioContext, true);
    });
  };
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
    window.addEventListener(evt, unlockAudioContext, { capture: true, once: true });
  });
}

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
// 🍎 싱싱 과일 & 채소 데이터셋 (고화질 실사 이미지 100% 로컬 연동)
// =============================================================================
const REAL_FRUITS = [
  // ── 과일 ──
  {
    id: 'apple', name: '사과', icon: '🍎', category: '과일',
    img: appleImg,
    color: '#ef4444', bg: '#fee2e2', fitPos: 'center center'
  },
  {
    id: 'banana', name: '바나나', icon: '🍌', category: '과일',
    img: bananaImg,
    color: '#d97706', bg: '#fef3c7', fitPos: 'center center'
  },
  {
    id: 'grape', name: '포도', icon: '🍇', category: '과일',
    img: grapeImg,
    color: '#7e22ce', bg: '#f3e8ff', fitPos: 'center center'
  },
  {
    id: 'watermelon', name: '수박', icon: '🍉', category: '과일',
    img: watermelonImg,
    color: '#15803d', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'strawberry', name: '딸기', icon: '🍓', category: '과일',
    img: strawberryImg,
    color: '#e11d48', bg: '#ffe4e6', fitPos: 'center center'
  },
  {
    id: 'tangerine', name: '귤', icon: '🍊', category: '과일',
    img: tangerineImg,
    color: '#ea580c', bg: '#ffedd5', fitPos: 'center center'
  },
  {
    id: 'peach', name: '복숭아', icon: '🍑', category: '과일',
    img: peachImg,
    color: '#f43f5e', bg: '#ffe4e6', fitPos: 'center center'
  },
  {
    id: 'pineapple', name: '파인애플', icon: '🍍', category: '과일',
    img: pineappleImg,
    color: '#b45309', bg: '#fef3c7', fitPos: 'center center', objectFit: 'contain'
  },
  {
    id: 'melon', name: '멜론', icon: '🍈', category: '과일',
    img: melonImg,
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'cherry', name: '체리', icon: '🍒', category: '과일',
    img: cherryImg,
    color: '#be123c', bg: '#ffe4e6', fitPos: 'center center'
  },
  {
    id: 'blueberry', name: '블루베리', icon: '🫐', category: '과일',
    img: blueberryImg,
    color: '#4338ca', bg: '#e0e7ff', fitPos: 'center center'
  },
  // ── 채소 ──
  {
    id: 'carrot', name: '당근', icon: '🥕', category: '채소',
    img: carrotImg,
    color: '#f97316', bg: '#ffedd5', fitPos: 'center center'
  },
  {
    id: 'broccoli', name: '브로콜리', icon: '🥦', category: '채소',
    img: broccoliImg,
    color: '#15803d', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'corn', name: '옥수수', icon: '🌽', category: '채소',
    img: cornImg,
    color: '#ca8a04', bg: '#fef9c3', fitPos: 'center center'
  },
  {
    id: 'sweet_potato', name: '고구마', icon: '🍠', category: '채소',
    img: sweetPotatoImg,
    color: '#9333ea', bg: '#f3e8ff', fitPos: 'center center'
  },
  {
    id: 'potato', name: '감자', icon: '🥔', category: '채소',
    img: potatoImg,
    color: '#a16207', bg: '#fef3c7', fitPos: 'center center'
  },
  {
    id: 'tomato', name: '토마토', icon: '🍅', category: '채소',
    img: tomatoImg,
    color: '#dc2626', bg: '#fee2e2', fitPos: 'center center'
  },
  {
    id: 'cucumber', name: '오이', icon: '🥒', category: '채소',
    img: cucumberImg,
    color: '#16a34a', bg: '#dcfce7', fitPos: 'center center'
  },
  {
    id: 'eggplant', name: '가지', icon: '🍆', category: '채소',
    img: eggplantImg,
    color: '#7e22ce', bg: '#f3e8ff', fitPos: 'center center'
  }
];

// 배열 무작위 셔플 헬퍼
const shuffleArray = (arr) => [...arr].sort(() => 0.5 - Math.random());

// 곰돌이 먹이기용: REAL_FRUITS에서 자동 파생 (실사 이미지, fitPos, objectFit 포함)
const ALL_FOOD_ITEMS = REAL_FRUITS.map(f => ({
  id: f.id, name: f.name, icon: f.icon, color: f.color, bg: f.bg,
  img: f.img, fitPos: f.fitPos, objectFit: f.objectFit
}));

// 정답 포함 5개 랜덤 선택지 생성 헬퍼
function pickBearChoices(targetFood) {
  const others = ALL_FOOD_ITEMS.filter(f => f.id !== targetFood.id);
  const shuffled = shuffleArray(others).slice(0, 4);
  return shuffleArray([targetFood, ...shuffled]);
}

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
  {
    id: 'num0', label: '0', category: '숫자',
    paths: ['M 50 15 C 25 15 25 35 25 50 C 25 65 25 85 50 85 C 75 85 75 65 75 50 C 75 35 75 15 50 15 Z'], viewBox: '0 0 100 100'
  },
  {
    id: 'num1', label: '1', category: '숫자',
    paths: ['M 38 32 L 52 18 L 52 82 M 34 82 L 70 82'], viewBox: '0 0 100 100'
  },
  {
    id: 'num2', label: '2', category: '숫자',
    paths: ['M 25 32 Q 25 12 50 12 Q 75 12 75 32 Q 75 52 50 58 L 25 85 L 75 85'], viewBox: '0 0 100 100'
  },
  {
    id: 'num3', label: '3', category: '숫자',
    paths: ['M 25 15 L 72 15 L 46 46 Q 75 46 75 68 Q 75 90 45 90 Q 25 90 25 78'], viewBox: '0 0 100 100'
  },
  {
    id: 'num4', label: '4', category: '숫자',
    paths: ['M 62 85 L 62 12 L 20 62 L 78 62'], viewBox: '0 0 100 100'
  },
  {
    id: 'num5', label: '5', category: '숫자',
    paths: ['M 70 15 L 32 15 L 28 48 Q 50 36 72 48 Q 80 64 65 82 Q 48 92 25 80'], viewBox: '0 0 100 100'
  },
  {
    id: 'num6', label: '6', category: '숫자',
    paths: ['M 66 22 Q 35 15 28 48 Q 24 64 36 82 Q 52 90 68 82 Q 76 68 74 54 Q 70 42 50 42 Q 34 42 28 54'], viewBox: '0 0 100 100'
  },
  {
    id: 'num7', label: '7', category: '숫자',
    paths: ['M 25 18 L 75 18 L 42 85'], viewBox: '0 0 100 100'
  },
  {
    id: 'num8', label: '8', category: '숫자',
    paths: ['M 50 50 Q 28 50 28 32 Q 28 15 50 15 Q 72 15 72 32 Q 72 50 50 50 Q 28 50 28 68 Q 28 85 50 85 Q 72 85 72 68 Q 72 50 50 50'], viewBox: '0 0 100 100'
  },
  {
    id: 'num9', label: '9', category: '숫자',
    paths: ['M 72 48 Q 72 32 62 20 Q 48 12 34 22 Q 24 34 28 48 Q 36 60 52 60 Q 72 60 72 40 Z M 72 48 L 72 68 Q 70 84 48 88'], viewBox: '0 0 100 100'
  },
];

// 🎨 퐁퐁 스탬프 아이템 목록
const STAMP_ITEMS = [
  { id: 'paw', icon: '🐾', name: '발자국', freq: 650 },
  { id: 'star', icon: '⭐', name: '반짝별', freq: 880 },
  { id: 'heart', icon: '💖', name: '하트', freq: 780 },
  { id: 'rainbow', icon: '🌈', name: '무지개', freq: 980 },
  { id: 'flower', icon: '🌸', name: '예쁜꽃', freq: 700 },
  { id: 'smile', icon: '😊', name: '스마일', freq: 820 },
  { id: 'duck', icon: '🐥', name: '삐약이', freq: 920 },
  { id: 'butterfly', icon: '🦋', name: '나비', freq: 850 },
  { id: 'apple', icon: '🍎', name: '사과', freq: 600 },
  { id: 'strawberry', icon: '🍓', name: '딸기', freq: 740 }
];

// 🦁 동물 친구들 과일 먹이기용 10종 동물 데이터 (실사 썸네일 + 칭호 + 고유 색상)
const FEEDABLE_ANIMALS = [
  {
    id: 'rabbit', name: '토끼', title: '🐰 깡총깡총 토끼', icon: '🐰',
    color: '#ec4899', bg: '#fce7f3', baseColor: '#FFFFFF', darkColor: '#CBD5E1', snoutColor: '#FFE4E6',
    photo: 'https://images.pexels.com/photos/326012/pexels-photo-326012.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'frog', name: '개구리', title: '🐸 개굴개굴 개구리', icon: '🐸',
    color: '#16a34a', bg: '#dcfce7', baseColor: '#4ADE80', darkColor: '#15803D', snoutColor: '#BBF7D0',
    photo: 'https://images.pexels.com/photos/70083/frog-macro-amphibian-green-70083.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'cat', name: '고양이', title: '🐱 야옹야옹 고양이', icon: '🐱',
    color: '#ea580c', bg: '#ffedd5', baseColor: '#FB923C', darkColor: '#C2410C', snoutColor: '#FFF7ED',
    photo: 'https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'monkey', name: '원숭이', title: '🐵 우끼끼 원숭이', icon: '🐵',
    color: '#854d0e', bg: '#fef9c3', baseColor: '#A16207', darkColor: '#713F12', snoutColor: '#FDE68A',
    photo: 'https://images.pexels.com/photos/1207875/pexels-photo-1207875.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'dog', name: '강아지', title: '🐶 멍멍이 강아지', icon: '🐶',
    color: '#d97706', bg: '#fef3c7', baseColor: '#F59E0B', darkColor: '#B45309', snoutColor: '#FEF3C7',
    photo: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'lion', name: '사자', title: '🦁 어흥 멋진 사자', icon: '🦁',
    color: '#b45309', bg: '#fef3c7', baseColor: '#FBBF24', darkColor: '#92400E', snoutColor: '#FEF3C7',
    photo: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'elephant', name: '코끼리', title: '🐘 뿌우 긴코 코끼리', icon: '🐘',
    color: '#0284c7', bg: '#e0f2fe', baseColor: '#93C5FD', darkColor: '#1D4ED8', snoutColor: '#DBEAFE',
    photo: 'https://images.pexels.com/photos/1054655/pexels-photo-1054655.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'panda', name: '판다', title: '🐼 냠냠 아기 판다', icon: '🐼',
    color: '#334155', bg: '#f1f5f9', baseColor: '#FFFFFF', darkColor: '#0F172A', snoutColor: '#F1F5F9',
    photo: 'https://images.pexels.com/photos/3608298/pexels-photo-3608298.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'pig', name: '돼지', title: '🐷 꿀꿀 분홍 돼지', icon: '🐷',
    color: '#f43f5e', bg: '#ffe4e6', baseColor: '#FDA4AF', darkColor: '#E11D48', snoutColor: '#FFE4E6',
    photo: 'https://images.pexels.com/photos/1300375/pexels-photo-1300375.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'bear', name: '곰돌이', title: '🐻 꿀먹는 곰돌이', icon: '🐻',
    color: '#92400e', bg: '#fef3c7', baseColor: '#C8952E', darkColor: '#854D0E', snoutColor: '#E8C87A',
    photo: 'https://images.pexels.com/photos/158109/kodiak-brown-bear-alaska-wildlife-158109.jpeg?auto=compress&cs=tinysrgb&w=300'
  }
];

// 3마리 랜덤 동물 + 1마리 목표 요청 동물 + 음식 1개 + 선택지 5개 라운드 생성 헬퍼
function pickFeedRound() {
  const shuffledAnimals = [...FEEDABLE_ANIMALS].sort(() => 0.5 - Math.random());
  const threeAnimals = shuffledAnimals.slice(0, 3);
  const target = threeAnimals[Math.floor(Math.random() * threeAnimals.length)];
  const food = ALL_FOOD_ITEMS[Math.floor(Math.random() * ALL_FOOD_ITEMS.length)];
const choices = pickBearChoices(food);
  return { threeAnimals, target, food, choices };
}

// =============================================================================
// 🐾 SVG 애니메이션 다채로운 동물 캐릭터 컴포넌트 (10종 고유 실루엣 극대화 모델)
// =============================================================================
function AnimatedAnimalCharacter({ animal, mood = 'hungry', isOver = false, rejectedFoodIcon = null, rejectedFoodImg = null, isTarget = false }) {
  const [chewOpen, setChewOpen] = React.useState(false);

  React.useEffect(() => {
    if (mood === 'eating') {
      const interval = setInterval(() => setChewOpen(prev => !prev), 180);
      return () => clearInterval(interval);
    }
    setChewOpen(false);
  }, [mood]);

  const dm = isOver && mood === 'hungry' ? 'mouth-open' : mood;

  const bodyClass = dm === 'happy' ? 'bear-bounce'
    : dm === 'eating' ? 'bear-munch'
      : dm === 'reject' ? 'bear-reject'
        : 'bear-idle';

  // 공통 반짝이 및 거절 이펙트 헬퍼
  const renderFX = () => (
    <>
      {dm === 'happy' && (
        <>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '0', left: '8px', fontSize: '1.4rem' }}>✨</div>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '10px', right: '2px', fontSize: '1.2rem', animationDelay: '0.15s' }}>⭐</div>
          <div className="bear-sparkle" style={{ position: 'absolute', bottom: '40px', left: '0', fontSize: '1.3rem', animationDelay: '0.35s' }}>💖</div>
          <div className="bear-sparkle" style={{ position: 'absolute', top: '-5px', right: '28px', fontSize: '1.1rem', animationDelay: '0.5s' }}>🌟</div>
        </>
      )}
      {dm === 'reject' && (rejectedFoodImg || rejectedFoodIcon) && (
        <div className="bear-fruit-reject" style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 10
        }}>
          {rejectedFoodImg ? (
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden',
              border: '3px solid #ef4444', boxShadow: '0 6px 16px rgba(239,68,68,0.4)',
              background: '#ffffff'
            }}>
              <img src={rejectedFoodImg} alt="거절된 음식을 나타내는 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <span style={{ fontSize: '2.2rem' }}>{rejectedFoodIcon}</span>
          )}
        </div>
      )}
    </>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐰 1. 토끼 (Rabbit) – 솟구치는 긴 귀, 루비빛 눈망울, 하얀 앞니(뻐드렁니), 솜털 가슴
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'rabbit') {
    const rabWhite = '#FFFFFF';
    const rabPink = '#F472B6';
    const pawL = dm === 'happy' ? { cx: 58, cy: 125 } : dm === 'reject' ? { cx: 75, cy: 155 } : { cx: 78, cy: 190 };
    const pawR = dm === 'happy' ? { cx: 142, cy: 125 } : dm === 'reject' ? { cx: 125, cy: 155 } : { cx: 122, cy: 190 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 복슬복슬 솜꼬리 */}
          <circle cx="154" cy="190" r="18" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />

          {/* 몸통 (타원 써클 대신 솜털 가슴깃) */}
          <path d="M 52 145 C 44 175, 48 215, 68 222 C 88 226, 112 226, 132 222 C 152 215, 156 175, 148 145 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />
          {/* 토끼 가슴 털 무늬 */}
          <path d="M 85 155 Q 100 170 115 155 Q 100 185 85 155 Z" fill="#FFE4E6" />

          {/* 🌟 머리 위로 길게 솟은 쫑긋한 토끼 긴 귀 2개 */}
          <g>
            <path d="M 50 82 C 28 22, 40 -25, 68 -22 C 92 -20, 88 40, 78 82 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />
            <path d="M 56 72 C 40 22, 50 -12, 68 -10 C 84 -10, 80 40, 72 72 Z" fill={rabPink} />

            <path d="M 150 82 C 172 22, 160 -25, 132 -22 C 108 -20, 112 40, 122 82 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />
            <path d="M 144 72 C 160 22, 150 -12, 132 -10 C 116 -10, 120 40, 128 72 Z" fill={rabPink} />
          </g>

          {/* 토끼 머리 (아래 볼살이 통통한 서양배 형태) */}
          <path d="M 60 70 C 50 100, 42 128, 70 138 C 88 142, 112 142, 130 138 C 158 128, 150 100, 140 70 C 130 50, 70 50, 60 70 Z" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />

          {/* 눈 표정 (루비빛 맑고 큰 토끼 눈망울) */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(68, 80) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(116, 80) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 86 L 86 96 M 68 96 L 86 86 M 114 86 L 132 96 M 114 96 L 132 86" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 66 90 Q 78 80 90 90 M 110 90 Q 122 80 134 90" stroke="#E11D48" strokeWidth="4" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <ellipse cx="78" cy="88" rx="8" ry="9" fill="#E11D48" /><circle cx="75" cy="85" r="3.5" fill="#FFFFFF" /><circle cx="81" cy="91" r="1.5" fill="#FFFFFF" />
              <ellipse cx="122" cy="88" rx="8" ry="9" fill="#E11D48" /><circle cx="119" cy="85" r="3.5" fill="#FFFFFF" /><circle cx="125" cy="91" r="1.5" fill="#FFFFFF" />
            </>
          )}

          {/* 핑크 작은 코 & Y자 인중 */}
          <polygon points="94,101 106,101 100,107" fill={rabPink} />
          <path d="M 100 107 L 100 113 M 92 113 Q 100 115 108 113" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* 🌟 톡 튀어나온 큼직한 토끼 앞니 2개 */}
          <g>
            <rect x="92.5" y="113" width="7" height="11" rx="2" fill="#FFFFFF" stroke="#64748B" strokeWidth="1.6" />
            <rect x="100.5" y="113" width="7" height="11" rx="2" fill="#FFFFFF" stroke="#64748B" strokeWidth="1.6" />
          </g>

          {/* 입 (먹을 때 열림) */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="128" rx="13" ry="12" fill="#E11D48" stroke="#334155" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="128" rx="10" ry={chewOpen ? 9 : 2} fill="#E11D48" stroke="#334155" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : null}

          {/* 토끼 수염 */}
          <g stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
            <line x1="38" y1="106" x2="72" y2="110" /><line x1="38" y1="118" x2="72" y2="116" />
            <line x1="162" y1="106" x2="128" y2="110" /><line x1="162" y1="118" x2="128" y2="116" />
          </g>

          {/* 솜방망이 앞발 */}
          <ellipse cx={pawL.cx} cy={pawL.cy} rx="16" ry="13" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />
          <ellipse cx={pawR.cx} cy={pawR.cy} rx="16" ry="13" fill={rabWhite} stroke="#CBD5E1" strokeWidth="2.5" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐸 2. 개구리 (Frog) – 솟구친 거대한 안구 돔, 넙적한 얼굴, 콧구멍 2개, 가로 찢어진 입
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'frog') {
    const frogBase = '#22C55E';
    const frogDark = '#15803D';
    const frogBelly = '#FEF08A';
    const frogMouth = '#064E3B';
    const handLeft = dm === 'happy' ? { x: 34, y: 110 } : dm === 'reject' ? { x: 55, y: 155 } : { x: 38, y: 185 };
    const handRight = dm === 'happy' ? { x: 166, y: 110 } : dm === 'reject' ? { x: 145, y: 155 } : { x: 162, y: 185 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 개구리 뒷다리 */}
          <ellipse cx="38" cy="195" rx="30" ry="18" fill={frogBase} stroke={frogDark} strokeWidth="2.5" transform="rotate(-20 38 195)" />
          <ellipse cx="162" cy="195" rx="30" ry="18" fill={frogBase} stroke={frogDark} strokeWidth="2.5" transform="rotate(20 162 195)" />

          {/* 넙적하고 통통한 청개구리 몸통 & 가로형 연노랑 배 */}
          <ellipse cx="100" cy="178" rx="58" ry="46" fill={frogBase} stroke={frogDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="182" rx="42" ry="28" fill={frogBelly} opacity="0.95" />

          {/* 빨판 앞발 */}
          <g>
            <line x1="65" y1="165" x2={handLeft.x} y2={handLeft.y} stroke={frogDark} strokeWidth="7" strokeLinecap="round" />
            <circle cx={handLeft.x - 7} cy={handLeft.y - 6} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handLeft.x} cy={handLeft.y - 10} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handLeft.x + 7} cy={handLeft.y - 6} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />

            <line x1="135" y1="165" x2={handRight.x} y2={handRight.y} stroke={frogDark} strokeWidth="7" strokeLinecap="round" />
            <circle cx={handRight.x - 7} cy={handRight.y - 6} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handRight.x} cy={handRight.y - 10} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />
            <circle cx={handRight.x + 7} cy={handRight.y - 6} r="7" fill={frogBase} stroke={frogDark} strokeWidth="2" />
          </g>

          {/* 🌟 머리 위로 완벽하게 솟아오른 2개의 대형 왕눈이 돔 */}
          <circle cx="54" cy="48" r="32" fill={frogBase} stroke={frogDark} strokeWidth="3" />
          <circle cx="146" cy="48" r="32" fill={frogBase} stroke={frogDark} strokeWidth="3" />

          {/* 넙적한 머리 본체 (주둥이 써클 전혀 없음!) */}
          <ellipse cx="100" cy="100" rx="72" ry="46" fill={frogBase} stroke={frogDark} strokeWidth="3" />

          {/* 왕눈이 안구 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(46, 38) scale(1.2)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(138, 38) scale(1.2)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 42 40 L 66 56 M 42 56 L 66 40 M 134 40 L 158 56 M 134 56 L 158 40" stroke="#064E3B" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 40 50 Q 54 36 68 50 M 132 50 Q 146 36 160 50" stroke="#064E3B" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="54" cy="48" r="23" fill="#FFFFFF" /><circle cx="56" cy="48" r="13" fill="#0F172A" /><circle cx="52" cy="44" r="5" fill="#FFFFFF" />
              <circle cx="146" cy="48" r="23" fill="#FFFFFF" /><circle cx="144" cy="48" r="13" fill="#0F172A" /><circle cx="140" cy="44" r="5" fill="#FFFFFF" />
            </>
          )}

          {/* 콧구멍 2개 (돌출 코 없음) */}
          <circle cx="94" cy="86" r="3" fill={frogMouth} />
          <circle cx="106" cy="86" r="3" fill={frogMouth} />

          {/* 🌟 가로로 얼굴 전체로 쫙 찢어진 시원한 개구리 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="112" rx="40" ry="22" fill="#E11D48" stroke={frogDark} strokeWidth="3" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="112" rx="32" ry={chewOpen ? 16 : 4} fill="#E11D48" stroke={frogDark} strokeWidth="3" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 56 118 Q 100 96 144 118" stroke={frogMouth} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 52 104 Q 100 128 148 104" stroke={frogMouth} strokeWidth="4" strokeLinecap="round" fill="none" />
          )}

          {/* 핑크 볼 울음주머니 */}
          <circle cx="44" cy="112" r="15" fill="#FB7185" opacity={dm === 'happy' ? 0.85 : 0.5} />
          <circle cx="156" cy="112" r="15" fill="#FB7185" opacity={dm === 'happy' ? 0.85 : 0.5} />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐱 3. 고양이 (Cat) – 뾰족 귀, M자 이마, 아몬드 눈, 역삼각 코, ω자 인중, 6줄 수염
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'cat') {
    const catBase = '#FB923C';
    const catDark = '#EA580C';
    const catWhite = '#FFF7ED';
    const catPink = '#F472B6';
    const pawLeft = dm === 'happy' ? { cx: 48, cy: 120 } : dm === 'reject' ? { cx: 72, cy: 155 } : { cx: 78, cy: 196 };
    const pawRight = dm === 'happy' ? { cx: 152, cy: 120 } : dm === 'reject' ? { cx: 128, cy: 155 } : { cx: 122, cy: 196 };

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 긴 고양이 꼬리 */}
          <path d={dm === 'happy' ? "M 135 195 C 175 190, 195 145, 185 105 C 182 95, 168 98, 172 110 C 180 138, 162 175, 130 182" : "M 135 195 C 170 195, 188 175, 180 140 C 177 130, 163 133, 167 145 C 172 165, 158 185, 130 185"}
            fill={catBase} stroke={catDark} strokeWidth="3" />

          {/* 몸통 & V자 가슴 털깃 */}
          <path d="M 62 145 C 50 170, 52 205, 68 215 C 85 220, 115 220, 132 215 C 148 205, 150 170, 138 145 C 125 130, 75 130, 62 145 Z" fill={catBase} stroke={catDark} strokeWidth="2.5" />
          <path d="M 80 145 L 100 190 L 120 145 Z" fill={catWhite} />

          {/* 🌟 뾰족한 고양이 귀 2개 */}
          <g>
            <path d="M 44 88 L 34 16 C 42 15, 64 34, 78 55 Z" fill={catBase} stroke={catDark} strokeWidth="3" strokeLinejoin="round" />
            <path d="M 46 80 L 40 26 C 46 25, 62 40, 72 58 Z" fill={catPink} />

            <path d="M 156 88 L 166 16 C 158 15, 136 34, 122 55 Z" fill={catBase} stroke={catDark} strokeWidth="3" strokeLinejoin="round" />
            <path d="M 154 80 L 160 26 C 154 25, 138 40, 128 58 Z" fill={catPink} />
          </g>

          {/* 머리 */}
          <path d="M 48 82 C 38 102, 48 128, 75 134 C 90 137, 110 137, 125 134 C 152 128, 162 102, 152 82 C 142 60, 58 60, 48 82 Z" fill={catBase} stroke={catDark} strokeWidth="2.5" />

          {/* 이마 M자 태비 마크 */}
          <path d="M 90 54 L 95 68 L 100 56 L 105 68 L 110 54" stroke={catDark} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* 🌟 고양이 전용 ω자 입술 패치 2개 (원형 써클 아님!) */}
          <ellipse cx="91" cy="113" rx="11" ry="9" fill={catWhite} />
          <ellipse cx="109" cy="113" rx="11" ry="9" fill={catWhite} />

          {/* 굵은 수염 6줄 */}
          <g stroke="#78350F" strokeWidth="2.8" strokeLinecap="round">
            <line x1="28" y1="104" x2="72" y2="108" /><line x1="26" y1="115" x2="70" y2="114" /><line x1="30" y1="126" x2="72" y2="120" />
            <line x1="172" y1="104" x2="128" y2="108" /><line x1="174" y1="115" x2="130" y2="114" /><line x1="170" y1="126" x2="128" y2="120" />
          </g>

          {/* 눈 표정 (아몬드형 에메랄드 캣츠아이) */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 80) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EC4899" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 80) scale(1.1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EC4899" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 84 L 86 94 M 68 94 L 86 84 M 114 84 L 132 94 M 114 94 L 132 84" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : dm === 'eating' ? (
            <>
              <path d="M 66 90 Q 78 80 90 90 M 110 90 Q 122 80 134 90" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              {/* 아몬드 눈 */}
              <ellipse cx="78" cy="88" rx="10" ry="11" fill="#059669" /><ellipse cx="78" cy="88" rx="4" ry="10" fill="#064E3B" /><circle cx="75" cy="84" r="3.5" fill="#FFFFFF" />
              <ellipse cx="122" cy="88" rx="10" ry="11" fill="#059669" /><ellipse cx="122" cy="88" rx="4" ry="10" fill="#064E3B" /><circle cx="119" cy="84" r="3.5" fill="#FFFFFF" />
            </>
          )}

          {/* 핑크 코 & ω자 입 */}
          <polygon points="93,103 107,103 100,110" fill={catPink} />
          {dm === 'mouth-open' ? (
            <path d="M 88 111 Q 94 112 100 110 Q 106 112 112 111 C 112 126, 88 126, 88 111 Z" fill="#E11D48" stroke="#78350F" strokeWidth="2.2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="116" rx="9" ry={chewOpen ? 10 : 3} fill="#E11D48" stroke="#78350F" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 90 116 Q 100 110 110 116" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 88 110 Q 94 116 100 111 Q 106 116 112 110" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          <ellipse cx={pawLeft.cx} cy={pawLeft.cy} rx="16" ry="12" fill={catWhite} stroke={catDark} strokeWidth="2" />
          <ellipse cx={pawRight.cx} cy={pawRight.cy} rx="16" ry="12" fill={catWhite} stroke={catDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐵 4. 원숭이 (Monkey) – 툭 튀어나온 대형 귀 2개, 하트형 살구색 얼굴 마스크
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'monkey') {
    const monkBase = '#854D0E';
    const monkDark = '#713F12';
    const monkFace = '#FDE68A';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 위로 둥글게 말린 긴 원숭이 꼬리 */}
          <path d={dm === 'happy' ? "M 140 190 C 185 190, 205 130, 185 95 C 170 70, 145 90, 160 115 C 175 135, 165 175, 130 180" : "M 140 190 C 180 190, 195 155, 175 130 C 160 110, 145 125, 155 145 C 165 165, 155 185, 130 185"}
            fill="none" stroke={monkBase} strokeWidth="12" strokeLinecap="round" />

          {/* 팔 */}
          <path d={armL} stroke={monkBase} strokeWidth="15" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={monkBase} strokeWidth="15" strokeLinecap="round" fill="none" />

          {/* 몸통 */}
          <ellipse cx="100" cy="178" rx="52" ry="46" fill={monkBase} stroke={monkDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="182" rx="30" ry="26" fill={monkFace} />

          {/* 🌟 머리 양옆으로 툭 튀어나온 큼직한 원숭이 귀 2개 */}
          <g>
            <circle cx="32" cy="85" r="28" fill={monkBase} stroke={monkDark} strokeWidth="2.5" />
            <circle cx="32" cy="85" r="17" fill={monkFace} />
            <circle cx="168" cy="85" r="28" fill={monkBase} stroke={monkDark} strokeWidth="2.5" />
            <circle cx="168" cy="85" r="17" fill={monkFace} />
          </g>

          {/* 머리 본체 */}
          <circle cx="100" cy="86" r="54" fill={monkBase} stroke={monkDark} strokeWidth="2.5" />

          {/* 🌟 하트 모양 살구색 얼굴 마스크 (곰돌이 둥근 써클 완벽 탈피!) */}
          <path d="M 68 70 C 60 52, 85 48, 100 68 C 115 48, 140 52, 132 70 C 145 92, 136 128, 100 134 C 64 128, 55 92, 68 70 Z" fill={monkFace} stroke={monkDark} strokeWidth="1.5" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(68, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(116, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 70 72 L 88 82 M 70 82 L 88 72 M 112 72 L 130 82 M 112 82 L 130 72" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="80" cy="76" r="6" fill="#451A03" /><circle cx="82" cy="74" r="2.2" fill="#FFFFFF" />
              <circle cx="120" cy="76" r="6" fill="#451A03" /><circle cx="122" cy="74" r="2.2" fill="#FFFFFF" />
            </>
          )}

          {/* 원숭이 납작 콧구멍 2개 */}
          <circle cx="94" cy="94" r="2.5" fill="#78350F" />
          <circle cx="106" cy="94" r="2.5" fill="#78350F" />

          {/* 원숭이 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="114" rx="18" ry="15" fill="#DC2626" stroke="#451A03" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="114" rx="14" ry={chewOpen ? 13 : 3} fill="#DC2626" stroke="#451A03" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 86 116 Q 100 106 114 116" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 80 108 Q 100 122 120 108" stroke="#451A03" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐶 5. 강아지 (Dog) – 롱 플로피 이어, 얼룩 패치 눈, 메롱 혓바닥, 방울 목걸이
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'dog') {
    const dogBase = '#F59E0B';
    const dogDark = '#B45309';
    const dogSnout = '#FEF3C7';
    const earRotL = dm === 'happy' ? -30 : 15;
    const earRotR = dm === 'happy' ? 30 : -15;

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 강아지 꼬리 */}
          <path d={dm === 'happy' ? "M 135 190 Q 185 180 180 130" : "M 135 190 Q 170 185 165 155"} stroke={dogBase} strokeWidth="12" strokeLinecap="round" fill="none" />

          {/* 몸통 */}
          <ellipse cx="100" cy="178" rx="54" ry="48" fill={dogBase} stroke={dogDark} strokeWidth="2" />
          <ellipse cx="100" cy="182" rx="30" ry="26" fill={dogSnout} />

          {/* 빨간 목걸이 & 노란 방울 */}
          <rect x="72" y="142" width="56" height="10" rx="5" fill="#EF4444" />
          <circle cx="100" cy="152" r="7" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />

          {/* 🌟 롱 플로피 이어 */}
          <ellipse cx="38" cy="74" rx="18" ry="38" fill={dogDark} transform={`rotate(${earRotL} 38 74)`} />
          <ellipse cx="162" cy="74" rx="18" ry="38" fill={dogDark} transform={`rotate(${earRotR} 162 74)`} />

          {/* 머리 */}
          <circle cx="100" cy="88" r="52" fill={dogBase} stroke={dogDark} strokeWidth="2" />

          {/* 🌟 한쪽 눈 큼직한 얼룩 패치 */}
          <ellipse cx="76" cy="80" rx="20" ry="18" fill={dogDark} opacity="0.45" transform="rotate(-10 76 80)" />

          {/* 🌟 돌출된 강아지 머즐 패치 */}
          <ellipse cx="100" cy="102" rx="32" ry="22" fill={dogSnout} />

          {/* 눈 표정 (순한 강아지 눈) */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 75) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 75) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 76 L 86 86 M 68 86 L 86 76 M 114 76 L 132 86 M 114 86 L 132 76" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="78" cy="80" r="7" fill="#1C1917" /><circle cx="76" cy="77" r="3" fill="#FFFFFF" />
              <circle cx="122" cy="80" r="7" fill="#1C1917" /><circle cx="120" cy="77" r="3" fill="#FFFFFF" />
            </>
          )}

          {/* 촉촉한 큰 까만 코 */}
          <ellipse cx="100" cy="94" rx="12" ry="8.5" fill="#1C1917" />
          <ellipse cx="97" cy="92" rx="3.5" ry="2" fill="#78716C" opacity="0.6" />

          {/* 🌟 빼꼼 나온 강아지 혓바닥 & 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="114" rx="15" ry="14" fill="#DC2626" stroke="#1C1917" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="114" rx="12" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#1C1917" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 112 Q 100 104 112 112" stroke="#1C1917" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <>
              <path d="M 86 104 Q 93 110 100 106 Q 107 110 114 104" stroke="#1C1917" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M 95 107 C 95 124, 105 124, 105 107 Z" fill="#F43F5E" stroke="#E11D48" strokeWidth="1" />
            </>
          )}

          {/* 앞발 */}
          <ellipse cx="74" cy="195" rx="16" ry="12" fill={dogSnout} stroke={dogDark} strokeWidth="2" />
          <ellipse cx="126" cy="195" rx="16" ry="12" fill={dogSnout} stroke={dogDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🦁 6. 사자 (Lion) – 360도 거대한 불꽃 갈기털, 맹수 코와 턱선
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'lion') {
    const lionBase = '#FBBF24';
    const lionMane = '#B45309';
    const lionManeDark = '#92400E';
    const lionSnout = '#FEF3C7';

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 붓 꼬리 */}
          <path d="M 135 190 Q 185 180 180 140" stroke={lionBase} strokeWidth="11" strokeLinecap="round" fill="none" />
          <ellipse cx="180" cy="135" rx="14" ry="18" fill={lionMane} />

          {/* 몸통 */}
          <ellipse cx="100" cy="180" rx="55" ry="48" fill={lionBase} stroke={lionManeDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="184" rx="32" ry="26" fill={lionSnout} />

          {/* 🌟 360도 거대한 불꽃 모양 사자 갈기털 */}
          <circle cx="100" cy="88" r="72" fill={lionMane} stroke={lionManeDark} strokeWidth="3.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
            <circle key={deg} cx={100 + 66 * Math.cos(deg * Math.PI / 180)} cy={88 + 66 * Math.sin(deg * Math.PI / 180)} r="15" fill={lionMane} />
          ))}

          {/* 둥근 귀 */}
          <circle cx="54" cy="44" r="17" fill={lionBase} stroke={lionManeDark} strokeWidth="2.5" />
          <circle cx="54" cy="44" r="9" fill={lionMane} />
          <circle cx="146" cy="44" r="17" fill={lionBase} stroke={lionManeDark} strokeWidth="2.5" />
          <circle cx="146" cy="44" r="9" fill={lionMane} />

          {/* 맹수 얼굴 본체 */}
          <circle cx="100" cy="88" r="48" fill={lionBase} stroke={lionManeDark} strokeWidth="2.5" />
          <ellipse cx="100" cy="100" rx="28" ry="18" fill={lionSnout} />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(72, 74) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(112, 74) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 70 76 L 88 86 M 70 86 L 88 76 M 112 76 L 130 86 M 112 86 L 130 76" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="82" cy="78" r="7" fill="#1C1917" /><circle cx="80" cy="75" r="2.8" fill="#FFFFFF" />
              <circle cx="118" cy="78" r="7" fill="#1C1917" /><circle cx="116" cy="75" r="2.8" fill="#FFFFFF" />
            </>
          )}

          {/* 큼직한 각진 맹수 코 & 입 */}
          <polygon points="90,92 110,92 100,102" fill="#78350F" />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="114" rx="16" ry="14" fill="#DC2626" stroke="#451A03" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="114" rx="13" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#451A03" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 112 Q 100 104 112 112" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 84 106 Q 92 112 100 108 Q 108 112 116 106" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          )}

          {/* 사자 수염 */}
          <g stroke="#78350F" strokeWidth="2.2" strokeLinecap="round">
            <line x1="52" y1="98" x2="78" y2="102" /><line x1="52" y1="108" x2="78" y2="108" />
            <line x1="148" y1="98" x2="122" y2="102" /><line x1="148" y1="108" x2="122" y2="108" />
          </g>

          <ellipse cx="72" cy="196" rx="18" ry="12" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
          <ellipse cx="128" cy="196" rx="18" ry="12" fill={lionBase} stroke={lionManeDark} strokeWidth="2" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐘 7. 코끼리 (Elephant) – 거대한 부채꼴 왕귀, S자 긴 코, 하얀 상아 (주둥이 써클 제거)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'elephant') {
    const eleBase = '#93C5FD';
    const eleDark = '#1D4ED8';
    const eleInner = '#DBEAFE';
    const trunkD = dm === 'happy' || dm === 'eating'
      ? "M 100 96 Q 88 130 115 142 Q 132 145 138 122"
      : dm === 'mouth-open'
        ? "M 100 96 Q 85 122 128 126"
        : "M 100 96 Q 92 135 108 152 Q 118 158 126 142";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 🌟 양옆으로 거대한 부채꼴 왕귀 2개 */}
          <ellipse cx="30" cy="85" rx="38" ry="44" fill={eleBase} stroke={eleDark} strokeWidth="3" />
          <ellipse cx="32" cy="85" rx="22" ry="28" fill={eleInner} />
          <ellipse cx="170" cy="85" rx="38" ry="44" fill={eleBase} stroke={eleDark} strokeWidth="3" />
          <ellipse cx="168" cy="85" rx="22" ry="28" fill={eleInner} />

          {/* 몸통 */}
          <ellipse cx="100" cy="180" rx="58" ry="50" fill={eleBase} stroke={eleDark} strokeWidth="3" />
          <ellipse cx="100" cy="185" rx="34" ry="28" fill={eleInner} opacity="0.8" />

          {/* 머리 (주둥이 써클 완전 제거) */}
          <circle cx="100" cy="88" r="50" fill={eleBase} stroke={eleDark} strokeWidth="3" />

          {/* 🌟 하얀 앙증맞은 상아 2개 (Tusks) */}
          <path d="M 82 105 Q 68 122 64 112 Q 74 98 82 105 Z" fill="#FFFFFF" stroke={eleDark} strokeWidth="1.8" />
          <path d="M 118 105 Q 132 122 136 112 Q 126 98 118 105 Z" fill="#FFFFFF" stroke={eleDark} strokeWidth="1.8" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 76 L 86 86 M 68 86 L 86 76 M 114 76 L 132 86 M 114 86 L 132 76" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="80" cy="78" r="6.5" fill="#1E3A8A" /><circle cx="78" cy="75" r="2.5" fill="#FFFFFF" />
              <circle cx="120" cy="78" r="6.5" fill="#1E3A8A" /><circle cx="118" cy="75" r="2.5" fill="#FFFFFF" />
            </>
          )}

          {/* 🌟 길게 뻗은 코끼리 코 (Trunk) */}
          <path d={trunkD} stroke={eleBase} strokeWidth="22" strokeLinecap="round" fill="none" />
          <path d={trunkD} stroke={eleDark} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 94 112 Q 100 116 106 112" stroke={eleDark} strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* 기둥 다리 */}
          <rect x="58" y="185" width="28" height="24" rx="8" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />
          <rect x="114" y="185" width="28" height="24" rx="8" fill={eleBase} stroke={eleDark} strokeWidth="2.5" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐼 8. 판다 (Panda) – 흑백 투톤 & 칠흑 같은 콩깍지 눈 패치 (주둥이 써클 제거)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'panda') {
    const panWhite = '#FFFFFF';
    const panBlack = '#0F172A';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 검은 어깨 팔 */}
          <path d={armL} stroke={panBlack} strokeWidth="18" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={panBlack} strokeWidth="18" strokeLinecap="round" fill="none" />

          {/* 하얀 몸통 */}
          <ellipse cx="100" cy="180" rx="56" ry="50" fill={panWhite} stroke="#CBD5E1" strokeWidth="2.5" />
          <ellipse cx="100" cy="150" rx="46" ry="16" fill={panBlack} opacity="0.95" />

          {/* 🌟 까맣고 동글동글한 판다 귀 2개 */}
          <circle cx="54" cy="45" r="24" fill={panBlack} />
          <circle cx="146" cy="45" r="24" fill={panBlack} />

          {/* 하얀 머리 */}
          <circle cx="100" cy="90" r="54" fill={panWhite} stroke="#CBD5E1" strokeWidth="2.5" />

          {/* 🌟 판다의 상징: 검은색 타원형 콩깍지 눈 패치 2개 */}
          <ellipse cx="74" cy="80" rx="18" ry="14" fill={panBlack} transform="rotate(-15 74 80)" />
          <ellipse cx="126" cy="80" rx="18" ry="14" fill={panBlack} transform="rotate(15 126 80)" />

          {/* 눈 표정 */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(66, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(118, 72) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 66 76 L 82 84 M 66 84 L 82 76 M 118 76 L 134 84 M 118 84 L 134 76" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="74" cy="80" r="5" fill="#FFFFFF" /><circle cx="74" cy="80" r="2.2" fill="#0F172A" />
              <circle cx="126" cy="80" r="5" fill="#FFFFFF" /><circle cx="126" cy="80" r="2.2" fill="#0F172A" />
            </>
          )}

          {/* 둥근 코 & 입 */}
          <ellipse cx="100" cy="98" rx="9" ry="7" fill={panBlack} />
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="114" rx="15" ry="14" fill="#DC2626" stroke={panBlack} strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="114" rx="12" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke={panBlack} strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 114 Q 100 106 112 114" stroke={panBlack} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 88 108 Q 94 114 100 110 Q 106 114 112 108" stroke={panBlack} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          <circle cx="58" cy="104" r="11" fill="#FDA4AF" opacity="0.65" />
          <circle cx="142" cy="104" r="11" fill="#FDA4AF" opacity="0.65" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐷 9. 돼지 (Pig) – 거대한 분홍 돼지코(콧구멍 2개), 접힌 핑크 세모 귀 (원형 써클 탈피!)
  // ═════════════════════════════════════════════════════════════════════════════
  if (animal?.id === 'pig') {
    const pigPink = '#FDA4AF';
    const pigDark = '#E11D48';
    const pigSnout = '#FB7185';
    const armL = dm === 'happy' ? "M 52 155 Q 15 105 30 75" : dm === 'reject' ? "M 52 155 Q 60 135 85 145" : "M 52 155 Q 26 170 32 195";
    const armR = dm === 'happy' ? "M 148 155 Q 185 105 170 75" : dm === 'reject' ? "M 148 155 Q 140 135 115 145" : "M 148 155 Q 174 170 168 195";

    return (
      <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
        <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* 스프링 모양 꼬리 */}
          <path d={dm === 'happy' ? "M 140 190 Q 170 175 165 155 Q 160 135 175 140" : "M 140 190 Q 165 180 160 165 Q 155 150 170 155"}
            stroke={pigDark} strokeWidth="6" strokeLinecap="round" fill="none" />

          {/* 팔 */}
          <path d={armL} stroke={pigDark} strokeWidth="15" strokeLinecap="round" fill="none" />
          <path d={armR} stroke={pigDark} strokeWidth="15" strokeLinecap="round" fill="none" />

          {/* 포동포동 몸통 */}
          <ellipse cx="100" cy="178" rx="58" ry="50" fill={pigPink} stroke={pigDark} strokeWidth="3" />
          <ellipse cx="100" cy="182" rx="34" ry="28" fill="#FFF1F2" />

          {/* 🌟 접힌 핑크 세모 귀 2개 */}
          <polygon points="42,70 60,22 84,55" fill={pigDark} />
          <polygon points="46,65 60,30 78,54" fill="#FFE4E6" />
          <polygon points="158,70 140,22 116,55" fill={pigDark} />
          <polygon points="154,65 140,30 122,54" fill="#FFE4E6" />

          {/* 머리 */}
          <circle cx="100" cy="88" r="54" fill={pigPink} stroke={pigDark} strokeWidth="3" />

          {/* 눈 표정 (눈웃음치는 돼지 눈) */}
          {dm === 'happy' ? (
            <>
              <g transform="translate(70, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
              <g transform="translate(114, 68) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#EF4444" className="bear-heart-pulse" /></g>
            </>
          ) : dm === 'reject' ? (
            <>
              <path d="M 68 72 L 86 82 M 68 82 L 86 72 M 114 72 L 132 82 M 114 82 L 132 72" stroke="#881337" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="78" cy="74" r="6.5" fill="#881337" /><circle cx="76" cy="71" r="2.5" fill="#FFFFFF" />
              <circle cx="122" cy="74" r="6.5" fill="#881337" /><circle cx="120" cy="71" r="2.5" fill="#FFFFFF" />
            </>
          )}

          {/* 🌟 얼굴 정중앙을 차지하는 큼직한 타원형 돼지코 (누가 봐도 돼지!) */}
          <ellipse cx="100" cy="98" rx="26" ry="18" fill={pigSnout} stroke={pigDark} strokeWidth="3" />
          <ellipse cx="91" cy="98" rx="5.5" ry="7" fill="#881337" />
          <ellipse cx="109" cy="98" rx="5.5" ry="7" fill="#881337" />

          {/* 입 */}
          {dm === 'mouth-open' ? (
            <ellipse cx="100" cy="122" rx="16" ry="14" fill="#DC2626" stroke="#881337" strokeWidth="2" className="bear-mouth-open-anim" />
          ) : dm === 'eating' ? (
            <ellipse cx="100" cy="122" rx="13" ry={chewOpen ? 12 : 3} fill="#DC2626" stroke="#881337" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
          ) : dm === 'reject' ? (
            <path d="M 88 122 Q 100 114 112 122" stroke="#881337" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M 86 118 Q 100 128 114 118" stroke="#881337" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          )}

          <circle cx="58" cy="98" r="11" fill="#F43F5E" opacity="0.55" />
          <circle cx="142" cy="98" r="11" fill="#F43F5E" opacity="0.55" />
        </svg>
        {renderFX()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🐻 10. 곰돌이 (Bear) – 포근한 꿀단지 브라운 & 동글동글 곰 귀
  // ═════════════════════════════════════════════════════════════════════════════
  const bearBase = '#C8952E';
  const bearDark = '#854D0E';
  const bearSnout = '#E8C87A';
  const armL = dm === 'happy' ? "M 48 160 Q 12 118 22 88" : dm === 'reject' ? "M 48 160 Q 50 140 80 148" : "M 48 160 Q 28 175 22 198";
  const armR = dm === 'happy' ? "M 152 160 Q 188 118 178 88" : dm === 'reject' ? "M 152 160 Q 150 140 120 148" : "M 152 160 Q 172 175 178 198";

  return (
    <div className={bodyClass} style={{ position: 'relative', width: '100%', maxWidth: '170px', height: '200px', margin: '0 auto' }}>
      <svg viewBox="0 0 200 245" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <path d={armL} stroke={bearDark} strokeWidth="16" strokeLinecap="round" fill="none" style={{ transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <path d={armR} stroke={bearDark} strokeWidth="16" strokeLinecap="round" fill="none" style={{ transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <ellipse cx="100" cy="178" rx="56" ry="50" fill={bearBase} stroke={bearDark} strokeWidth="2.5" />
        <ellipse cx="100" cy="182" rx="32" ry="28" fill={bearSnout} opacity="0.9" />

        {/* 둥근 곰 귀 */}
        <circle cx="54" cy="42" r="22" fill={bearDark} />
        <circle cx="146" cy="42" r="22" fill={bearDark} />
        <circle cx="54" cy="42" r="12" fill="#FFCAD4" />
        <circle cx="146" cy="42" r="12" fill="#FFCAD4" />

        <circle cx="100" cy="88" r="54" fill={bearBase} stroke={bearDark} strokeWidth="2.5" />
        <ellipse cx="100" cy="98" rx="34" ry="28" fill={bearSnout} />

        {dm === 'happy' ? (
          <>
            <g transform="translate(72, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#ef4444" className="bear-heart-pulse" /></g>
            <g transform="translate(112, 70) scale(1)"><path d="M 0 5 C 0 -1 5 -4.5 8 0.5 C 11 -4.5 16 -1 16 5 C 16 11 8 17 8 17 C 8 17 0 11 0 5 Z" fill="#ef4444" className="bear-heart-pulse" /></g>
          </>
        ) : dm === 'reject' ? (
          <>
            <path d="M 73 74 L 89 82 M 73 82 L 89 74 M 111 74 L 127 82 M 111 82 L 127 74" stroke="#3E2723" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="80" cy="76" r="6.5" fill="#3E2723" /><circle cx="82" cy="74" r="2.5" fill="white" />
            <circle cx="120" cy="76" r="6.5" fill="#3E2723" /><circle cx="122" cy="74" r="2.5" fill="white" />
          </>
        )}

        <ellipse cx="100" cy="94" rx="8" ry="6" fill="#3E2723" />
        {dm === 'mouth-open' ? (
          <ellipse cx="100" cy="112" rx="14" ry="15" fill="#D32F2F" stroke="#3E2723" strokeWidth="2" className="bear-mouth-open-anim" />
        ) : dm === 'eating' ? (
          <ellipse cx="100" cy="110" rx="12" ry={chewOpen ? 14 : 4} fill="#D32F2F" stroke="#3E2723" strokeWidth="2" style={{ transition: 'ry 0.12s ease' }} />
        ) : dm === 'reject' ? (
          <path d="M 86 110 Q 100 102 114 110" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M 88 104 Q 100 115 112 104" stroke="#3E2723" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        )}

        <circle cx="60" cy="96" r="11" fill="#FF9999" opacity="0.6" />
        <circle cx="140" cy="96" r="11" fill="#FF9999" opacity="0.6" />
      </svg>
      {renderFX()}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔊 고품질 자연어 한국어 음성 (TTS) 엔진 (상냥하고 다정한 유아 친화 구어체 톤)
// ═════════════════════════════════════════════════════════════════════════════

// 브라우저 보이스 캐시 및 비동기 이벤트 리스너 등록 (아이패드 Safari 보이스 늦은 로딩 대응)
let cachedVoices = [];
function updateVoicesCache() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const list = window.speechSynthesis.getVoices();
    if (list && list.length > 0) {
      cachedVoices = list;
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateVoicesCache();
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = updateVoicesCache;
  }
}

// 보이스 객체 획득 및 성별/기기 환경 분석
export function getKoreanVoiceInfo() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { voice: null, isMale: false };
  let voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) cachedVoices = voices;
  if (!voices || voices.length === 0) return { voice: null, isMale: false };

  const koreanVoices = voices.filter(v => v.lang === 'ko-KR' || v.lang.startsWith('ko') || v.lang.includes('ko'));
  if (koreanVoices.length === 0) return { voice: null, isMale: false };

  const scoredVoices = koreanVoices.map(voice => {
    const name = voice.name.toLowerCase();
    const uri = (voice.voiceURI || '').toLowerCase();
    let score = 0;
    let isMale = false;

    // 🏆 다정하고 나긋나긋한 남성 목소리 최우선 1순위 (PC InJoon Natural, 봉진, 국민, Apple Siri Male 등)
    if (name.includes('injoon') || name.includes('인준')) { score += 1000; isMale = true; }
    else if (name.includes('bongjin') || name.includes('봉진')) { score += 850; isMale = true; }
    else if (name.includes('gookmin') || name.includes('국민')) { score += 750; isMale = true; }
    else if (name.includes('male') || uri.includes('male') || name.includes('남성') || name.includes('남자')) { score += 650; isMale = true; }
    else if (name.includes('siri') && (name.includes('1') || name.includes('voice 1') || name.includes('음성 1') || name.includes('남'))) { score += 600; isMale = true; }
    else if (name.includes('sinji') || name.includes('신지')) { score += 400; isMale = true; }

    if (name.includes('natural')) score += 100;
    if (name.includes('online')) score += 90;
    if (name.includes('neural')) score += 90;
    if (name.includes('premium') || name.includes('enhanced')) score += 80;

    // ❌ 여성 목소리는 점수 감점 (남성 음성이 없을 때만 최종 선택되도록 함)
    const isFemale = name.includes('sunhi') || name.includes('선희') ||
                     name.includes('yuna') || name.includes('유나') ||
                     name.includes('heami') || name.includes('혜미') ||
                     name.includes('seoyeon') || name.includes('서연') ||
                     name.includes('gaeun') || name.includes('가은') ||
                     name.includes('female') || uri.includes('female') ||
                     name.includes('여성') || name.includes('여자') ||
                     (name.includes('siri') && (name.includes('2') || name.includes('voice 2') || name.includes('음성 2')));

    if (isFemale) {
      score -= 500;
      isMale = false;
    }

    if (name.includes('desktop')) score -= 100;
    if (name.includes('sapi5')) score -= 100;

    return { voice, score, isMale };
  });

  scoredVoices.sort((a, b) => b.score - a.score);
  const best = scoredVoices[0];
  return { voice: best.voice, isMale: !!best.isMale };
}

// 하위 호환용 래퍼 함수
export function getBestKoreanVoice() {
  return getKoreanVoiceInfo().voice;
}

// 텍스트를 자연스러운 구어체(다정한 대화체)로 튜닝하고 기호/이모지/물결표 제거
export function formatSpokenKoreanText(text) {
  if (!text) return '';

  // 1. 이모지, 물결표(~), 특수 기호 제거 (TTS 유닛이 "물결표", "물결표 사인" 등 기호를 소리내어 읽는 현상 100% 방지)
  let cleanText = text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[~～]/g, ' ')
    .replace(/[*#@^&_+={}\[\]<>"'`]/g, ' ')
    .replace(/["'""'']/g, '');

  // 2. '배고파요' 뒤에 부드러운 쉼표(,)를 두어 0.8초의 긴 묵음 텀은 없애고, 0.2초의 적절하고 자연스러운 호흡 구분 부여
  cleanText = cleanText
    .replace(/배고파요[!.,·…~～\s]*/g, '배고파요, ')
    .replace(/어디 있을까요\?/g, '어디에 있을까요?')
    .replace(/누구일까요\?/g, '누구일까요?')
    .replace(/맞춰볼까요\?/g, '맞춰볼까요?')
    .replace(/먹고 싶어요[!.]?/g, '먹고 싶대요!')
    .replace(/참 잘했어요[!.]?/g, '참 잘했어요! 대단해요!')
    .replace(/정말 최고예요[!.]?/g, '정말 최고예요!')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanText;
}

export function speakNaturalKorean(text, { pitch = 1.16, rate = 0.92, priority = true } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    if (priority) {
      window.speechSynthesis.cancel();
    }

    const spokenText = formatSpokenKoreanText(text);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'ko-KR';

    const { voice: bestVoice, isMale } = getKoreanVoiceInfo();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // 🎧 기기 및 보이스 환경별 피치(Pitch) 지능형 자동 보정:
    // 1) 남성 보이스(PC InJoon, 봉진, Siri 남성 등): 기본 음역대가 낮으므로 1.14~1.16이 다정하고 밝은 삼촌/아빠 톤으로 완벽함.
    // 2) 여성 보이스(아이패드/iOS 기본 Yuna 등): 기본 음역대가 높아 피치 1.16을 곱하면 고음으로 째지므로,
    //    피치를 0.83~0.85로 낮춰 편안하고 차분한 중저음 톤으로 자동 변환합니다.
    let finalPitch = pitch;
    let finalRate = rate;

    if (!isMale) {
      // 여성 보이스일 경우: 고음 째짐을 차단하고 따뜻하고 차분한 동화 구연가/중저음 톤으로 매핑
      finalPitch = Math.max(0.78, Math.min(0.90, pitch * 0.72));
      finalRate = Math.min(rate, 0.93);
    }

    utterance.pitch = finalPitch;
    utterance.rate = finalRate;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('TTS playback error:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎙️ PC Edge 인준(InJoon) 고음질 MP3 플레이어 (아이패드/모바일 100% 비동기 지원 Web Audio 엔진 연동)
// ═════════════════════════════════════════════════════════════════════════════
export function playVoiceAudio(audioSrc, fallbackFn = null, onEnded = null) {
  if (typeof window === 'undefined') return;
  try {
    if (audioEngine && typeof audioEngine.playVoice === 'function') {
      audioEngine.playVoice(audioSrc, fallbackFn, onEnded);
      return;
    }

    // fallback
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { }
    }
    const audio = new Audio(audioSrc);
    audio.onended = () => { if (onEnded) onEnded(); };
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Voice MP3 playback fallback to TTS:', err);
        if (fallbackFn) fallbackFn();
      });
    }
  } catch (err) {
    if (fallbackFn) fallbackFn();
  }
}

// 한글 조사 자동 연결 헬퍼 (은/는, 이/가, 을/를, 과/와)
export function attachJosa(word, josaType) {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  const hasBatchim = (lastChar - 0xac00) % 28 > 0;
  if (josaType === '은/는') return word + (hasBatchim ? '은' : '는');
  if (josaType === '이/가') return word + (hasBatchim ? '이' : '가');
  if (josaType === '을/를') return word + (hasBatchim ? '을' : '를');
  if (josaType === '과/와') return word + (hasBatchim ? '과' : '와');
  return word;
}

// ═════════════════════════════════════════════════════════════════════════════
// 🌊 신비 바다 생물 실제 형태 SVG 벡터 아트워크 (8종 실체 디자인)
// ═════════════════════════════════════════════════════════════════════════════
function OceanCreatureSVG({ id, isTarget, isFound, isActive }) {
  // 1. 🐟 니모 열대어
  if (id === 'fish') {
    return (
      <svg viewBox="0 0 130 95" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 등지느러미 */}
        <path d="M 45 26 Q 65 8 90 28 Q 70 20 45 26 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="2.5" />
        {/* 배지느러미 */}
        <path d="M 50 68 Q 68 86 85 70 Q 70 74 50 68 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="2.5" />
        {/* 꼬리지느러미 */}
        <path d="M 28 48 L 4 22 Q 18 48 4 74 Z" fill="#f97316" stroke="#ea580c" strokeWidth="3" />
        <path d="M 22 48 L 8 30 Q 18 48 8 66 Z" fill="#fb923c" opacity="0.8" />
        
        {/* 몸통 (주황색 유선형) */}
        <ellipse cx="68" cy="48" rx="42" ry="26" fill="#f97316" stroke="#ea580c" strokeWidth="3.5" />
        <ellipse cx="68" cy="44" rx="38" ry="20" fill="url(#fishGrad)" opacity="0.4" />
        
        {/* 흰색/검은 줄무늬 1 */}
        <path d="M 52 23 Q 46 48 52 73" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M 52 23 Q 46 48 52 73" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" />
        
        {/* 흰색/검은 줄무늬 2 */}
        <path d="M 78 24 Q 72 48 78 72" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M 78 24 Q 72 48 78 72" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        
        {/* 가슴지느러미 */}
        <ellipse cx="62" cy="54" rx="12" ry="8" fill="#fbbf24" stroke="#d97706" strokeWidth="2" transform="rotate(-15 62 54)" />
        
        {/* 초롱초롱 눈 */}
        <circle cx="94" cy="42" r="8.5" fill="#ffffff" stroke="#ea580c" strokeWidth="2" />
        <circle cx="96" cy="42" r="5" fill="#0f172a" />
        <circle cx="98" cy="40" r="2" fill="#ffffff" />
        <circle cx="94" cy="44" r="1" fill="#ffffff" />
        
        {/* 볼터치 & 입술 */}
        <circle cx="88" cy="54" r="5" fill="#f43f5e" opacity="0.75" />
        <path d="M 106 48 Q 112 50 106 54" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" fill="none" />
        
        <defs>
          <linearGradient id="fishGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 2. 🐙 말랑 뽀글 문어
  if (id === 'octopus') {
    return (
      <svg viewBox="0 0 130 120" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 8개의 물결치는 문어 다리 */}
        <g stroke="#db2777" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 28 80 Q 14 96 16 112" />
          <path d="M 40 86 Q 30 106 38 116" />
          <path d="M 52 88 Q 50 110 58 118" />
          <path d="M 65 88 Q 65 110 65 118" />
          <path d="M 78 88 Q 80 110 72 118" />
          <path d="M 90 86 Q 100 106 92 116" />
          <path d="M 102 80 Q 116 96 114 112" />
        </g>
        <g stroke="#f472b6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 28 80 Q 14 96 16 112" />
          <path d="M 40 86 Q 30 106 38 116" />
          <path d="M 52 88 Q 50 110 58 118" />
          <path d="M 65 88 Q 65 110 65 118" />
          <path d="M 78 88 Q 80 110 72 118" />
          <path d="M 90 86 Q 100 106 92 116" />
          <path d="M 102 80 Q 116 96 114 112" />
        </g>
        {/* 동글동글 빨판 */}
        <circle cx="16" cy="108" r="3" fill="#fef08a" />
        <circle cx="36" cy="112" r="3" fill="#fef08a" />
        <circle cx="56" cy="114" r="3" fill="#fef08a" />
        <circle cx="74" cy="114" r="3" fill="#fef08a" />
        <circle cx="94" cy="112" r="3" fill="#fef08a" />
        <circle cx="114" cy="108" r="3" fill="#fef08a" />

        {/* 돔형 문어 머리 */}
        <ellipse cx="65" cy="50" rx="42" ry="38" fill="#ec4899" stroke="#db2777" strokeWidth="4" />
        <ellipse cx="65" cy="44" rx="36" ry="30" fill="url(#octoGrad)" opacity="0.5" />
        
        {/* 머리 위 물방울 리본/하이라이트 */}
        <ellipse cx="50" cy="24" rx="8" ry="4" fill="#ffffff" opacity="0.6" transform="rotate(-20 50 24)" />

        {/* 초롱초롱 눈망울 */}
        <circle cx="48" cy="50" r="8" fill="#ffffff" />
        <circle cx="50" cy="50" r="5" fill="#1e1b4b" />
        <circle cx="52" cy="48" r="2" fill="#ffffff" />
        <circle cx="48" cy="52" r="1" fill="#ffffff" />

        <circle cx="82" cy="50" r="8" fill="#ffffff" />
        <circle cx="80" cy="50" r="5" fill="#1e1b4b" />
        <circle cx="82" cy="48" r="2" fill="#ffffff" />
        <circle cx="78" cy="52" r="1" fill="#ffffff" />

        {/* 볼터치 & 입 */}
        <circle cx="38" cy="60" r="6" fill="#f43f5e" opacity="0.8" />
        <circle cx="92" cy="60" r="6" fill="#f43f5e" opacity="0.8" />
        <ellipse cx="65" cy="64" rx="7" ry="5" fill="#831843" />
        <ellipse cx="65" cy="62" rx="4" ry="2" fill="#fda4af" />

        <defs>
          <linearGradient id="octoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fdf2f8" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 3. 🦀 꽃게
  if (id === 'crab') {
    return (
      <svg viewBox="0 0 135 105" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 6개 걷는다리 */}
        <g stroke="#b91c1c" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 38 65 Q 18 70 12 88" />
          <path d="M 42 74 Q 24 85 20 100" />
          <path d="M 48 82 Q 34 96 32 106" />
          
          <path d="M 97 65 Q 117 70 123 88" />
          <path d="M 93 74 Q 111 85 115 100" />
          <path d="M 87 82 Q 101 96 103 106" />
        </g>
        <g stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 38 65 Q 18 70 12 88" />
          <path d="M 42 74 Q 24 85 20 100" />
          <path d="M 48 82 Q 34 96 32 106" />
          
          <path d="M 97 65 Q 117 70 123 88" />
          <path d="M 93 74 Q 111 85 115 100" />
          <path d="M 87 82 Q 101 96 103 106" />
        </g>

        {/* 좌우 커다란 집게발 */}
        {/* 왼쪽 집게 */}
        <path d="M 35 55 Q 18 36 24 20" stroke="#b91c1c" strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="22" cy="18" rx="14" ry="11" fill="#ef4444" stroke="#b91c1c" strokeWidth="3" transform="rotate(-30 22 18)" />
        <path d="M 12 12 Q 22 2 30 14" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* 오른쪽 집게 */}
        <path d="M 100 55 Q 117 36 111 20" stroke="#b91c1c" strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="113" cy="18" rx="14" ry="11" fill="#ef4444" stroke="#b91c1c" strokeWidth="3" transform="rotate(30 113 18)" />
        <path d="M 123 12 Q 113 2 105 14" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* 꽃게 둥근 등껍질 */}
        <ellipse cx="67" cy="68" rx="38" ry="26" fill="#ef4444" stroke="#b91c1c" strokeWidth="4" />
        <ellipse cx="67" cy="62" rx="32" ry="18" fill="url(#crabGrad)" opacity="0.4" />

        {/* 위로 솟은 두 눈자루 */}
        <line x1="52" y1="50" x2="48" y2="34" stroke="#b91c1c" strokeWidth="5" strokeLinecap="round" />
        <line x1="82" y1="50" x2="86" y2="34" stroke="#b91c1c" strokeWidth="5" strokeLinecap="round" />
        <circle cx="48" cy="32" r="9" fill="#ffffff" stroke="#b91c1c" strokeWidth="2.5" />
        <circle cx="50" cy="32" r="5" fill="#0f172a" /><circle cx="52" cy="30" r="2" fill="#ffffff" />
        <circle cx="86" cy="32" r="9" fill="#ffffff" stroke="#b91c1c" strokeWidth="2.5" />
        <circle cx="84" cy="32" r="5" fill="#0f172a" /><circle cx="86" cy="30" r="2" fill="#ffffff" />

        {/* 볼터치 & 방긋 입 */}
        <circle cx="46" cy="72" r="5.5" fill="#fb7185" opacity="0.8" />
        <circle cx="88" cy="72" r="5.5" fill="#fb7185" opacity="0.8" />
        <path d="M 58 72 Q 67 82 76 72" stroke="#7f1d1d" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        <defs>
          <linearGradient id="crabGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef2f2" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 4. 🐢 바다거북
  if (id === 'turtle') {
    return (
      <svg viewBox="0 0 135 105" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 뒷지느러미 2개 & 꼬리 */}
        <ellipse cx="32" cy="74" rx="14" ry="7" fill="#10b981" stroke="#047857" strokeWidth="2.5" transform="rotate(-35 32 74)" />
        <ellipse cx="32" cy="36" rx="14" ry="7" fill="#10b981" stroke="#047857" strokeWidth="2.5" transform="rotate(35 32 36)" />
        <path d="M 22 55 L 8 55" stroke="#047857" strokeWidth="4" strokeLinecap="round" />

        {/* 앞쪽 커다란 노 젓는 지느러미 2개 */}
        <path d="M 70 38 Q 95 12 118 16 Q 100 38 76 44 Z" fill="#10b981" stroke="#047857" strokeWidth="3" />
        <path d="M 70 72 Q 95 98 118 94 Q 100 72 76 66 Z" fill="#10b981" stroke="#047857" strokeWidth="3" />

        {/* 둥근 거북이 머리 */}
        <ellipse cx="108" cy="55" rx="16" ry="13" fill="#10b981" stroke="#047857" strokeWidth="3" />
        <circle cx="114" cy="50" r="4.5" fill="#ffffff" />
        <circle cx="115" cy="50" r="2.8" fill="#0f172a" /><circle cx="116" cy="49" r="1.2" fill="#ffffff" />
        <circle cx="110" cy="58" r="3.5" fill="#f43f5e" opacity="0.65" />
        <path d="M 118 56 Q 123 58 119 61" stroke="#047857" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* 에메랄드 육각 등껍질 */}
        <ellipse cx="58" cy="55" rx="38" ry="28" fill="#059669" stroke="#047857" strokeWidth="4" />
        <ellipse cx="58" cy="52" rx="32" ry="22" fill="#10b981" />
        
        {/* 등껍질 육각형 패턴 디테일 */}
        <polygon points="58,40 68,46 68,58 58,64 48,58 48,46" fill="#047857" opacity="0.75" />
        <line x1="58" y1="40" x2="58" y2="28" stroke="#047857" strokeWidth="2.5" />
        <line x1="68" y1="46" x2="82" y2="38" stroke="#047857" strokeWidth="2.5" />
        <line x1="68" y1="58" x2="82" y2="68" stroke="#047857" strokeWidth="2.5" />
        <line x1="58" y1="64" x2="58" y2="78" stroke="#047857" strokeWidth="2.5" />
        <line x1="48" y1="58" x2="34" y2="68" stroke="#047857" strokeWidth="2.5" />
        <line x1="48" y1="46" x2="34" y2="38" stroke="#047857" strokeWidth="2.5" />
      </svg>
    );
  }

  // 5. 🐳 파랑고래
  if (id === 'whale') {
    return (
      <svg viewBox="0 0 150 110" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 등 위 뿜어내는 시원한 3단 물줄기 분수 */}
        <g stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M 65 30 Q 60 10 45 6" />
          <path d="M 67 28 Q 67 4 67 2" />
          <path d="M 70 30 Q 75 10 90 6" />
        </g>
        <circle cx="43" cy="6" r="3.5" fill="#bae6fd" />
        <circle cx="67" cy="2" r="4" fill="#bae6fd" />
        <circle cx="92" cy="6" r="3.5" fill="#bae6fd" />

        {/* 고래 꼬리지느러미 */}
        <path d="M 28 62 L 4 42 Q 18 62 4 82 Z" fill="#0284c7" stroke="#0369a1" strokeWidth="3" />

        {/* 둥글고 푸근한 고래 몸통 */}
        <path d="M 24 62 Q 24 32 75 32 Q 128 32 135 62 Q 135 88 80 88 Q 38 88 24 62 Z" fill="#0284c7" stroke="#0369a1" strokeWidth="4" />
        
        {/* 고래 하얀 배 & 복부 스트라이프 */}
        <path d="M 45 74 Q 80 92 125 72 Q 120 86 80 86 Q 52 86 45 74 Z" fill="#e0f2fe" />
        <path d="M 60 76 Q 80 84 100 80" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M 68 80 Q 82 86 94 84" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* 가슴지느러미 */}
        <ellipse cx="78" cy="70" rx="16" ry="9" fill="#0369a1" stroke="#0284c7" strokeWidth="2" transform="rotate(20 78 70)" />

        {/* 크고 귀여운 눈 & 볼터치 */}
        <circle cx="110" cy="54" r="8" fill="#ffffff" />
        <circle cx="112" cy="54" r="5" fill="#0f172a" /><circle cx="114" cy="52" r="2" fill="#ffffff" />
        <circle cx="102" cy="64" r="6" fill="#f43f5e" opacity="0.75" />
        
        {/* 미소 */}
        <path d="M 118 62 Q 128 68 132 60" stroke="#082f49" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  // 6. 🦈 아기상어
  if (id === 'shark') {
    return (
      <svg viewBox="0 0 145 100" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 상어 등지느러미 */}
        <path d="M 60 38 L 74 10 Q 78 30 92 36 Z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="3" />
        
        {/* 상어 꼬리지느러미 */}
        <path d="M 28 52 L 4 24 Q 20 52 4 80 Z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="3.5" />

        {/* 상어 몸체 (유선형 날렵함) */}
        <path d="M 24 52 Q 35 32 80 32 Q 130 32 140 52 Q 125 78 75 76 Q 38 76 24 52 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="3.5" />
        
        {/* 하얀 배 */}
        <path d="M 38 60 Q 75 80 128 60 Q 115 74 75 74 Q 48 74 38 60 Z" fill="#eff6ff" />

        {/* 가슴지느러미 */}
        <path d="M 72 58 L 60 84 Q 78 78 86 64 Z" fill="#1d4ed8" stroke="#1e40af" strokeWidth="2" />

        {/* 아가미 3줄 */}
        <g stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round">
          <line x1="84" y1="46" x2="82" y2="56" />
          <line x1="89" y1="46" x2="87" y2="56" />
          <line x1="94" y1="46" x2="92" y2="56" />
        </g>

        {/* 눈망울 */}
        <circle cx="116" cy="46" r="7.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2" />
        <circle cx="118" cy="46" r="4.5" fill="#0f172a" /><circle cx="120" cy="44" r="1.8" fill="#ffffff" />
        <circle cx="108" cy="56" r="5" fill="#f43f5e" opacity="0.75" />

        {/* 귀여운 상어 이빨 미소 */}
        <path d="M 120 56 Q 132 64 135 54" stroke="#1e3a8a" strokeWidth="2.5" fill="#ffffff" strokeLinecap="round" />
        <polygon points="124,57 127,61 130,57" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1" />
      </svg>
    );
  }

  // 7. 🦑 화살오징어
  if (id === 'squid') {
    return (
      <svg viewBox="0 0 115 125" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
        {/* 삼각 귀 (지느러미) */}
        <polygon points="57,6 20,42 94,42" fill="#e11d48" stroke="#be123c" strokeWidth="3" />
        <polygon points="57,12 30,40 84,40" fill="#fb7185" />

        {/* 오징어 매끄러운 외투막 몸통 */}
        <ellipse cx="57" cy="56" rx="28" ry="32" fill="#fb7185" stroke="#be123c" strokeWidth="3.5" />
        
        {/* 10개 촉수 다리 (가운데 긴 사냥 촉수 2개) */}
        <g stroke="#be123c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 38 84 Q 28 102 32 116" />
          <path d="M 46 86 Q 42 106 44 122" />
          <path d="M 54 88 Q 50 112 52 124" />
          <path d="M 60 88 Q 64 112 62 124" />
          <path d="M 68 86 Q 72 106 70 122" />
          <path d="M 76 84 Q 86 102 82 116" />
        </g>
        <g stroke="#fda4af" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 38 84 Q 28 102 32 116" />
          <path d="M 46 86 Q 42 106 44 122" />
          <path d="M 54 88 Q 50 112 52 124" />
          <path d="M 60 88 Q 64 112 62 124" />
          <path d="M 68 86 Q 72 106 70 122" />
          <path d="M 76 84 Q 86 102 82 116" />
        </g>

        {/* 눈망울 */}
        <circle cx="44" cy="68" r="8" fill="#ffffff" />
        <circle cx="46" cy="68" r="4.8" fill="#0f172a" /><circle cx="48" cy="66" r="2" fill="#ffffff" />
        <circle cx="70" cy="68" r="8" fill="#ffffff" />
        <circle cx="68" cy="68" r="4.8" fill="#0f172a" /><circle cx="70" cy="66" r="2" fill="#ffffff" />

        {/* 볼터치 & 입 */}
        <circle cx="36" cy="74" r="5" fill="#f43f5e" opacity="0.8" />
        <circle cx="78" cy="74" r="5" fill="#f43f5e" opacity="0.8" />
        <ellipse cx="57" cy="76" rx="4" ry="3" fill="#881337" />
      </svg>
    );
  }

  // 8. 🦭 아기물개
  return (
    <svg viewBox="0 0 135 105" width="100%" height="100%" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))', overflow: 'visible' }}>
      {/* 꼬리 지느러미 */}
      <ellipse cx="18" cy="62" rx="14" ry="7" fill="#64748b" stroke="#475569" strokeWidth="2.5" transform="rotate(-25 18 62)" />
      <ellipse cx="18" cy="74" rx="14" ry="7" fill="#64748b" stroke="#475569" strokeWidth="2.5" transform="rotate(25 18 74)" />

      {/* 통통하고 매끄러운 몸체 */}
      <path d="M 22 68 Q 30 40 70 38 Q 110 38 120 58 Q 118 84 75 84 Q 35 84 22 68 Z" fill="#94a3b8" stroke="#475569" strokeWidth="3.5" />
      <ellipse cx="80" cy="62" rx="30" ry="18" fill="#cbd5e1" opacity="0.5" />

      {/* 손뼉 치는 앞지느러미 */}
      <ellipse cx="76" cy="76" rx="14" ry="8" fill="#64748b" stroke="#475569" strokeWidth="2" transform="rotate(15 76 76)" />

      {/* 머리 & 얼굴 */}
      <circle cx="106" cy="52" r="18" fill="#94a3b8" stroke="#475569" strokeWidth="3.5" />
      <circle cx="108" cy="48" r="5" fill="#ffffff" />
      <circle cx="109" cy="48" r="3.2" fill="#0f172a" /><circle cx="110" cy="47" r="1.2" fill="#ffffff" />
      
      {/* 앙증맞은 주둥이와 코 */}
      <ellipse cx="116" cy="56" rx="7" ry="5" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      <ellipse cx="117" cy="54" rx="3" ry="2" fill="#0f172a" />
      
      {/* 수염 3쌍 */}
      <g stroke="#334155" strokeWidth="1.5" strokeLinecap="round">
        <line x1="118" y1="54" x2="128" y2="50" />
        <line x1="119" y1="56" x2="129" y2="57" />
        <line x1="118" y1="58" x2="127" y2="64" />
      </g>
      
      {/* 핑크 볼터치 */}
      <circle cx="104" cy="58" r="4.5" fill="#f43f5e" opacity="0.75" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🌊 신비한 바다속 탐험 데이터 (8종 바다 생물)
// ═════════════════════════════════════════════════════════════════════════════
const OCEAN_CREATURES = [
  {
    id: 'fish', name: '물고기', icon: '🐟', title: '니모 열대어',
    color: '#f97316', bg: '#ffedd5',
    soundText: '뻐끔뻐끔~ 주황빛 귀여운 아기 물고기!',
    left: 20, top: 40, size: 100, swimDelay: 0
  },
  {
    id: 'octopus', name: '문어', icon: '🐙', title: '뽀글 문어',
    color: '#ec4899', bg: '#fce7f3',
    soundText: '뽀글뽀글~ 다리 여덟 개 말랑말랑 문어!',
    left: 68, top: 58, size: 110, swimDelay: 1.2
  },
  {
    id: 'crab', name: '게', icon: '🦀', title: '꽃게',
    color: '#ef4444', bg: '#fee2e2',
    soundText: '찰칵찰칵~ 옆으로 걷는 집게발 꽃게!',
    left: 12, top: 82, size: 95, swimDelay: 0.6
  },
  {
    id: 'turtle', name: '거북이', icon: '🐢', title: '바다거북',
    color: '#10b981', bg: '#d1fae5',
    soundText: '느릿느릿~ 푸른 바다를 둥실 헤엄치는 거북이!',
    left: 45, top: 20, size: 115, swimDelay: 2.1
  },
  {
    id: 'whale', name: '고래', icon: '🐳', title: '파랑고래',
    color: '#0284c7', bg: '#e0f2fe',
    soundText: '뿌우우~~ 등에서 시원한 물을 뿜는 거대 파랑고래!',
    left: 78, top: 22, size: 135, swimDelay: 1.8
  },
  {
    id: 'shark', name: '상어', icon: '🦈', title: '아기상어',
    color: '#3b82f6', bg: '#dbeafe',
    soundText: '뚜루루뚜루~ 멋진 지느러미 아기상어!',
    left: 40, top: 62, size: 125, swimDelay: 0.9
  },
  {
    id: 'squid', name: '오징어', icon: '🦑', title: '화살오징어',
    color: '#f43f5e', bg: '#ffe4e6',
    soundText: '슝슝~ 바다속을 재빠르게 헤엄치는 오징어!',
    left: 88, top: 80, size: 95, swimDelay: 1.5
  },
  {
    id: 'seal', name: '물개', icon: '🦭', title: '아기물개',
    color: '#64748b', bg: '#f1f5f9',
    soundText: '앙앙~! 짝짜꿍 박수 치는 귀여운 물개!',
    left: 26, top: 16, size: 105, swimDelay: 2.4
  }
];

// ═════════════════════════════════════════════════════════════════════════════
// 🧩 4조각 아기 퍼즐 데이터 (8종 퍼즐 테마)
// ═════════════════════════════════════════════════════════════════════════════
const BABY_PUZZLES = [
  { id: 'dog', name: '강아지', icon: '🐶', label: '🐶 강아지 얼굴', color: '#f97316', bg: '#fff7ed', desc: '사랑스러운 멍멍이 강아지' },
  { id: 'cat', name: '고양이', icon: '🐱', label: '🐱 고양이 얼굴', color: '#ec4899', bg: '#fdf2f8', desc: '초롱초롱 야옹이 고양이' },
  { id: 'lion', name: '사자', icon: '🦁', label: '🦁 사자 얼굴', color: '#d97706', bg: '#fefce8', desc: '멋진 갈기털 밀림의 왕 사자' },
  { id: 'rabbit', name: '토끼', icon: '🐰', label: '🐰 토끼 얼굴', color: '#f43f5e', bg: '#fff1f2', desc: '쫑긋한 분홍 귀 깡충 토끼' },
  { id: 'bear', name: '곰돌이', icon: '🐻', label: '🐻 곰돌이 얼굴', color: '#b45309', bg: '#fef3c7', desc: '포근한 꿀단지 아기 곰돌이' },
  { id: 'panda', name: '판다', icon: '🐼', label: '🐼 판다 얼굴', color: '#0f172a', bg: '#f8fafc', desc: '귀여운 눈 패치 흑백 판다' },
  { id: 'frog', name: '개구리', icon: '🐸', label: '🐸 개구리 얼굴', color: '#16a34a', bg: '#f0fdf4', desc: '초롱초롱 왕눈이 개구리' },
  { id: 'apple', name: '빨간 사과', icon: '🍎', label: '🍎 빨간 사과', color: '#dc2626', bg: '#fee2e2', desc: '새콤달콤 싱싱한 빨간 사과' }
];

// 🧩 퍼즐 300x300 고화질 벡터 아트워크 그룹 (단일 루트 SVG에서 1/4 조각으로 완벽 분할)
function PuzzleArtworkG({ id }) {
  if (id === 'dog') {
    return (
      <g>
        <circle cx="150" cy="150" r="130" fill="#fed7aa" stroke="#ea580c" strokeWidth="6" />
        <ellipse cx="60" cy="110" rx="35" ry="70" fill="#c2410c" transform="rotate(-15 60 110)" />
        <ellipse cx="240" cy="110" rx="35" ry="70" fill="#c2410c" transform="rotate(15 240 110)" />
        <ellipse cx="110" cy="130" rx="28" ry="32" fill="#ea580c" opacity="0.35" />
        <circle cx="110" cy="130" r="14" fill="#1e293b" /><circle cx="114" cy="126" r="5" fill="#ffffff" />
        <circle cx="190" cy="130" r="14" fill="#1e293b" /><circle cx="194" cy="126" r="5" fill="#ffffff" />
        <ellipse cx="150" cy="175" rx="42" ry="32" fill="#ffedd5" />
        <ellipse cx="150" cy="165" rx="16" ry="12" fill="#0f172a" />
        <circle cx="146" cy="163" r="3.5" fill="#ffffff" />
        <path d="M 132 182 Q 150 196 168 182" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M 142 188 Q 150 216 158 188 Z" fill="#f43f5e" />
        <circle cx="95" cy="170" r="16" fill="#fca5a5" opacity="0.7" />
        <circle cx="205" cy="170" r="16" fill="#fca5a5" opacity="0.7" />
        <path d="M 90 260 Q 150 280 210 260" stroke="#ef4444" strokeWidth="16" strokeLinecap="round" fill="none" />
        <circle cx="150" cy="275" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
      </g>
    );
  }
  if (id === 'cat') {
    return (
      <g>
        <polygon points="50,110 80,20 130,80" fill="#f472b6" stroke="#db2777" strokeWidth="6" strokeLinejoin="round" />
        <polygon points="65,95 85,38 120,78" fill="#fbcfe8" />
        <polygon points="250,110 220,20 170,80" fill="#f472b6" stroke="#db2777" strokeWidth="6" strokeLinejoin="round" />
        <polygon points="235,95 215,38 180,78" fill="#fbcfe8" />
        <circle cx="150" cy="160" r="120" fill="#fdf2f8" stroke="#db2777" strokeWidth="6" />
        <ellipse cx="105" cy="145" rx="18" ry="24" fill="#10b981" /><ellipse cx="105" cy="145" rx="6" ry="20" fill="#064e3b" /><circle cx="110" cy="138" r="4.5" fill="#ffffff" />
        <ellipse cx="195" cy="145" rx="18" ry="24" fill="#10b981" /><ellipse cx="195" cy="145" rx="6" ry="20" fill="#064e3b" /><circle cx="200" cy="138" r="4.5" fill="#ffffff" />
        <polygon points="150,185 140,172 160,172" fill="#f43f5e" />
        <line x1="40" y1="170" x2="95" y2="175" stroke="#db2777" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="35" y1="190" x2="95" y2="185" stroke="#db2777" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="260" y1="170" x2="205" y2="175" stroke="#db2777" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="265" y1="190" x2="205" y2="185" stroke="#db2777" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 134 195 Q 142 208 150 196 Q 158 208 166 195" stroke="#831843" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="85" cy="180" r="15" fill="#fbcfe8" />
        <circle cx="215" cy="180" r="15" fill="#fbcfe8" />
      </g>
    );
  }
  if (id === 'lion') {
    return (
      <g>
        <circle cx="150" cy="150" r="135" fill="#d97706" stroke="#b45309" strokeWidth="6" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <path key={deg} d="M 150 15 L 165 40 L 135 40 Z" fill="#b45309" transform={`rotate(${deg} 150 150)`} />
        ))}
        <circle cx="150" cy="150" r="95" fill="#fef08a" stroke="#b45309" strokeWidth="5" />
        <circle cx="85" cy="80" r="24" fill="#b45309" /><circle cx="85" cy="80" r="12" fill="#fed7aa" />
        <circle cx="215" cy="80" r="24" fill="#b45309" /><circle cx="215" cy="80" r="12" fill="#fed7aa" />
        <circle cx="115" cy="135" r="13" fill="#451a03" /><circle cx="118" cy="131" r="4.5" fill="#ffffff" />
        <circle cx="185" cy="135" r="13" fill="#451a03" /><circle cx="188" cy="131" r="4.5" fill="#ffffff" />
        <ellipse cx="150" cy="180" rx="38" ry="26" fill="#ffffff" opacity="0.95" />
        <polygon points="150,175 136,158 164,158" fill="#78350f" />
        <path d="M 134 185 Q 150 200 166 185" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  if (id === 'rabbit') {
    return (
      <g>
        <ellipse cx="105" cy="70" rx="26" ry="65" fill="#ffffff" stroke="#f43f5e" strokeWidth="5" transform="rotate(-8 105 70)" />
        <ellipse cx="105" cy="70" rx="14" ry="48" fill="#fda4af" transform="rotate(-8 105 70)" />
        <ellipse cx="195" cy="70" rx="26" ry="65" fill="#ffffff" stroke="#f43f5e" strokeWidth="5" transform="rotate(8 195 70)" />
        <ellipse cx="195" cy="70" rx="14" ry="48" fill="#fda4af" transform="rotate(8 195 70)" />
        <circle cx="150" cy="175" r="105" fill="#ffffff" stroke="#f43f5e" strokeWidth="5" />
        <circle cx="110" cy="160" r="15" fill="#e11d48" /><circle cx="114" cy="155" r="5" fill="#ffffff" /><circle cx="107" cy="165" r="2.5" fill="#ffffff" />
        <circle cx="190" cy="160" r="15" fill="#e11d48" /><circle cx="194" cy="155" r="5" fill="#ffffff" /><circle cx="187" cy="165" r="2.5" fill="#ffffff" />
        <polygon points="150,190 140,178 160,178" fill="#fb7185" />
        <rect x="141" y="196" width="8" height="12" rx="2" fill="#ffffff" stroke="#e11d48" strokeWidth="1.5" />
        <rect x="151" y="196" width="8" height="12" rx="2" fill="#ffffff" stroke="#e11d48" strokeWidth="1.5" />
        <circle cx="85" cy="188" r="18" fill="#fecdd3" />
        <circle cx="215" cy="188" r="18" fill="#fecdd3" />
      </g>
    );
  }
  if (id === 'bear') {
    return (
      <g>
        <circle cx="75" cy="75" r="36" fill="#854d0e" stroke="#713f12" strokeWidth="5" />
        <circle cx="75" cy="75" r="18" fill="#fed7aa" />
        <circle cx="225" cy="75" r="36" fill="#854d0e" stroke="#713f12" strokeWidth="5" />
        <circle cx="225" cy="75" r="18" fill="#fed7aa" />
        <circle cx="150" cy="165" r="115" fill="#ca8a04" stroke="#713f12" strokeWidth="5" />
        <circle cx="112" cy="145" r="13" fill="#3e2723" /><circle cx="115" cy="141" r="4.5" fill="#ffffff" />
        <circle cx="188" cy="145" r="13" fill="#3e2723" /><circle cx="191" cy="141" r="4.5" fill="#ffffff" />
        <ellipse cx="150" cy="190" rx="46" ry="34" fill="#fef08a" />
        <ellipse cx="150" cy="178" rx="16" ry="12" fill="#3e2723" />
        <path d="M 132 198 Q 150 214 168 198" stroke="#3e2723" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <circle cx="85" cy="180" r="16" fill="#fca5a5" opacity="0.6" />
        <circle cx="215" cy="180" r="16" fill="#fca5a5" opacity="0.6" />
      </g>
    );
  }
  if (id === 'panda') {
    return (
      <g>
        <circle cx="70" cy="70" r="38" fill="#0f172a" />
        <circle cx="230" cy="70" r="38" fill="#0f172a" />
        <circle cx="150" cy="165" r="115" fill="#ffffff" stroke="#0f172a" strokeWidth="6" />
        <ellipse cx="105" cy="145" rx="28" ry="22" fill="#0f172a" transform="rotate(-20 105 145)" />
        <ellipse cx="195" cy="145" rx="28" ry="22" fill="#0f172a" transform="rotate(20 195 145)" />
        <circle cx="108" cy="145" r="10" fill="#ffffff" /><circle cx="109" cy="144" r="5" fill="#0f172a" /><circle cx="111" cy="142" r="2.5" fill="#ffffff" />
        <circle cx="192" cy="145" r="10" fill="#ffffff" /><circle cx="191" cy="144" r="5" fill="#0f172a" /><circle cx="189" cy="142" r="2.5" fill="#ffffff" />
        <ellipse cx="150" cy="180" rx="14" ry="10" fill="#0f172a" />
        <path d="M 136 195 Q 150 210 164 195" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="85" cy="185" r="16" fill="#fbcfe8" />
        <circle cx="215" cy="185" r="16" fill="#fbcfe8" />
      </g>
    );
  }
  if (id === 'frog') {
    return (
      <g>
        <circle cx="90" cy="85" r="45" fill="#22c55e" stroke="#15803d" strokeWidth="5" />
        <circle cx="210" cy="85" r="45" fill="#22c55e" stroke="#15803d" strokeWidth="5" />
        <circle cx="90" cy="85" r="26" fill="#ffffff" /><circle cx="93" cy="85" r="14" fill="#0f172a" /><circle cx="98" cy="80" r="5" fill="#ffffff" />
        <circle cx="210" cy="85" r="26" fill="#ffffff" /><circle cx="207" cy="85" r="14" fill="#0f172a" /><circle cx="212" cy="80" r="5" fill="#ffffff" />
        <ellipse cx="150" cy="175" rx="125" ry="95" fill="#22c55e" stroke="#15803d" strokeWidth="5" />
        <ellipse cx="150" cy="195" rx="75" ry="55" fill="#a7f3d0" />
        <circle cx="140" cy="155" r="4" fill="#15803d" />
        <circle cx="160" cy="155" r="4" fill="#15803d" />
        <path d="M 75 175 Q 150 240 225 175" stroke="#065f46" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="75" cy="175" r="18" fill="#fca5a5" />
        <circle cx="225" cy="175" r="18" fill="#fca5a5" />
      </g>
    );
  }
  // Default: apple
  return (
    <g>
      <path d="M 150 75 Q 165 30 175 20" stroke="#78350f" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M 160 45 Q 210 25 210 65 Q 175 75 160 45 Z" fill="#22c55e" stroke="#15803d" strokeWidth="4" />
      <path d="M 150 85 C 95 65 35 110 45 185 C 55 255 120 280 150 270 C 180 280 245 255 255 185 C 265 110 205 65 150 85 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="6" />
      <path d="M 75 120 Q 95 105 110 120" stroke="#fca5a5" strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="115" cy="175" r="11" fill="#450a0a" /><circle cx="118" cy="172" r="3.5" fill="#ffffff" />
      <circle cx="185" cy="175" r="11" fill="#450a0a" /><circle cx="188" cy="172" r="3.5" fill="#ffffff" />
      <path d="M 135 195 Q 150 210 165 195" stroke="#450a0a" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <circle cx="95" cy="195" r="14" fill="#fecdd3" opacity="0.8" />
      <circle cx="205" cy="195" r="14" fill="#fecdd3" opacity="0.8" />
    </g>
  );
}

// 4개 슬롯의 viewBox 설정 (0:좌상, 1:우상, 2:좌하, 3:우하)
const PUZZLE_QUAD_VIEWBOX = [
  '0 0 150 150',      // Quad 0: Top-Left
  '150 0 150 150',    // Quad 1: Top-Right
  '0 150 150 150',    // Quad 2: Bottom-Left
  '150 150 150 150'   // Quad 3: Bottom-Right
];

const PUZZLE_QUAD_LABELS = ['1. 왼쪽 위', '2. 오른쪽 위', '3. 왼쪽 아래', '4. 오른쪽 아래'];

// =============================================================================
// 🎹 1. 퐁퐁 실로폰 & 동물 합창단 상수 및 컴포넌트
// =============================================================================
const XYLOPHONE_KEYS = [
  { id: 'c4', note: '도', solfege: 'C', freq: 261.63, color: '#ef4444', border: '#b91c1c', bg: '#fee2e2', height: '100%' },
  { id: 'd4', note: '레', solfege: 'D', freq: 293.66, color: '#f97316', border: '#c2410c', bg: '#ffedd5', height: '94%' },
  { id: 'e4', note: '미', solfege: 'E', freq: 329.63, color: '#eab308', border: '#a16207', bg: '#fef9c3', height: '88%' },
  { id: 'f4', note: '파', solfege: 'F', freq: 349.23, color: '#22c55e', border: '#15803d', bg: '#dcfce7', height: '82%' },
  { id: 'g4', note: '솔', solfege: 'G', freq: 392.00, color: '#06b6d4', border: '#0e7490', bg: '#cffafe', height: '76%' },
  { id: 'a4', note: '라', solfege: 'A', freq: 440.00, color: '#3b82f6', border: '#1d4ed8', bg: '#dbeafe', height: '70%' },
  { id: 'b4', note: '시', solfege: 'B', freq: 493.88, color: '#8b5cf6', border: '#6d28d9', bg: '#ede9fe', height: '64%' },
  { id: 'c5', note: '높은도', solfege: 'C5', freq: 523.25, color: '#ec4899', border: '#be185d', bg: '#fce7f3', height: '58%' }
];

const CHOIR_MODES = [
  { id: 'xylophone', label: '맑은 실로폰 🔔', icon: '🔔', color: '#f59e0b', sub: '영롱한 글로켄슈필' },
  { id: 'dog', label: '멍멍이 합창단 🐶', icon: '🐶', color: '#d97706', sub: '통통 튀는 멍멍 음계' },
  { id: 'cat', label: '야옹이 합창단 🐱', icon: '🐱', color: '#ec4899', sub: '다정한 야옹 음계' },
  { id: 'frog', label: '개구리 합창단 🐸', icon: '🐸', color: '#16a34a', sub: '개굴개굴 뜀박질' }
];

const SONG_TUTORIALS = [
  { id: 'free', title: '자유 연주 🎵', notes: [] },
  { id: 'star', title: '⭐ 반짝반짝 작은별', notes: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0] },
  { id: 'airplane', title: '✈️ 비행기', notes: [2, 1, 0, 1, 2, 2, 2, 1, 1, 1, 2, 4, 4] },
  { id: 'rabbit', title: '🐰 산토끼', notes: [4, 2, 2, 4, 2, 0, 1, 2, 1, 0] }
];

function XylophoneChoirView() {
  const [instrument, setInstrument] = useState('xylophone');
  const [activeKeyId, setActiveKeyId] = useState(null);
  const [jumpAnimalIdx, setJumpAnimalIdx] = useState(null);
  const [songIdx, setSongIdx] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [particles, setParticles] = useState([]);

  // 실제 동물 소리 MP3 버퍼 사전 로드 (지연 0초 보장)
  useEffect(() => {
    audioEngine.preloadChoirBuffers();
  }, []);

  const currentSong = SONG_TUTORIALS[songIdx];
  const targetKeyIndex = currentSong.notes.length > 0 ? currentSong.notes[tutorialStep] : null;

  const handleKeyPress = (key, index) => {
    audioEngine.playChoirNote(instrument, key.freq);
    setActiveKeyId(key.id);
    setJumpAnimalIdx(index % 4);

    // 파티클 생성
    const symbols = ['♪', '♫', '⭐', '💖', '✨', '🌸'];
    const newParticle = {
      id: Date.now() + Math.random(),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      color: key.color,
      left: `${(index / 8) * 85 + 8}%`
    };
    setParticles(prev => [...prev.slice(-15), newParticle]);

    setTimeout(() => setActiveKeyId(null), 180);
    setTimeout(() => setJumpAnimalIdx(null), 350);

    // 멜로디 튜토리얼 진행
    if (targetKeyIndex !== null) {
      if (index === targetKeyIndex) {
        if (tutorialStep + 1 >= currentSong.notes.length) {
          audioEngine.playFanfare();
          setTutorialStep(0);
        } else {
          setTutorialStep(prev => prev + 1);
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* 상단 컨트롤 바 (악기 모드 & 곡 선택) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
        background: '#ffffff', padding: '12px 18px', borderRadius: '24px', border: '3px solid #fed7aa',
        boxShadow: '0 6px 16px rgba(249, 115, 22, 0.12)'
      }}>
        {/* 음색 선택 탭 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CHOIR_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                setInstrument(mode.id);
                audioEngine.playFreq(600, 'sine', 0.1);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '16px',
                border: instrument === mode.id ? `3px solid ${mode.color}` : '2px solid #e2e8f0',
                background: instrument === mode.id ? mode.color : '#f8fafc',
                color: instrument === mode.id ? '#ffffff' : '#475569',
                fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer',
                transform: instrument === mode.id ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.15s ease'
              }}
            >
              <span>{mode.icon}</span> {mode.label}
            </button>
          ))}
        </div>

        {/* 멜로디 가이드 곡 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#7c2d12' }}>📖 멜로디 가이드:</span>
          {SONG_TUTORIALS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setSongIdx(idx);
                setTutorialStep(0);
                audioEngine.playPopSound();
              }}
              style={{
                padding: '6px 12px', borderRadius: '14px',
                border: songIdx === idx ? '2.5px solid #ea580c' : '1.5px solid #fed7aa',
                background: songIdx === idx ? '#ffedd5' : '#ffffff',
                color: songIdx === idx ? '#c2410c' : '#78350f',
                fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* 동물 합창단 무대 */}
      <div style={{
        flex: 1, minHeight: '140px', maxHeight: '200px',
        background: 'linear-gradient(180deg, #fef3c7 0%, #ffedd5 100%)',
        borderRadius: '24px', border: '3.5px solid #fbbf24',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        padding: '10px 20px', position: 'relative', overflow: 'hidden'
      }}>
        {/* 파티클 애니메이션 */}
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute', bottom: '20px', left: p.left,
              fontSize: '2rem', color: p.color, pointerEvents: 'none',
              animation: 'choirFloat 1s forwards ease-out'
            }}
          >
            {p.symbol}
          </div>
        ))}

        {/* 4마리 합창단 동물들 */}
        {[
          { icon: '🐶', name: '바둑이', color: '#f59e0b' },
          { icon: '🐱', name: '나비', color: '#ec4899' },
          { icon: '🐸', name: '개구리', color: '#16a34a' },
          { icon: '🐻', name: '곰돌이', color: '#92400e' }
        ].map((animal, aIdx) => {
          const isJumping = jumpAnimalIdx === aIdx;
          return (
            <div
              key={animal.name}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transform: isJumping ? 'translateY(-28px) scale(1.18)' : 'translateY(0) scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <div style={{
                fontSize: isJumping ? '4.8rem' : '4rem', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.15))',
                animation: isJumping ? 'choirSing 0.3s ease' : 'none'
              }}>
                {animal.icon}
              </div>
              <span style={{
                background: isJumping ? animal.color : '#ffffff',
                color: isJumping ? '#ffffff' : '#78350f',
                padding: '2px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 900,
                border: `2px solid ${animal.color}`, marginTop: '-4px'
              }}>
                {animal.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* 8음계 실로폰 건반 영역 */}
      <div style={{
        height: '240px', background: '#334155', borderRadius: '28px',
        padding: '16px 20px', border: '5px solid #1e293b',
        boxShadow: 'inset 0 6px 14px rgba(0,0,0,0.35), 0 15px 30px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
      }}>
        {XYLOPHONE_KEYS.map((key, kIdx) => {
          const isActive = activeKeyId === key.id;
          const isTarget = targetKeyIndex === kIdx;

          return (
            <button
              key={key.id}
              onClick={() => handleKeyPress(key, kIdx)}
              style={{
                flex: 1, height: key.height,
                background: isActive
                  ? `linear-gradient(180deg, #ffffff 0%, ${key.color} 100%)`
                  : `linear-gradient(180deg, ${key.color} 0%, ${key.border} 100%)`,
                borderRadius: '16px', border: `3.5px solid ${isTarget ? '#ffffff' : key.border}`,
                boxShadow: isActive
                  ? `0 2px 4px rgba(0,0,0,0.4), 0 0 24px ${key.color}`
                  : `0 8px 16px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.4)`,
                transform: isActive ? 'translateY(6px) scale(0.97)' : isTarget ? 'translateY(-6px) scale(1.02)' : 'none',
                transition: 'transform 0.08s ease, box-shadow 0.08s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 4px', cursor: 'pointer', position: 'relative'
              }}
            >
              {/* 상단 은색 못 */}
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />

              {/* 반짝이 타겟 표시 */}
              {isTarget && (
                <div style={{
                  position: 'absolute', top: '-18px', background: '#facc15', color: '#78350f',
                  fontSize: '0.75rem', fontWeight: 900, padding: '2px 6px', borderRadius: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.25)', animation: 'bounce 0.8s infinite'
                }}>
                  콕! 👇
                </div>
              )}

              {/* 건반 음계 라벨 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
                  {key.note}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', opacity: 0.85 }}>
                  {key.solfege}
                </span>
              </div>

              {/* 하단 은색 못 */}
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 🌙 2. 동물 친구들 코 잘 시간 (수면 유도 & 자장가 모드) 컴포넌트
// =============================================================================
// =============================================================================
// 🌙 2. 동물 친구들 코 잘 시간 (실제 누워있는 동물 & 실제 이불 드래그 덮어주기)
// =============================================================================
const SLEEP_ANIMAL_DATA = [
  {
    id: 'rabbit',
    name: '아기 토끼',
    icon: '🐰',
    // 🐰 실제 포근하게 엎드려 기대어 누워있는 아기 토끼 고화질 실사
    realImg: 'https://images.pexels.com/photos/372166/pexels-photo-372166.jpeg?auto=compress&cs=tinysrgb&w=600',
    imgPos: 'center 40%',
    bedColor: '#fdf2f8',
    bedBorder: '#ec4899',
    blanketId: 'blanket-rabbit',
    blanketName: '벚꽃 퀼팅 이불',
    blanketColor: '#f472b6',
    blanketClass: 'quilt-fabric-pink',
    blanketBorder: '#db2777',
    blanketEmoji: '🌸',
    tagText: '토끼용 🌸 벚꽃 퀼팅',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)'
  },
  {
    id: 'dog',
    name: '아기 강아지',
    icon: '🐶',
    // 🐶 침대 담요 위에서 앞발을 모으고 편안히 누워있는 아기 강아지 고화질 실사
    realImg: 'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=600',
    imgPos: 'center 35%',
    bedColor: '#eff6ff',
    bedBorder: '#0284c7',
    blanketId: 'blanket-dog',
    blanketName: '별빛 순면 이불',
    blanketColor: '#60a5fa',
    blanketClass: 'quilt-fabric-blue',
    blanketBorder: '#1d4ed8',
    blanketEmoji: '🦴',
    tagText: '강아지용 🦴 별빛 퀼팅',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)'
  },
  {
    id: 'cat',
    name: '아기 고양이',
    icon: '🐱',
    // 🐱 침대 위에서 뺨을 베개에 기대고 새근새근 누워있는 아기 고양이 고화질 실사
    realImg: 'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=600',
    imgPos: 'center 30%',
    bedColor: '#fefce8',
    bedBorder: '#d97706',
    blanketId: 'blanket-cat',
    blanketName: '허니 퀼팅 이불',
    blanketColor: '#fbbf24',
    blanketClass: 'quilt-fabric-yellow',
    blanketBorder: '#b45309',
    blanketEmoji: '🍯',
    tagText: '고양이용 🍯 꿀단지 퀼팅',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
  }
];

function BedtimeSleepView() {
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [animalStates, setAnimalStates] = useState({
    rabbit: { hasBlanket: false, blanketData: null, isAsleep: false, pats: 0, yawn: false },
    dog: { hasBlanket: false, blanketData: null, isAsleep: false, pats: 0, yawn: false },
    cat: { hasBlanket: false, blanketData: null, isAsleep: false, pats: 0, yawn: false }
  });
  const [isLullabyOn, setIsLullabyOn] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [animatingCoverId, setAnimatingCoverId] = useState(null);

  // 🛏️ 실제 이불 드래그 앤 드롭 상태 관리
  const [draggingBlanket, setDraggingBlanket] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [hoverBedId, setHoverBedId] = useState(null);

  // 침대 엘리먼트 참조 (충돌 감지용)
  const bedRefs = useRef({});

  // 불 끄기/켜기 토글
  const toggleLights = () => {
    const nextState = !isLightsOff;
    setIsLightsOff(nextState);
    if (nextState) {
      audioEngine.startLullaby();
      setIsLullabyOn(true);
      speakNaturalKorean('모두 불을 끄고 코 잘 시간이에요. 잘 자렴, 좋은 꿈 꿔~', { pitch: 1.12, rate: 0.88 });
    } else {
      audioEngine.stopLullaby();
      setIsLullabyOn(false);
      audioEngine.playFreq(700, 'triangle', 0.15);
    }
  };

  const toggleLullabyOnly = () => {
    if (isLullabyOn) {
      audioEngine.stopLullaby();
      setIsLullabyOn(false);
    } else {
      audioEngine.startLullaby();
      setIsLullabyOn(true);
    }
  };

  // 동물 토닥이기
  const handlePatAnimal = (animalId) => {
    const st = animalStates[animalId];
    const newPats = st.pats + 1;
    const becomesAsleep = newPats >= 3;

    audioEngine.playMusicBox(440 + Math.random() * 200, 0.4);

    // 하트 파티클
    setHearts(prev => [...prev.slice(-10), { id: Date.now() + Math.random(), animalId }]);

    setAnimalStates(prev => ({
      ...prev,
      [animalId]: {
        ...prev[animalId],
        pats: newPats,
        isAsleep: becomesAsleep || prev[animalId].hasBlanket,
        yawn: !becomesAsleep && !prev[animalId].hasBlanket
      }
    }));

    if (becomesAsleep) {
      const animal = SLEEP_ANIMAL_DATA.find(a => a.id === animalId);
      speakNaturalKorean(`${animal.name}가 스르륵 눈을 감고 잠들었어요. 쿨쿨~`, { pitch: 1.15, rate: 0.88 });
    }
  };

  // 🛏️ 실제 동물에게 이불 덮어주기 실행
  const coverAnimalWithBlanket = (targetAnimalId, blanket) => {
    const targetAnimal = SLEEP_ANIMAL_DATA.find(a => a.id === targetAnimalId);
    if (!targetAnimal) return;

    // 사운드: 포근한 오르골 + 찰칵 피드백
    audioEngine.playMusicBox(523.25, 0.65);
    setTimeout(() => audioEngine.playMusicBox(659.25, 0.55), 100);
    setTimeout(() => audioEngine.playSnap(), 190);

    // 이불 덮기 애니메이션 발동
    setAnimatingCoverId(targetAnimalId);
    setTimeout(() => setAnimatingCoverId(null), 800);

    // 동물 상태 업데이트: 이불 덮고 편안히 수면
    setAnimalStates(prev => ({
      ...prev,
      [targetAnimalId]: {
        ...prev[targetAnimalId],
        hasBlanket: true,
        blanketData: blanket,
        isAsleep: true,
        yawn: false
      }
    }));

    // 다정한 음성 안내
    speakNaturalKorean(`${targetAnimal.name}에게 ${blanket.blanketName}을 덮어주었어요. 포근포근 잘 자렴~`, {
      pitch: 1.16,
      rate: 0.9
    });

    // 별빛 하트 생성
    setHearts(prev => [
      ...prev.slice(-10),
      { id: Date.now() + Math.random(), animalId: targetAnimalId }
    ]);
  };

  // 🛏️ 이불 개어주기
  const handleRemoveBlanket = (animalId, e) => {
    if (e) e.stopPropagation();
    audioEngine.playSnap();
    setAnimalStates(prev => ({
      ...prev,
      [animalId]: {
        ...prev[animalId],
        hasBlanket: false,
        blanketData: null
      }
    }));
  };

  // 👆 이불 드래그 시작
  const handleBlanketPointerDown = (blanket, e) => {
    e.preventDefault();
    setDraggingBlanket(blanket);
    setDragPos({ x: e.clientX, y: e.clientY });
    audioEngine.playFreq(493.88, 'triangle', 0.09, 0.4);
  };

  // 전역 포인터 추적 리스너
  useEffect(() => {
    if (!draggingBlanket) return;

    const handlePointerMove = (e) => {
      setDragPos({ x: e.clientX, y: e.clientY });

      let foundBed = null;
      for (const animal of SLEEP_ANIMAL_DATA) {
        const el = bedRefs.current[animal.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            foundBed = animal.id;
            break;
          }
        }
      }
      setHoverBedId(foundBed);
    };

    const handlePointerUp = () => {
      if (hoverBedId) {
        coverAnimalWithBlanket(hoverBedId, draggingBlanket);
      }
      setDraggingBlanket(null);
      setHoverBedId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingBlanket, hoverBedId]);

  const allSleeping = Object.values(animalStates).every(st => st.isAsleep && st.hasBlanket);

  useEffect(() => {
    return () => {
      audioEngine.stopLullaby();
    };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: isLightsOff
        ? 'linear-gradient(180deg, #070a12 0%, #111827 50%, #1e1b4b 100%)'
        : 'linear-gradient(180deg, #e0e7ff 0%, #fef3c7 60%, #fed7aa 100%)',
      borderRadius: '28px', padding: '1.2rem', position: 'relative',
      transition: 'background 0.8s ease', overflow: 'hidden', userSelect: 'none'
    }}>
      {/* 밤하늘 별빛 이펙트 */}
      {isLightsOff && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${(i * 17) % 88}%`, left: `${(i * 23) % 96}%`,
                fontSize: i % 2 === 0 ? '1rem' : '1.3rem', color: '#fef08a',
                animation: `twinkle ${(i % 3) + 1.5}s infinite ease-in-out`
              }}
            >
              ★
            </div>
          ))}
        </div>
      )}

      {/* 상단 툴바 (달님 & 전등 스위치 & 오르골 BGM 토글) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: isLightsOff ? 'rgba(17, 24, 39, 0.88)' : '#ffffff',
        backdropFilter: 'blur(10px)', padding: '10px 18px', borderRadius: '22px',
        border: isLightsOff ? '2px solid #374151' : '3px solid #fde68a',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 10, marginBottom: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2.2rem' }}>{isLightsOff ? '🌙' : '☀️'}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: isLightsOff ? '#f8fafc' : '#78350f' }}>
              {isLightsOff ? '스르륵... 코 잘 시간 🌙' : '따뜻한 낮 시간 ☀️'}
            </h3>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isLightsOff ? '#9ca3af' : '#92400e' }}>
              {allSleeping
                ? '✨ 모든 동물 친구들이 포근한 이불을 덮고 쿨쿨 잠들었어요! 좋은 꿈 꿔~'
                : '실제 이불을 손가락으로 드래그해서 동물 친구에게 덮어주세요! 🌸'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 오르골 자장가 토글 */}
          <button
            onClick={toggleLullabyOnly}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px', borderRadius: '18px',
              border: isLullabyOn ? '2.5px solid #a855f7' : '2px solid #cbd5e1',
              background: isLullabyOn ? '#f3e8ff' : '#ffffff',
              color: isLullabyOn ? '#7e22ce' : '#64748b', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer'
            }}
          >
            <Music size={18} /> {isLullabyOn ? '자장가 켜짐 🎵' : '자장가 끄기 🔇'}
          </button>

          {/* 방 조명 스위치 버튼 */}
          <button
            onClick={toggleLights}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '18px',
              border: isLightsOff ? '3px solid #facc15' : '3px solid #f59e0b',
              background: isLightsOff ? '#fef08a' : '#1e293b',
              color: isLightsOff ? '#713f12' : '#f8fafc',
              fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: isLightsOff ? '0 0 20px #fef08a' : '0 6px 14px rgba(0,0,0,0.2)'
            }}
          >
            {isLightsOff ? '💡 방 불 켜기' : '🌙 방 불 끄기 (자장가)'}
          </button>
        </div>
      </div>

      {/* 3마리 실제 동물 침실 무대 (실사 누워있는 모습 + 실제 침대/베개) */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
        alignItems: 'center', zIndex: 5
      }}>
        {SLEEP_ANIMAL_DATA.map(animal => {
          const st = animalStates[animal.id];
          const isTargeted = hoverBedId === animal.id;
          const isSnuggling = animatingCoverId === animal.id;
          const activeBlanket = st.blanketData || animal;

          return (
            <div
              key={animal.id}
              ref={el => (bedRefs.current[animal.id] = el)}
              style={{
                height: '100%', maxHeight: '350px',
                background: isLightsOff ? '#1f2937' : '#ffffff',
                borderRadius: '28px',
                border: isTargeted
                  ? '4px solid #facc15'
                  : `4px solid ${animal.bedBorder}`,
                boxShadow: isTargeted
                  ? '0 0 35px rgba(250, 204, 21, 0.85)'
                  : isLightsOff ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 24px rgba(0,0,0,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 0.9rem', position: 'relative', overflow: 'hidden',
                transform: isTargeted ? 'scale(1.03)' : 'scale(1)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* 침대 헤드보드 (따스한 원목/패브릭 프레임) */}
              <div style={{
                position: 'absolute', top: 0, left: '16px', right: '16px', height: '12px',
                background: animal.bedBorder, borderRadius: '0 0 12px 12px'
              }} />

              {/* 하트/별 팝업 파티클 */}
              {hearts.filter(h => h.animalId === animal.id).map(h => (
                <div
                  key={h.id}
                  style={{
                    position: 'absolute', top: '35px', fontSize: '2rem',
                    animation: 'choirFloat 1s forwards ease-out', pointerEvents: 'none', zIndex: 30
                  }}
                >
                  💖
                </div>
              ))}

              {/* 침대 상단 말풍선 & 가이드 */}
              <div style={{
                background: isTargeted
                  ? '#fef08a'
                  : isLightsOff ? '#374151' : animal.bedColor,
                border: isTargeted ? '2px solid #ca8a04' : `2px solid ${animal.bedBorder}`,
                borderRadius: '14px', padding: '4px 12px', fontSize: '0.85rem', fontWeight: 900,
                color: isTargeted ? '#854d0e' : isLightsOff ? '#f8fafc' : '#78350f',
                marginTop: '4px', textAlign: 'center', zIndex: 10
              }}>
                {isTargeted
                  ? '✨ 여기에 이불을 덮어주세요!'
                  : st.hasBlanket
                    ? '😴 포근포근 쿨쿨... zZ'
                    : st.yawn
                      ? '🥱 하아암~ 이불 덮어줘요'
                      : '👀 이불을 끌어다 덮어줘요!'}
              </div>

              {/* 🛏️ 실제 동물 침대 & 누워있는 실사 동물 영역 */}
              <div
                onClick={() => handlePatAnimal(animal.id)}
                title="톡톡 토닥여주거나, 아래 이불을 드래그해 덮어주세요!"
                style={{
                  width: '100%', height: '185px', borderRadius: '22px',
                  background: isLightsOff ? '#111827' : animal.bedColor,
                  border: isTargeted ? '3px dashed #eab308' : `3px solid ${animal.bedBorder}`,
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {/* 1. 상단 푹신한 하얀 오리털 베개 (Pillow Layer) */}
                <div style={{
                  position: 'absolute', top: '10px', width: '75%', height: '38px',
                  background: '#ffffff', borderRadius: '18px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', border: '2px solid #e2e8f0',
                  zIndex: 2
                }} />

                {/* 2. 실제 누워있는 아기 동물 실사 사진 (Lying Animal Photo Layer) */}
                <img
                  src={animal.realImg}
                  alt={animal.name}
                  className={st.isAsleep ? 'animal-breathing' : ''}
                  style={{
                    width: '92%', height: '155px', objectFit: 'cover',
                    objectPosition: animal.imgPos || 'center 35%',
                    borderRadius: '18px',
                    filter: st.isAsleep
                      ? 'brightness(0.92) contrast(1.04) saturate(0.95)'
                      : 'brightness(1) contrast(1)',
                    boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
                    zIndex: 3, transition: 'all 0.4s ease'
                  }}
                />

                {/* 잠잘 때 머리맡 zZ 수면 이펙트 */}
                {st.isAsleep && (
                  <div
                    className="sleep-zz-anim"
                    style={{
                      position: 'absolute', top: '8px', right: '14px',
                      fontSize: '1.6rem', fontWeight: 900, color: '#c084fc',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: 25
                    }}
                  >
                    zZ
                  </div>
                )}

                {/* 3. 🛏️ 실제 덮여진 퀼팅 이불 (동물의 몸을 덮고 얼굴만 쏙 내놓음) */}
                {st.hasBlanket && (
                  <div
                    className={`${activeBlanket.blanketClass || ''} ${isSnuggling ? 'blanket-snuggle-anim' : ''}`}
                    style={{
                      position: 'absolute', bottom: '0', left: '4%', right: '4%', height: '62%',
                      borderTop: '5px solid #ffffff',
                      borderRadius: '8px 8px 18px 18px',
                      boxShadow: '0 -6px 16px rgba(0,0,0,0.22), inset 0 2px 6px rgba(255,255,255,0.4)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      zIndex: 10, overflow: 'hidden'
                    }}
                  >
                    {/* 상단 화이트 퀼팅 접힘 깃 (Folded rim) */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '14px',
                      background: 'rgba(255, 255, 255, 0.92)',
                      borderBottom: '2px dashed rgba(0, 0, 0, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#475569', letterSpacing: '1px' }}>
                        SNUGGLE QUILT
                      </span>
                    </div>

                    {/* 이불 중앙 자수 라벨 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(255,255,255,0.85)', padding: '4px 12px',
                      borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      marginTop: '10px'
                    }}>
                      <span style={{ fontSize: '1.3rem' }}>{activeBlanket.blanketEmoji}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1e293b' }}>
                        {activeBlanket.blanketName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 하단 버튼 바: 토닥이기 & 이불 걷기 */}
              <div style={{ display: 'flex', width: '100%', gap: '8px', zIndex: 10, marginTop: '8px' }}>
                {st.hasBlanket ? (
                  <button
                    onClick={(e) => handleRemoveBlanket(animal.id, e)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '14px', border: 'none',
                      background: '#f1f5f9', color: '#64748b',
                      fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    이불 개기 🛏️
                  </button>
                ) : (
                  <div style={{
                    flex: 1, padding: '7px', borderRadius: '14px',
                    background: isLightsOff ? '#111827' : '#f8fafc',
                    border: `1.5px dashed ${animal.bedBorder}`,
                    color: isLightsOff ? '#9ca3af' : '#78350f',
                    fontSize: '0.78rem', fontWeight: 800, textAlign: 'center'
                  }}>
                    이불을 끌어다 덮어줘요 👆
                  </div>
                )}

                <button
                  onClick={() => handlePatAnimal(animal.id)}
                  style={{
                    padding: '7px 12px', borderRadius: '14px', border: `2px solid ${animal.bedBorder}`,
                    background: isLightsOff ? '#111827' : '#ffffff',
                    color: isLightsOff ? '#f8fafc' : animal.bedBorder,
                    fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >
                  토닥토닥 ({st.pats}/3)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🧺 하단: 실제 퀼팅 이불 바구니 / 선반 */}
      <div style={{
        marginTop: '0.8rem', background: isLightsOff ? 'rgba(17, 24, 39, 0.88)' : '#ffffff',
        backdropFilter: 'blur(10px)', borderRadius: '24px', padding: '12px 20px',
        border: isLightsOff ? '2px solid #374151' : '3px solid #fed7aa',
        boxShadow: '0 8px 24px rgba(249, 115, 22, 0.12)', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧺</span>
            <span style={{ fontSize: '0.98rem', fontWeight: 900, color: isLightsOff ? '#f8fafc' : '#7c2d12' }}>
              포근한 실제 퀼팅 이불 바구니
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isLightsOff ? '#9ca3af' : '#ea580c' }}>
              (이불을 손가락으로 꾹 눌러서 동물 침대로 끌어올려 덮어주세요!)
            </span>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f59e0b' }}>
            {Object.values(animalStates).filter(s => s.hasBlanket).length} / 3 덮음 ✨
          </span>
        </div>

        {/* 3장의 실제 퀼팅 이불 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {SLEEP_ANIMAL_DATA.map(item => {
            const isUsed = animalStates[item.id].hasBlanket;

            return (
              <div
                key={item.blanketId}
                onPointerDown={(e) => {
                  if (!isUsed) handleBlanketPointerDown(item, e);
                }}
                className={`${!isUsed ? 'blanket-ready-wiggle' : ''} ${item.blanketClass || ''}`}
                style={{
                  borderRadius: '20px', padding: '10px 14px',
                  border: isUsed ? '2px dashed #94a3b8' : `3px solid #ffffff`,
                  boxShadow: isUsed ? 'none' : '0 6px 18px rgba(0,0,0,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: isUsed ? 'default' : 'grab',
                  touchAction: 'none',
                  opacity: isUsed ? 0.5 : 1,
                  transform: isUsed ? 'scale(0.96)' : 'scale(1)',
                  transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden'
                }}
              >
                {/* 상단 화이트 깃 디테일 */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
                  background: 'rgba(255,255,255,0.75)'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 2 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.85)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}>
                    {item.blanketEmoji}
                  </div>
                  <div>
                    <div style={{
                      fontWeight: 900, fontSize: '0.92rem',
                      color: '#ffffff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.45)'
                    }}>
                      {item.blanketName}
                    </div>
                    <div style={{
                      fontSize: '0.75rem', fontWeight: 800,
                      color: 'rgba(255,255,255,0.95)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}>
                      {item.tagText}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '5px 11px', borderRadius: '12px',
                  background: isUsed ? '#cbd5e1' : 'rgba(255,255,255,0.92)',
                  color: isUsed ? '#475569' : item.blanketBorder,
                  fontWeight: 900, fontSize: '0.78rem', zIndex: 2,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                }}>
                  {isUsed ? '덮어줌 ✅' : '드래그 👆'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🎈 드래그 중인 플로팅 실제 이불 (손가락을 따라 부드럽게 둥실 떠다님) */}
      {draggingBlanket && (
        <div
          className={draggingBlanket.blanketClass || ''}
          style={{
            position: 'fixed',
            left: `${dragPos.x - 75}px`,
            top: `${dragPos.y - 50}px`,
            width: '150px',
            height: '95px',
            border: '3.5px solid #ffffff',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.38)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 99999,
            transform: 'scale(1.1) rotate(-5deg)',
            transition: 'transform 0.05s ease',
            overflow: 'hidden'
          }}
        >
          {/* 상단 깃 접힘 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '10px',
            background: 'rgba(255,255,255,0.85)'
          }} />

          <span style={{ fontSize: '2.3rem', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.3))' }}>
            {draggingBlanket.blanketEmoji}
          </span>
          <span style={{
            fontSize: '0.85rem', fontWeight: 900, color: '#ffffff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)', marginTop: '2px'
          }}>
            {draggingBlanket.blanketName}
          </span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('animal');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIpadFrame, setIsIpadFrame] = useState(true);

  // 탭 전환 시마다 동물 및 과일/채소 카드 무작위 셔플
  const [animalItems, setAnimalItems] = useState(() => shuffleArray(REAL_ANIMALS));
  const [fruitItems, setFruitItems] = useState(() => shuffleArray(REAL_FRUITS));

  useEffect(() => {
    if (activeTab === 'animal') {
      setAnimalItems(shuffleArray(REAL_ANIMALS));
    } else if (activeTab === 'fruit') {
      setFruitItems(shuffleArray(REAL_FRUITS));
    }
  }, [activeTab]);

  const [selectedRealItem, setSelectedRealItem] = useState(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);

  // 🦁 3마리 동물 과일 먹이기 상태
  const [feedRound, setFeedRound] = useState(() => pickFeedRound());
  const [animalMoods, setAnimalMoods] = useState({}); // { [animalId]: 'hungry' | 'eating' | 'happy' | 'reject' }
  const [feedScore, setFeedScore] = useState(0);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [hoverAnimalId, setHoverAnimalId] = useState(null);
  const [rejectedAnimalId, setRejectedAnimalId] = useState(null);
  const [rejectedFood, setRejectedFood] = useState(null);

  const animalBoxRefs = useRef({});
  const isFeedBusyRef = useRef(false);
  const draggingFoodRef = useRef(null);
  const [draggingFood, setDraggingFood] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  const handleStartDragFood = (e, food) => {
    // 먹는 중이거나 피드백 중일 때 드래그 차단 (PROTECT)
    if (isFeedBusyRef.current) return;
    e.preventDefault();
    draggingFoodRef.current = food;
    setDraggingFood(food);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    setDragPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    if (!isFeedModalOpen) return;

    const handleWindowPointerMove = (e) => {
      if (!draggingFoodRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      setDragPos({ x, y });

      let currentOverId = null;
      Object.entries(animalBoxRefs.current).forEach(([id, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverId = id;
          }
        }
      });
      setHoverAnimalId(currentOverId);
    };

    const handleWindowPointerUp = (e) => {
      if (!draggingFoodRef.current) return;
      const food = draggingFoodRef.current;
      const x = e.clientX;
      const y = e.clientY;

      let currentOverId = null;
      Object.entries(animalBoxRefs.current).forEach(([id, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverId = id;
          }
        }
      });

      if (currentOverId && !isFeedBusyRef.current) {
        handleFeedAnimal(currentOverId, food);
      }

      draggingFoodRef.current = null;
      setDraggingFood(null);
      setHoverAnimalId(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isFeedModalOpen, feedRound]);

  // 🎨 물감 & 스탬프 & 따라쓰기 모드
  const [paintMode, setPaintMode] = useState('brush'); // 'brush' | 'stamp' | 'tracing'
  const [selectedStamp, setSelectedStamp] = useState(STAMP_ITEMS[0]);
  const [stamps, setStamps] = useState([]);
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

  // 🌊 바다속 탐험 상태
  const [oceanTarget, setOceanTarget] = useState(() => OCEAN_CREATURES[1]); // 기본: 문어
  const [oceanFound, setOceanFound] = useState(false);
  const [activeOceanCreatureId, setActiveOceanCreatureId] = useState(null);
  const [oceanBubbles, setOceanBubbles] = useState([]);
  const [oceanScore, setOceanScore] = useState(0);

  // 🧩 4조각 아기 퍼즐 상태 (드래그 앤 드롭 지원)
  const [puzzleTheme, setPuzzleTheme] = useState(() => BABY_PUZZLES[0]); // 기본: 강아지
  const [placedPieces, setPlacedPieces] = useState([false, false, false, false]);
  const [trayPieces, setTrayPieces] = useState(() => [2, 0, 3, 1]); // 셔플된 조각
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);

  const puzzleSlotRefs = useRef({});
  const draggingPieceRef = useRef(null);
  const [draggingPieceQuad, setDraggingPieceQuad] = useState(null);
  const [dragPiecePos, setDragPiecePos] = useState({ x: 0, y: 0 });
  const [hoverSlotIdx, setHoverSlotIdx] = useState(null);

  const handleStartDragPiece = (e, quadIdx) => {
    if (placedPieces[quadIdx] || puzzleCompleted) return;
    e.preventDefault();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    draggingPieceRef.current = quadIdx;
    setDraggingPieceQuad(quadIdx);
    setDragPiecePos({ x: clientX, y: clientY });
    audioEngine.playFreq(480, 'sine', 0.1);
  };

  useEffect(() => {
    if (activeTab !== 'puzzle') return;

    const handlePointerMove = (e) => {
      if (draggingPieceRef.current === null) return;
      const x = e.clientX;
      const y = e.clientY;
      setDragPiecePos({ x, y });

      let currentOverSlot = null;
      Object.entries(puzzleSlotRefs.current).forEach(([idxStr, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverSlot = parseInt(idxStr, 10);
          }
        }
      });
      setHoverSlotIdx(currentOverSlot);
    };

    const handlePointerUp = (e) => {
      if (draggingPieceRef.current === null) return;
      const quadIdx = draggingPieceRef.current;
      const x = e.clientX;
      const y = e.clientY;

      let currentOverSlot = null;
      Object.entries(puzzleSlotRefs.current).forEach(([idxStr, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            currentOverSlot = parseInt(idxStr, 10);
          }
        }
      });

      if (currentOverSlot === quadIdx) {
        // 올바른 사각형 슬롯에 드롭 성공!
        handleSnapPiece(quadIdx);
        // 다른 사각형 슬롯에 잘못 놓음
        audioEngine.playFreq(220, 'sawtooth', 0.2);
        playVoiceAudio('/sounds/voice/puzzle_wrong.mp3', () => {
          speakNaturalKorean('여기가 아니에요~ 제자리에 쏙 맞춰보세요!', { pitch: 1.15, rate: 0.93 });
        });
      }

      draggingPieceRef.current = null;
      setDraggingPieceQuad(null);
      setHoverSlotIdx(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [activeTab, placedPieces, puzzleTheme, puzzleCompleted]);

  // 🌊 바다속 음성 미션 (다정하고 상냥한 인준 MP3 보이스 우선 재생)
  const speakOceanMission = (creature) => {
    const subj = attachJosa(creature.name, '은/는');
    playVoiceAudio(`/sounds/voice/ocean_mission_${creature.id}.mp3`, () => {
      speakNaturalKorean(`신비한 바다속에서 ${subj} 어디 있을까요?`, { pitch: 1.16, rate: 0.92 });
    });
  };

  const generateNextOceanMission = () => {
    const nextList = OCEAN_CREATURES.filter(c => c.id !== oceanTarget.id);
    const nextTarget = nextList[Math.floor(Math.random() * nextList.length)];
    setOceanTarget(nextTarget);
    setOceanFound(false);
    setActiveOceanCreatureId(null);
    speakOceanMission(nextTarget);
  };

  const handleTapOceanCreature = (creature, e) => {
    // 거품 팝핑 파티클 생성
    const newBubbles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x: (e.nativeEvent?.offsetX || 50) + (Math.random() - 0.5) * 50,
      y: (e.nativeEvent?.offsetY || 50) + (Math.random() - 0.5) * 50,
      size: 16 + Math.random() * 24
    }));

    setOceanBubbles(prev => [...prev.slice(-30), ...newBubbles]);
    setTimeout(() => {
      setOceanBubbles(prev => prev.filter(b => !newBubbles.includes(b)));
    }, 1200);

    // 액티브 애니메이션 & 사운드
    setActiveOceanCreatureId(creature.id);
    audioEngine.playBubble();

    setTimeout(() => {
      setActiveOceanCreatureId(null);
    }, 900);

    // 정답 판정
    if (creature.id === oceanTarget.id && !oceanFound) {
      setOceanFound(true);
      setOceanScore(prev => prev + 1);
      audioEngine.playFanfare();

      const obj = attachJosa(creature.name, '을/를');
      playVoiceAudio(`/sounds/voice/ocean_found_${creature.id}.mp3`, () => {
        speakNaturalKorean(`찾았다! ${obj} 찾았어요! 정말 최고예요~ 🎉`, { pitch: 1.2, rate: 0.94 });
      });

      // 2.8초 후 다음 미션으로 자동 전환
      setTimeout(() => {
        generateNextOceanMission();
      }, 2800);
    } else if (creature.id !== oceanTarget.id) {
      speakNaturalKorean(`${creature.name}! ${creature.soundText}`, { pitch: 1.15, rate: 0.95 });
    }
  };

  const handleOceanBackgroundClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newBubbles = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      size: 14 + Math.random() * 20
    }));

    setOceanBubbles(prev => [...prev.slice(-30), ...newBubbles]);
    audioEngine.playBubble();
    setTimeout(() => {
      setOceanBubbles(prev => prev.filter(b => !newBubbles.includes(b)));
    }, 1200);
  };

  // 🧩 퍼즐 조작 핸들러
  const handleSnapPiece = (quadIdx) => {
    if (placedPieces[quadIdx]) return;
    audioEngine.playSnap();

    const updated = [...placedPieces];
    updated[quadIdx] = true;
    setPlacedPieces(updated);

    // 4조각 모두 맞췄는지 확인
    if (updated.every(Boolean)) {
      setPuzzleCompleted(true);
      setTimeout(() => {
        audioEngine.playFanfare();
        const obj = attachJosa(puzzleTheme.name, '을/를');
        playVoiceAudio(`/sounds/voice/puzzle_done_${puzzleTheme.id}.mp3`, () => {
          speakNaturalKorean(`와아! 멋진 ${obj} 퍼즐을 완성했어요! 참 잘했어요~ 🌟`, { pitch: 1.2, rate: 0.94 });
        });
      }, 300);
    }
  };

  const handleResetPuzzle = (theme) => {
    const t = theme || puzzleTheme;
    setPlacedPieces([false, false, false, false]);
    setTrayPieces([0, 1, 2, 3].sort(() => 0.5 - Math.random()));
    setPuzzleCompleted(false);
  };

  const handleSelectPuzzleTheme = (theme) => {
    setPuzzleTheme(theme);
    handleResetPuzzle(theme);
    const obj = attachJosa(theme.name, '을/를');
    playVoiceAudio(`/sounds/voice/puzzle_start_${theme.id}.mp3`, () => {
      speakNaturalKorean(`우리 ${obj} 퍼즐을 맞춰볼까요?`, { pitch: 1.16, rate: 0.93 });
    });
  };

  const handleNextPuzzleTheme = () => {
    const currentIdx = BABY_PUZZLES.findIndex(p => p.id === puzzleTheme.id);
    const nextIdx = (currentIdx + 1) % BABY_PUZZLES.length;
    handleSelectPuzzleTheme(BABY_PUZZLES[nextIdx]);
  };

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
      if (item.soundUrl) {
        audioEngine.playItemSound(item);
      } else {
        speakNaturalKorean(`맛있는 ${item.name}!`, { pitch: 1.16, rate: 0.92 });
      }
    }, 100);
  };

  const closeItemModal = () => {
    audioEngine.stopAllSounds();
    setSelectedRealItem(null);
  };

  const speakQuizQuestion = (animal) => {
    const target = typeof animal === 'string' ? REAL_ANIMALS.find(a => a.name === animal) : animal;
    const name = target?.name || animal;
    const subj = attachJosa(name, '은/는');
    if (target?.id) {
      playVoiceAudio(`/sounds/voice/quiz_${target.id}.mp3`, () => {
        speakNaturalKorean(`${subj} 누구일까요?`, { pitch: 1.16, rate: 0.92 });
      });
    } else {
      speakNaturalKorean(`${subj} 누구일까요?`, { pitch: 1.16, rate: 0.92 });
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
    speakQuizQuestion(target);
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

  // 🦁 동물 과일 먹이기 음성 안내 (인준 고음질 MP3 우선 재생 - 아이패드 100% 동일 남성 목소리)
  const speakFeedWish = (animal, food) => {
    const targetAnimal = animal || feedRound?.target;
    const targetFood = food || feedRound?.food;
    if (!targetAnimal || !targetFood) return;
    const subj = attachJosa(targetAnimal.name, '이/가');
    const obj = attachJosa(targetFood.name, '을/를');
    const audioUrl = `/sounds/voice/feed_${targetAnimal.id}_${targetFood.id}.mp3`;
    playVoiceAudio(audioUrl, () => {
      speakNaturalKorean(`배고파요, ${subj} 맛있는 ${obj} 먹고 싶대요!`, { pitch: 1.18, rate: 0.93 });
    });
  };

  const openFeedModal = () => {
    audioEngine.init();
    // 칭찬 음성 3종 사전 버퍼 캐싱 (정답 시 0초 즉시 반응 보장)
    [0, 1, 2].forEach(idx => {
      audioEngine.getVoiceBuffer(`/sounds/voice/feed_praise_${idx}.mp3`);
    });
    const round = pickFeedRound();
    setFeedRound(round);
    setAnimalMoods({});
    setRejectedAnimalId(null);
    setRejectedFood(null);
    isFeedBusyRef.current = false;
    setIsFeedModalOpen(true);
    speakFeedWish(round.target, round.food);
  };

  const handleFeedAnimal = (droppedAnimalId, food) => {
    if (isFeedBusyRef.current) return;
    const targetAnimal = feedRound.target;
    const wantedFood = feedRound.food;

    if (droppedAnimalId === targetAnimal.id) {
      if (food.id === wantedFood.id) {
        // 🎉 정답! 목표 동물이 원하는 과일을 줌
        isFeedBusyRef.current = true;
        audioEngine.playYum();
        setAnimalMoods({
          [targetAnimal.id]: 'eating',
          ...feedRound.threeAnimals.filter(a => a.id !== targetAnimal.id).reduce((acc, a) => ({ ...acc, [a.id]: 'happy' }), {})
        });
        setFeedScore(prev => prev + 1);

        // 🚀 다음 라운드 동물/과일 사전 선정 및 음성 백그라운드 프리로드 (정답 맞춘 터치 순간 캐싱)
        const upcomingRound = pickFeedRound();
        audioEngine.getVoiceBuffer(`/sounds/voice/feed_${upcomingRound.target.id}_${upcomingRound.food.id}.mp3`);

        // 🗣️ 동물이 직접 소감 표현 (인준 고음질 MP3 우선 재생)
        const praisePhrases = [
          `냠냠! ${wantedFood.name} 정말 맛있어요! 고마워요!`,
          `와아! ${wantedFood.name} 최고예요! 냠냠 맛있어요!`,
          `냠냠 꿀꺽! 달콤한 ${wantedFood.name} 맛있어요! 배가 든든해요!`
        ];
        const randomIdx = Math.floor(Math.random() * praisePhrases.length);
        const randomPraise = praisePhrases[randomIdx];

        // 1.0초 후 기뻐하기 (만세 + 하트눈 + 팡파레)
        setTimeout(() => {
          setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'happy' }));
          audioEngine.playFanfare();
        }, 1000);

        const praiseStartTime = Date.now();
        let hasAdvanced = false;
        const advanceToNextRound = () => {
          if (hasAdvanced) return;
          hasAdvanced = true;
          const nextRound = upcomingRound || pickFeedRound();
          setFeedRound(nextRound);
          setAnimalMoods({});
          setRejectedAnimalId(null);
          setRejectedFood(null);
          isFeedBusyRef.current = false;
          speakFeedWish(nextRound.target, nextRound.food);
        };

        // 🛡️ 음성 짤림 100% 방지: 어떤 경우에도 최소 4.6초간 동물 축하 및 음성 완독 보장
        const tryAdvanceWithMinDelay = (extraWait = 0) => {
          const elapsed = Date.now() - praiseStartTime;
          const waitTime = Math.max(0, 4600 - elapsed) + extraWait;
          setTimeout(advanceToNextRound, waitTime);
        };

        // 칭찬 음성 재생 -> 음성이 끝까지 다 나오고 최소 4.6초 축하를 온전히 즐긴 후 다음 문제로 전환
        playVoiceAudio(
          `/sounds/voice/feed_praise_${randomIdx}.mp3`,
          () => {
            speakNaturalKorean(randomPraise, { pitch: 1.16, rate: 0.92 });
            tryAdvanceWithMinDelay(0);
          },
          () => {
            // MP3 음성 완독 후에도 최소 4.6초 축하 시간을 확보한 뒤 부드럽게 다음 문제로 전환
            tryAdvanceWithMinDelay(500);
          }
        );

        // 안전 타이머: 최대 5.5초 내 다음 라운드 보장
        setTimeout(advanceToNextRound, 5500);
      } else {
        // 목표 동물인데 다른 과일을 줌
        isFeedBusyRef.current = true;
        setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'reject' }));
        setRejectedAnimalId(targetAnimal.id);
        setRejectedFood(food);

        audioEngine.playFreq(200, 'sawtooth', 0.15, 0.5);
        setTimeout(() => audioEngine.playFreq(280, 'sawtooth', 0.12, 0.4), 120);
        setTimeout(() => audioEngine.playFreq(160, 'sawtooth', 0.2, 0.5), 240);

        const animalSubj = attachJosa(targetAnimal.name, '은/는');
        const foodObj = attachJosa(wantedFood.name, '을/를');
        playVoiceAudio('/sounds/voice/feed_reject_wrong_food.mp3', () => {
          speakNaturalKorean(`으응, 이거 말고! ${animalSubj} ${foodObj} 먹고 싶대요.`, { pitch: 1.16, rate: 0.92 });
        });

        setTimeout(() => {
          setAnimalMoods(prev => ({ ...prev, [targetAnimal.id]: 'hungry' }));
          setRejectedAnimalId(null);
          setRejectedFood(null);
          isFeedBusyRef.current = false;
        }, 1500);
      }
    } else {
      // 다른 동물에게 줌 (요청하지 않은 동물)
      isFeedBusyRef.current = true;
      setAnimalMoods(prev => ({ ...prev, [droppedAnimalId]: 'reject' }));
      setRejectedAnimalId(droppedAnimalId);
      setRejectedFood(food);

      audioEngine.playFreq(200, 'sawtooth', 0.15, 0.5);
      setTimeout(() => audioEngine.playFreq(280, 'sawtooth', 0.12, 0.4), 120);
      setTimeout(() => audioEngine.playFreq(160, 'sawtooth', 0.2, 0.5), 240);

      const foodObj = attachJosa(wantedFood.name, '을/를');
      playVoiceAudio('/sounds/voice/feed_reject_wrong_animal.mp3', () => {
        speakNaturalKorean(`나는 아니에요. ${targetAnimal.name}에게 ${foodObj} 주세요!`, { pitch: 1.16, rate: 0.92 });
      });

      setTimeout(() => {
        setAnimalMoods(prev => ({ ...prev, [droppedAnimalId]: 'hungry' }));
        setRejectedAnimalId(null);
        setRejectedFood(null);
        isFeedBusyRef.current = false;
      }, 1500);
    }
  };

  const BRUSH_SIZES = { small: { width: 6, label: '슬림 연필' }, medium: { width: 14, label: '색연필' }, large: { width: 24, label: '굵은 붓' } };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (paintMode === 'stamp') {
      const stampSizes = { small: 38, medium: 54, large: 74 };
      const newStamp = {
        id: Date.now() + Math.random(),
        x, y,
        icon: selectedStamp.icon,
        size: stampSizes[brushSize] || 54,
        rotation: Math.round((Math.random() - 0.5) * 36)
      };
      setStamps(prev => [...prev.slice(-60), newStamp]);
      audioEngine.playPopSound();
      if (selectedStamp.freq) {
        audioEngine.playXylophone(selectedStamp.freq);
      }
      return;
    }

    isDrawingRef.current = true;
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
        {/* 탭 네비게이션 (8종 테마 컬러) */}
        <nav style={{
          display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px',
          padding: '10px 12px', background: '#fff1f2', borderBottom: '3.5px solid #fca5a5'
        }}>
          {[
            { id: 'animal', label: '📸 생생 동물', sub: '울음소리 탐험', color: '#ef4444' },
            { id: 'xylophone', label: '🎹 퐁퐁 실로폰', sub: '동물 합창단', color: '#f59e0b' },
            { id: 'sleep', label: '🌙 코 잘 시간', sub: '오르골 자장가', color: '#6366f1' },
            { id: 'fruit', label: '🍎 싱싱 과일/채소', sub: '고화질 실사 관찰', color: '#10b981' },
            { id: 'ocean', label: '🌊 신비 바다속', sub: '뽀글 생물 탐험', color: '#0284c7' },
            { id: 'puzzle', label: '🧩 아기 퍼즐', sub: '4조각 맞추기', color: '#8b5cf6' },
            { id: 'paint', label: '🎨 무지개 물감', sub: '터치 감각 미술', color: '#3b82f6' },
            { id: 'song', label: '🎵 동요 재생', sub: `한국 동요 (${LOCAL_NURSERY_SONGS.length}곡)`, color: '#ec4899' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => {
                if (tab.id !== 'sleep') audioEngine.stopLullaby();
                if (tab.id === 'animal') setAnimalItems(shuffleArray(REAL_ANIMALS));
                if (tab.id === 'fruit') setFruitItems(shuffleArray(REAL_FRUITS));
                if (tab.id === 'ocean') speakOceanMission(oceanTarget);
                if (tab.id === 'puzzle' && !puzzleCompleted) {
                  const obj = attachJosa(puzzleTheme.name, '을/를');
                  playVoiceAudio(`/sounds/voice/puzzle_start_${puzzleTheme.id}.mp3`, () => {
                    speakNaturalKorean(`우리 ${obj} 퍼즐을 맞춰볼까요?`, { pitch: 1.16, rate: 0.93 });
                  });
                }
                setActiveTab(tab.id);
                audioEngine.playFreq(520, 'sine', 0.15);
              }} style={{
                padding: '10px 4px', borderRadius: '18px',
                border: isActive ? `3.5px solid ${tab.color}` : '2px solid #fed7aa',
                background: isActive ? tab.color : '#ffffff',
                color: isActive ? '#ffffff' : '#475569', fontWeight: 900, cursor: 'pointer',
                boxShadow: isActive ? '0 8px 18px rgba(0,0,0,0.16)' : 'none',
                transform: isActive ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.05rem', lineHeight: 1.2 }}>{tab.label}</span>
                <span style={{ fontSize: '0.72rem', opacity: isActive ? 0.95 : 0.7, fontWeight: 800, marginTop: '2px' }}>{tab.sub}</span>
              </button>
            );
          })}
        </nav>

        {/* 캔버스 영역 */}
        <div style={{ flex: 1, padding: activeTab === 'paint' ? '1rem 1.8rem' : '1.8rem', position: 'relative', background: '#fafafa', overflowY: activeTab === 'paint' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* ===== 모듈: 🎹 퐁퐁 실로폰 & 동물 합창단 ===== */}
          {activeTab === 'xylophone' && <XylophoneChoirView />}

          {/* ===== 모듈: 🌙 동물 친구들 코 잘 시간 (수면 유도) ===== */}
          {activeTab === 'sleep' && <BedtimeSleepView />}

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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                {animalItems.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `3.5px solid ${item.color}`, borderRadius: '22px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.07)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '155px', overflow: 'hidden', background: '#f8fafc' }}>
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
                    <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', margin: '0 0 5px 0' }}>{item.name}</h3>
                      {item.soundUrl ? (
                        <span style={{
                          background: item.color, color: '#ffffff', fontSize: '0.8rem', fontWeight: 900,
                          padding: '3px 10px', borderRadius: '12px', display: 'inline-block'
                        }}>🔊 {item.soundText}</span>
                      ) : (
                        <span style={{
                          background: '#94a3b8', color: '#ffffff', fontSize: '0.8rem', fontWeight: 900,
                          padding: '3px 10px', borderRadius: '12px', display: 'inline-block'
                        }}>🔇 소리 준비 중</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 2: 🍎 18종 싱싱 과일 & 채소 관찰 ===== */}
          {activeTab === 'fruit' && (
            <div>
              <div style={{
                background: '#fee2e2', borderRadius: '24px', padding: '1.2rem 1.6rem', marginBottom: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '2.5px solid #fecdd3', flexWrap: 'wrap', gap: '14px'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9f1239', margin: 0 }}>
                  🍎 싱싱한 과일·채소 카드를 콕콕 눌러보세요! 커다란 고화질 사진이 보여요!
                </h2>
                <button onClick={openFeedModal} style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff',
                  border: 'none', padding: '12px 24px', borderRadius: '18px', fontWeight: 900,
                  fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={22} /> 🦁 동물 친구들 과일 먹이기!
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.9rem' }}>
                {fruitItems.map(item => (
                  <div key={item.id} onClick={() => openRealDetailModal(item)} style={{
                    background: '#ffffff', border: `3.5px solid ${item.color}`, borderRadius: '20px',
                    overflow: 'hidden', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                    transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ width: '100%', height: '135px', overflow: 'hidden', background: '#f8fafc', padding: item.objectFit === 'contain' ? '8px' : '0' }}>
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
                    <div style={{ padding: '0.65rem 0.4rem', textAlign: 'center', background: item.bg }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{item.icon} {item.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 3: 🌊 신비한 바다속 탐험 (뽀글뽀글 거품 + 움직임 + 소리 + 미션 퀴즈) ===== */}
          {activeTab === 'ocean' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* 상단 미션 안내 바 ("문어는 어디 있을까요?") */}
              <div style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                borderRadius: '24px', padding: '0.9rem 1.4rem', marginBottom: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '3px solid #38bdf8', flexWrap: 'wrap', gap: '10px', flexShrink: 0,
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '2.3rem', lineHeight: 1 }}>{oceanFound ? '🎉' : '🎯'}</span>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {oceanFound ? (
                        <span style={{ color: '#fef08a' }}>🎉 찾았다! {oceanTarget.name}를 찾았어요! 참 잘했어요! 🌟</span>
                      ) : (
                        <span>"{oceanTarget.name}는 어디 있을까요?" {oceanTarget.icon}</span>
                      )}
                    </h2>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#bae6fd' }}>
                      {oceanFound ? '잠시 후 다음 바다 친구를 찾으러 가요!' : '바다속 생물을 콕 터치해보세요! 뽀글뽀글 거품과 소리가 나요!'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => speakOceanMission(oceanTarget)}
                    style={{
                      background: '#ffffff', color: '#0369a1', border: 'none',
                      padding: '9px 16px', borderRadius: '16px', fontWeight: 900,
                      fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <Volume2 size={18} /> 🔊 다시 듣기
                  </button>
                  <button
                    onClick={generateNextOceanMission}
                    style={{
                      background: '#38bdf8', color: '#082f49', border: 'none',
                      padding: '9px 16px', borderRadius: '16px', fontWeight: 900,
                      fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <RotateCcw size={16} /> 다른 친구 찾기
                  </button>
                </div>
              </div>

              {/* 바다속 인터랙티브 메인 뷰포트 (신비한 심해 그라데이션 + 햇살 + 거품 + 산호초 + 유영 생물들) */}
              <div
                onClick={handleOceanBackgroundClick}
                style={{
                  flex: 1, minHeight: 0, borderRadius: '28px', position: 'relative',
                  background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 35%, #0369a1 70%, #082f49 100%)',
                  overflow: 'hidden', border: '4px solid #0284c7', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.25)',
                  cursor: 'pointer'
                }}
              >
                {/* 햇살 일렁임 (Sunrays) */}
                <div className="sunray" style={{ position: 'absolute', top: 0, left: '15%', width: '90px', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 80%)' }} />
                <div className="sunray" style={{ position: 'absolute', top: 0, left: '48%', width: '120px', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 85%)', animationDelay: '2s' }} />
                <div className="sunray" style={{ position: 'absolute', top: 0, left: '75%', width: '80px', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 75%)', animationDelay: '1s' }} />

                {/* 배경 은은한 뽀글뽀글 거품들 (Floating ambient bubbles) */}
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      bottom: '-20px',
                      left: `${(i * 8.5 + 4)}%`,
                      width: `${12 + (i % 4) * 8}px`,
                      height: `${12 + (i % 4) * 8}px`,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(255,255,255,0.2) 60%, rgba(255,255,255,0.6) 100%)',
                      border: '1px solid rgba(255,255,255,0.7)',
                      animation: `ambient-bubble-rise ${4 + (i % 5) * 1.5}s infinite ease-in`,
                      animationDelay: `${i * 0.4}s`,
                      pointerEvents: 'none'
                    }}
                  />
                ))}

                {/* 바닥 해초 및 산호초 실루엣 (Bottom Seaweed & Corals) */}
                <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '130px', pointerEvents: 'none', zIndex: 1 }}>
                  {/* 모래 바닥 */}
                  <path d="M 0 160 Q 250 140 500 165 Q 750 190 1000 155 L 1000 200 L 0 200 Z" fill="#eab308" opacity="0.45" />
                  <path d="M 0 175 Q 300 160 600 180 Q 850 165 1000 170 L 1000 200 L 0 200 Z" fill="#ca8a04" opacity="0.6" />
                  {/* 좌측 흔들리는 해초 */}
                  <g className="seaweed-left">
                    <path d="M 60 200 Q 40 130 70 80 Q 50 40 65 10 Q 80 45 60 90 Q 85 140 75 200 Z" fill="#10b981" opacity="0.85" />
                    <path d="M 90 200 Q 120 140 95 90 Q 115 50 105 20 Q 90 55 105 100 Q 80 150 100 200 Z" fill="#059669" opacity="0.9" />
                  </g>
                  {/* 중앙 산호초 */}
                  <path d="M 320 200 C 310 160 290 140 315 120 C 330 110 340 130 350 120 C 365 105 385 130 375 160 C 390 150 405 170 395 200 Z" fill="#f43f5e" opacity="0.8" />
                  {/* 우측 흔들리는 해초 */}
                  <g className="seaweed-right">
                    <path d="M 880 200 Q 860 130 890 80 Q 870 40 885 15 Q 900 50 880 95 Q 905 145 895 200 Z" fill="#10b981" opacity="0.85" />
                    <path d="M 930 200 Q 960 140 935 90 Q 955 50 945 25 Q 930 60 945 105 Q 920 155 940 200 Z" fill="#059669" opacity="0.9" />
                  </g>
                  {/* 귀여운 불가사리 & 조개 */}
                  <circle cx="210" cy="182" r="14" fill="#fb923c" stroke="#ea580c" strokeWidth="2" />
                  <circle cx="780" cy="180" r="12" fill="#ec4899" stroke="#db2777" strokeWidth="2" />
                </svg>

                {/* 8종 바다 생물들 (자유 유영 & 터치 인터랙션) */}
                {OCEAN_CREATURES.map(creature => {
                  const isTarget = creature.id === oceanTarget.id;
                  const isActive = activeOceanCreatureId === creature.id;
                  const isFoundTarget = oceanFound && isTarget;

                  return (
                    <div
                      key={creature.id}
                      onClick={(e) => { e.stopPropagation(); handleTapOceanCreature(creature, e); }}
                      className={isActive ? 'ocean-creature-active' : 'ocean-creature-swim'}
                      style={{
                        position: 'absolute',
                        left: `${creature.left}%`,
                        top: `${creature.top}%`,
                        transform: 'translate(-50%, -50%)',
                        animationDelay: `${creature.swimDelay}s`,
                        cursor: 'pointer',
                        zIndex: isFoundTarget ? 15 : 5,
                        userSelect: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: `${creature.size * 1.15}px`,
                        height: `${creature.size * 1.05}px`
                      }}
                    >
                      {/* 타겟 발견 시 화려한 골드 후광 이펙트 */}
                      {isFoundTarget && (
                        <div style={{
                          position: 'absolute',
                          inset: '-12px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(253, 224, 71, 0.75), rgba(245, 158, 11, 0.2) 70%, transparent 100%)',
                          animation: 'pulse 1.2s infinite alternate',
                          pointerEvents: 'none',
                          zIndex: -1
                        }} />
                      )}

                      {/* 🌊 실제 생물 형태 SVG 벡터 아트 (배지 없이 바다를 유영) */}
                      <div style={{
                        width: '100%',
                        height: '75%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: isFoundTarget ? 'scale(1.22)' : isActive ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}>
                        <OceanCreatureSVG id={creature.id} isTarget={isTarget} isFound={isFoundTarget} isActive={isActive} />
                      </div>

                      {/* 🏷️ 하단 반투명 네임 캡슐 */}
                      <div style={{
                        marginTop: '2px',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        color: isFoundTarget ? '#92400e' : '#0f172a',
                        background: isFoundTarget
                          ? 'linear-gradient(135deg, #fef08a, #fde047)'
                          : 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(4px)',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        boxShadow: isFoundTarget
                          ? '0 0 16px rgba(250, 204, 21, 0.9), 0 3px 8px rgba(0,0,0,0.2)'
                          : '0 3px 8px rgba(0,0,0,0.18)',
                        border: isFoundTarget ? '2px solid #ffffff' : `2px solid ${creature.color}`,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                        transform: isFoundTarget ? 'scale(1.1)' : 'scale(1)',
                        transition: 'all 0.25s ease'
                      }}>
                        {creature.name}
                      </div>
                    </div>
                  );
                })}

                {/* 터치 시 솟구치는 뽀글뽀글 거품 파티클들 */}
                {oceanBubbles.map(b => (
                  <div
                    key={b.id}
                    className="bubble-particle"
                    style={{
                      position: 'absolute',
                      left: `${b.x}px`,
                      top: `${b.y}px`,
                      width: `${b.size}px`,
                      height: `${b.size}px`,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.4) 60%, rgba(56,189,248,0.7) 100%)',
                      border: '1.5px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 0 10px rgba(255,255,255,0.6)',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 20
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ===== 모듈 4: 🧩 4조각 아기 퍼즐 맞추기 (2x2 직관적 보드 + 원터치/드래그 안착) ===== */}
          {activeTab === 'puzzle' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* 테마 선택 바 (8종 동물 & 과일 퍼즐) */}
              <div style={{
                display: 'flex', gap: '8px', marginBottom: '0.8rem', overflowX: 'auto',
                padding: '8px 12px', background: '#f5f3ff', borderRadius: '20px',
                border: '2.5px solid #ddd6fe', flexShrink: 0
              }}>
                {BABY_PUZZLES.map(p => {
                  const isSelected = puzzleTheme.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPuzzleTheme(p)}
                      style={{
                        padding: '8px 16px', borderRadius: '16px',
                        border: isSelected ? `3.5px solid ${p.color}` : '2px solid #e2e8f0',
                        background: isSelected ? p.color : '#ffffff',
                        color: isSelected ? '#ffffff' : '#475569',
                        fontWeight: 900, fontSize: '0.98rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: isSelected ? '0 6px 16px rgba(0,0,0,0.15)' : 'none',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{p.icon}</span>
                      <span>{p.name} 퍼즐</span>
                    </button>
                  );
                })}
              </div>

              {/* 메인 퍼즐 컨테이너 (좌측 2x2 보드판 + 우측 셔플 조각 트레이) */}
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', gap: '24px',
                alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
                padding: '0.5rem', overflowY: 'auto'
              }}>
                {/* 2x2 퍼즐 맞춤 보드판 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: puzzleCompleted ? '#dcfce7' : '#eff6ff',
                    border: puzzleCompleted ? '2.5px solid #22c55e' : '2.5px solid #93c5fd',
                    padding: '6px 16px', borderRadius: '16px', marginBottom: '10px'
                  }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: puzzleCompleted ? '#15803d' : '#1d4ed8' }}>
                      {puzzleCompleted ? '🎉 100% 완성!! 참 잘했어요!' : `🧩 맞춰진 조각: ${placedPieces.filter(Boolean).length} / 4개`}
                    </span>
                  </div>

                  {/* 2x2 그리드 보드 (4조각 결합 시 완전체 완성) */}
                  <div
                    className={puzzleCompleted ? 'puzzle-completed-board' : ''}
                    style={{
                      width: '320px', height: '320px', background: '#ffffff',
                      borderRadius: '28px', border: puzzleCompleted ? '6px solid #eab308' : '4px dashed #94a3b8',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.1)', display: 'grid',
                      gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
                      gap: puzzleCompleted ? '0px' : '3px', padding: '6px',
                      overflow: 'hidden', position: 'relative', transition: 'all 0.3s ease'
                    }}
                  >
                    {[0, 1, 2, 3].map(quadIdx => {
                      const isPlaced = placedPieces[quadIdx];
                      const isHovered = hoverSlotIdx === quadIdx;

                      return (
                        <div
                          key={quadIdx}
                          ref={el => { puzzleSlotRefs.current[quadIdx] = el; }}
                          onClick={() => {
                            if (!isPlaced) handleSnapPiece(quadIdx);
                          }}
                          style={{
                            background: isPlaced ? '#ffffff' : isHovered ? '#fef3c7' : '#f8fafc',
                            border: isPlaced ? '1px solid #cbd5e1' : isHovered ? '3.5px dashed #f59e0b' : '2px dashed #cbd5e1',
                            borderRadius: puzzleCompleted ? '0px' : '14px',
                            overflow: 'hidden', position: 'relative',
                            cursor: isPlaced ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isPlaced ? (
                            <div className="puzzle-snapped" style={{ width: '100%', height: '100%' }}>
                              <svg viewBox={PUZZLE_QUAD_VIEWBOX[quadIdx]} width="100%" height="100%" preserveAspectRatio="none">
                                <PuzzleArtworkG id={puzzleTheme.id} />
                              </svg>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '6px' }}>
                              <span style={{ fontSize: '1.5rem', opacity: 0.35 }}>{puzzleTheme.icon}</span>
                              <p style={{ fontSize: '0.78rem', fontWeight: 900, margin: '2px 0 0 0', opacity: 0.7 }}>
                                {PUZZLE_QUAD_LABELS[quadIdx]}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 셔플된 4조각 트레이 & 완성 컨트롤 (드래그 앤 드롭 지원) */}
                <div style={{
                  maxWidth: '380px', width: '100%', background: '#ffffff',
                  borderRadius: '28px', border: '3.5px solid #e2e8f0',
                  padding: '1.2rem', boxShadow: '0 10px 24px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', margin: '0 0 8px 0' }}>
                    {puzzleCompleted ? '🌟 퍼즐 완성 축하해요!' : '👇 조각을 손가락으로 끌어다(Drag) 사각형에 쏙 맞춰보세요!'}
                  </h3>

                  {/* 4조각 목록 (1/4씩 정확히 쪼개진 조각) */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
                    width: '100%', marginBottom: '1rem'
                  }}>
                    {trayPieces.map((quadIdx, i) => {
                      const isPlaced = placedPieces[quadIdx];
                      const isDragging = draggingPieceQuad === quadIdx;

                      return (
                        <button
                          key={i}
                          disabled={isPlaced}
                          onPointerDown={(e) => handleStartDragPiece(e, quadIdx)}
                          onClick={() => {
                            if (!isPlaced) handleSnapPiece(quadIdx);
                          }}
                          style={{
                            height: '115px', borderRadius: '18px',
                            border: isPlaced ? '2px solid #e2e8f0' : `3.5px solid ${puzzleTheme.color}`,
                            background: isPlaced ? '#f1f5f9' : '#ffffff',
                            opacity: isDragging ? 0.2 : isPlaced ? 0.25 : 1,
                            cursor: isPlaced ? 'not-allowed' : 'grab',
                            overflow: 'hidden', padding: 0, position: 'relative',
                            boxShadow: isPlaced ? 'none' : '0 6px 16px rgba(0,0,0,0.08)',
                            transform: isPlaced ? 'scale(0.96)' : 'scale(1)',
                            touchAction: 'none', userSelect: 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <svg viewBox={PUZZLE_QUAD_VIEWBOX[quadIdx]} width="100%" height="100%" preserveAspectRatio="none">
                            <PuzzleArtworkG id={puzzleTheme.id} />
                          </svg>
                          <span style={{
                            position: 'absolute', bottom: '4px', right: '6px',
                            background: 'rgba(0,0,0,0.65)', color: '#ffffff',
                            fontSize: '0.72rem', fontWeight: 900, padding: '2px 6px',
                            borderRadius: '8px'
                          }}>
                            {PUZZLE_QUAD_LABELS[quadIdx]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={() => handleResetPuzzle(puzzleTheme)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '16px',
                        background: '#f1f5f9', color: '#475569', border: '2px solid #cbd5e1',
                        fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <RotateCcw size={16} /> 다시 맞추기
                    </button>
                    <button
                      onClick={handleNextPuzzleTheme}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: '#ffffff', border: 'none',
                        fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <Sparkles size={16} /> 다음 퍼즐 ➡️
                    </button>
                  </div>
                </div>
              </div>

              {/* 🧩 드래그 중인 퍼즐 조각 (커서 추적 오버레이) */}
              {draggingPieceQuad !== null && (
                <div style={{
                  position: 'fixed',
                  left: dragPiecePos.x,
                  top: dragPiecePos.y,
                  transform: 'translate(-50%, -50%) scale(1.15)',
                  width: '130px', height: '130px',
                  borderRadius: '20px',
                  border: `4px solid ${puzzleTheme.color}`,
                  background: '#ffffff',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  overflow: 'hidden'
                }}>
                  <svg viewBox={PUZZLE_QUAD_VIEWBOX[draggingPieceQuad]} width="100%" height="100%" preserveAspectRatio="none">
                    <PuzzleArtworkG id={puzzleTheme.id} />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ===== 모듈 5: 무지개 물감 & 퐁퐁 스탬프 & 따라쓰기 ===== */}
          {activeTab === 'paint' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {/* 상단 툴바 */}
              <div style={{
                background: '#e0f2fe', border: '2.5px solid #bae6fd', borderRadius: '20px',
                padding: '0.7rem 1.2rem', marginBottom: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                flexShrink: 0
              }}>
                {/* 모드 선택 (물감 / 퐁퐁 스탬프 / 따라쓰기) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setPaintMode('brush'); setTracingMode(null); }} style={{
                    background: paintMode === 'brush' ? '#3b82f6' : '#ffffff',
                    color: paintMode === 'brush' ? '#ffffff' : '#0369a1',
                    border: paintMode === 'brush' ? '3px solid #1d4ed8' : '2px solid #bae6fd',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    🎨 물감 그리기
                  </button>

                  <button onClick={() => { setPaintMode('stamp'); setTracingMode(null); }} style={{
                    background: paintMode === 'stamp' ? '#ec4899' : '#ffffff',
                    color: paintMode === 'stamp' ? '#ffffff' : '#be185d',
                    border: paintMode === 'stamp' ? '3px solid #db2777' : '2px solid #fbcfe8',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    🐾 퐁퐁 스탬프
                  </button>

                  <button onClick={() => {
                    setPaintMode('tracing');
                    if (!tracingMode) setTracingMode(TRACING_TEMPLATES[0]);
                    setStrokes([]);
                  }} style={{
                    background: paintMode === 'tracing' ? '#f59e0b' : '#ffffff',
                    color: paintMode === 'tracing' ? '#ffffff' : '#92400e',
                    border: paintMode === 'tracing' ? '3px solid #d97706' : '2px solid #fcd34d',
                    borderRadius: '14px', padding: '6px 14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                  }}>
                    ✏️ 따라쓰기
                  </button>
                </div>

                {/* 우측 조작 (크기 선택 & 지우기) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 크기 선택 */}
                  {[{ key: 'small', label: '작게', sz: 14 }, { key: 'medium', label: '보통', sz: 20 }, { key: 'large', label: '크게', sz: 28 }].map(b => (
                    <button key={b.key} onClick={() => setBrushSize(b.key)} style={{
                      background: brushSize === b.key ? '#0284c7' : '#ffffff',
                      color: brushSize === b.key ? '#ffffff' : '#334155',
                      border: brushSize === b.key ? '3px solid #0369a1' : '2px solid #cbd5e1',
                      borderRadius: '14px', padding: '5px 10px', fontWeight: 900, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem'
                    }}>
                      <span style={{ width: b.sz, height: b.sz, borderRadius: '50%', background: brushSize === b.key ? '#7dd3fc' : '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                      {b.label}
                    </button>
                  ))}

                  <span style={{ width: '2px', height: '26px', background: '#bae6fd', borderRadius: '2px' }} />

                  <button onClick={() => { setStrokes([]); setStamps([]); }} style={{
                    background: '#ef4444', color: '#ffffff', border: 'none', padding: '7px 14px',
                    borderRadius: '14px', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.86rem',
                    boxShadow: '0 3px 10px rgba(239,68,68,0.25)'
                  }}><Eraser size={16} /> 싹 지우기</button>
                </div>
              </div>

              {/* 🐾 스탬프 선택 바 (퐁퐁 스탬프 모드일 때) */}
              {paintMode === 'stamp' && (
                <div style={{
                  display: 'flex', gap: '8px', marginBottom: '0.6rem', flexWrap: 'wrap',
                  flexShrink: 0, alignItems: 'center', background: '#fdf2f8', padding: '8px 14px',
                  borderRadius: '16px', border: '2px solid #fbcfe8'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#be185d', marginRight: '4px' }}>도장 선택:</span>
                  {STAMP_ITEMS.map(st => (
                    <button key={st.id} onClick={() => setSelectedStamp(st)} style={{
                      padding: '5px 12px', borderRadius: '14px',
                      background: selectedStamp.id === st.id ? '#f472b6' : '#ffffff',
                      border: selectedStamp.id === st.id ? '3px solid #db2777' : '2px solid #fbcfe8',
                      fontSize: '1.25rem', fontWeight: 900,
                      color: selectedStamp.id === st.id ? '#ffffff' : '#9d174d',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      transform: selectedStamp.id === st.id ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}>
                      <span>{st.icon}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 900 }}>{st.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ✏️ 따라쓰기 글자 선택 (따라쓰기 모드일 때) */}
              {paintMode === 'tracing' && tracingMode && (
                <div style={{
                  display: 'flex', gap: '6px', marginBottom: '0.6rem', flexWrap: 'wrap',
                  flexShrink: 0, alignItems: 'center', background: '#fffbeb', padding: '8px 14px',
                  borderRadius: '16px', border: '2px solid #fde68a'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#92400e', marginRight: '4px' }}>숫자 선택:</span>
                  {TRACING_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setTracingMode(t); setStrokes([]); }} style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: tracingMode.id === t.id ? '#fbbf24' : '#ffffff',
                      border: tracingMode.id === t.id ? '3px solid #d97706' : '2px solid #fcd34d',
                      fontSize: '1.2rem', fontWeight: 900,
                      color: tracingMode.id === t.id ? '#78350f' : '#92400e',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{t.label}</button>
                  ))}
                </div>
              )}

              {/* 캔버스 (flex: 1로 남은 공간 전부 사용, 연필 stroke & 스탬프 드로잉) */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={paintMode !== 'stamp' ? handlePointerMove : undefined}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  width: '100%', flex: 1, minHeight: 0, background: '#ffffff', borderRadius: '24px',
                  border: paintMode === 'stamp' ? '4px dashed #f472b6' : '4px dashed #38bdf8',
                  position: 'relative', overflow: 'hidden',
                  cursor: paintMode === 'stamp' ? 'pointer' : 'crosshair',
                  touchAction: 'none'
                }}
              >
                {/* 따라쓰기 가이드 실선 (배경) */}
                {paintMode === 'tracing' && tracingMode && (
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

                {/* 찍힌 스탬프들 */}
                {stamps.map(st => (
                  <div
                    key={st.id}
                    className="stamp-pop"
                    style={{
                      position: 'absolute',
                      left: st.x,
                      top: st.y,
                      transform: `translate(-50%, -50%) rotate(${st.rotation || 0}deg)`,
                      fontSize: `${st.size}px`,
                      lineHeight: 1,
                      pointerEvents: 'none',
                      zIndex: 3,
                      userSelect: 'none'
                    }}
                  >
                    {st.icon}
                  </div>
                ))}

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

                {strokes.length === 0 && stamps.length === 0 && paintMode === 'brush' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8', pointerEvents: 'none'
                  }}>
                    <Sparkles size={56} style={{ color: '#38bdf8', marginBottom: '12px' }} />
                    <p style={{ fontSize: '1.4rem', fontWeight: 900 }}>화면에 연필처럼 쓱쓱 자유롭게 그려보세요!</p>
                  </div>
                )}
                {strokes.length === 0 && stamps.length === 0 && paintMode === 'stamp' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#f472b6', pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: '3rem', marginBottom: '8px' }}>🐾</span>
                    <p style={{ fontSize: '1.35rem', fontWeight: 900 }}>화면을 콕콕 터치하여 귀여운 도장을 퐁퐁 찍어보세요!</p>
                  </div>
                )}
                {strokes.length === 0 && paintMode === 'tracing' && tracingMode && (
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
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 14px 0' }}>
                {selectedRealItem.icon ? `${selectedRealItem.icon} ` : ''}{selectedRealItem.name}
              </h2>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {selectedRealItem.soundUrl && (
                  <button onClick={() => audioEngine.playItemSound(selectedRealItem)} style={{
                    background: selectedRealItem.color, color: '#ffffff', border: 'none',
                    padding: '14px 24px', borderRadius: '22px', fontSize: '1.2rem', fontWeight: 900,
                    cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                    display: 'inline-flex', alignItems: 'center', gap: '10px'
                  }}>
                    <Volume2 size={24} /> 울음소리 다시 듣기 🔊
                  </button>
                )}
                <button onClick={() => speakNaturalKorean(selectedRealItem.soundText ? `${selectedRealItem.name}! ${selectedRealItem.soundText}` : `맛있는 ${selectedRealItem.name}!`, { pitch: 1.16, rate: 0.92 })} style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', border: 'none',
                  padding: '14px 24px', borderRadius: '22px', fontSize: '1.2rem', fontWeight: 900,
                  cursor: 'pointer', boxShadow: '0 8px 20px rgba(99,102,241,0.25)',
                  display: 'inline-flex', alignItems: 'center', gap: '10px'
                }}>
                  🗣️ 다정한 구어체로 듣기
                </button>
              </div>
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

      {/* ===== 🦁 3마리 동물 과일 먹이기 놀이 모달 (드래그 앤 드롭 지원) ===== */}
      {isFeedModalOpen && feedRound && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: '1rem', userSelect: 'none'
          }}
        >
          <div style={{
            background: '#fffbeb', borderRadius: '36px', maxWidth: '860px', width: '100%',
            padding: '1.8rem 1.6rem', border: '6px solid #f59e0b',
            boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.35)', position: 'relative', textAlign: 'center'
          }}>
            <button onClick={() => { setIsFeedModalOpen(false); audioEngine.stopAllSounds(); }} style={{
              position: 'absolute', top: '18px', right: '18px', background: '#fef3c7', color: '#78350f',
              border: '2px solid #fde68a', borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
            }}><X size={24} /></button>

            {/* 상단 점수 */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fef3c7', padding: '6px 18px', borderRadius: '20px', marginBottom: '0.8rem', border: '2px solid #fde68a' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#92400e' }}>⭐ 먹인 과일: {feedScore}개</span>
            </div>

            {/* 목표 동물 말풍선 (고화질 실사 과일 요구사항 뱃지 탑재) */}
            <div
              onClick={() => speakFeedWish(feedRound.target, feedRound.food)}
              title="콕 누르면 동물 친구가 목소리로 다시 말해요!"
              style={{
                background: '#ffffff', border: '3.5px solid #fbbf24', borderRadius: '24px',
                padding: '0.8rem 1.4rem', marginBottom: '1.2rem', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.18)',
                cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '12px', maxWidth: '90%'
              }}
            >
              {/* 실사 과일 요구사항 미니 뱃지 📸 */}
              {feedRound.food?.img && (
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden',
                  border: `3px solid ${feedRound.food.color || '#fbbf24'}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', flexShrink: 0, background: '#ffffff'
                }}>
                  <img
                    src={feedRound.food.img}
                    alt={feedRound.food.name}
                    style={{ width: '100%', height: '100%', objectFit: feedRound.food.objectFit || 'cover' }}
                  />
                </div>
              )}
              <p style={{ fontSize: '1.35rem', fontWeight: 900, color: '#78350f', margin: 0 }}>
                {rejectedAnimalId === feedRound.target.id
                  ? `😤 "${feedRound.target.name}: 이거 말고~!! ${feedRound.food.name} 달라고~! 😣"`
                  : rejectedAnimalId
                    ? `🙅 "${feedRound.threeAnimals.find(a => a.id === rejectedAnimalId)?.name || '나'} 말고! ${feedRound.target.name}한테 ${feedRound.food.name} 줘! 😣"`
                    : animalMoods[feedRound.target.id] === 'eating'
                      ? `😋 "${feedRound.target.name}: 아구아구... 우물우물... 냠냠!"`
                      : animalMoods[feedRound.target.id] === 'happy'
                        ? `💖 "${feedRound.target.name}: 너무 맛있다~! 최고야! 🥰"`
                        : hoverAnimalId === feedRound.target.id
                          ? `😮 "${feedRound.target.name}: 아~~ 입 벌리고 있어! 쏙 넣어줘!"`
                          : `"${feedRound.target.name}가 ${feedRound.food.name} 먹고 싶어요!"`}
              </p>
              {/* 말풍선 꼬리 */}
              <div style={{
                position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                borderTop: '10px solid #fbbf24'
              }} />
              <div style={{
                position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
                borderTop: '8px solid #ffffff'
              }} />
            </div>

            {/* 3마리 동물 캐릭터 드롭 영역 목록 (실사 포토 뱃지 + 선명한 동물 이름표 + 고유 배경색) */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px',
              marginBottom: '1rem', alignItems: 'stretch'
            }}>
              {feedRound.threeAnimals.map(animal => {
                const isTarget = animal.id === feedRound.target.id;
                const isOver = hoverAnimalId === animal.id;
                const mood = animalMoods[animal.id] || 'hungry';

                return (
                  <div
                    key={animal.id}
                    ref={el => { animalBoxRefs.current[animal.id] = el; }}
                    onClick={() => {
                      if (isTarget) speakFeedWish(animal, feedRound.food);
                    }}
                    style={{
                      padding: '12px 10px', borderRadius: '28px',
                      border: isOver
                        ? '4px dashed #f59e0b'
                        : '3px solid #e2e8f0',
                      background: isOver
                        ? '#fef3c7'
                        : '#ffffff',
                      boxShadow: isOver
                        ? '0 10px 26px rgba(245, 158, 11, 0.25)'
                        : '0 4px 14px rgba(0,0,0,0.05)',
                      transform: isOver ? 'scale(1.03)' : 'scale(1)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    {/* 상단 뱃지: 실사 사진 + 동물 이름 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#f1f5f9',
                      color: '#334155',
                      padding: '6px 14px', borderRadius: '20px',
                      marginBottom: '8px', width: '92%', justifyContent: 'center',
                      border: '1.5px solid #e2e8f0'
                    }}>
                      {/* 실제 동물 실사 사진 미니 뱃지 📸 */}
                      {animal.photo && (
                        <img
                          src={animal.photo}
                          alt={animal.name}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            objectFit: 'cover', border: '1.5px solid #cbd5e1'
                          }}
                        />
                      )}
                      <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.3px' }}>
                        {animal.name}
                      </span>
                    </div>

                    {/* SVG 애니메이션 캐릭터 (실사 과일 거절 지원) */}
                    <AnimatedAnimalCharacter
                      animal={animal}
                      mood={mood}
                      isOver={isOver}
                      rejectedFoodIcon={rejectedAnimalId === animal.id ? rejectedFood?.icon : null}
                      rejectedFoodImg={rejectedAnimalId === animal.id ? rejectedFood?.img : null}
                    />

                    {/* 하단 칭호 태그 */}
                    <div style={{ marginTop: '6px' }}>
                      <span style={{
                        fontSize: '0.86rem', fontWeight: 900,
                        color: '#64748b',
                        background: '#f8fafc',
                        padding: '3px 10px', borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'inline-block'
                      }}>
                        {animal.title || `${animal.icon} ${animal.name}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: '1.05rem', fontWeight: 900, color: '#92400e', marginBottom: '0.8rem' }}>
              👇 원하는 과일·채소를 손가락으로 끌어다(Drag) <strong>{feedRound.target.name}</strong>에게 쏙 넣어주세요!
            </p>

            {/* 과일/채소 랜덤 5개 고화질 실사 선택 카드 (먹는 동안 PROTECT 비활성화) */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px',
              opacity: isFeedBusyRef.current ? 0.45 : 1,
              pointerEvents: isFeedBusyRef.current ? 'none' : 'auto',
              transition: 'opacity 0.25s ease'
            }}>
              {feedRound.choices.map(food => (
                <button
                  key={food.id}
                  onPointerDown={(e) => handleStartDragFood(e, food)}
                  style={{
                    background: '#ffffff',
                    border: `3.5px solid ${food.color || '#fed7aa'}`,
                    borderRadius: '24px', padding: '10px 6px',
                    cursor: isFeedBusyRef.current ? 'not-allowed' : 'grab',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    boxShadow: '0 8px 18px rgba(0,0,0,0.12)', touchAction: 'none',
                    opacity: draggingFood?.id === food.id ? 0.25 : 1,
                    userSelect: 'none', overflow: 'hidden'
                  }}
                >
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '20px', overflow: 'hidden',
                    background: food.bg || '#f8fafc', border: '2px solid rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    {food.img ? (
                      <img
                        src={food.img}
                        alt={food.name}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: food.objectFit || 'cover',
                          objectPosition: food.fitPos || 'center center'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '2.4rem' }}>{food.icon}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '1.08rem', fontWeight: 900, color: '#1e293b' }}>{food.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 손가락/마우스를 따라 움직이는 드래그 과일 이펙트 (고화질 실사 뱃지 📸) */}
          {draggingFood && (
            <div style={{
              position: 'fixed', left: dragPos.x, top: dragPos.y,
              transform: 'translate(-50%, -50%) scale(1.15)',
              zIndex: 2000, pointerEvents: 'none',
              width: '84px', height: '84px', borderRadius: '50%',
              overflow: 'hidden', border: `4px solid ${draggingFood.color || '#ffffff'}`,
              boxShadow: '0 14px 32px rgba(0,0,0,0.42)', background: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {draggingFood.img ? (
                <img
                  src={draggingFood.img}
                  alt={draggingFood.name}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: draggingFood.objectFit || 'cover',
                    objectPosition: draggingFood.fitPos || 'center center'
                  }}
                />
              ) : (
                <span style={{ fontSize: '3.2rem' }}>{draggingFood.icon}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
