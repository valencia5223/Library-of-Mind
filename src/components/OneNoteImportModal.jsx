import React, { useState, useEffect } from 'react';
import { X, NotebookText, LogOut, CheckSquare, Square, Loader2, Users, RefreshCw } from 'lucide-react';
import {
  isOneNoteConfigured,
  getSignedInAccount,
  signInMicrosoft,
  signOutMicrosoft,
  listSections,
  listPages,
  NEED_LOGIN
} from '../utils/oneNote';
import {
  oneNoteScheduleId,
  toLocalDateTime,
  loadShareMap,
  saveShareMap,
  loadAutoSync,
  saveAutoSync,
  buildScheduleItem
} from '../utils/oneNoteSync';

// OneNote 페이지를 골라 일정으로 가져오는 창
// onImport([{ id, title, date, time, memo, shared_friend_id }]) 로 넘기면 달력이 저장한다.
export default function OneNoteImportModal({ onClose, onImport, importedIds = new Set(), userId = null, friendsList = [] }) {
  const [account, setAccount] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [dateBasis, setDateBasis] = useState('created'); // 'created' | 'modified'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [shareMap, setShareMap] = useState(() => loadShareMap(userId));
  const [autoSync, setAutoSync] = useState(() => loadAutoSync(userId));

  const section = sections.find(s => s.id === sectionId);
  const notebookFriendId = section?.notebookShared ? (shareMap[section.notebookId] || '') : '';
  const notebookFriend = friendsList.find(f => f.id === notebookFriendId);

  const setNotebookFriend = (friendId) => {
    if (!section) return;
    const next = { ...shareMap };
    if (friendId) next[section.notebookId] = friendId;
    else delete next[section.notebookId];
    setShareMap(next);
    saveShareMap(userId, next);
  };

  // 이 섹션 자동 동기화: 켠 뒤에 새로 만들거나 고친 페이지가 달력에 저절로 들어감
  const sectionAutoSync = section ? autoSync[section.id] : null;
  const toggleAutoSync = () => {
    if (!section) return;
    const next = { ...autoSync };
    if (next[section.id]) {
      delete next[section.id];
    } else {
      next[section.id] = {
        name: section.name,
        notebook: section.notebook,
        notebookId: section.notebookId,
        notebookShared: section.notebookShared,
        dateBasis,
        lastSync: new Date().toISOString()
      };
    }
    setAutoSync(next);
    saveAutoSync(userId, next);
  };

  // 날짜 기준을 바꾸면 자동 동기화 설정에도 반영
  useEffect(() => {
    if (!section || !autoSync[section.id] || autoSync[section.id].dateBasis === dateBasis) return;
    const next = { ...autoSync, [section.id]: { ...autoSync[section.id], dateBasis } };
    setAutoSync(next);
    saveAutoSync(userId, next);
  }, [dateBasis]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      console.warn('OneNote 오류:', e);
      if (e?.code === NEED_LOGIN) setAccount(null);
      if (e?.errorCode !== 'user_cancelled') setError(e.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const loadSections = () => run('섹션 불러오는 중…', async () => {
    const list = await listSections();
    setSections(list);
    if (list.length > 0) setSectionId(list[0].id);
  });

  useEffect(() => {
    if (!isOneNoteConfigured()) return;
    getSignedInAccount().then(acc => {
      if (acc) {
        setAccount(acc);
        loadSections();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sectionId) return;
    setSelected(new Set());
    run('페이지 불러오는 중…', async () => setPages(await listPages(sectionId)));
  }, [sectionId]);

  const handleSignIn = () => run('로그인 중…', async () => {
    const acc = await signInMicrosoft();
    setAccount(acc);
    const list = await listSections();
    setSections(list);
    if (list.length > 0) setSectionId(list[0].id);
  });

  const handleSignOut = async () => {
    await signOutMicrosoft();
    setAccount(null);
    setSections([]);
    setSectionId('');
    setPages([]);
    setSelected(new Set());
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = pages.length > 0 && selected.size === pages.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pages.map(p => p.id)));

  const handleImport = () => run('본문 가져오는 중…', async () => {
    const targets = pages.filter(p => selected.has(p.id));
    const result = [];
    // Graph 요청 제한을 피하려고 한 페이지씩 순서대로
    for (let i = 0; i < targets.length; i++) {
      setBusy(`본문 가져오는 중… (${i + 1}/${targets.length})`);
      result.push(await buildScheduleItem(targets[i], { dateBasis, friendId: notebookFriend?.id }));
    }
    onImport(result);
    onClose();
  });

  const fmt = (iso) => {
    const { date, time } = toLocalDateTime(iso);
    return `${date} ${time}`;
  };

  return (
    <div className="modal-overlay modal-backdrop" onClick={onClose}>
      <div className="modal-card calendar-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', width: '94%' }}>
        <div className="modal-header">
          <h3 className="modal-title flex align-center gap-2">
            <NotebookText size={20} style={{ color: '#7719aa' }} />
            OneNote에서 일정 가져오기
          </h3>
          <button className="modal-close" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {!isOneNoteConfigured() ? (
            <p className="text-sm" style={{ color: '#be123c' }}>
              Microsoft 앱 클라이언트 ID(VITE_MS_CLIENT_ID)가 설정되지 않았습니다.
            </p>
          ) : !account ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p className="text-sm sub-text" style={{ marginBottom: '1rem' }}>
                Microsoft 개인 계정으로 로그인하면 OneNote 페이지를 골라 달력에 넣을 수 있습니다.
              </p>
              <button type="button" className="btn btn-primary font-bold" onClick={handleSignIn} disabled={Boolean(busy)}>
                Microsoft 계정으로 로그인
              </button>
            </div>
          ) : (
            <>
              <div className="flex align-center justify-between gap-2">
                <span className="text-xs sub-text">{account.username}</span>
                <button type="button" className="btn btn-secondary btn-sm flex align-center gap-1" onClick={handleSignOut}>
                  <LogOut size={14} /> 로그아웃
                </button>
              </div>

              <div>
                <label className="form-label font-bold text-xs">섹션</label>
                <select className="input-field mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={Boolean(busy)}>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{autoSync[s.id] ? '🔄 ' : ''}{s.notebookShared ? '👥 ' : ''}{s.notebook ? `${s.notebook} › ${s.name}` : s.name}</option>
                  ))}
                </select>
              </div>

              {section?.notebookShared && (
                <div style={{ border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', borderRadius: '10px', padding: '0.7rem 0.85rem' }}>
                  <label className="form-label font-bold text-xs flex align-center gap-1" style={{ color: '#0369a1' }}>
                    <Users size={14} /> 공유 노트북 · 함께 볼 친구
                  </label>
                  <select
                    className="input-field mt-1 font-bold"
                    value={notebookFriendId}
                    onChange={(e) => setNotebookFriend(e.target.value)}
                    disabled={Boolean(busy)}
                  >
                    <option value="">🔒 공유 안함 (내 달력에만)</option>
                    {friendsList.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name || f.email.split('@')[0]} 님과 공유 ({f.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs sub-text mt-1">
                    {friendsList.length === 0
                      ? '등록된 친구가 없습니다. 친구 탭에서 먼저 친구를 추가하세요.'
                      : '이 노트북에서 가져오는 페이지는 고른 친구 달력에도 자동으로 공유됩니다. 노트북마다 한 번만 고르면 기억합니다.'}
                  </p>
                </div>
              )}

              {section && (
                <div
                  className="flex align-center justify-between gap-2"
                  style={{ border: `1px solid ${sectionAutoSync ? '#c4b5fd' : '#e2e8f0'}`, backgroundColor: sectionAutoSync ? '#f5f3ff' : 'transparent', borderRadius: '10px', padding: '0.6rem 0.85rem' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="text-xs font-bold flex align-center gap-1" style={{ color: '#7719aa' }}>
                      <RefreshCw size={14} /> 이 섹션 자동 동기화 {sectionAutoSync ? '켜짐' : '꺼짐'}
                    </div>
                    <div className="text-xs sub-text mt-1">
                      {sectionAutoSync
                        ? '일정 탭을 열 때와 열어 둔 동안 5분마다, 새로 쓰거나 고친 페이지를 달력에 넣습니다.'
                        : '켜면 앞으로 이 섹션에 새로 쓰는 노트가 달력에 저절로 들어갑니다. 지금 있는 페이지는 아래에서 골라 가져오세요.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${sectionAutoSync ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={toggleAutoSync}
                    style={{ flexShrink: 0 }}
                  >
                    {sectionAutoSync ? '끄기' : '켜기'}
                  </button>
                </div>
              )}

              <div>
                <label className="form-label font-bold text-xs">달력에 넣을 날짜</label>
                <div className="flex gap-2 mt-1">
                  {[['created', '페이지 만든 날'], ['modified', '마지막 수정한 날']].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn btn-sm ${dateBasis === key ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setDateBasis(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex align-center justify-between">
                  <label className="form-label font-bold text-xs">페이지 ({selected.size}/{pages.length} 선택)</label>
                  {pages.length > 0 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={toggleAll}>
                      {allSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  {pages.length === 0 && !busy && (
                    <p className="text-xs sub-text" style={{ padding: '1rem', textAlign: 'center' }}>페이지가 없습니다.</p>
                  )}
                  {pages.map(p => {
                    const checked = selected.has(p.id);
                    const already = importedIds.has(oneNoteScheduleId(p.id));
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className="flex align-center gap-2"
                        style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: checked ? '#f5f3ff' : 'transparent' }}
                      >
                        {checked ? <CheckSquare size={18} style={{ color: '#7719aa', flexShrink: 0 }} /> : <Square size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="text-sm font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                          <div className="text-xs sub-text">{fmt(dateBasis === 'created' ? p.created : p.modified)}</div>
                        </div>
                        {already && (
                          <span className="text-xs" style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>가져옴</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs sub-text mt-1">이미 가져온 페이지를 다시 가져오면 최신 내용으로 덮어씁니다.</p>
              </div>
            </>
          )}

          {busy && (
            <p className="text-xs flex align-center gap-1" style={{ color: '#7719aa' }}>
              <Loader2 size={14} /> {busy}
            </p>
          )}
          {error && <p className="text-xs" style={{ color: '#be123c' }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            {account && (
              <button type="button" className="btn btn-primary font-bold" onClick={handleImport} disabled={selected.size === 0 || Boolean(busy)}>
                {selected.size}개 일정으로 가져오기{notebookFriend ? ` (${notebookFriend.name || notebookFriend.email.split('@')[0]}님과 공유)` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
