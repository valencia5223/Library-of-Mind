// public/sw.js - 웹 푸시 알림 수신 및 클릭 이벤트를 처리하는 서비스 워커 스크립트

// 1. 서비스 워커 설치 & 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const OLD_TITLES = ['🔔 일정 알림', '💬 [클릭 시 채팅창 열림] 쪽지가 도착했습니다!'];
function fallbackPromo() {
  const pick = (l) => l[Math.floor(Math.random() * l.length)];
  const ai = pick(['ChatGPT', 'Claude', 'Gemini', 'GPT']);
  return {
    title: pick(['📢 AI 시대, {ai} 교육 안내', '🎓 {ai} 실무 활용 과정 모집', '💡 {ai}로 업무 시간 절반 줄이기']).replace('{ai}', ai),
    body: pick(['{ai} 하나로 보고서·메일·기획서까지! 실무 활용 교육 신청 받는 중이에요.', 'AI 시대 필수 역량! {ai} 실무 교육 수강생 모집 중입니다.']).replace('{ai}', ai)
  };
}

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

  // 예전 버전 화면에서 보낸 흔들기는 문구가 기본값으로 와서, 받는 쪽에서 홍보 문구로 바꾼다
  // (화면 쪽 문구 목록은 src/utils/nudgeMessages.js, 여기는 예전 버전 대비용 짧은 목록)
  if (!notificationData.title || OLD_TITLES.includes(notificationData.title)) {
    const promo = fallbackPromo();
    notificationData.title = promo.title;
    notificationData.body = promo.body;
  }

  // 흔들기 번호(nid): 같은 흔들기가 실시간 알림·여러 푸시 구독으로 두 번 와도 한 번만 울린다.
  // 푸시를 받으면 알림을 꼭 띄워야 해서(안 띄우면 브라우저가 기본 알림을 띄움) 같은 번호면 소리 없이 덮어쓴다
  const data = notificationData.data || {};
  let nid = data.nid || '';
  if (!nid && data.url) {
    try { nid = new URL(data.url, self.location.origin).searchParams.get('nudge') || ''; } catch (e) { /* 무시 */ }
  }
  data.nid = nid;
  data.at = Date.now();

  event.waitUntil(
    self.registration.getNotifications({ tag: notificationData.tag }).then((list) => {
      // 번호가 같으면 같은 흔들기. 번호가 없는 예전 버전 흔들기는 8초 안에 뜬 알림이 있으면 같은 것으로 본다
      const seen = list.some((n) => n.data && (nid ? n.data.nid === nid : Date.now() - (n.data.at || 0) < 8000));
      // 자동으로 닫지 않는다: 안 누르고 사라지는 알림이 쌓이면 브라우저가 알림 권한을 회수한다
      return self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        renotify: !seen,
        silent: seen,
        requireInteraction: false,
        vibrate: seen ? undefined : [200, 100, 200, 100, 200],
        data
      });
    })
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
