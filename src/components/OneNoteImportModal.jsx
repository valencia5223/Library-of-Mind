import React, { useState, useEffect, useRef } from 'react';
import { X, NotebookText, LogOut, CheckSquare, Square, Loader2, Users, RefreshCw } from 'lucide-react';
import {
  isOneNoteConfigured,
  getSignedInAccount,
  signInMicrosoft,
  signOutMicrosoft,
  listSections,
  listPagesChunk,
  NEED_LOGIN
} from '../utils/oneNote';
import {
  oneNoteScheduleId,
  toLocalDateTime,
  loadShareMap,
  saveShareMap,
  sectionFriendId,
  withSectionFriend,
  loadAutoSync,
  saveAutoSync,
  buildScheduleItem,
  loadCache,
  saveCache,
  clearCache,
  mapLimit,
  runAutoSync,
  trackSection,
  SYNC_LOOKBACK_DAYS
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
  const [busy, setBusy] = useState(''); // 로그인·가져오기처럼 창을 잠그는 작업
  const [loading, setLoading] = useState(''); // 목록을 뒤에서 받는 중 (창은 그대로 쓸 수 있음)
  const [nextLink, setNextLink] = useState(null);
  const pagesReq = useRef(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [shareMap, setShareMap] = useState(() => loadShareMap(userId));
  const [autoSync, setAutoSync] = useState(() => loadAutoSync(userId));

  const section = sections.find(s => s.id === sectionId);
  const sectionFriend = section
    ? friendsList.find(f => f.id === sectionFriendId(shareMap, section.id, section.notebookShared ? section.notebookId : null)) || null
    : null;

  // 섹션마다 공유할 친구를 기억 (가져오기·자동 동기화 모두 이 설정을 따름)
  const setSectionFriend = (friendId) => {
    if (!section) return;
    const next = withSectionFriend(shareMap, section.id, friendId);
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
        lastSync: null // 처음에는 최근 30일을 확인
      };
    }
    setAutoSync(next);
    saveAutoSync(userId, next);
    if (next[section.id]) syncNow(section.id);
  };

  // 이 섹션 최근 30일을 바로 다시 확인
  const syncNow = (secId) => run('동기화 중…', async () => {
    const count = await runAutoSync(userId, onImport, { sectionIds: [secId], full: true });
    const latest = loadAutoSync(userId);
    setAutoSync(latest);
    if (latest[secId]?.blocked) {
      setError('암호로 보호된 섹션이라 OneNote 가 내용을 열어 주지 않습니다. OneNote 에서 섹션 암호를 해제해야 동기화할 수 있습니다.');
      return;
    }
    setInfo(count > 0
      ? `최근 ${SYNC_LOOKBACK_DAYS}일 안에 쓰거나 고친 페이지 ${count}개를 달력에 반영했습니다.`
      : `최근 ${SYNC_LOOKBACK_DAYS}일 안에 쓰거나 고친 페이지가 없습니다.`);
  });

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
    setInfo('');
    try {
      await fn();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  };

  const accountId = account?.homeAccountId || '';

  // 섹션: 저장해 둔 목록을 바로 보여 주고 뒤에서 새로 받음. 마지막으로 본 섹션을 다시 고름
  const loadSections = async (acc) => {
    const accId = acc.homeAccountId;
    const pick = (list) => {
      const last = loadCache(accId, 'lastSection');
      setSectionId(prev => (list.some(s => s.id === prev) ? prev : list.some(s => s.id === last) ? last : list[0]?.id || ''));
    };
    const cached = loadCache(accId, 'sections');
    if (cached) {
      setSections(cached);
      pick(cached);
    }
    setLoading(cached ? '목록 새로 고치는 중…' : '섹션 불러오는 중…');
    try {
      const list = await listSections();
      setSections(list);
      pick(list);
      saveCache(accId, 'sections', list);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading('');
    }
  };

  const handleError = (e) => {
    console.warn('OneNote 오류:', e);
    if (e?.code === NEED_LOGIN) setAccount(null);
    if (e?.errorCode !== 'user_cancelled') setError(e.message || String(e));
  };

  useEffect(() => {
    if (!isOneNoteConfigured()) return;
    getSignedInAccount().then(acc => {
      if (acc) {
        setAccount(acc);
        loadSections(acc);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지: 저장해 둔 목록을 바로 보여 주고, 최근 30개를 새로 받음 (섹션을 빨리 바꾸면 늦게 온 응답은 버림)
  useEffect(() => {
    if (!sectionId || !accountId) return;
    const req = ++pagesReq.current;
    setSelected(new Set());
    setError('');
    saveCache(accountId, 'lastSection', sectionId);
    const cached = loadCache(accountId, `pages_${sectionId}`);
    setPages(cached || []);
    setNextLink(null);
    setLoading(cached ? '목록 새로 고치는 중…' : '페이지 불러오는 중…');
    listPagesChunk(sectionId)
      .then(({ pages: list, next }) => {
        if (req !== pagesReq.current) return;
        setPages(list);
        setNextLink(next);
        saveCache(accountId, `pages_${sectionId}`, list);
      })
      .catch(e => {
        if (req === pagesReq.current) handleError(e);
      })
      .finally(() => {
        if (req === pagesReq.current) setLoading('');
      });
  }, [sectionId, accountId]);

  const loadMorePages = () => {
    if (!nextLink) return;
    const req = pagesReq.current;
    setLoading('페이지 더 불러오는 중…');
    listPagesChunk(sectionId, nextLink)
      .then(({ pages: list, next }) => {
        if (req !== pagesReq.current) return;
        setPages(prev => [...prev, ...list.filter(p => !prev.some(q => q.id === p.id))]);
        setNextLink(next);
      })
      .catch(e => {
        if (req === pagesReq.current) handleError(e);
      })
      .finally(() => {
        if (req === pagesReq.current) setLoading('');
      });
  };

  const handleSignIn = () => run('로그인 중…', async () => {
    const acc = await signInMicrosoft();
    setAccount(acc);
    await loadSections(acc);
  });

  const handleSignOut = async () => {
    clearCache(accountId);
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
    setBusy(`본문 가져오는 중… (0/${targets.length})`);
    // 3개씩 동시에 (너무 많이 보내면 OneNote 가 잠시 막음)
    const result = await mapLimit(
      targets,
      3,
      page => buildScheduleItem(page, { dateBasis, friendId: sectionFriend?.id }),
      done => setBusy(`본문 가져오는 중… (${done}/${targets.length})`)
    );
    // 이 섹션의 가져온 노트는 OneNote 에서 고치면 자동으로 다시 반영
    if (section) trackSection(userId, section, dateBasis);
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
                <select className="input-field mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={Boolean(busy) || sections.length === 0}>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{autoSync[s.id]?.blocked ? '🔒 ' : autoSync[s.id] ? '🔄 ' : ''}{sectionFriendId(shareMap, s.id, s.notebookShared ? s.notebookId : null) ? '👥 ' : ''}{s.notebook ? `${s.notebook} › ${s.name}` : s.name}</option>
                  ))}
                </select>
              </div>

              {section && (
                <div style={{ border: `1px solid ${sectionFriend ? '#7dd3fc' : '#e2e8f0'}`, backgroundColor: sectionFriend ? '#f0f9ff' : 'transparent', borderRadius: '10px', padding: '0.7rem 0.85rem' }}>
                  <label className="form-label font-bold text-xs flex align-center gap-1" style={{ color: '#0369a1' }}>
                    <Users size={14} /> 이 섹션을 함께 볼 친구{section.notebookShared ? ' · 공유 노트북' : ''}
                  </label>
                  <select
                    className="input-field mt-1 font-bold"
                    value={sectionFriend?.id || ''}
                    onChange={(e) => setSectionFriend(e.target.value)}
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
                      : '한 번 고르면 기억해서, 다음부터 이 섹션에서 가져오거나 자동 동기화되는 페이지는 고른 친구 달력에도 자동으로 공유됩니다.'}
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
                        ? sectionAutoSync.blocked
                          ? '🔒 암호로 보호된 섹션이라 동기화할 수 없습니다. OneNote 에서 섹션 암호를 해제하거나 자동 동기화를 꺼 주세요.'
                          : `일정 화면을 열 때와 열어 둔 동안 5분마다, 새로 쓰거나 고친 페이지를 달력에 넣습니다. 마지막 확인: ${sectionAutoSync.lastSync ? fmt(sectionAutoSync.lastSync) : '아직 없음'}`
                        : `켜면 최근 ${SYNC_LOOKBACK_DAYS}일 안의 페이지부터, 앞으로 이 섹션에 쓰는 노트가 달력에 저절로 들어갑니다.`}
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ flexShrink: 0 }}>
                    {sectionAutoSync && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => syncNow(section.id)} disabled={Boolean(busy)}>
                        지금 동기화
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn btn-sm ${sectionAutoSync ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={toggleAutoSync}
                      disabled={Boolean(busy)}
                    >
                      {sectionAutoSync ? '끄기' : '켜기'}
                    </button>
                  </div>
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
                  {pages.length === 0 && (
                    <p className="text-xs sub-text" style={{ padding: '1rem', textAlign: 'center' }}>
                      {loading ? '불러오는 중…' : '페이지가 없습니다.'}
                    </p>
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
                  {nextLink && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={loadMorePages}
                      disabled={Boolean(loading)}
                      style={{ width: '100%', borderRadius: 0, border: 'none' }}
                    >
                      {loading ? '불러오는 중…' : '이전 페이지 더 보기'}
                    </button>
                  )}
                </div>
                <p className="text-xs sub-text mt-1">이미 가져온 페이지를 다시 가져오면 최신 내용으로 덮어씁니다.</p>
              </div>
            </>
          )}

          {!busy && loading && (
            <p className="text-xs flex align-center gap-1" style={{ color: '#94a3b8' }}>
              <Loader2 size={14} /> {loading}
            </p>
          )}
          {busy && (
            <p className="text-xs flex align-center gap-1" style={{ color: '#7719aa' }}>
              <Loader2 size={14} /> {busy}
            </p>
          )}
          {error && <p className="text-xs" style={{ color: '#be123c' }}>{error}</p>}
          {info && <p className="text-xs" style={{ color: '#059669', fontWeight: 700 }}>{info}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            {account && (
              <button type="button" className="btn btn-primary font-bold" onClick={handleImport} disabled={selected.size === 0 || Boolean(busy)}>
                {selected.size}개 일정으로 가져오기{sectionFriend ? ` (${sectionFriend.name || sectionFriend.email.split('@')[0]}님과 공유)` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
