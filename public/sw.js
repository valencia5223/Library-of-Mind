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
    title: '🔔 일정 알림',
    body: '확인할 일정이 있습니다.',
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
    requireInteraction: false,
    vibrate: [200, 100, 200, 100, 200],
    data: notificationData.data
  };

  event.waitUntil(
    // 자동으로 닫지 않는다: 안 누르고 사라지는 알림이 쌓이면 브라우저가 알림 권한을 회수한다
    self.registration.showNotification(notificationData.title, options)
  );
});

// 3. 클라이언트 메타 메시지 이벤트 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NUDGE_NOTIFICATION') {
    const title = event.data.title || '🔔 일정 알림';
    const body = event.data.body || '확인할 일정이 있습니다.';
    const tag = 'nudge-shake-notification';
    
    self.registration.showNotification(title, {
      body: body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: '/',
        sender_id: event.data.senderId,
        sender_email: event.data.senderEmail
      }
    });
  }
});

// 4. 알림 및 바로가기 버튼 클릭 시 닫혀있던 브라우저를 열고 바로 1:1 라이브 채팅 모달 오픈
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/';

  // 딥링크 파라미터 구성 (클릭 시 1:1 메모 모달 바로 띄우기)
  const senderId = data.sender_id || '';
  const senderEmail = data.sender_email || '';
  if (senderId || senderEmail) {
    const params = new URLSearchParams();
    params.set('open_chat', 'true');
    if (senderId) params.set('sender_id', senderId);
    if (senderEmail) params.set('sender_email', senderEmail);
    targetUrl = `/?${params.toString()}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 앱 탭이 있다면 포커스 후 페이지 딥링크 이동
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
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
