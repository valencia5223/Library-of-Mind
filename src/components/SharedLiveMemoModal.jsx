import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Sparkles, Copy, Trash2, CheckCircle2, RefreshCw, Zap, GripHorizontal, ArrowRightLeft, User, MessageSquare, MapPin, Search } from 'lucide-react';

export default function SharedLiveMemoModal({ user, friend, onClose }) {
  if (!user || !friend) return null;

  // 1:1 대화방 고유 룸 ID (두 사용자 UUID 오름차순 정렬 연결)
  const sortedUserIds = [user.id, friend.friend_id].sort();
  const roomId = `${sortedUserIds[0]}_${sortedUserIds[1]}`;

  const myEditorRef = useRef(null);
  const [myContent, setMyContent] = useState('');
  const [partnerContent, setPartnerContent] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingPartner, setTypingPartner] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [isMyEditorEmpty, setIsMyEditorEmpty] = useState(true);
  const [isPartnerEmpty, setIsPartnerEmpty] = useState(true);

  // 실시간 흔들기/알람 효과 및 쿨다운 상태
  const [isLocalShaking, setIsLocalShaking] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(0);

  // 쿨다운 1초 단위 카운트다운 타이머
  useEffect(() => {
    if (nudgeCooldown > 0) {
      const timer = setInterval(() => {
        setNudgeCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [nudgeCooldown]);

  // 흔들기(알람) 버튼 클릭 송신 핸들러
  const handleSendNudge = async () => {
    if (nudgeCooldown > 0) return;
    setNudgeCooldown(3);

    // 내 화면/모달 진동 효과 발생
    setIsLocalShaking(true);
    setTimeout(() => setIsLocalShaking(false), 1400);

    try {
      // 1. 현재 오픈된 메모 룸 채널로 흔들기 브로드캐스트
      const roomChan = supabase.channel(`shared_memo:${roomId}`);
      await roomChan.send({
        type: 'broadcast',
        event: 'nudge_shake',
        payload: { sender_id: user.id }
      });

      // 2. 상대방의 전역 수신 채널로도 흔들기 브로드캐스트 (메모창 닫혀 있을 때 대응!)
      const globalChan = supabase.channel(`global_user_nudge:${friend.friend_id}`);
      await globalChan.send({
        type: 'broadcast',
        event: 'nudge_received',
        payload: { sender_id: user.id, sender_email: user.email }
      });
    } catch (err) {
      console.warn('흔들기 알람 전송 예외 발생:', err);
    }
  };

  // 글씨 폰트 크기 상태 (기본값: 16px, 숫자로 자유롭게 입력 및 localStorage 기억)
  const [fontSizePx, setFontSizePx] = useState(() => {
    const saved = localStorage.getItem('shared_memo_font_size_px');
    return saved ? parseInt(saved, 10) || 16 : 16;
  });

  const handleFontSizePxChange = (val) => {
    const num = Math.max(1, Math.min(100, parseInt(val, 10) || 16));
    setFontSizePx(num);
    localStorage.setItem('shared_memo_font_size_px', num.toString());
  };

  // 모달 창 마우스 드래그 이동 및 위치 localStorage 기억
  const [modalPos, setModalPos] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_memo_modal_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { x: 0, y: 0 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  const handleMouseDownHeader = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('[contenteditable="true"]')) return;

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...modalPos };

    document.addEventListener('mousemove', handleMouseMoveWindow);
    document.addEventListener('mouseup', handleMouseUpWindow);
  };

  const handleMouseMoveWindow = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setModalPos({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy
    });
  };

  const handleMouseUpWindow = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMoveWindow);
      document.removeEventListener('mouseup', handleMouseUpWindow);

      setModalPos((latestPos) => {
        localStorage.setItem('shared_memo_modal_pos', JSON.stringify(latestPos));
        return latestPos;
      });
    }
  };

  // 메모 보드 개별 입력 박스 크기 조절 (드래그 resize & localStorage 기억)
  const [panelSize, setPanelSize] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_memo_panel_size_dual');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { width: 380, height: 320 };
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 380, height: 320 });

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height
    };

    document.addEventListener('mousemove', handleMouseMoveResize);
    document.addEventListener('mouseup', handleMouseUpResize);
  };

  const handleMouseMoveResize = (e) => {
    if (!isResizingRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;
    const newWidth = Math.max(300, Math.min((window.innerWidth - 100) / 2, resizeStartRef.current.width + dx));
    const newHeight = Math.max(180, Math.min(window.innerHeight - 240, resizeStartRef.current.height + dy));

    setPanelSize({ width: newWidth, height: newHeight });
  };

  const handleMouseUpResize = () => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMoveResize);
      document.removeEventListener('mouseup', handleMouseUpResize);

      setPanelSize((latestSize) => {
        localStorage.setItem('shared_memo_panel_size_dual', JSON.stringify(latestSize));
        return latestSize;
      });
    }
  };

  // ESC 키 누르면 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveTimeoutRef = useRef(null);
  const latestMyContentRef = useRef('');
  const allMemosDictRef = useRef({}); // { [user1_id]: html1, [user2_id]: html2 }
  const isDirtyRef = useRef(false);

  // HTML 문자열이 &lt;div&gt; 등 이중 Escape 되어 텍스트로 노출되는 현상을 자동 복원하는 정제 함수
  const sanitizeAndNormalizeHTML = (rawContent) => {
    if (!rawContent) return '';
    let content = rawContent;
    if (typeof content === 'string' && (content.includes('&lt;') || content.includes('&gt;'))) {
      const txt = document.createElement('textarea');
      txt.innerHTML = content;
      content = txt.value;
    }
    return content;
  };

  // 내 에디터 DOM 업데이트
  const updateMyEditorDOM = (htmlContent) => {
    const normalized = sanitizeAndNormalizeHTML(htmlContent);
    if (myEditorRef.current) {
      if (myEditorRef.current.innerHTML !== normalized) {
        myEditorRef.current.innerHTML = normalized || '';
      }
      const text = myEditorRef.current.innerText || '';
      setIsMyEditorEmpty(!normalized || normalized === '<br>' || text.trim() === '');
    }
  };

  // DB에서 읽어온 콘텐츠(JSON 또는 마크다운/단일텍스트)를 딕셔너리로 구파싱
  const parseMemoContent = (raw) => {
    if (!raw) return {};
    try {
      if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
        return JSON.parse(raw);
      }
    } catch (e) {}
    // 이전 단일 텍스트 데이터의 경우 내 메모로 보존
    return { [user.id]: raw };
  };

  // DB에 내 메모만 즉시 동기화 저장 (Flush)
  const saveImmediately = async (myHtmlContent) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    isDirtyRef.current = false;
    setIsSaving(true);

    const updatedDict = {
      ...allMemosDictRef.current,
      [user.id]: myHtmlContent
    };
    allMemosDictRef.current = updatedDict;

    try {
      const { error } = await supabase
        .from('shared_memos')
        .upsert(
          {
            room_id: roomId,
            user1_id: sortedUserIds[0],
            user2_id: sortedUserIds[1],
            content: JSON.stringify(updatedDict),
            last_updated_by: user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'room_id' }
        );
      if (error) throw error;
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('메모 즉시 저장 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // 1. 기존 공유 메모 조회 및 초기화
    const initMemo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('shared_memos')
          .select('content, updated_at, last_updated_by')
          .eq('room_id', roomId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('공유 메모 조회 중 오류:', error);
        }

        if (data) {
          const dict = parseMemoContent(data.content);
          allMemosDictRef.current = dict;
          
          const myHtml = dict[user.id] || '';
          const partnerHtml = dict[friend.friend_id] || '';

          setMyContent(myHtml);
          latestMyContentRef.current = myHtml;
          setPartnerContent(partnerHtml);

          const pText = sanitizeAndNormalizeHTML(partnerHtml).replace(/<[^>]*>/g, '').trim();
          setIsPartnerEmpty(!partnerHtml || partnerHtml === '<br>' || pText === '');

          if (data.updated_at) {
            setLastSavedTime(new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        } else {
          // 데이터가 없으면 최초 생성
          const initialDict = { [user.id]: '', [friend.friend_id]: '' };
          allMemosDictRef.current = initialDict;
          await supabase.from('shared_memos').insert({
            room_id: roomId,
            user1_id: sortedUserIds[0],
            user2_id: sortedUserIds[1],
            content: JSON.stringify(initialDict),
            last_updated_by: user.id
          });
        }
      } catch (err) {
        console.error('메모 초기화 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    initMemo();

    // 2. Supabase Realtime 채널 실시간 구독 (0.1초 동기화)
    const channel = supabase
      .channel(`shared_memo:${roomId}`)
      .on(
        'broadcast',
        { event: 'nudge_shake' },
        (payload) => {
          if (payload.payload?.sender_id !== user.id) {
            setIsLocalShaking(true);
            setTimeout(() => setIsLocalShaking(false), 1400);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_memos',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new && payload.new.last_updated_by !== user.id) {
            const dict = parseMemoContent(payload.new.content);
            allMemosDictRef.current = dict;

            const newPartnerHtml = dict[friend.friend_id] || '';
            setPartnerContent(newPartnerHtml);

            const pText = sanitizeAndNormalizeHTML(newPartnerHtml).replace(/<[^>]*>/g, '').trim();
            setIsPartnerEmpty(!newPartnerHtml || newPartnerHtml === '<br>' || pText === '');

            setTypingPartner(friend.email);
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            setTimeout(() => {
              setTypingPartner(null);
            }, 1500);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (isDirtyRef.current) {
        saveImmediately(latestMyContentRef.current);
      } else if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, user.id, friend.friend_id, friend.email]);

  // loading 완료 후 내 에디터 DOM 마운트 시 myContent 바인딩
  useEffect(() => {
    if (!loading) {
      updateMyEditorDOM(myContent);
    }
  }, [loading]);

  // 메모 내용 수정 시 DB 업서트 (디바운스 250ms)
  const triggerSave = (htmlContent) => {
    setMyContent(htmlContent);
    latestMyContentRef.current = htmlContent;
    isDirtyRef.current = true;
    setIsSaving(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveImmediately(htmlContent);
    }, 250);
  };

  const handleMyEditorInput = () => {
    if (!myEditorRef.current) return;
    const html = myEditorRef.current.innerHTML;
    const text = myEditorRef.current.innerText || '';
    setIsMyEditorEmpty(!html || html === '<br>' || text.trim() === '');
    triggerSave(html);
  };

  const handleMyBlur = () => {
    if (isDirtyRef.current && myEditorRef.current) {
      saveImmediately(myEditorRef.current.innerHTML);
    }
  };

  // 클립보드 이미지 및 텍스트 붙여넣기 (Paste) 처리 핸들러
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith('image/')) {
        hasImage = true;
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target?.result;
          if (!base64Data) return;

          const img = document.createElement('img');
          img.src = base64Data;
          img.alt = '클립보드 이미지';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '320px';
          img.style.borderRadius = '10px';
          img.style.margin = '8px 0';
          img.style.display = 'block';
          img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
          } else if (myEditorRef.current) {
            myEditorRef.current.appendChild(img);
          }

          handleMyEditorInput();
        };
        reader.readAsDataURL(file);
        break;
      }
    }

    if (!hasImage && e.clipboardData) {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        handleMyEditorInput();
      }
    }
  };

  // 내 메모 전체 복사
  const handleCopyMyContent = () => {
    const text = myEditorRef.current ? myEditorRef.current.innerText : myContent;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // 내 메모 지우기
  const handleClearMyContent = () => {
    if (window.confirm('내 메모 내용을 모두 지우시겠습니까?')) {
      if (myEditorRef.current) {
        myEditorRef.current.innerHTML = '';
      }
      handleMyEditorInput();
    }
  };

  // 상대방 메모를 내 메모로 전체 가져오기 복사
  const handleImportPartnerContent = () => {
    if (!partnerContent || isPartnerEmpty) return;
    if (window.confirm(`${friend.email}님의 라이브 메모 내용을 내 메모장으로 가져올까요? (기존 내 메모 뒤에 추가됩니다)`)) {
      const newMyContent = (myContent ? myContent + '<br><br>' : '') + partnerContent;
      setMyContent(newMyContent);
      updateMyEditorDOM(newMyContent);
      triggerSave(newMyContent);
    }
  };

  // 📍 카카오맵 맛집/장소 검색 & 실시간 자동완성 결과 목록 기능
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  // 카카오 키워드 검색 (Kakao Places SDK & REST API 하이브리드 연동)
  const handleSearchKakaoPlaces = async (queryStr) => {
    const q = (queryStr !== undefined ? queryStr : customPlaceName).trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setIsSearchingPlace(true);

    const parsePlacesData = (dataList) => {
      return dataList.map(item => {
        let catStr = '장소';
        if (item.category_name) {
          const parts = item.category_name.split(' > ').filter(p => p !== '음식점');
          catStr = parts.length > 0 ? parts.slice(-2).join(' · ') : item.category_name;
        }
        const roadAddr = item.road_address_name || '';
        const lotAddr = item.address_name || '';
        let fullAddress = roadAddr;
        if (roadAddr && lotAddr && roadAddr !== lotAddr) {
          fullAddress = `${roadAddr} (지번: ${lotAddr})`;
        } else if (!roadAddr && lotAddr) {
          fullAddress = lotAddr;
        }

        return {
          id: item.id || Math.random().toString(),
          name: item.place_name,
          category: catStr,
          address: fullAddress || '주소 정보 없음',
          phone: item.phone || '',
          mapUrl: item.place_url || `https://map.kakao.com/?q=${encodeURIComponent(item.place_name)}`
        };
      });
    };

    // 1. 카카오 맵 JS SDK (window.kakao.maps.services.Places) 공식 검색 시도
    if (window.kakao && window.kakao.maps) {
      const executePlacesSDK = () => {
        try {
          if (window.kakao.maps.services && window.kakao.maps.services.Places) {
            const ps = new window.kakao.maps.services.Places();
            ps.keywordSearch(q, (data, status) => {
              if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
                setSearchResults(parsePlacesData(data));
                setIsSearchingPlace(false);
              } else {
                fetchKakaoRESTSearch(q, parsePlacesData);
              }
            });
            return true;
          }
        } catch (e) {
          console.warn('Kakao SDK search error:', e);
        }
        return false;
      };

      if (window.kakao.maps.load) {
        window.kakao.maps.load(() => {
          if (!executePlacesSDK()) {
            fetchKakaoRESTSearch(q, parsePlacesData);
          }
        });
        return;
      } else {
        if (executePlacesSDK()) return;
      }
    }

    // 2. REST API 백업 검색
    fetchKakaoRESTSearch(q, parsePlacesData);
  };

  const fetchKakaoRESTSearch = async (q, parsePlacesData) => {
    try {
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: 'KakaoAK 28212e3427976e1a4d87b9264c92b234'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          setSearchResults(parsePlacesData(data.documents));
          setIsSearchingPlace(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Kakao Local API search warning:', err);
    }

    // 카카오 API 검색 결과가 없거나 도메인 승인 필요 시 실제 카카오맵 실시간 검색 연결 1건 제공
    setSearchResults([
      {
        id: 'real_kakao_direct_search',
        name: `'${q}' 카카오맵 실시간 위치/상호 상세 검색`,
        category: '카카오맵 바로가기',
        address: `'${q}' 카카오맵 지도에서 실시간 위치 및 지점 확인`,
        phone: '',
        mapUrl: `https://map.kakao.com/?q=${encodeURIComponent(q)}`
      }
    ]);
    setIsSearchingPlace(false);
  };

  // 자동완성 디바운싱 효과
  useEffect(() => {
    if (!showPlaceModal) return;
    const timer = setTimeout(() => {
      if (customPlaceName.trim().length >= 1) {
        handleSearchKakaoPlaces(customPlaceName);
      } else if (customPlaceName.trim().length === 0) {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customPlaceName, showPlaceModal]);

  const handleSharePlace = (item) => {
    const myName = user.email ? user.email.split('@')[0] : '나';
    const placeName = item ? item.name : customPlaceName.trim();
    if (!placeName) return;

    const address = item ? item.address : '';
    const category = item ? item.category : '';
    const phone = item ? item.phone : '';
    
    let rawUrl = item ? item.mapUrl : `https://map.kakao.com/?q=${encodeURIComponent(placeName + (address ? ' ' + address : ''))}`;
    if (rawUrl && rawUrl.startsWith('http:')) {
      rawUrl = rawUrl.replace('http:', 'https:');
    }
    const kakaoUrl = rawUrl;

    const placeCardHTML = `<div style="display:inline-block; padding: 10px 14px; margin: 6px 0; background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%); color: #854d0e; border: 1.5px solid #facc15; border-radius: 10px; font-size: 0.88rem; box-shadow: 0 2px 6px rgba(234,179,8,0.2);">📍 <b>[${myName}]</b>님의 추천 맛집/장소 공유:<br><a href="${kakaoUrl}" target="_blank" rel="noreferrer" onclick="window.open('${kakaoUrl}', '_blank'); return false;" style="text-decoration:none;"><b style="font-size: 1.05rem; color: #713f12; text-decoration: underline;">🏪 ${placeName} 🔗</b></a>${category ? ` <span style="font-size: 0.76rem; color: #b45309; background:#ffffff; padding:2px 6px; border-radius:5px; font-weight:800; border: 1px solid #fde047; margin-left: 4px;">🍱 ${category}</span>` : ''}<br>${address ? `<span style="font-size: 0.8rem; color: #713f12; opacity: 0.9;">🏠 <b>주소:</b> ${address}</span><br>` : ''}${phone ? `<span style="font-size: 0.78rem; color: #a16207;">📞 <b>전화:</b> ${phone}</span><br>` : ''}<a href="${kakaoUrl}" target="_blank" rel="noreferrer" onclick="window.open('${kakaoUrl}', '_blank'); return false;" style="display:inline-block; margin-top: 6px; padding: 5px 12px; background: #eab308; color: #ffffff !important; font-weight: 800; text-decoration: none; border-radius: 6px; font-size: 0.82rem; box-shadow: 0 2px 5px rgba(234,179,8,0.3); cursor: pointer;">👉 카카오맵 지도 앱/웹으로 바로가기 🗺️</a></div><br>`;

    if (myEditorRef.current) {
      myEditorRef.current.innerHTML = (myEditorRef.current.innerHTML || '') + placeCardHTML;
      handleMyEditorInput();
    }
    setShowPlaceModal(false);
    setCustomPlaceName('');
    setSearchResults([]);
  };

  // 이모티콘 팝업 오픈 상태
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // 이모티콘 팔레트 카테고리별 목록
  const EMOJI_CATEGORIES = [
    { name: '😊 감정/표정', emojis: ['😂', '🤣', '😊', '😍', '🥳', '🤩', '🥺', '😱', '😤', '🤔', '😇', '😴', '💩', '👻', '🤖', '💖', '🔥', '✨'] },
    { name: '👍 손짓/반응', emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '💪', '🤙', '👊', '🖐️', '📍', '💯', '💬', '⚡', '🎉', '🎈'] },
    { name: '🍕 음식/디저트', emojis: ['🍕', '🍗', '🍣', '🍜', '🍔', '🍲', '🥩', '🍛', '☕', '🧋', '🍰', '🍩', '🍺', '🍷', '🍏', '🍊', '🍓', '🍦'] },
    { name: '🔮 기분/행운', emojis: ['🌟', '💥', '🎵', '🔮', '📌', '💌', '📍', '🏆', '🎯', '🍀', '🌈', '☀️', '🌙', '⭐', '🎁', '🔑', '💎', '🚀'] }
  ];

  const handleInsertEmoji = (emojiStr) => {
    if (myEditorRef.current) {
      myEditorRef.current.focus();
      document.execCommand('insertText', false, emojiStr);
      handleMyEditorInput();
    }
  };



  // 줄 수 및 글자 수 계산
  const myText = myEditorRef.current ? (myEditorRef.current.innerText || '') : '';
  const myLineCount = myText ? myText.split('\n').length : 0;
  const myCharCount = myText.length;

  const partnerText = sanitizeAndNormalizeHTML(partnerContent).replace(/<[^>]*>/g, '').trim();
  const partnerCharCount = partnerText.length;

  // 모달 오버레이 스마트 클릭 감지 (텍스트 드래그 선택 시 창이 닫히는 현상 100% 방지)
  const overlayMouseDownRef = useRef(null);

  const handleOverlayMouseDown = (e) => {
    overlayMouseDownRef.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    if (overlayMouseDownRef.current === e.currentTarget && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1250 }}
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div
        className={`modal-card animate-scale-in ${isLocalShaking ? 'app-nudge-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'fit-content',
          minWidth: `${Math.max(680, panelSize.width * 2 + 60)}px`,
          maxWidth: '98vw',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.2rem 1.35rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
          transition: isDraggingRef.current || isResizingRef.current ? 'none' : 'transform 0.05s ease-out'
        }}
      >
        {/* 모달 닫기 버튼 */}
        <button
          className="modal-close"
          onClick={onClose}
          title="닫기 (Esc)"
          style={{
            position: 'absolute',
            top: '1.1rem',
            right: '1.1rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        {/* 상단 타이틀 및 상태 헤더 */}
        <div
          onMouseDown={handleMouseDownHeader}
          style={{
            paddingBottom: '0.85rem',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '1rem',
            cursor: 'move',
            userSelect: 'none',
            flexShrink: 0
          }}
        >
          <div className="flex align-center justify-between" style={{ paddingRight: '6.5rem' }}>
            <h3 className="flex align-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              <GripHorizontal size={20} className="text-slate-400 me-1" />
              <Zap size={22} className="text-primary" style={{ color: '#0078a6' }} />
              <span>실시간 1:1 분리 메모장</span>
            </h3>

            {/* 흔들기 알람 버튼 및 폰트 크기 커스텀 숫자 입력 컨트롤러 */}
            <div className="flex align-center gap-2">
              <button
                type="button"
                className={`btn btn-xs font-bold flex align-center gap-1 ${nudgeCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleSendNudge}
                disabled={nudgeCooldown > 0}
                title="상대방의 메모창/전체 화면을 진동시키고 붉은색 테두리 알람을 보냅니다!"
                style={{
                  background: nudgeCooldown > 0 ? '#f1f5f9' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: nudgeCooldown > 0 ? '#94a3b8' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  boxShadow: nudgeCooldown > 0 ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)',
                  cursor: nudgeCooldown > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Zap size={14} className={nudgeCooldown > 0 ? '' : 'animate-bounce'} />
                {nudgeCooldown > 0 ? `${nudgeCooldown}초 대기...` : '⚡ 흔들기 알람'}
              </button>


              {/* 😀 이모티콘 팝업 드롭다운 버튼 */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-xs font-bold flex align-center gap-1"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="다양한 이모티콘/스티커를 선택하여 메모장에 입력합니다!"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 9px',
                    fontSize: '0.78rem',
                    boxShadow: '0 2px 6px rgba(236, 72, 153, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  😀 이모티콘
                </button>

                {/* 이모티콘 팝오버 팔레트 */}
                {showEmojiPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '110%',
                      right: 0,
                      zIndex: 999,
                      width: '270px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>이모티콘 팔레트</span>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {EMOJI_CATEGORIES.map((cat, idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>{cat.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                          {cat.emojis.map((emoji, eIdx) => (
                            <button
                              key={eIdx}
                              type="button"
                              onClick={() => {
                                handleInsertEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              style={{
                                border: 'none',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                fontSize: '1.15rem',
                                padding: '4px 0',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 📍 카카오맵 맛집/장소 공유 버튼 */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-xs font-bold flex align-center gap-1"
                  onClick={() => setShowPlaceModal(!showPlaceModal)}
                  title="카카오맵 연동 맛집/장소를 검색하고 메모장에 지도 링크와 함께 공유합니다!"
                  style={{
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 9px',
                    fontSize: '0.78rem',
                    boxShadow: '0 2px 6px rgba(234, 179, 8, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  <MapPin size={13} /> 📍 맛집/장소
                </button>

                {/* 카카오맵 맛집/장소 공유 모달 팝오버 */}
                {showPlaceModal && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '110%',
                      right: 0,
                      zIndex: 999,
                      width: '320px',
                      maxHeight: '380px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
                      border: '1.5px solid #fef08a'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #fef08a', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#854d0e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={15} className="text-amber-600" /> 카카오맵 맛집/장소 공유
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPlaceModal(false)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* 상호명/장소 검색 입력 */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#713f12', display: 'block', marginBottom: '4px' }}>
                        🔍 상호명 또는 주소 검색 입력 (실시간 연동):
                      </label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          placeholder="예: 마포설렁탕, 성수 카페, 을밀대"
                          value={customPlaceName}
                          onChange={(e) => setCustomPlaceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (searchResults.length > 0) {
                                handleSharePlace(searchResults[0]);
                              } else {
                                handleSharePlace();
                              }
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 9px',
                            fontSize: '0.82rem',
                            border: '1.5px solid #fde047',
                            borderRadius: '6px',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (searchResults.length > 0) {
                              handleSharePlace(searchResults[0]);
                            } else {
                              handleSharePlace();
                            }
                          }}
                          style={{
                            background: '#eab308',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0 12px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          검색/공유
                        </button>
                      </div>
                    </div>

                    {/* 실시간 검색 결과 및 자동완성 목록 중 선택 공유 */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#854d0e', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>📋 카카오맵 검색 결과 목록 ({searchResults.length}건):</span>
                        {isSearchingPlace && <span style={{ fontSize: '0.7rem', color: '#ca8a04' }}>검색 중...</span>}
                      </div>

                      {searchResults.length === 0 ? (
                        <div style={{ padding: '16px 8px', textAlign: 'center', color: '#a16207', fontSize: '0.78rem', background: '#fefce8', borderRadius: '8px', border: '1px dashed #fde047' }}>
                          {customPlaceName.trim() ? '검색어를 더 자세히 입력하시거나 엔터를 누르시면 즉시 카카오맵 링크로 공유됩니다!' : '상호명이나 위치를 입력하시면 카카오맵 장소 목록이 여기에 나타납니다!'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '230px', overflowY: 'auto' }}>
                          {searchResults.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleSharePlace(item)}
                              style={{
                                padding: '8px 10px',
                                background: '#ffffff',
                                border: '1.5px solid #fef08a',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fefce8';
                                e.currentTarget.style.borderColor = '#eab308';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '#fef08a';
                              }}
                            >
                              <div style={{ flex: 1, paddingRight: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{item.name}</span>
                                  {item.category && (
                                    <span style={{ fontSize: '0.7rem', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fde047' }}>
                                      🍱 {item.category}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '3px', lineHeight: 1.3 }}>
                                  📍 <b>주소:</b> {item.address}
                                </div>
                                {item.phone && (
                                  <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>
                                    📞 <b>전화:</b> {item.phone}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  backgroundColor: '#ca8a04',
                                  border: 'none',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 3px rgba(202,138,4,0.3)'
                                }}
                              >
                                + 공유
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex align-center gap-1.5" style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span className="text-xs font-bold text-slate-600" style={{ fontSize: '0.78rem' }}>글씨 크기:</span>
                <button
                  type="button"
                  onClick={() => handleFontSizePxChange(fontSizePx - 1)}
                  style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  -
                </button>
                <div className="flex align-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={fontSizePx}
                    onChange={(e) => handleFontSizePxChange(e.target.value)}
                    style={{ width: '42px', height: '24px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', border: '1.5px solid #38bdf8', borderRadius: '5px', outline: 'none', background: '#ffffff', padding: '0 2px' }}
                  />
                  <span className="text-xs font-bold text-slate-500" style={{ fontSize: '0.75rem' }}>px</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFontSizePxChange(fontSizePx + 1)}
                  style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 상태 표시 1줄 */}
          <div className="flex align-center justify-between mt-2" style={{ fontSize: '0.82rem', color: '#64748b' }}>
            <span className="flex align-center gap-1 font-semibold flex-shrink-0" style={{ color: isConnected ? '#059669' : '#d97706' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#f59e0b',
                  boxShadow: isConnected ? '0 0 8px #10b981' : 'none'
                }}
              />
              {isConnected ? '실시간 동기화 연결됨 (2인 독립 동시 작성)' : '연결 준비 중...'}
            </span>

            {isSaving ? (
              <span className="flex align-center gap-1 text-slate-500 flex-shrink-0">
                <RefreshCw size={13} className="animate-spin" /> 저장 중...
              </span>
            ) : lastSavedTime ? (
              <span className="text-slate-400 flex-shrink-0">최근 동기화: {lastSavedTime}</span>
            ) : null}
          </div>

          {/* 상태 표시 2줄: 작성 중 안내 줄 (고정 높이 20px) */}
          <div style={{ height: '20px', marginTop: '4px', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
            {typingPartner ? (
              <span className="animate-pulse flex align-center gap-1 font-bold" style={{ color: '#0284c7' }}>
                <Sparkles size={13} /> {typingPartner}님이 오른쪽 메모장에서 실시간 작성 중...
              </span>
            ) : null}
          </div>
        </div>

        {/* 2열 듀얼 실시간 분리 메모 영역 */}
        <div style={{ flex: 1, display: 'flex', gap: '1.2rem', minHeight: 0 }}>
          {loading ? (
            <div className="empty-search p-5 text-center flex-1 flex flex-col align-center justify-center" style={{ width: `${panelSize.width * 2 + 20}px`, height: `${panelSize.height}px` }}>
              <RefreshCw size={28} className="animate-spin text-primary mb-2" />
              <p>독립 1:1 라이브 메모장을 준비하는 중입니다...</p>
            </div>
          ) : (
            <>
              {/* 좌측: 내 메모보드 */}
              <div style={{ display: 'flex', flexDirection: 'column', width: `${panelSize.width}px` }}>
                <div className="flex align-center justify-between mb-2">
                  <span className="font-bold flex align-center gap-1 text-slate-800" style={{ fontSize: '0.88rem' }}>
                    <User size={16} className="text-sky-600" /> 내 메모
                  </span>
                </div>

                <div style={{ position: 'relative', width: '100%', height: `${panelSize.height}px` }}>
                  {isMyEditorEmpty && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '1rem',
                        right: '1rem',
                        color: '#94a3b8',
                        fontSize: `${fontSizePx}px`,
                        lineHeight: 1.7,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 1,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {`여기에 나만의 메모나 이미지(Ctrl+V)를 자유롭게 작성하세요!\n상대방의 작성과 서로 방해받지 않고 독립적으로 실시간 공유됩니다 ✨`}
                    </div>
                  )}

                  <div
                    ref={myEditorRef}
                    contentEditable
                    onInput={handleMyEditorInput}
                    onBlur={handleMyBlur}
                    onPaste={handlePaste}
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: '1rem',
                      fontSize: `${fontSizePx}px`,
                      lineHeight: 1.7,
                      color: '#1e293b',
                      background: '#ffffff',
                      border: '2px solid #bae6fd',
                      borderRadius: '12px',
                      outline: 'none',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}
                  />
                </div>
              </div>

              {/* 우측: 상대방 실시간 메모보드 */}
              <div style={{ display: 'flex', flexDirection: 'column', width: `${panelSize.width}px` }}>
                <div className="flex align-center justify-between mb-2">
                  <span className="font-bold flex align-center gap-1 text-slate-800" style={{ fontSize: '0.88rem' }}>
                    <MessageSquare size={16} className="text-emerald-600" /> {friend.email} 님의 메모
                  </span>
                  <button
                    className="btn btn-xs btn-outline font-bold flex align-center gap-1"
                    onClick={handleImportPartnerContent}
                    disabled={isPartnerEmpty}
                    title="상대방 메모 내용을 내 메모에 추가 복사"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', borderRadius: '6px' }}
                  >
                    <ArrowRightLeft size={12} /> 내 메모로 가져오기
                  </button>
                </div>

                <div style={{ position: 'relative', width: '100%', height: `${panelSize.height}px` }}>
                  {isPartnerEmpty ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '1rem',
                        fontSize: `${fontSizePx}px`,
                        lineHeight: 1.7,
                        color: '#94a3b8',
                        background: '#f8fafc',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                      }}
                    >
                      상대방({friend.email})이 메모를 작성하면<br />0.1초 만에 실시간으로 여기에 노출됩니다.
                    </div>
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: sanitizeAndNormalizeHTML(partnerContent) }}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '1rem',
                        fontSize: `${fontSizePx}px`,
                        lineHeight: 1.7,
                        color: '#334155',
                        background: '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '12px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        userSelect: 'text',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}
                    />
                  )}

                  {/* 우측 하단 듀얼 전체 크기 조절 손잡이 */}
                  <div
                    onMouseDown={handleMouseDownResize}
                    title="드래그하여 메모 박스 크기 변경 (localStorage 기억됨)"
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      width: '22px',
                      height: '22px',
                      cursor: 'nwse-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0284c7',
                      background: '#f0f9ff',
                      borderRadius: '5px',
                      border: '1px solid #bae6fd',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      zIndex: 5,
                      userSelect: 'none'
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M10 2L2 10M10 6L6 10M10 10H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 푸터 바 */}
        <div
          className="mt-3 pt-3 flex justify-between align-center"
          style={{ borderTop: '1px solid #e2e8f0', background: 'transparent', flexShrink: 0 }}
        >
          <div className="flex align-center gap-4 text-slate-500" style={{ fontSize: '0.78rem', fontWeight: 500 }}>
            <span>내 글자 수: <b style={{ color: '#0284c7' }}>{myCharCount}</b>자 ({myLineCount}줄)</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>상대방 글자 수: <b style={{ color: '#059669' }}>{partnerCharCount}</b>자</span>
          </div>

          <div className="flex align-center gap-2">
            <button
              className="btn btn-outline btn-sm font-bold flex align-center gap-1"
              onClick={handleCopyMyContent}
              disabled={isMyEditorEmpty}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px' }}
            >
              {copySuccess ? <CheckCircle2 size={15} color="#059669" /> : <Copy size={15} />}
              {copySuccess ? '복사 완료!' : '내 메모 전체 복사'}
            </button>

            <button
              className="btn btn-outline btn-sm text-danger font-bold flex align-center gap-1"
              onClick={handleClearMyContent}
              disabled={isMyEditorEmpty}
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', borderColor: '#fca5a5', color: '#dc2626' }}
            >
              <Trash2 size={15} /> 지우기
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ padding: '0.45rem 1.1rem', borderRadius: '8px', fontWeight: 600 }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
