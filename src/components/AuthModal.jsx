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
      // Supabase 미설정시 데모 승인
      setTimeout(() => {
        const mockUser = { id: `user-${Date.now()}`, email, user_metadata: { full_name: name || email.split('@')[0] } };
        setUser(mockUser);
        localStorage.setItem('demo_user', JSON.stringify(mockUser));
        setMessage({ type: 'success', text: '회원가입 및 즉시 승인이 완료되었습니다!' });
        setLoading(false);
        setTimeout(onClose, 1000);
      }, 400);
      return;
    }

    try {
      if (isSignUp) {
        // 1. 회원가입 신청 (기본적으로 is_approved: false 상태로 회원가입 신청)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, is_approved: false } }
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: '🎉 회원가입 신청이 등록되었습니다! 관리자 메일로 가입 승인 요청이 전송되었으며, 관리자가 승인한 후 로그인하실 수 있습니다.'
        });
        setIsSignUp(false);
      } else {
        // 2. 로그인 실행
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // 관리자 승인 여부 검사 (is_approved가 false인 경우 승인 대기 처리)
        const userMeta = data.user?.user_metadata || {};
        if (userMeta.is_approved === false && data.user.email !== 'valencia5223@gmail.com') {
          await supabase.auth.signOut();
          setMessage({
            type: 'error',
            text: '🔒 관리자의 가입 승인 대기 중입니다. 관리자가 가입을 승인한 후 서비스 이용이 가능합니다.'
          });
          return;
        }

        setUser(data.user);
        if (autoLogin) {
          localStorage.setItem('library_auto_login', 'true');
        }
        setMessage({ type: 'success', text: '환영합니다! 로그인되었습니다.' });
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

            <div className="badge-row mt-3 flex justify-center gap-2">
              <span className="badge-pill">🔒 자동로그인 세션 유지</span>
              <span className="badge-pill">⚡ 이메일 즉시 승인</span>
            </div>

            <button className="btn btn-secondary mt-4 w-full justify-center" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="auth-form">
            <h2>{isSignUp ? '회원가입 (즉시 승인)' : '로그인'}</h2>
            <p className="auth-subtitle sub-text">
              이메일 인증 절차 없이 가입 즉시 서재에 들어오실 수 있습니다.
            </p>

            {message && (
              <div className={`alert-box alert-${message.type} mt-3 p-3 rounded flex align-center gap-2`}>
                {message.type === 'success' ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
                <span>{message.text}</span>
              </div>
            )}

            {isSignUp && (
              <div className="form-group mt-3">
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

            <div className="form-group mt-3">
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

            <div className="form-group mt-3">
              <label>비밀번호</label>
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
              <div className="form-checkbox mt-3">
                <label className="flex align-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={(e) => setAutoLogin(e.target.checked)}
                  />
                  <span className="sub-text">자동 로그인 (세션 지속 유지)</span>
                </label>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full mt-4 w-full justify-center" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '회원가입 및 즉시 서재 입장' : '로그인하기'}
            </button>

            <div className="auth-switch text-center mt-3 sub-text">
              {isSignUp ? (
                <span>이미 계정이 있으신가요? <button type="button" className="text-primary underline bg-transparent border-0 cursor-pointer" onClick={() => setIsSignUp(false)}>로그인</button></span>
              ) : (
                <span>처음이신가요? <button type="button" className="text-primary underline bg-transparent border-0 cursor-pointer" onClick={() => setIsSignUp(true)}>회원가입</button></span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
