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

  const mapContainerRef = useRef(null);
  const kakaoMapInstance = useRef(null);
  const markersRef = useRef([]);

  // 1. 친구 목록 및 맛집 목록 데이터 불러오기
  useEffect(() => {
    fetchFriends();
    fetchRestaurants();
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

  // 맛집 목록 DB 및 fallback 조회
  const fetchRestaurants = async () => {
    setLoading(true);
    let loadedData = [];
    
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('shared_restaurants')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          loadedData = data.map(item => ({
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

    // DB 데이터가 없을 경우 기본 데이터 + 로컬스토리지 합성
    if (loadedData.length === 0) {
      const localSaved = localStorage.getItem('shared_restaurants_local');
      let localList = [];
      if (localSaved) {
        try { localList = JSON.parse(localSaved); } catch (e) {}
      }
      
      const convertedDefaults = defaultRestaurants.map(item => ({
        id: `def_${item.id}`,
        name: item.name,
        member_id: item.member === 'papa' ? 'papa' : item.member === 'mama' ? 'mama' : 'def',
        member_email: item.member === 'papa' ? '할아버지 (아빠)' : item.member === 'mama' ? '할머니 (엄마)' : '가족 멤버',
        member_name: item.member === 'papa' ? '할아버지' : item.member === 'mama' ? '할머니' : '가족',
        region: item.region,
        category: item.category,
        rating: item.rating,
        recomMenu: item.recomMenu,
        review: item.review,
        address: item.address,
        mapUrl: item.mapUrl,
        coords: item.coords || [37.5665, 126.9780]
      }));

      loadedData = [...localList, ...convertedDefaults];
    }

    setRestaurants(loadedData);
    setLoading(false);
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
            center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 중심
            level: 8
          };

          const map = new window.kakao.maps.Map(container, options);
          kakaoMapInstance.current = map;

          // 지도 컨트롤 추가
          const zoomControl = new window.kakao.maps.ZoomControl();
          map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

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
      const badgeName = isMy ? '나 (본인)' : (item.member_name || item.member_email.split('@')[0]);

      // 커스텀 오버레이 마커 태그 생성
      const content = document.createElement('div');
      content.style.cssText = `
        padding: 5px 10px;
        background: #ffffff;
        border: 2px solid ${badgeColor};
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78rem;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
        transform: translateY(-100%);
      `;
      content.innerHTML = `
        <span style="background:${badgeColor}; color:#fff; padding:1px 6px; border-radius:10px; font-size:0.7rem;">${badgeName}</span>
        <span style="color:#0f172a;">${item.name}</span>
      `;

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

  // 검색 결과 선택 시 폼 채우기
  const handleSelectSearchResult = (item) => {
    setFormData(prev => ({
      ...prev,
      name: item.name,
      address: item.address,
      phone: item.phone || '',
      mapUrl: item.mapUrl,
      lat: item.lat,
      lng: item.lng
    }));
    setPlaceSearchResults([]);
  };

  // 맛집 신규 저장 제출
  const handleSaveRestaurant = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('상호명을 입력하거나 검색 결과에서 선택해 주세요!');
      return;
    }

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

    // 폼 및 모달 초기화
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
    setIsAddModalOpen(false);
    alert(`🎉 [${newObj.name}] 맛집이 성공적으로 공유 저장되었습니다!`);
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
    <div className="shared-restaurant-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. 상단 웰컴 & 맛집 등록 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin className="text-amber-500" size={28} /> 📍 우리들의 카카오 맛집 지도
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
            나와 이웃 친구들이 직접 다녀온 검증된 맛집을 지도 위에서 확인하고, 등록자별 뱃지로 한눈에 구별하세요!
          </p>
        </div>

        <button
          className="btn btn-primary font-bold flex align-center gap-2"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
            border: 'none',
            padding: '0.65rem 1.3rem',
            borderRadius: '10px',
            boxShadow: '0 4px 14px rgba(234,179,8,0.35)',
            fontSize: '0.92rem'
          }}
        >
          <Plus size={18} /> + 새 맛집 저장하기
        </button>
      </div>

      {/* 2. 작성자별(인원별) 퀵 탭 & 멀티 필터바 */}
      <div style={{ background: '#ffffff', padding: '1rem 1.2rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
        {/* 작성자 (인원별 구별) 필터 태그 */}
        <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
          
          {/* 지도 좌측 하단 정보 범례 뱃지 */}
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            📍 지도 표기: <span style={{ color: '#0284c7' }}>🔵 내 맛집</span> | <span style={{ color: '#059669' }}>🟢 친구 맛집</span> (클릭 시 상세 모달)
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
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, marginLeft: '3px' }}>{item.rating}.0</span>
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
                <Plus size={18} /> 📍 카카오 연동 새 맛집 저장하기
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
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>평점 (별점 1~5)</label>
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5점 만점)</option>
                      <option value={4}>⭐⭐⭐⭐ (4점 강추)</option>
                      <option value={3}>⭐⭐⭐ (3점 무난)</option>
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
                  <button type="submit" className="btn btn-primary font-bold">저장하기</button>
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
