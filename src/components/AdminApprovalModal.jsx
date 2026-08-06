import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, ShieldCheck, UserCheck, UserX, Clock, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminApprovalModal({ isOpen, onClose, user }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // 가입 승인 대기 유저 목록 조회
  const fetchPendingUsers = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      if (!isSupabaseConfigured()) {
        // 데모 데이터
        setPendingUsers([
          { id: 'demo-user-1', email: 'guest1@example.com', full_name: '김철수', created_at: new Date().toISOString() },
          { id: 'demo-user-2', email: 'reader22@naver.com', full_name: '이영희', created_at: new Date(Date.now() - 3600000).toISOString() }
        ]);
        setLoading(false);
        return;
      }

      // Supabase RPC 또는 RPC 쿼리를 통한 승인 대기 유저 목록 수집
      const { data, error } = await supabase.rpc('get_pending_approval_users');

      if (error) {
        console.warn('RPC 승인 대기 목록 조회 시도 (Direct Fallback):', error);
        // Fallback: shared_memos / profiles 연동 조회 또는 대시보드 연동
        const { data: userProfiles, error: pError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('is_approved', false);
          
        if (!pError && userProfiles) {
          setPendingUsers(userProfiles);
        } else {
          // 로컬 스토리지에 기록된 가입 대기 유저 fallback
          const localPending = JSON.parse(localStorage.getItem('pending_signup_requests') || '[]');
          setPendingUsers(localPending);
        }
      } else if (data) {
        setPendingUsers(data);
      }
    } catch (err) {
      console.error('승인 대기 유저 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // React Hook은 반드시 조건문(if (!isOpen) return null) 위에 배치되어야 함 (Rules of Hooks 준수)
  useEffect(() => {
    if (isOpen) {
      fetchPendingUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 가입 승인 동의 처리 (is_approved: true로 갱신)
  const handleApprove = async (targetUser) => {
    setProcessingId(targetUser.id);
    setActionMessage(null);
    try {
      if (!isSupabaseConfigured()) {
        setPendingUsers(prev => prev.filter(u => u.id !== targetUser.id));
        setActionMessage({ type: 'success', text: `✅ ${targetUser.email} 님의 회원가입이 승인되었습니다!` });
        return;
      }

      // 1. RPC 함수로 가입 승인 갱신 시도
      const { error: rpcErr } = await supabase.rpc('approve_user_signup', { target_user_id: targetUser.id });

      if (rpcErr) {
        // Fallback: user_profiles 테이블 승인 상태 갱신
        await supabase
          .from('user_profiles')
          .upsert({ id: targetUser.id, email: targetUser.email, is_approved: true });
      }

      // 로컬 스토리지 대기 리스트에서도 삭제
      const localPending = JSON.parse(localStorage.getItem('pending_signup_requests') || '[]');
      const updatedLocal = localPending.filter(u => u.email !== targetUser.email);
      localStorage.setItem('pending_signup_requests', JSON.stringify(updatedLocal));

      setPendingUsers(prev => prev.filter(u => u.id !== targetUser.id && u.email !== targetUser.email));
      setActionMessage({ type: 'success', text: `✅ ${targetUser.email} 님의 가입이 성공적으로 승인되었습니다!` });
    } catch (err) {
      console.error('승인 처리 실패:', err);
      setActionMessage({ type: 'error', text: '승인 처리 중 오류가 발생했습니다.' });
    } finally {
      setProcessingId(null);
    }
  };

  // 가입 요청 거절
  const handleReject = async (targetUser) => {
    if (!window.confirm(`${targetUser.email} 님의 회원가입 신청을 거절하시겠습니까?`)) return;

    setProcessingId(targetUser.id);
    try {
      const localPending = JSON.parse(localStorage.getItem('pending_signup_requests') || '[]');
      const updatedLocal = localPending.filter(u => u.email !== targetUser.email);
      localStorage.setItem('pending_signup_requests', JSON.stringify(updatedLocal));

      setPendingUsers(prev => prev.filter(u => u.id !== targetUser.id && u.email !== targetUser.email));
      setActionMessage({ type: 'success', text: `가입 신청을 거절했습니다.` });
    } catch (err) {
      console.error('거절 실패:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={onClose}>
      <div
        className="modal-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '100%',
          borderRadius: '16px',
          padding: '1.8rem'
        }}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="flex align-center gap-2 mb-3" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <ShieldCheck size={24} color="#0284c7" />
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              👑 관리자 회원가입 승인 센터
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              가입을 신청한 사용자를 1초 만에 확인하고 승인합니다.
            </span>
          </div>
        </div>

        {actionMessage && (
          <div className={`alert-box alert-${actionMessage.type} mb-3 p-3 rounded flex align-center gap-2`}>
            {actionMessage.type === 'success' ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{actionMessage.text}</span>
          </div>
        )}

        <div className="flex justify-between align-center mb-3">
          <span className="font-bold text-slate-700" style={{ fontSize: '0.9rem' }}>
            가입 승인 대기 중인 회원 (<b style={{ color: '#0284c7' }}>{pendingUsers.length}</b>명)
          </span>
          <button className="btn btn-outline btn-xs flex align-center gap-1" onClick={fetchPendingUsers} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-center text-slate-400 flex flex-col align-center justify-center">
            <RefreshCw size={24} className="animate-spin text-primary mb-2" />
            <p style={{ fontSize: '0.88rem' }}>가입 대기 회원 정보를 조회하는 중입니다...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div
            className="p-5 text-center rounded-xl"
            style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', color: '#64748b' }}
          >
            <Clock size={32} className="text-slate-300 mb-2" style={{ display: 'block', margin: '0 auto 8px auto' }} />
            <p className="font-bold mb-1" style={{ color: '#334155' }}>현재 가입 승인 대기 중인 회원이 없습니다.</p>
            <span style={{ fontSize: '0.78rem' }}>새로운 사용자가 회원가입을 신청하면 여기에 즉시 표시됩니다.</span>
          </div>
        ) : (
          <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingUsers.map((u) => (
              <div
                key={u.id || u.email}
                className="flex align-center justify-between p-3 rounded-xl"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                }}
              >
                <div>
                  <div className="font-bold text-slate-800" style={{ fontSize: '0.92rem' }}>
                    {u.full_name || u.name || '신규 신청자'}
                  </div>
                  <div className="text-xs text-sky-600 font-semibold">{u.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5" style={{ fontSize: '0.72rem' }}>
                    신청 일시: {u.created_at ? new Date(u.created_at).toLocaleString() : '방금 전'}
                  </div>
                </div>

                <div className="flex align-center gap-1.5">
                  <button
                    className="btn btn-success btn-sm font-bold flex align-center gap-1"
                    onClick={() => handleApprove(u)}
                    disabled={processingId === u.id}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    <UserCheck size={14} /> 승인하기
                  </button>
                  <button
                    className="btn btn-danger btn-sm font-bold flex align-center gap-1"
                    onClick={() => handleReject(u)}
                    disabled={processingId === u.id}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    <UserX size={14} /> 거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 text-end" style={{ borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
