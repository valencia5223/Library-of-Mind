import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Lock, Mail, User, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, user, setUser }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!isSupabaseConfigured()) {
      // Supabase 키 미설정 시 데모용 상태 전환
      setTimeout(() => {
        const mockUser = { id: 'demo-user-123', email, user_metadata: { full_name: name || email.split('@')[0] } };
        setUser(mockUser);
        localStorage.setItem('demo_user', JSON.stringify(mockUser));
        setMessage({ type: 'success', text: '데모 계정으로 로그인되었습니다! (Supabase 키 설정 후 실제 DB 연동)' });
        setLoading(false);
        setTimeout(onClose, 1200);
      }, 500);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '회원가입 성공! 로그인해 주세요.' });
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setUser(data.user);
        if (autoLogin) {
          localStorage.setItem('library_auto_login', 'true');
        }
        setMessage({ type: 'success', text: '반갑습니다! 로그인되었습니다.' });
        setTimeout(onClose, 1000);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '인증 과정에서 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('demo_user');
    localStorage.removeItem('library_auto_login');
    setUser(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        {user ? (
          <div className="auth-logged-in text-center">
            <div className="avatar-large">
              {user.user_metadata?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <h3>{user.user_metadata?.full_name || '독서가'} 님</h3>
            <p className="sub-text">{user.email}</p>
            <div className="badge-row">
              <span className="badge-pill">🔒 자동로그인 활성화</span>
              <span className="badge-pill">⚡ Supabase Auth 암호화 저장</span>
            </div>
            <button className="btn btn-secondary mt-4 w-full" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="auth-form">
            <h2>{isSignUp ? '회원가입' : '로그인'}</h2>
            <p className="auth-subtitle">
              나만의 독서 서재 'Library of Mind'에 오신 것을 환영합니다.
            </p>

            {message && (
              <div className={`alert-box alert-${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{message.text}</span>
              </div>
            )}

            {isSignUp && (
              <div className="form-group">
                <label>이름 / 닉네임</label>
                <div className="input-icon-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>이메일 계정</label>
              <div className="input-icon-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>비밀번호 (보안 암호화)</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {!isSignUp && (
              <div className="form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={(e) => setAutoLogin(e.target.checked)}
                  />
                  <span>자동 로그인 (세션 정보 유지)</span>
                </label>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full mt-3" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '회원가입 완료' : '로그인하기'}
            </button>

            <div className="auth-switch">
              {isSignUp ? (
                <span>이미 계정이 있으신가요? <button type="button" onClick={() => setIsSignUp(false)}>로그인</button></span>
              ) : (
                <span>처음이신가요? <button type="button" onClick={() => setIsSignUp(true)}>회원가입</button></span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
