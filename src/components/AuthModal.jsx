import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Lock, Mail, User, CheckCircle2, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';

export default function AuthModal({
  isOpen,
  onClose,
  user,
  setUser,
  isAdmin = false,
  onOpenAdmin = () => {},
  mode: externalMode,
  setMode: setExternalMode
}) {
  const [internalMode, setInternalMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const mode = externalMode || internalMode;

  const changeMode = (newMode) => {
    setMessage(null);
    if (setExternalMode) {
      setExternalMode(newMode);
    }
    setInternalMode(newMode);
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 모달이 열리거나 닫힐 때 메시지 초기화
  useEffect(() => {
    if (!isOpen) {
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. 로그인 & 회원가입 핸들러
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
      if (mode === 'signup') {
        // 1-1. 회원가입 신청
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, is_approved: false } }
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: '🎉 회원가입 신청이 등록되었습니다! 관리자 승인 후 로그인하실 수 있습니다.'
        });
        changeMode('login');
      } else {
        // 1-2. 로그인 실행
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

  // 2. 비밀번호 찾기 (재설정 메일 발송) 핸들러
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: 'error', text: '이메일 주소를 입력해주세요.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        setMessage({ type: 'success', text: '테스트 모드: 비밀번호 재설정 이메일이 발송되었습니다.' });
        return;
      }

      // 현재 앱 주소로 리다이렉트
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: '✅ 비밀번호 재설정 링크가 입력하신 이메일로 발송되었습니다! 메일함(스팸 메일함 포함)에서 링크를 클릭해 새 비밀번호를 설정해주세요.'
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '재설정 메일 발송 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. 새 비밀번호 설정 (재설정 링크 접속 후) 핸들러
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 최소 6자 이상이어야 합니다.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        setMessage({ type: 'success', text: '테스트 모드: 비밀번호가 성공적으로 변경되었습니다.' });
        setTimeout(() => changeMode('login'), 1500);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setMessage({
        type: 'success',
        text: '🎉 비밀번호가 성공적으로 변경되었습니다! 새로운 비밀번호로 로그인해주세요.'
      });

      // URL의 복구 해시 파라미터 클리어
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setTimeout(() => {
        changeMode('login');
      }, 1800);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '비밀번호 변경 중 오류가 발생했습니다.' });
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

            {isAdmin && (
              <button
                className="btn btn-warning mt-3 w-full justify-center font-bold flex align-center gap-1"
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1rem',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                }}
              >
                👑 회원가입 승인 관리 센터
              </button>
            )}

            <button className="btn btn-secondary mt-4 w-full justify-center" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : mode === 'forgot' ? (
          /* [비밀번호 찾기] 폼 */
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="bg-transparent border-0 cursor-pointer p-0 text-secondary hover-text-primary"
                onClick={() => changeMode('login')}
                title="로그인으로 돌아가기"
                style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 style={{ margin: 0 }}>비밀번호 찾기</h2>
            </div>
            <p className="auth-subtitle sub-text">
              가입하신 이메일 주소를 입력하시면 비밀번호를 재설정할 수 있는 링크를 보내드립니다.
            </p>

            {message && (
              <div className={`alert-box alert-${message.type} mt-3 p-3 rounded`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {message.type === 'success' ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
                <span>{message.text}</span>
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

            <button type="submit" className="btn btn-primary btn-full mt-4 w-full justify-center" disabled={loading}>
              {loading ? '메일 전송 중...' : '비밀번호 재설정 메일 발송'}
            </button>

            <div className="auth-switch text-center mt-3 sub-text">
              <button
                type="button"
                className="text-primary underline bg-transparent border-0 cursor-pointer"
                onClick={() => changeMode('login')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← 로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        ) : mode === 'reset' ? (
          /* [새 비밀번호 설정] 폼 (재설정 메일 링크 클릭 시 진입) */
          <form onSubmit={handleResetPassword} className="auth-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <KeyRound size={22} className="text-primary" />
              <h2 style={{ margin: 0 }}>새 비밀번호 설정</h2>
            </div>
            <p className="auth-subtitle sub-text">
              새롭게 사용할 비밀번호(최소 6자 이상)를 입력해 주세요.
            </p>

            {message && (
              <div className={`alert-box alert-${message.type} mt-3 p-3 rounded`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {message.type === 'success' ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="form-group mt-3">
              <label>새 비밀번호</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group mt-3">
              <label>새 비밀번호 확인</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  placeholder="새 비밀번호 다시 입력"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full mt-4 w-full justify-center" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경 완료'}
            </button>

            <div className="auth-switch text-center mt-3 sub-text">
              <button
                type="button"
                className="text-primary underline bg-transparent border-0 cursor-pointer"
                onClick={() => changeMode('login')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                로그인 화면으로 이동
              </button>
            </div>
          </form>
        ) : (
          /* [로그인 및 회원가입] 폼 */
          <form onSubmit={handleAuth} className="auth-form">
            <h2>{mode === 'signup' ? '회원가입 (즉시 승인)' : '로그인'}</h2>
            <p className="auth-subtitle sub-text">
              이메일 인증 절차 없이 가입 즉시 서재에 들어오실 수 있습니다.
            </p>

            {message && (
              <div className={`alert-box alert-${message.type} mt-3 p-3 rounded`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {message.type === 'success' ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
                <span>{message.text}</span>
              </div>
            )}

            {mode === 'signup' && (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>비밀번호</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => changeMode('forgot')}
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--primary-color, #4f46e5)',
                      textDecoration: 'underline',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                )}
              </div>
              <div className="input-icon-wrapper" style={{ marginTop: '0.4rem' }}>
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

            {mode === 'login' && (
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
              {loading ? '처리 중...' : mode === 'signup' ? '회원가입 및 즉시 서재 입장' : '로그인하기'}
            </button>

            <div className="auth-switch text-center mt-3 sub-text">
              {mode === 'signup' ? (
                <span>이미 계정이 있으신가요? <button type="button" className="text-primary underline bg-transparent border-0 cursor-pointer" onClick={() => changeMode('login')}>로그인</button></span>
              ) : (
                <span>처음이신가요? <button type="button" className="text-primary underline bg-transparent border-0 cursor-pointer" onClick={() => changeMode('signup')}>회원가입</button></span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
