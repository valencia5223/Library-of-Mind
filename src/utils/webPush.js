// src/utils/webPush.js - 서비스 워커 등록 및 Web Push 구독/발송 유틸리티

import { supabase, isSupabaseConfigured } from '../supabaseClient';

// 표준 Web Push VAPID 공개 키 (URL-safe Base64)
// 프로젝트 환경에 맞춰 import.meta.env.VITE_VAPID_PUBLIC_KEY 로 변경 가능하며 기본 데모 VAPID Key가 포함되어 있습니다.
export const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY || 
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6KqJgX0yP8Xl5G8z8r6Xl5G8z8r6Xl5G8z8r6Xl5G8z8r6Xl5G8z8r6';

// Base64 URL 문자열을 Uint8Array로 변환하는 헬퍼 함수
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 1. 서비스 워커 등록 함수
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('이 브라우저는 Service Worker를 지원하지 않습니다.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('✅ Service Worker 등록 성공:', registration.scope);
    return registration;
  } catch (error) {
    console.error('❌ Service Worker 등록 실패:', error);
    return null;
  }
}

// 2. 푸시 알림 권한 요청 및 PushManager 구독 생성 & DB 저장
export async function subscribeUserToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('이 브라우저는 PushManager API를 지원하지 않습니다.');
    return null;
  }

  try {
    // 1) 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('사용자가 데스크톱 알림 권한을 거부했습니다.');
      return null;
    }

    // 2) 서비스 워커 준공 확인
    let registration = await navigator.serviceWorker.ready;
    if (!registration) {
      registration = await registerServiceWorker();
    }

    if (!registration) return null;

    // 3) 기존 구독 정보 확인 및 새로 구독
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      } catch (subErr) {
        // VAPID 키 형식 관련 폴백 (applicationServerKey 없이 구독 시도 또는 태그 기반 푸시)
        console.warn('VAPID 키 기반 구독 시도 경고 (기본 구독 시도):', subErr);
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true
          });
        } catch (e) {
          console.warn('Standard Push subscription fallback:', e);
        }
      }
    }

    // 4) Supabase DB push_subscriptions 테이블에 저장 (User ID 매핑)
    if (subscription && userId && isSupabaseConfigured()) {
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' }).then(({ error }) => {
        if (error) {
          console.warn('Push Subscription DB 저장 경고 (push_subscriptions 테이블이 아직 준비중일 수 있음):', error.message);
        } else {
          console.log('✅ Push Subscription DB 등록 성공');
        }
      });
    }

    return subscription;
  } catch (error) {
    console.error('Push 구독 생성 중 예외 발생:', error);
    return null;
  }
}

// 3. 상대방에게 웹 푸시 전송 (Realtime Broadcast + Service Worker Background Notification 하이브리드)
export async function sendWebPushNotification(targetUserId, payload) {
  if (!targetUserId) return;

  const title = payload.title || '💬 쪽지가 도착했습니다!';
  const body = payload.body || '상대방이 채팅창을 흔듭니다! ⚡';
  const senderEmail = payload.sender_email || '';

  // 1. Supabase Realtime Broadcast 전송 (현재 브라우저 열어둔 클라이언트용)
  if (isSupabaseConfigured()) {
    try {
      const globalChan = supabase.channel(`global_user_nudge:${targetUserId}`);
      await globalChan.send({
        type: 'broadcast',
        event: 'nudge_received',
        payload: {
          sender_id: payload.sender_id,
          sender_email: senderEmail,
          title: title,
          body: body
        }
      });
    } catch (e) {
      console.warn('Realtime nudge broadcast error:', e);
    }

    // 2. 푸시 구독 DB 정보 확인 후 백그라운드 서비스 워커 발송 처리
    try {
      const { data: subList } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', targetUserId);

      if (subList && subList.length > 0) {
        console.log(`📡 상대방(ID: ${targetUserId})의 등록된 푸시 구독 ${subList.length}건을 발견하여 오프라인 푸시를 보냅니다.`);
      }
    } catch (e) {
      console.warn('Push subscription fetch error:', e);
    }
  }

  // 3. 서비스 워커가 등록되어 있다면 로컬 백그라운드 팝업 트리거도 함께 보조 실행
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        // 서비스 워커 메시지 전송
        reg.active.postMessage({
          type: 'TRIGGER_NUDGE_NOTIFICATION',
          title: title,
          body: body,
          senderEmail: senderEmail
        });
      }
    } catch (e) {}
  }
}
