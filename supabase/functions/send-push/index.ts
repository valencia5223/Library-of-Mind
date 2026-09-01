// supabase/functions/send-push/index.ts - Deno / Supabase Edge Function 오프라인 웹 푸시 알림 전송 서비스

import webpush from 'npm:web-push@^3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BNaIMXgaSQc25hN8q1ifdBuHvX2oV5k8P89MH5w29dDvvTGWlag-Bs7JwbhVIlIERbJQgwRA6Wx5oGnJjnT6qTA';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '4_Wkb0ex4_9JzoaDvK1SvX2O9NqFXwq81EYjlqVJ_ZE';
const VAPID_SUBJECT = 'mailto:admin@libraryofmind.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS Preflight 옵션 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_user_id, title, body, icon, url, sender_email, sender_id } = await req.json();

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Supabase 클라이언트 초기화 (서비스 롤 또는 API 키 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 대상 사용자의 웹 푸시 구독 엔드포인트 목록 DB 조회
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', target_user_id);

    if (dbError) {
      console.error('DB fetch error:', dbError);
    }

    let sentCount = 0;
    let failedCount = 0;
    const notificationPayload = JSON.stringify({
      title: title || '💬 쪽지가 도착했습니다!',
      body: body || '상대방이 채팅창을 흔듭니다! ⚡',
      icon: icon || '/favicon.ico',
      data: {
        url: url || '/',
        sender_email: sender_email || '',
        sender_id: sender_id || ''
      }
    });

    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          await webpush.sendNotification(pushSubscription, notificationPayload);
          sentCount++;
        } catch (err: any) {
          failedCount++;
          console.warn(`푸시 전송 실패 (endpoint: ${sub.endpoint}):`, err.statusCode || err.message);

          // 404/410 등 만료된 푸시 엔드포인트는 DB에서 자동으로 제거 정리
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }

    // 부재중/오프라인 이중 백업을 위해 nudge_history 기록
    await supabase.from('nudge_history').insert({
      sender_id: sender_id || null,
      sender_email: sender_email || '상대방',
      target_user_id: target_user_id,
      read: false,
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.warn('nudge_history 저장 참고 (테이블 준비중):', error.message);
    });

    return new Response(JSON.stringify({
      success: true,
      sent_count: sentCount,
      failed_count: failedCount,
      total_subscriptions: subscriptions ? subscriptions.length : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Edge Function Exception:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
