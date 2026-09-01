import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Users, UserPlus, Heart, ExternalLink, Trash2, ShieldAlert, Sparkles, Mail, Zap, MessageSquare } from 'lucide-react';
import SharedLiveMemoModal from './SharedLiveMemoModal';
import { subscribeUserToPush, isNotificationSupported, getNotificationPermission } from '../utils/webPush';

export default function FriendManager({ user, onViewFriendBookshelf, currentViewedFriend, onBackToMyBookshelf }) {
  const [friendEmail, setFriendEmail] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeFriendForMemo, setActiveFriendForMemo] = useState(null);

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchFriends();
    }
  }, [user]);

  const fetchFriends = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. 내가 추가한 친구 관계 목록 가져오기
      const { data: friendsData, error: friendsError } = await supabase
        .from('user_friends')
        .select('id, friend_id')
        .eq('user_id', user.id);

      if (friendsError) throw friendsError;

      if (friendsData && friendsData.length > 0) {
        // 2. 관계자들의 이메일/이름 프로필 조회
        const friendIds = friendsData.map(f => f.friend_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', friendIds);

        if (profilesError) throw profilesError;

        // 3. 로컬에서 profiles 이메일/이름 매핑
        const mappedFriends = friendsData.map(f => {
          const prof = profilesData?.find(p => p.id === f.friend_id);
          return {
            id: f.id,
            friend_id: f.friend_id,
            email: prof ? prof.email : '알 수 없는 사용자',
            name: prof?.name || (prof?.email ? prof.email.split('@')[0] : '')
          };
        });

        // 4. 각 친구들의 실시간 독서 통계 획득 (user_books SELECT 가이드)
        const loadedFriends = await Promise.all(
          mappedFriends.map(async (friend) => {
            let bookCount = 0;
            let completedCount = 0;
            try {
              const { data: bData } = await supabase
                .from('user_books')
                .select('status')
                .eq('user_id', friend.friend_id);
              
              if (bData) {
                bookCount = bData.length;
                completedCount = bData.filter(b => b.status === 'READ').length;
              }
            } catch (e) {
              console.warn(`책 권수 조회 실패 (친구 또는 RLS 미반영):`, e);
            }

            return {
              ...friend,
              bookCount,
              completedCount
            };
          })
        );

        setFriendsList(loadedFriends);
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error('친구 목록 불러오기 오류:', err);
      if (err.message?.includes('relation "user_friends" does not exist')) {
        setErrorMsg('💡 안내: 친구 기능용 DB 스키마가 생성되지 않았습니다. supabase_bookshelf_schema.sql 파일 하단의 친구 테이블 관련 SQL 스크립트를 Supabase SQL Editor에 실행(Run)해 주세요.');
      } else {
        setErrorMsg('친구 목록을 불러오지 못했습니다. DB 상태를 확인해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendEmail.trim()) return;

    if (!isSupabaseConfigured()) {
      setErrorMsg('데모 모드에서는 친구 기능을 사용할 수 없습니다. Supabase 설정을 완료해 주세요.');
      return;
    }

    if (friendEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setErrorMsg('본인 자신은 친구로 추가할 수 없습니다.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. 해당 이메일의 유저가 profiles 테이블에 존재하는지 확인
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('email', friendEmail.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        setErrorMsg('가입되지 않은 이메일 주소이거나 프로필 동기화가 아직 진행되지 않은 유저입니다.');
        setLoading(false);
        return;
      }

      // 2. 이미 등록되었는지 DB 및 로컬 상태 중복 확인 (예외 에러 사전방지)
      const isAlreadyFriend = friendsList.some(f => f.friend_id === profileData.id);
      if (isAlreadyFriend) {
        setErrorMsg('이미 친구로 등록된 이메일 주소입니다.');
        setLoading(false);
        return;
      }

      const { data: checkExist } = await supabase
        .from('user_friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', profileData.id)
        .maybeSingle();

      if (checkExist) {
        setErrorMsg('이미 친구로 등록된 이메일 주소입니다.');
        setLoading(false);
        return;
      }

      // 3. user_friends 테이블에 삽입
      const { error: insertError } = await supabase
        .from('user_friends')
        .insert([{
          user_id: user.id,
          friend_id: profileData.id
        }]);

      if (insertError) throw insertError;

      const friendDisplayName = profileData.name ? `${profileData.name} (${profileData.email})` : profileData.email;
      setSuccessMsg(`🎉 ${friendDisplayName} 님을 친구로 정상 등록했습니다!`);
      setFriendEmail('');
      await fetchFriends();
    } catch (err) {
      console.error('친구 추가 오류:', err);
      if (err.message?.includes('relation "user_friends" does not exist')) {
        setErrorMsg('💡 안내: DB 스키마가 생성되지 않았습니다. supabase_bookshelf_schema.sql 스크립트 실행이 필요합니다.');
      } else {
        setErrorMsg('친구를 추가하는 도중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFriend = async (friendshipId, email, name) => {
    const displayName = name ? `${name} (${email})` : email;
    if (!window.confirm(`${displayName} 님을 친구 목록에서 삭제하시겠습니까?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_friends')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      setSuccessMsg('친구 관계가 영구 삭제되었습니다.');
      await fetchFriends();
    } catch (err) {
      console.error('친구 삭제 에러:', err);
      setErrorMsg('친구 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="friend-manager-container p-4">
      <div className="stats-header text-center mb-4">
        <h2><Users className="text-pink inline-block me-2" size={28} /> 소셜 서재 & 친구 관리</h2>
        <p className="sub-text mb-3">다른 독서가들의 이메일을 등록하고, 서재에 꽂힌 3D 명작 책장을 탐색해보세요.</p>
        
        {/* 데스크톱 알림 권한 확인 및 활성화 버튼 */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200 transition"
             onClick={async () => {
               if (!isNotificationSupported()) {
                 alert('이 브라우저/기기는 데스크톱 푸시 알림을 지원하지 않습니다.');
                 return;
               }
               const perm = getNotificationPermission();
               if (perm === 'granted') {
                 if (user) await subscribeUserToPush(user.id, user.email, true);
                 alert('✅ [데스크톱 알림 활성화 완수]\nVAPID 푸시 키가 최신 상태로 갱신되었습니다! 인터넷 창이 닫혀 있어도 흔들기 및 라이브 채팅 알림을 팝업으로 수신받으실 수 있습니다.');
               } else if (perm === 'denied') {
                 alert('⚠️ [브라우저 알림이 차단되어 있습니다]\n\n해결 방법:\n1. 브라우저 주소창 맨 좌측의 🔒(자물쇠/설정) 아이콘 클릭\n2. [알림] 권한을 [허용]으로 변경\n3. 페이지 새로고침(F5) 실행');
               } else {
                 const res = await Notification.requestPermission();
                 if (res === 'granted' && user) {
                   await subscribeUserToPush(user.id, user.email, true);
                   alert('🎉 데스크톱 알림 권한이 정상적으로 허용되었습니다!');
                 }
               }
             }}>
          <Zap size={14} className="text-amber-500 animate-pulse" />
          <span>데스크톱 오프라인 알림 상태: </span>
          <strong className={getNotificationPermission() === 'granted' ? 'text-green-600' : getNotificationPermission() === 'denied' ? 'text-red-500' : 'text-blue-600'}>
            {!isNotificationSupported() ? '⚪ 미지원 (모바일 Webview)' : getNotificationPermission() === 'granted' ? '🟢 허용됨 (수신 가능)' : getNotificationPermission() === 'denied' ? '🔴 차단됨 (클릭하여 설정)' : '🟡 권한 설정하기 (클릭)'}
          </strong>
        </div>
      </div>

      {currentViewedFriend && (
        <div className="friend-banner-status flex justify-between align-middle p-3 mb-4 rounded border-amber" style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div className="flex align-middle text-amber-800">
            <Sparkles className="me-2 text-warning animate-bounce" size={18} />
            <span>현재 <strong>{currentViewedFriend.name ? `${currentViewedFriend.name} (${currentViewedFriend.email})` : currentViewedFriend.email}</strong> 님의 책장을 탐구하고 있습니다.</span>
          </div>
          <button className="btn btn-secondary px-3 py-1 btn-sm" onClick={onBackToMyBookshelf}>
            내 서재로 환원
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger mb-4 flex align-middle">
          <ShieldAlert className="me-2" size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success mb-4 flex align-middle" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          <Sparkles className="me-2" size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 친구 추가 폼 구역 */}
        <div className="card p-4 col-span-1 shadow-sm h-fit">
          <h3 className="flex align-middle font-bold text-lg mb-3">
            <UserPlus className="me-2 text-blue" size={20} /> 친구 추가
          </h3>
          <p className="text-sm text-sub mb-4">가입된 친구의 이메일을 입력하세요.</p>
          <form onSubmit={handleAddFriend}>
            <div className="mb-3">
              <label className="form-label font-semibold text-xs">친구 이메일 주소</label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-gray-400" />
                </span>
                <input
                  type="email"
                  className="form-control pl-10"
                  placeholder="friend@example.com"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary w-100 flex justify-center align-middle"
              disabled={loading}
            >
              {loading ? '추가하는 중...' : '친구 추가하기'}
            </button>
          </form>
        </div>

        {/* 내 친구 목록 구역 */}
        <div className="card p-4 col-span-2 shadow-sm">
          <h3 className="flex align-middle font-bold text-lg mb-3">
            <Users className="me-2 text-green" size={20} /> 내 친구 목록 ({friendsList.length}명)
          </h3>
          {loading && friendsList.length === 0 ? (
            <p className="text-center text-sub py-5">친구 목록을 불러오고 있습니다...</p>
          ) : friendsList.length === 0 ? (
            <div className="text-center py-5 text-sub bg-slate-50 rounded">
              <div className="text-3xl mb-2">🤝</div>
              <p>아직 등록된 친구가 없습니다.</p>
              <p className="text-xs">상단 폼을 통해 첫 번째 친구를 추가해보세요!</p>
            </div>
          ) : (
            <div className="friend-list-wrapper mt-3">
              {friendsList.map((friend) => (
                <div key={friend.id} className="friend-item-card flex justify-between align-middle border-b py-3 transition hover:bg-slate-50 px-2 rounded mb-2">
                  <div className="friend-details">
                    <div className="flex align-center gap-2">
                      {friend.name && (
                        <span className="font-extrabold text-slate-800" style={{ fontSize: '0.98rem' }}>{friend.name}</span>
                      )}
                      <span className="text-slate-500 text-xs font-medium">({friend.email})</span>
                    </div>
                    <div className="flex text-xs text-sub mt-1">
                      <span className="me-3">총 책 수: <strong>{friend.bookCount}권</strong></span>
                      <span>완독 수: <strong className="text-green">{friend.completedCount}권</strong></span>
                    </div>
                  </div>
                  <div className="friend-actions flex gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm flex align-middle px-2.5 font-bold"
                      style={{ fontSize: '0.8rem', color: '#0284c7', borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}
                      onClick={() => setActiveFriendForMemo(friend)}
                    >
                      <MessageSquare className="me-1 text-sky-600" size={14} /> 실시간 채팅
                    </button>

                    <button
                      className="btn btn-outline-primary btn-sm flex align-middle px-3"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => onViewFriendBookshelf(friend.friend_id, friend.email, friend.name)}
                    >
                      <ExternalLink className="me-1" size={14} /> 서재 방문
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm p-1.5"
                      onClick={() => handleDeleteFriend(friend.id, friend.email, friend.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1:1 친구 실시간 라이브 메모장 모달 */}
      {activeFriendForMemo && (
        <SharedLiveMemoModal
          user={user}
          friend={activeFriendForMemo}
          onClose={() => setActiveFriendForMemo(null)}
        />
      )}
    </div>
  );
}
