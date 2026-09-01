// public/sw.js - 웹 푸시 알림 수신 및 클릭 이벤트를 처리하는 서비스 워커 스크립트

// 1. 서비스 워커 설치 & 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. 푸시(Push) 이벤트 수신 - 브라우저 창이 닫혀 있어도 OS 백그라운드에서 동작!
self.addEventListener('push', (event) => {
  let notificationData = {
    title: '💬 쪽지가 도착했습니다!',
    body: '상대방이 채팅창을 흔듭니다! ⚡',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'nudge-shake-notification',
    renotify: true,
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.title) notificationData.title = payload.title;
      if (payload.body) notificationData.body = payload.body;
      if (payload.icon) notificationData.icon = payload.icon;
      if (payload.data) notificationData.data = payload.data;
    } catch (e) {
      // JSON 파싱 실패 시 일반 텍스트 사용
      const text = event.data.text();
      if (text) notificationData.body = text;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    renotify: notificationData.renotify,
    requireInteraction: true, // 사용자가 직접 닫거나 클릭할 때까지 팝업 유지
    vibrate: [200, 100, 200, 100, 200], // 모바일/지원 기기 진동 패턴
    data: notificationData.data
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// 3. 클라이언트 메타 메시지 이벤트 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NUDGE_NOTIFICATION') {
    const title = event.data.title || '💬 쪽지가 도착했습니다!';
    const body = event.data.body || '상대방이 채팅창을 흔듭니다! ⚡';
    self.registration.showNotification(title, {
      body: body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'nudge-shake-notification',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: '/' }
    });
  }
});

// 4. 알림 클릭 시 닫혀있던 웹페이지 열기 또는 기존 탭으로 포커스 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 앱 탭이 있다면 포커스
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // 열려 있는 탭이 없으면 새 창/탭으로 웹 앱 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

