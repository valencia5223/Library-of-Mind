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
    title: '💬 [클릭 시 채팅창 열림] 쪽지가 도착했습니다!',
    body: '상대방이 채팅창을 흔듭니다! ⚡\n👉 알림창 아무 곳이나 클릭하면 채팅창으로 바로 이동합니다.',
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
    requireInteraction: false, // 🔒 프라이버시 보호: 30초 후 자동 소멸
    vibrate: [200, 100, 200, 100, 200],
    data: notificationData.data
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options).then(() => {
      // 🔒 프라이버시 보호: 30초 타이머 설정 후 팝업 자동 닫기
      setTimeout(async () => {
        try {
          const notifications = await self.registration.getNotifications({ tag: notificationData.tag });
          notifications.forEach((n) => n.close());
        } catch (e) {
          console.warn('Auto close notification timer warning:', e);
        }
      }, 30000);
    })
  );
});

// 3. 클라이언트 메타 메시지 이벤트 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NUDGE_NOTIFICATION') {
    const title = event.data.title || '💬 [클릭 시 채팅창 열림] 쪽지가 도착했습니다!';
    const body = event.data.body || '상대방이 채팅창을 흔듭니다! ⚡\n👉 알림창 아무 곳이나 클릭하면 채팅창으로 바로 이동합니다.';
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
    }).then(() => {
      setTimeout(async () => {
        try {
          const notifications = await self.registration.getNotifications({ tag: tag });
          notifications.forEach((n) => n.close());
        } catch (e) {}
      }, 30000);
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
