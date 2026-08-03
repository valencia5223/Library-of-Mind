import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, CloudRain, Flame, Coffee, FileText, CheckCircle2, Timer } from 'lucide-react';

export default function FocusStudio({ books = [], onSaveSession }) {
  // 타이머 상태
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [pagesReadInput, setPagesReadInput] = useState('');
  const [sessionSaved, setSessionSaved] = useState(false);

  // ASMR 사운드 오디오 믹서 (Web Audio Synth)
  const [activeSound, setActiveSound] = useState(null); // 'rain' | 'fire' | 'cafe' | 'page' | null
  const [volume, setVolume] = useState(0.5);

  const audioCtxRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const gainNodeRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((sec) => sec + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  // Web Audio 백색소음 생성기
  const playAmbient = (type) => {
    if (activeSound === type) {
      stopAmbient();
      return;
    }

    stopAmbient();
    setActiveSound(type);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // 핑크/브라운 노이즈 생성
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // soft noise filter
        lastOut = output[i];
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.value = 800;
      } else if (type === 'fire') {
        filter.type = 'bandpass';
        filter.frequency.value = 400;
      } else if (type === 'cafe') {
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
      } else {
        filter.type = 'highpass';
        filter.frequency.value = 1500;
      }

      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      gainNodeRef.current = gainNode;

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      whiteNoise.start();
      noiseNodeRef.current = whiteNoise;
    } catch (e) {
      console.warn('Audio Context failed', e);
    }
  };

  const stopAmbient = () => {
    if (noiseNodeRef.current) {
      try { noiseNodeRef.current.stop(); } catch (e) {}
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
    }
    setActiveSound(null);
  };

  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSave = () => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    onSaveSession({
      book_id: selectedBookId || null,
      duration_minutes: minutes,
      pages_read: parseInt(pagesReadInput) || 0
    });
    setSessionSaved(true);
    setTimeout(() => setSessionSaved(false), 3000);
  };

  const handleReset = () => {
    setIsActive(false);
    setSeconds(0);
    setPagesReadInput('');
  };

  return (
    <div className="focus-studio-container">
      {/* 타이틀 */}
      <div className="studio-header text-center">
        <h2><Timer className="text-warning inline-block me-2" size={28} /> 몰입 독서 스튜디오</h2>
        <p className="sub-text">백색소음과 함께 집중 시간을 측정하고 독서 기록을 세워보세요.</p>
      </div>

      <div className="studio-grid mt-4">
        {/* 타이머 카드 */}
        <div className="timer-card">
          <div className="timer-display">
            <span className="time-text">{formatTime(seconds)}</span>
            <p className="timer-sub font-mono">
              {isActive ? '⏱️ 독서 몰입 중...' : '일시정지됨'}
            </p>
          </div>

          <div className="timer-controls mt-4">
            <button
              className={`btn btn-lg ${isActive ? 'btn-warning' : 'btn-primary'}`}
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? <><Pause size={20} /> 일시정지</> : <><Play size={20} /> 독서 시작</>}
            </button>
            <button className="btn btn-lg btn-outline" onClick={handleReset}>
              <RotateCcw size={20} /> 리셋
            </button>
          </div>

          {/* 독서 기록 저장 폼 */}
          <div className="session-save-box mt-4">
            <h4>오늘의 독서 세션 기록 저장</h4>
            <div className="form-group mt-2">
              <label>읽은 책 선택</label>
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
              >
                <option value="">책 선택 안함 (일반 독서)</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group mt-2">
              <label>읽은 페이지 수</label>
              <input
                type="number"
                placeholder="예: 25"
                value={pagesReadInput}
                onChange={(e) => setPagesReadInput(e.target.value)}
              />
            </div>

            <button
              className="btn btn-success w-full mt-3"
              onClick={handleSave}
              disabled={seconds === 0}
            >
              독서 기록 저장하기 ({Math.round(seconds / 60)}분 기록)
            </button>

            {sessionSaved && (
              <div className="text-success text-center mt-2 flex align-center justify-center gap-1">
                <CheckCircle2 size={16} /> 독서 시간이 기록되었습니다!
              </div>
            )}
          </div>
        </div>

        {/* ASMR 백색소음 플레이어 */}
        <div className="asmr-card">
          <h3>🎧 독서 백색소음 (Ambient Sounds)</h3>
          <p className="sub-text">몰입을 돕는 자연 소리를 선택하여 재생하세요.</p>

          <div className="sound-buttons-grid mt-3">
            <button
              className={`sound-btn ${activeSound === 'rain' ? 'active' : ''}`}
              onClick={() => playAmbient('rain')}
            >
              <CloudRain size={24} className="sound-icon" />
              <span>차분한 빗소리</span>
            </button>

            <button
              className={`sound-btn ${activeSound === 'fire' ? 'active' : ''}`}
              onClick={() => playAmbient('fire')}
            >
              <Flame size={24} className="sound-icon" />
              <span>따뜻한 모닥불</span>
            </button>

            <button
              className={`sound-btn ${activeSound === 'cafe' ? 'active' : ''}`}
              onClick={() => playAmbient('cafe')}
            >
              <Coffee size={24} className="sound-icon" />
              <span>조용한 카페</span>
            </button>

            <button
              className={`sound-btn ${activeSound === 'page' ? 'active' : ''}`}
              onClick={() => playAmbient('page')}
            >
              <FileText size={24} className="sound-icon" />
              <span>종이 넘기는 소리</span>
            </button>
          </div>

          {activeSound && (
            <div className="volume-control mt-4">
              <div className="flex align-center justify-between">
                <span><Volume2 size={18} /> 음량 조절</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (gainNodeRef.current) gainNodeRef.current.gain.value = val;
                }}
                className="w-full mt-2"
              />
              <button className="btn btn-sm btn-outline mt-3 w-full" onClick={stopAmbient}>
                <VolumeX size={16} /> 백색소음 끄기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
