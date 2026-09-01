// src/utils/webPush.js - 서비스 워커 등록 및 Web Push 구독/Edge Function 발송 유틸리티

import { supabase, isSupabaseConfigured } from '../supabaseClient';

// 표준 Web Push VAPID 공개 키 (Edge Function VAPID Key와 100% 매칭)
export const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY || 
  'BNaIMXgaSQc25hN8q1ifdBuHvX2oV5k8P89MH5w29dDvvTGWlag-Bs7JwbhVIlIERbJQgwRA6Wx5oGnJjnT6qTA';

// 모바일 Safari / 인앱 웹뷰(카카오톡 등) ReferenceError 방지용 안전 알림 지원 확인 헬퍼
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined';
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission || 'default';
  } catch (e) {
    return 'unsupported';
  }
}

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

// 2. 푸시 알림 권한 요청 및 PushManager 최신 VAPID 구독 생성 & DB 저장 (타임아웃 및 모바일 안전 방어 적용)
export async function subscribeUserToPush(userId, userEmail, forceRefresh = false) {
  if (!isNotificationSupported() || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('이 브라우저는 PushManager/Notification API를 지원하지 않습니다.');
    return null;
  }

  try {
    // 1) 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('사용자가 데스크톱 알림 권한을 거부했거나 설정하지 않았습니다.');
      return null;
    }

    // 2) 서비스 워커 준비 (3초 타임아웃 방어)
    let registration = await Promise.race([
      navigator.serviceWorker.ready,
      registerServiceWorker(),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ]);

    if (!registration) {
      registration = await registerServiceWorker();
    }

    if (!registration) {
      console.warn('서비스 워커를 준비할 수 없습니다.');
      return null;
    }

    // 3) 기존 구형 또는 타 VAPID 구독이 존재하면 해제 후 항상 최신 VAPID 키로 재구독
    let subscription = await registration.pushManager.getSubscription();

    if (subscription && forceRefresh) {
      try {
        await subscription.unsubscribe();
        subscription = null;
      } catch (e) {
        console.warn('기존 구독 해제 예외:', e);
      }
    }

    if (!subscription) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
        console.log('✨ 구글 FCM / 브라우저 푸시 서버 신규 구독 성공');
      } catch (subErr) {
        console.warn('VAPID 키 구독 예외, 표준 구독 시도:', subErr);
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true
          });
        } catch (e) {
          console.error('Standard Push subscription error:', e);
        }
      }
    }

    // 4) Supabase DB push_subscriptions 테이블에 저장 (User ID + Email 이중 매칭)
    if (subscription && (userId || userEmail) && isSupabaseConfigured()) {
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId || null,
        user_email: userEmail || '',
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

      if (error) {
        console.warn('Push Subscription DB 저장 경고:', error.message);
      } else {
        console.log('✅ Push Subscription DB 등록/갱신 완수:', userEmail || userId);
      }
    }

    return subscription;
  } catch (error) {
    console.error('Push 구독 생성 중 예외 발생:', error);
    return null;
  }
}

// 3. 상대방에게 오프라인 웹 푸시 전송 (Supabase Edge Function + Realtime Broadcast 하이브리드)
export async function sendWebPushNotification(targetUserId, payload) {
  const targetEmail = payload?.target_user_email || payload?.email || '';
  if (!targetUserId && !targetEmail) return;

  const title = payload.title || '💬 [클릭 시 채팅창 열림] 쪽지가 도착했습니다!';
  const body = payload.body || '상대방이 채팅창을 흔듭니다! ⚡\n👉 알림창 아무 곳이나 클릭하면 채팅창으로 바로 이동합니다.';
  const senderEmail = payload.sender_email || '';
  const senderId = payload.sender_id || '';

  if (isSupabaseConfigured()) {
    // 1) Supabase Realtime Broadcast 전송 (현재 브라우저를 열어둔 웹 온라인 상태 대응)
    const channelsToBroadcast = [];
    if (targetUserId) channelsToBroadcast.push(`global_user_nudge:${targetUserId}`);
    if (targetEmail) channelsToBroadcast.push(`global_user_nudge:email_${targetEmail}`);

    channelsToBroadcast.forEach((chanName) => {
      try {
        const tempChan = supabase.channel(chanName);
        tempChan.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            tempChan.send({
              type: 'broadcast',
              event: 'nudge_received',
              payload: {
                sender_id: senderId,
                sender_email: senderEmail,
                title: title,
                body: body
              }
            });
            setTimeout(() => {
              supabase.removeChannel(tempChan);
            }, 3000);
          }
        });
      } catch (e) {
        console.warn('Realtime nudge broadcast error:', e);
      }
    });

    // 2) Supabase Edge Function 'send-push' 호출 (창이 완전히 닫힌 오프라인 상태 대응!)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          target_user_id: targetUserId || '',
          target_user_email: targetEmail || '',
          sender_id: senderId,
          sender_email: senderEmail,
          title: title,
          body: body,
          url: '/'
        }
      });

      if (error) {
        console.warn('Edge Function send-push 호출 경고:', error.message);
      } else if (data) {
        console.log('✅ Edge Function 푸시 전송 결과:', data);
        if (data.total_subscriptions === 0) {
          console.warn(`⚠️ 상대방(${targetEmail || targetUserId})의 푸시 구독 정보가 Supabase DB에 등록되어 있지 않습니다.`);
        }
      }
    } catch (e) {
      console.warn('Edge Function invocation error:', e);
    }
  }
}
