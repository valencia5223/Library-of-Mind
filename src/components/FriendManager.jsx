import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Users, UserPlus, Heart, ExternalLink, Trash2, ShieldAlert, Sparkles, Mail } from 'lucide-react';

export default function FriendManager({ user, onViewFriendBookshelf, currentViewedFriend, onBackToMyBookshelf }) {
  const [friendEmail, setFriendEmail] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchFriends();
    }
  }, [user]);

  const fetchFriends = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. 내가 추가한 친구 목록 조회
      const { data: friendsData, error: friendsError } = await supabase
        .from('user_friends')
        .select('*, profiles!user_friends_friend_id_fkey(email)')
        .eq('user_id', user.id);

      if (friendsError) throw friendsError;

      // 2. 각 친구의 도서 건수(책 개수)를 가져옴
      const loadedFriends = await Promise.all(
        (friendsData || []).map(async (friend) => {
          const friendEmail = friend.profiles?.email || '알 수 없는 사용자';
          
          let bookCount = 0;
          let completedCount = 0;
          try {
            // RLS 정책이 친구의 user_books SELECT를 허용하도록 되어 있으므로 조회 가능
            const { data: bData } = await supabase
              .from('user_books')
              .select('status')
              .eq('user_id', friend.friend_id);
            
            if (bData) {
              bookCount = bData.length;
              completedCount = bData.filter(b => b.status === 'READ').length;
            }
          } catch (e) {
            console.warn(`책 권수 조회 실패 (친구 또는 스키마 미반영):`, e);
          }

          return {
            id: friend.id,
            friend_id: friend.friend_id,
            email: friendEmail,
            bookCount,
            completedCount
          };
        })
      );

      setFriendsList(loadedFriends);
    } catch (err) {
      console.error('친구 목록 불러오기 오류:', err);
      // 테이블 누락 경고 처리
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
        .select('id, email')
        .eq('email', friendEmail.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        setErrorMsg('가입되지 않은 이메일 주소이거나 프로필 동기화가 아직 진행되지 않은 유저입니다.');
        setLoading(false);
        return;
      }

      // 2. 이미 등록된 친구인지 확인
      const isAlreadyFriend = friendsList.some(f => f.friend_id === profileData.id);
      if (isAlreadyFriend) {
        setErrorMsg('이미 등록된 친구입니다.');
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

      setSuccessMsg(`🎉 ${friendEmail} 님을 친구로 정상 등록했습니다!`);
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

  const handleDeleteFriend = async (friendshipId, email) => {
    if (!window.confirm(`${email} 님을 친구 목록에서 삭제하시겠습니까?`)) return;

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
      <div className="stats-header text-center mb-5">
        <h2><Users className="text-pink inline-block me-2" size={28} /> 소셜 서재 & 친구 관리</h2>
        <p className="sub-text">다른 독서가들의 이메일을 등록하고, 서재에 꽂힌 3D 명작 책장을 탐색해보세요.</p>
      </div>

      {currentViewedFriend && (
        <div className="friend-banner-status flex justify-between align-middle p-3 mb-4 rounded border-amber" style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div className="flex align-middle text-amber-800">
            <Sparkles className="me-2 text-warning animate-bounce" size={18} />
            <span>현재 <strong>{currentViewedFriend.email}</strong> 님의 책장을 탐구하고 있습니다.</span>
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
                    <span className="font-bold text-slate-800">{friend.email}</span>
                    <div className="flex text-xs text-sub mt-1">
                      <span className="me-3">총 책 수: <strong>{friend.bookCount}권</strong></span>
                      <span>완독 수: <strong className="text-green">{friend.completedCount}권</strong></span>
                    </div>
                  </div>
                  <div className="friend-actions flex gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm flex align-middle px-3"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => onViewFriendBookshelf(friend.friend_id, friend.email)}
                    >
                      <ExternalLink className="me-1" size={14} /> 서재 방문
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm p-1.5"
                      onClick={() => handleDeleteFriend(friend.id, friend.email)}
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
    </div>
  );
}
