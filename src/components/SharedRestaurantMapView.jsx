import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { MapPin, Search, Plus, Star, Filter, User, Compass, ExternalLink, RefreshCw, X, Tag, Utensils, Navigation, Heart, Award, Share2 } from 'lucide-react';
import { defaultRestaurants, regions, foodCategories } from '../restaurantData';

export default function SharedRestaurantMapView({ user }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);

  // 필터 상태
  const [selectedUserFilter, setSelectedUserFilter] = useState('all'); // 'all' | 'my' | friend_user_id
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 장소 검색 & 등록 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  
  // 맛집 등록 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    category: 'korean',
    region: '서울',
    rating: 5,
    recomMenu: '',
    review: '',
    address: '',
    mapUrl: '',
    phone: ''
  });

  // 선택된 상세보기 맛집 모달
  const [activeDetailRestaurant, setActiveDetailRestaurant] = useState(null);
  // 수정 중인 맛집 ID (null이면 신규 등록 모드)
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);

  const mapContainerRef = useRef(null);
  const kakaoMapInstance = useRef(null);
  const markersRef = useRef([]);
  const myLocationOverlayRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const restaurantsRef = useRef(restaurants);

  // 최신 맛집 상태를 ref에 동기화
  useEffect(() => {
    restaurantsRef.current = restaurants;
  }, [restaurants]);

  // 1. 친구 목록 및 맛집 목록 데이터 불러오기 및 실시간 DB / 브로드캐스트 동기화 구독
  useEffect(() => {
    fetchFriends();
    fetchRestaurants();

    if (isSupabaseConfigured()) {
      // DB 테이블 변경 감지 구독
      const dbChannel = supabase
        .channel('shared_restaurants_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_restaurants' }, () => {
          fetchRestaurants();
        })
        .subscribe();

      // 글로벌 실시간 P2P 브로드캐스트 채널 (DB RLS 제한에 영향을 받지 않는 100% 맛집 정보 동기화)
      const bChannel = supabase.channel('global_shared_restaurants');
      
      bChannel
        .on('broadcast', { event: 'RESTAURANT_UPSERT' }, ({ payload }) => {
          if (payload && payload.item) {
            setRestaurants(prev => {
              const exists = prev.some(x => x.name === payload.item.name || x.id === payload.item.id);
              let updated;
              if (exists) {
                updated = prev.map(x => (x.name === payload.item.name || x.id === payload.item.id) ? payload.item : x);
              } else {
                updated = [payload.item, ...prev];
              }
              localStorage.setItem('shared_restaurants_local', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .on('broadcast', { event: 'RESTAURANT_DELETE' }, ({ payload }) => {
          if (payload && payload.id) {
            setRestaurants(prev => {
              const updated = prev.filter(x => x.id !== payload.id);
              localStorage.setItem('shared_restaurants_local', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .on('broadcast', { event: 'SYNC_REQUEST' }, ({ payload }) => {
          if (payload && payload.requester_id !== (user ? user.id : 'demo')) {
            if (restaurantsRef.current && restaurantsRef.current.length > 0) {
              bChannel.send({
                type: 'broadcast',
                event: 'SYNC_RESPONSE',
                payload: { items: restaurantsRef.current }
              });
            }
          }
        })
        .on('broadcast', { event: 'SYNC_RESPONSE' }, ({ payload }) => {
          if (payload && payload.items && payload.items.length > 0) {
            setRestaurants(prev => {
              const map = new Map();
              prev.forEach(item => map.set(item.name, item));
              payload.items.forEach(item => {
                if (!map.has(item.name)) {
                  map.set(item.name, item);
                }
              });
              const updated = Array.from(map.values());
              localStorage.setItem('shared_restaurants_local', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            bChannel.send({
              type: 'broadcast',
              event: 'SYNC_REQUEST',
              payload: { requester_id: user ? user.id : 'demo' }
            });
          }
        });

      broadcastChannelRef.current = bChannel;

      return () => {
        supabase.removeChannel(dbChannel);
        supabase.removeChannel(bChannel);
      };
    }
  }, [user]);

  // 친구 목록 조회
  const fetchFriends = async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase
        .from('user_friends')
        .select('friend_id')
        .eq('user_id', user.id);

      if (data && data.length > 0) {
        const friendIds = data.map(f => f.friend_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', friendIds);
        
        if (profs) setFriends(profs);
      }
    } catch (e) {
      console.warn('친구 목록 조회 경고:', e);
    }
  };

  // 맛집 목록 DB 및 fallback 조회 (로컬 데이터 자동 DB 동기화 포함)
  const fetchRestaurants = async () => {
    setLoading(true);
    let dbData = [];
    
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('shared_restaurants')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          dbData = data.map(item => ({
            id: item.id,
            name: item.name,
            member_id: item.user_id,
            member_email: item.user_email || '알 수 없는 사용자',
            member_name: item.user_name || (item.user_email ? item.user_email.split('@')[0] : '익명'),
            region: item.region || '서울',
            category: item.category || 'korean',
            rating: item.rating || 5,
            recomMenu: item.recom_menu || '',
            review: item.review || '',
            address: item.address || '',
            mapUrl: item.map_url || `https://map.kakao.com/?q=${encodeURIComponent(item.name)}`,
            phone: item.phone || '',
            coords: item.lat && item.lng ? [item.lat, item.lng] : [37.5665, 126.9780],
            created_at: item.created_at
          }));
        }
      } catch (err) {
        console.warn('shared_restaurants DB 조회 실패:', err);
      }
    }

    // 로컬 스토리지 기존 저장 데이터 확인
    let localSaved = [];
    const localStr = localStorage.getItem('shared_restaurants_local');
    if (localStr) {
      try { localSaved = JSON.parse(localStr); } catch (e) {}
    }

    // 로그인이 되어있고 DB 연결이 된 경우, 로컬 데이터를 DB로 자동 업로드(동기화)하여 친구들과 공유
    if (user && isSupabaseConfigured() && localSaved.length > 0) {
      const dbNames = new Set(dbData.map(d => d.name));
      const unsynced = localSaved.filter(item => !dbNames.has(item.name));

      if (unsynced.length > 0) {
        for (const item of unsynced) {
          try {
            await supabase.from('shared_restaurants').insert([{
              user_id: user.id,
              user_email: user.email,
              user_name: user.user_metadata?.full_name || user.email.split('@')[0],
              name: item.name,
              region: item.region || '서울',
              category: item.category || 'korean',
              rating: item.rating || 5,
              recom_menu: item.recomMenu || '',
              review: item.review || '',
              address: item.address || '',
              phone: item.phone || '',
              map_url: item.mapUrl || '',
              lat: item.coords ? item.coords[0] : 37.5665,
              lng: item.coords ? item.coords[1] : 126.9780
            }]);
          } catch (e) {
            console.warn('기존 로컬 데이터 DB 동기화 업로드 중 예외:', e);
          }
        }
        // DB 재조회
        const { data: refreshed } = await supabase.from('shared_restaurants').select('*').order('created_at', { ascending: false });
        if (refreshed && refreshed.length > 0) {
          dbData = refreshed.map(item => ({
            id: item.id,
            name: item.name,
            member_id: item.user_id,
            member_email: item.user_email || '알 수 없는 사용자',
            member_name: item.user_name || (item.user_email ? item.user_email.split('@')[0] : '익명'),
            region: item.region || '서울',
            category: item.category || 'korean',
            rating: item.rating || 5,
            recomMenu: item.recom_menu || '',
            review: item.review || '',
            address: item.address || '',
            mapUrl: item.map_url || `https://map.kakao.com/?q=${encodeURIComponent(item.name)}`,
            phone: item.phone || '',
            coords: item.lat && item.lng ? [item.lat, item.lng] : [37.5665, 126.9780],
            created_at: item.created_at
          }));
        }
      }
    }

    // DB 데이터와 로컬 데이터 결합 (중복 상호명 제거)
    const combinedMap = new Map();
    dbData.forEach(item => combinedMap.set(item.name, item));
    localSaved.forEach(item => {
      if (!combinedMap.has(item.name)) {
        combinedMap.set(item.name, item);
      }
    });

    setRestaurants(Array.from(combinedMap.values()));
    setLoading(false);
  };

  // 신규 등록 모달 열기 (기존 입력 폼 초기화)
  const handleOpenAddModal = () => {
    setEditingRestaurantId(null);
    setFormData({
      name: '',
      category: 'korean',
      region: '서울',
      rating: 5.0,
      recomMenu: '',
      review: '',
      address: '',
      mapUrl: '',
      phone: '',
      lat: null,
      lng: null
    });
    setIsAddModalOpen(true);
  };

  // 맛집 정보 수정 모달 열기 (기존 값으로 채움)
  const handleOpenEditModal = (item) => {
    setEditingRestaurantId(item.id);
    setFormData({
      name: item.name,
      category: item.category || 'korean',
      region: item.region || '서울',
      rating: item.rating || 5.0,
      recomMenu: item.recomMenu || '',
      review: item.review || '',
      address: item.address || '',
      mapUrl: item.mapUrl || '',
      phone: item.phone || '',
      lat: item.coords ? item.coords[0] : null,
      lng: item.coords ? item.coords[1] : null
    });
    setActiveDetailRestaurant(null);
    setIsAddModalOpen(true);
  };

  // 맛집 삭제 처리
  const handleDeleteRestaurant = async (item) => {
    if (!window.confirm(`'${item.name}' 맛집을 정말 삭제하시겠습니까?`)) return;

    if (isSupabaseConfigured() && user) {
      try {
        await supabase
          .from('shared_restaurants')
          .delete()
          .eq('id', item.id);
      } catch (err) {
        console.warn('shared_restaurants 삭제 예외:', err);
      }
    }

    const updated = restaurants.filter(x => x.id !== item.id);
    setRestaurants(updated);
    localStorage.setItem('shared_restaurants_local', JSON.stringify(updated.filter(x => String(x.id).startsWith('rest_'))));

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'RESTAURANT_DELETE',
          payload: { id: item.id }
        });
      } catch (e) {}
    }

    setActiveDetailRestaurant(null);
    alert(`🗑️ [${item.name}] 맛집이 성공적으로 삭제되었습니다.`);
  };

  // 내 위치 커스텀 빨간색 동그라미 오버레이 렌더링
  const renderMyLocationMarker = (map, pos) => {
    if (!map || !pos) return;
    if (myLocationOverlayRef.current) {
      myLocationOverlayRef.current.setMap(null);
    }

    const content = document.createElement('div');
    content.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    `;
    content.innerHTML = `
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.35); box-shadow: 0 0 12px rgba(239,68,68,0.6);"></div>
      <div style="width: 16px; height: 16px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 2px 10px rgba(239,68,68,0.7); z-index: 2;"></div>
    `;

    const overlay = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: content,
      zIndex: 99
    });

    overlay.setMap(map);
    myLocationOverlayRef.current = overlay;
  };

  // 내 위치로 지도 이동 함수
  const moveToMyLocation = () => {
    if (navigator.geolocation && kakaoMapInstance.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const userLoc = new window.kakao.maps.LatLng(lat, lng);
          kakaoMapInstance.current.setCenter(userLoc);
          renderMyLocationMarker(kakaoMapInstance.current, userLoc);
        },
        (err) => {
          console.warn('내 위치 정보 조회 실패:', err);
          alert('내 현재 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  // 2. 카카오맵 지도 스크립트 로딩 & 마커 표시
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initKakaoMap = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          const container = mapContainerRef.current;
          if (!container) return;
          
          const options = {
            center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 기본 fallback (서울 시청)
            level: 8 // 유지되는 배율
          };

          const map = new window.kakao.maps.Map(container, options);
          kakaoMapInstance.current = map;

          // 지도 컨트롤 추가
          const zoomControl = new window.kakao.maps.ZoomControl();
          map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

          // 내 현재 위치 감지 후 바로 지도 중심 이동 및 빨간 동그라미 오버레이 표시
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const userLoc = new window.kakao.maps.LatLng(lat, lng);
                map.setCenter(userLoc);
                renderMyLocationMarker(map, userLoc);
              },
              (err) => {
                console.warn('지오로케이션 기본 위치 조회 실패:', err);
              },
              { enableHighAccuracy: true, timeout: 5000 }
            );
          }

          renderMarkersOnMap(map, filteredRestaurants);
        });
      }
    };

    initKakaoMap();
  }, [restaurants.length]);

  // 필터 변경 시 지도 마커 갱신
  useEffect(() => {
    if (kakaoMapInstance.current) {
      renderMarkersOnMap(kakaoMapInstance.current, filteredRestaurants);
    }
  }, [selectedUserFilter, selectedCategory, selectedRegion, searchQuery, restaurants]);

  // 지도 위 등록자별 구별 마커 렌더링
  const renderMarkersOnMap = (map, list) => {
    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (!list || list.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();

    list.forEach(item => {
      if (!item.coords || item.coords.length < 2) return;

      const position = new window.kakao.maps.LatLng(item.coords[0], item.coords[1]);
      bounds.extend(position);

      const isMy = user && item.member_id === user.id;
      const badgeColor = isMy ? '#0284c7' : '#059669';
      const badgeName = isMy ? '나' : (item.member_name || item.member_email.split('@')[0]);
      const formattedRating = Number(item.rating || 5).toFixed(1);

      // 커스텀 오버레이 마커 태그 생성 (기본: 컴팩트 핀, 마우스 호버 시 상세 라벨+평점 툴팁 팝업)
      const content = document.createElement('div');
      content.style.cssText = `
        position: relative;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 10;
      `;

      content.innerHTML = `
        <!-- 마우스 호버 시 표출되는 상호명 & 평점 툴팁 카드 -->
        <div class="marker-hover-tooltip" style="
          display: none;
          position: absolute;
          bottom: 100%;
          margin-bottom: 8px;
          background: #ffffff;
          border: 2px solid ${badgeColor};
          border-radius: 12px;
          padding: 7px 11px;
          box-shadow: 0 10px 20px rgba(0,0,0,0.22);
          white-space: nowrap;
          z-index: 999;
          flex-direction: column;
          gap: 3px;
          align-items: flex-start;
          pointer-events: none;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px;">
            <span style="background:${badgeColor}; color:#fff; padding:1px 7px; border-radius:10px; font-size:0.7rem; font-weight:800;">
              👤 ${badgeName} 추천
            </span>
            <span style="color:#eab308; font-size:0.8rem; font-weight:800; display:flex; align-items:center; gap:3px;">
              ★ ${formattedRating}
            </span>
          </div>
          <div style="font-size:0.9rem; font-weight:800; color:#0f172a; margin-top:2px;">${item.name}</div>
          ${item.recomMenu ? `<div style="font-size:0.75rem; color:#b45309; font-weight:700; background:#fef3c7; padding:1px 6px; border-radius:4px; margin-top:2px;">🍱 ${item.recomMenu}</div>` : ''}
        </div>

        <!-- 기본 항상 노출되는 깔끔한 컴팩트 서클/뱃지 핀 마커 (상호명 텍스트 비노출) -->
        <div class="marker-compact-pin" style="
          background: #ffffff;
          border: 2.5px solid ${badgeColor};
          border-radius: 20px;
          padding: 3px 8px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 800;
          color: ${badgeColor};
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        ">
          <span style="width:8px; height:8px; border-radius:50%; background:${badgeColor}; display:inline-block; box-shadow: 0 0 4px ${badgeColor};"></span>
          <span>${badgeName}</span>
        </div>
      `;

      const tooltipEl = content.querySelector('.marker-hover-tooltip');
      const pinEl = content.querySelector('.marker-compact-pin');

      // 마우스 갖다 대었을 때 (Hover)
      content.onmouseenter = () => {
        if (tooltipEl) tooltipEl.style.display = 'flex';
        if (pinEl) {
          pinEl.style.transform = 'scale(1.12)';
          pinEl.style.boxShadow = `0 6px 16px rgba(0,0,0,0.25)`;
        }
        content.style.zIndex = '999';
      };

      // 마우스 떼었을 때 (Un-hover)
      content.onmouseleave = () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
        if (pinEl) {
          pinEl.style.transform = 'scale(1.0)';
          pinEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.18)';
        }
        content.style.zIndex = '10';
      };

      content.onclick = () => {
        setActiveDetailRestaurant(item);
      };

      const customOverlay = new window.kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1
      });

      customOverlay.setMap(map);
      markersRef.current.push(customOverlay);
    });

    if (list.length > 0 && map) {
      map.setBounds(bounds);
    }
  };

  // 카카오 장소 카테고리 자동 분석 및 추출 함수
  const parseCategoryFromKakao = (rawCat) => {
    if (!rawCat) return 'korean';
    const str = String(rawCat);
    if (str.includes('카페') || str.includes('디저트') || str.includes('제과') || str.includes('빵') || str.includes('커피')) return 'cafe';
    if (str.includes('일식') || str.includes('초밥') || str.includes('돈가스') || str.includes('라멘') || str.includes('회')) return 'japanese';
    if (str.includes('양식') || str.includes('파스타') || str.includes('피자') || str.includes('스테이크') || str.includes('이탈리안')) return 'western';
    if (str.includes('중식') || str.includes('중국') || str.includes('짜장') || str.includes('짬뽕')) return 'chinese';
    if (str.includes('아시안') || str.includes('베트남') || str.includes('태국') || str.includes('인도') || str.includes('쌀국수')) return 'asian';
    return 'korean'; // 기본값: 한식
  };

  // 카카오맵 장소 키워드 검색
  const handleSearchPlace = (e) => {
    e.preventDefault();
    if (!placeSearchQuery.trim()) return;

    setIsSearchingPlace(true);

    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      window.kakao.maps.load(() => {
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(placeSearchQuery, (data, status) => {
          setIsSearchingPlace(false);
          if (status === window.kakao.maps.services.Status.OK && data) {
            setPlaceSearchResults(data.map(item => ({
              id: item.id,
              name: item.place_name,
              category: item.category_group_name || '음식점',
              rawCategory: item.category_name || item.category_group_name || '',
              address: item.road_address_name || item.address_name,
              phone: item.phone,
              mapUrl: item.place_url || `https://map.kakao.com/?q=${encodeURIComponent(item.place_name)}`,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x)
            })));
          } else {
            setPlaceSearchResults([]);
          }
        });
      });
    } else {
      // 카카오 키워드 API direct fallback
      fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(placeSearchQuery)}`)
        .then(res => res.json())
        .then(data => {
          setIsSearchingPlace(false);
          if (data && data.documents) {
            setPlaceSearchResults(data.documents.map(item => ({
              id: item.id,
              name: item.place_name,
              category: item.category_group_name || '음식점',
              rawCategory: item.category_name || item.category_group_name || '',
              address: item.road_address_name || item.address_name,
              phone: item.phone,
              mapUrl: item.place_url,
              lat: parseFloat(item.y),
              lng: parseFloat(item.x)
            })));
          }
        })
        .catch(() => setIsSearchingPlace(false));
    }
  };

  // 검색 결과 선택 시 폼 채우기 (카테고리 자동 추출 포함)
  const handleSelectSearchResult = (item) => {
    const autoCat = parseCategoryFromKakao(item.rawCategory || item.category);
    setFormData(prev => ({
      ...prev,
      name: item.name,
      address: item.address,
      phone: item.phone || '',
      mapUrl: item.mapUrl,
      category: autoCat,
      lat: item.lat,
      lng: item.lng
    }));
    setPlaceSearchResults([]);
  };

  // 맛집 저장/수정 제출
  const handleSaveRestaurant = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('상호명을 입력하거나 검색 결과에서 선택해 주세요!');
      return;
    }

    if (editingRestaurantId) {
      // --- 맛집 정보 수정 (UPDATE) ---
      const targetCoords = formData.lat && formData.lng ? [formData.lat, formData.lng] : [37.5665, 126.9780];
      const targetMapUrl = formData.mapUrl || `https://map.kakao.com/?q=${encodeURIComponent(formData.name)}`;

      if (isSupabaseConfigured() && user) {
        try {
          await supabase
            .from('shared_restaurants')
            .update({
              name: formData.name,
              region: formData.region,
              category: formData.category,
              rating: formData.rating,
              recom_menu: formData.recomMenu,
              review: formData.review,
              address: formData.address,
              phone: formData.phone,
              map_url: targetMapUrl,
              lat: targetCoords[0],
              lng: targetCoords[1]
            })
            .eq('id', editingRestaurantId);
        } catch (err) {
          console.warn('shared_restaurants DB 수정 예외:', err);
        }
      }

      const updated = restaurants.map(item => {
        if (item.id === editingRestaurantId) {
          return {
            ...item,
            name: formData.name,
            region: formData.region,
            category: formData.category,
            rating: formData.rating,
            recomMenu: formData.recomMenu,
            review: formData.review,
            address: formData.address,
            phone: formData.phone,
            mapUrl: targetMapUrl,
            coords: targetCoords
          };
        }
        return item;
      });

      setRestaurants(updated);
      localStorage.setItem('shared_restaurants_local', JSON.stringify(updated.filter(x => String(x.id).startsWith('rest_'))));

      if (broadcastChannelRef.current) {
        try {
          const editedObj = updated.find(x => x.id === editingRestaurantId);
          if (editedObj) {
            broadcastChannelRef.current.send({
              type: 'broadcast',
              event: 'RESTAURANT_UPSERT',
              payload: { item: editedObj }
            });
          }
        } catch (e) {}
      }

      setIsAddModalOpen(false);
      setEditingRestaurantId(null);
      alert(`🎉 [${formData.name}] 맛집 정보가 수정되었습니다!`);
    } else {
      // --- 신규 맛집 저장 (INSERT) ---
      const newObj = {
        id: `rest_${Date.now()}`,
        name: formData.name,
        member_id: user ? user.id : 'demo_user',
        member_email: user ? user.email : '내 계정',
        member_name: user ? (user.user_metadata?.full_name || user.email.split('@')[0]) : '나',
        region: formData.region,
        category: formData.category,
        rating: formData.rating,
        recomMenu: formData.recomMenu,
        review: formData.review,
        address: formData.address,
        phone: formData.phone,
        mapUrl: formData.mapUrl || `https://map.kakao.com/?q=${encodeURIComponent(formData.name)}`,
        coords: formData.lat && formData.lng ? [formData.lat, formData.lng] : [37.5665, 126.9780],
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured() && user) {
        try {
          await supabase
            .from('shared_restaurants')
            .insert([{
              user_id: user.id,
              user_email: user.email,
              user_name: newObj.member_name,
              name: newObj.name,
              region: newObj.region,
              category: newObj.category,
              rating: newObj.rating,
              recom_menu: newObj.recomMenu,
              review: newObj.review,
              address: newObj.address,
              phone: newObj.phone,
              map_url: newObj.mapUrl,
              lat: newObj.coords[0],
              lng: newObj.coords[1]
            }]);
        } catch (err) {
          console.warn('shared_restaurants DB 저장 예외:', err);
        }
      }

      // 로컬 상태 즉시 갱신
      const updated = [newObj, ...restaurants];
      setRestaurants(updated);
      localStorage.setItem('shared_restaurants_local', JSON.stringify(updated.filter(x => String(x.id).startsWith('rest_'))));

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'RESTAURANT_UPSERT',
            payload: { item: newObj }
          });
        } catch (e) {}
      }

      setIsAddModalOpen(false);
      alert(`🎉 [${newObj.name}] 맛집이 성공적으로 공유 저장되었습니다!`);
    }

    // 폼 초기화
    setFormData({
      name: '',
      category: 'korean',
      region: '서울',
      rating: 5,
      recomMenu: '',
      review: '',
      address: '',
      mapUrl: '',
      phone: ''
    });
  };

  // 필터링 적용 목록
  const filteredRestaurants = restaurants.filter(item => {
    // 작성자(인원별) 필터
    if (selectedUserFilter === 'my') {
      if (user && item.member_id !== user.id) return false;
    } else if (selectedUserFilter !== 'all') {
      if (item.member_id !== selectedUserFilter) return false;
    }

    // 요리 카테고리 필터
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    // 지역 필터
    if (selectedRegion !== 'all' && item.region !== selectedRegion) {
      return false;
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchAddress = item.address.toLowerCase().includes(q);
      const matchMenu = item.recomMenu.toLowerCase().includes(q);
      const matchUser = (item.member_name || item.member_email).toLowerCase().includes(q);
      if (!matchName && !matchAddress && !matchMenu && !matchUser) return false;
    }

    return true;
  });

  return (
    <div className="shared-restaurant-container" style={{ padding: '1rem 1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 2. 작성자별(인원별) 퀵 탭 & 멀티 필터바 + 새 맛집 저장 버튼 */}
      <div style={{ background: '#ffffff', padding: '1rem 1.2rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.2rem' }}>
        {/* 작성자 (인원별 구별) 필터 태그 & 우측 새 맛집 저장 버튼 */}
        <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px' }}>
              <User size={15} className="text-sky-600" /> 저장한 멤버:
            </span>

          <button
            onClick={() => setSelectedUserFilter('all')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              border: selectedUserFilter === 'all' ? '2px solid #0284c7' : '1px solid #cbd5e1',
              background: selectedUserFilter === 'all' ? '#e0f2fe' : '#ffffff',
              color: selectedUserFilter === 'all' ? '#0369a1' : '#475569',
              fontWeight: selectedUserFilter === 'all' ? 800 : 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            🗺️ 전체 맛집 ({restaurants.length})
          </button>

          {user && (
            <button
              onClick={() => setSelectedUserFilter('my')}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: selectedUserFilter === 'my' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                background: selectedUserFilter === 'my' ? '#0284c7' : '#ffffff',
                color: selectedUserFilter === 'my' ? '#ffffff' : '#0284c7',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              👤 내가 저 장한 맛집
            </button>
          )}

          {friends.map(friend => (
            <button
              key={friend.id}
              onClick={() => setSelectedUserFilter(friend.id)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: selectedUserFilter === friend.id ? '2px solid #059669' : '1px solid #cbd5e1',
                background: selectedUserFilter === friend.id ? '#ecfdf5' : '#ffffff',
                color: selectedUserFilter === friend.id ? '#047857' : '#334155',
                fontWeight: selectedUserFilter === friend.id ? 800 : 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              🟢 {friend.name || friend.email.split('@')[0]} 님의 추천
            </button>
          ))}
          </div>

          <button
            className="btn btn-primary font-bold flex align-center gap-2"
            onClick={handleOpenAddModal}
            style={{
              background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(234,179,8,0.35)',
              fontSize: '0.88rem'
            }}
          >
            <Plus size={16} /> 새 맛집 저장하기
          </button>
        </div>

        {/* 요리 카테고리 & 검색바 2줄 정렬 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {foodCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: selectedCategory === cat.id ? '1.5px solid #eab308' : '1px solid #e2e8f0',
                  background: selectedCategory === cat.id ? '#fefce8' : '#f8fafc',
                  color: selectedCategory === cat.id ? '#854d0e' : '#64748b',
                  fontWeight: selectedCategory === cat.id ? 800 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex1: '1', maxWidth: '320px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                placeholder="맛집 이름, 메뉴, 주소 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. 대형 인터랙티브 카카오맵 지도 & 우측 갤러리 2열 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.2rem', minHeight: '620px' }}>
        {/* 좌측: 카카오맵 지도 뷰 */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #cbd5e1', overflow: 'hidden', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '620px' }} />
          
          {/* 내 위치로 이동 플로팅 버튼 (줌 컨트롤과 겹치지 않게 좌측 상단 배치) */}
          <button
            onClick={moveToMyLocation}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: 10,
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '0.78rem',
              color: '#ef4444',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Navigation size={14} className="text-red-500" /> 🎯 내 위치로 이동
          </button>

          {/* 지도 좌측 하단 정보 범례 뱃지 */}
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            📍 지도 표기: <span style={{ color: '#ef4444', fontWeight: 800 }}>🔴 내 현재 위치</span> | <span style={{ color: '#0284c7' }}>🔵 내 맛집</span> | <span style={{ color: '#059669' }}>🟢 친구 맛집</span>
          </div>
        </div>

        {/* 우측: 필터링된 맛집 리스트 갤러리 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '640px', overflowY: 'auto', paddingRight: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              🍱 등록된 맛집 ({filteredRestaurants.length}곳)
            </span>
          </div>

          {filteredRestaurants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #cbd5e1', color: '#64748b' }}>
              <Utensils size={32} className="text-slate-400 mb-2 mx-auto" />
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>조건에 맞는 맛집이 없습니다.</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>상단의 [+ 새 맛집 저장하기]를 눌러 첫 맛집을 등록해 보세요!</p>
            </div>
          ) : (
            filteredRestaurants.map(item => {
              const isMy = user && item.member_id === user.id;
              const badgeColor = isMy ? '#0284c7' : '#059669';
              const badgeName = isMy ? '나 (본인)' : (item.member_name || item.member_email.split('@')[0]);

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveDetailRestaurant(item)}
                  style={{
                    background: '#ffffff',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = badgeColor}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', background: badgeColor, padding: '2px 8px', borderRadius: '12px' }}>
                      👤 {badgeName} 추천
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#eab308' }}>
                      <Star size={13} fill="#eab308" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, marginLeft: '3px' }}>{Number(item.rating || 5).toFixed(1)}</span>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{item.name}</h4>
                  
                  {item.recomMenu && (
                    <p style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 700, marginBottom: '6px' }}>
                      🍱 추천: {item.recomMenu}
                    </p>
                  )}

                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{item.review || '작성된 후기가 없습니다.'}"
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', fontSize: '0.74rem', color: '#94a3b8' }}>
                    <span>📍 {item.address || item.region}</span>
                    <a
                      href={item.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      지도보기 <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. 신규 맛집 키워드 검색 및 저장 모달 */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1.5px solid #fef08a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.2rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#713f12', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={18} /> {editingRestaurantId ? '✏️ 맛집 정보 수정하기' : '📍 카카오 연동 새 맛집 저장하기'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#854d0e' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.2rem' }}>
              {/* 카카오 장소 실시간 검색 */}
              <form onSubmit={handleSearchPlace} style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  🔍 카카오맵 상호명/주소 키워드 검색:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="예: 마포설렁탕, 연남동 라비올라..."
                    value={placeSearchQuery}
                    onChange={(e) => setPlaceSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm font-bold" disabled={isSearchingPlace}>
                    {isSearchingPlace ? <RefreshCw size={14} className="animate-spin" /> : '검색'}
                  </button>
                </div>
              </form>

              {/* 검색 결과 드롭다운 목록 */}
              {placeSearchResults.length > 0 && (
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px', background: '#f8fafc' }}>
                  {placeSearchResults.map(res => (
                    <div
                      key={res.id}
                      onClick={() => handleSelectSearchResult(res)}
                      style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', marginBottom: '4px', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{res.name} ({res.category})</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {res.address}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 저장 폼 */}
              <form onSubmit={handleSaveRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>상호명 *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>요리 카테고리</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      {foodCategories.filter(c => c.id !== 'all').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>평점 (별점 1.0 ~ 5.0)</label>
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value={5.0}>⭐⭐⭐⭐⭐ 5.0 (최상)</option>
                      <option value={4.5}>⭐⭐⭐⭐✨ 4.5 (강추)</option>
                      <option value={4.0}>⭐⭐⭐⭐ 4.0 (추천)</option>
                      <option value={3.5}>⭐⭐⭐✨ 3.5 (우수)</option>
                      <option value={3.0}>⭐⭐⭐ 3.0 (무난)</option>
                      <option value={2.5}>⭐⭐✨ 2.5 (보통)</option>
                      <option value={2.0}>⭐⭐ 2.0 (아쉬움)</option>
                      <option value={1.5}>⭐✨ 1.5 (미흡)</option>
                      <option value={1.0}>⭐ 1.0 (비추)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>대표 추천 메뉴</label>
                  <input
                    type="text"
                    placeholder="예: 특설렁탕, 수제 커스터드 푸딩"
                    value={formData.recomMenu}
                    onChange={(e) => setFormData({ ...formData, recomMenu: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>한 줄 추천 이유 / 후기</label>
                  <textarea
                    rows={3}
                    placeholder="친구들과 나누고 싶은 이 맛집만의 매력을 자유롭게 써주세요!"
                    value={formData.review}
                    onChange={(e) => setFormData({ ...formData, review: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyRight: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>취소</button>
                  <button type="submit" className="btn btn-primary font-bold">{editingRestaurantId ? '수정 완료' : '저장하기'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. 맛집 클릭 상세 모달 팝업 */}
      {activeDetailRestaurant && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '1.4rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1.5px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', background: '#0284c7', padding: '3px 10px', borderRadius: '12px' }}>
                👤 {activeDetailRestaurant.member_name} 님의 추천 맛집
              </span>
              <button onClick={() => setActiveDetailRestaurant(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              {activeDetailRestaurant.name}
            </h3>

            <p style={{ fontSize: '0.88rem', color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', fontWeight: 800, display: 'inline-block', marginBottom: '12px' }}>
              🍱 추천 대표 메뉴: {activeDetailRestaurant.recomMenu || '전 메뉴 강추'}
            </p>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
              "{activeDetailRestaurant.review || '후기가 작성되지 않았습니다.'}"
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>📍 <b>주소:</b> {activeDetailRestaurant.address || '주소 정보 없음'}</div>
              {activeDetailRestaurant.phone && <div>📞 <b>전화:</b> {activeDetailRestaurant.phone}</div>}
            </div>

            {/* 작성자 본인일 경우 수정 & 삭제 버튼 노출 */}
            {(!user || activeDetailRestaurant.member_id === user.id || activeDetailRestaurant.member_id === 'demo_user' || String(activeDetailRestaurant.id).startsWith('rest_')) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                <button
                  onClick={() => handleOpenEditModal(activeDetailRestaurant)}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid #0284c7', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  ✏️ 맛집 정보 수정
                </button>
                <button
                  onClick={() => handleDeleteRestaurant(activeDetailRestaurant)}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid #f87171', background: '#fef2f2', color: '#dc2626', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  🗑️ 맛집 삭제
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={activeDetailRestaurant.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary font-bold flex-1 text-center"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                카카오맵 길찾기 / 바로가기 <ExternalLink size={14} />
              </a>
              <button className="btn btn-secondary" onClick={() => setActiveDetailRestaurant(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
