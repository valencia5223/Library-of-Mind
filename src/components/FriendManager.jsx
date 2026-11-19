import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Users, UserPlus, Heart, ExternalLink, Trash2, ShieldAlert, Sparkles, Mail, Bell, MessageSquare } from 'lucide-react';
import SharedLiveMemoModal from './SharedLiveMemoModal';
import { subscribeUserToPush, isNotificationSupported, getNotificationPermission } from '../utils/webPush';

import { toast, confirmDialog, alertDialog } from '../utils/notify';
export default function FriendManager({ user, onViewFriendBookshelf, currentViewedFriend, onBackToMyBookshelf }) {
  const [friendEmail, setFriendEmail] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeFriendForMemo, setActiveFriendForMemo] = useState(null);
  const [isNotifHovered, setIsNotifHovered] = useState(false);

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
      // 1. 해당 이메일의 유저가 있는지 확인. profiles 는 나·친구만 보이게 막혀 있어서(전체 목록 노출 방지)
      //    이메일이 정확히 같은 한 명만 찾는 RPC find_profile_by_email 을 쓴다.
      const { data: profileData, error: profileError } = await supabase
        .rpc('find_profile_by_email', { p_email: friendEmail.trim() })
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
    if (!await confirmDialog(`${displayName} 님을 친구 목록에서 삭제하시겠습니까?`)) return;

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
        
        {/* 심플 깔끔 알림 갱신 캡슐 버튼 */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            if (!isNotificationSupported()) {
              toast('이 브라우저/기기는 데스크톱 푸시 알림을 지원하지 않습니다.');
              return;
            }
            const perm = getNotificationPermission();
            if (perm === 'granted') {
              if (user) await subscribeUserToPush(user.id, user.email, true);
              toast('알림이 켜져 있습니다. 창을 닫아 두어도 흔들기·채팅 알림을 받을 수 있어요.', { type: 'success' });
            } else if (perm === 'denied') {
              alertDialog('주소창 왼쪽 자물쇠(사이트 정보) → 알림을 "허용"으로 바꾼 뒤 새로고침해 주세요.', { title: '브라우저에서 알림이 차단되어 있어요' });
            } else {
              const res = await Notification.requestPermission();
              if (res === 'granted' && user) {
                await subscribeUserToPush(user.id, user.email, true);
                toast('알림을 허용했습니다.', { type: 'success' });
              }
            }
          }}
          title="인터넷 창이 닫혀 있어도 수신받는 데스크톱 푸시 알림 상태 켜기/갱신"
        >
          <Bell size={14} />
          <span>
            {!isNotificationSupported() ? '알림 미지원' : getNotificationPermission() === 'granted' ? '알림 켜짐 (갱신)' : getNotificationPermission() === 'denied' ? '알림 차단됨' : '알림 켜기'}
          </span>
        </button>
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
              <div className="input-with-icon mt-1">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  className="form-control"
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
                <div key={friend.id} className="friend-row">
                  <div className="friend-avatar" aria-hidden="true">
                    {(friend.name || friend.email || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">{friend.name || friend.email.split('@')[0]}</div>
                    <div className="friend-email">{friend.email}</div>
                    <div className="friend-stats">
                      책 <strong>{friend.bookCount}</strong>권 · 완독 <strong className="text-green">{friend.completedCount}</strong>권
                    </div>
                  </div>
                  <div className="friend-row-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveFriendForMemo(friend)}>
                      <MessageSquare size={14} /> 채팅
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onViewFriendBookshelf(friend.friend_id, friend.email, friend.name)}>
                      <ExternalLink size={14} /> 서재 방문
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm friend-delete"
                      onClick={() => handleDeleteFriend(friend.id, friend.email, friend.name)}
                      title="친구 삭제"
                      aria-label="친구 삭제"
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
