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

Deno.serve(async (req: Request) => {
  // CORS Preflight 옵션 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_user_id, target_user_email, title, body, icon, url, sender_email, sender_id } = await req.json();

    if (!target_user_id && !target_user_email) {
      return new Response(JSON.stringify({ error: 'target_user_id or target_user_email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Supabase 클라이언트 초기화 (서비스 롤 또는 API 키 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 대상 사용자의 웹 푸시 구독 엔드포인트 목록 DB 조회 (user_id 또는 user_email 매칭)
    let query = supabase.from('push_subscriptions').select('*');
    if (target_user_id && target_user_email) {
      query = query.or(`user_id.eq.${target_user_id},user_email.eq.${target_user_email}`);
    } else if (target_user_id) {
      query = query.eq('user_id', target_user_id);
    } else {
      query = query.eq('user_email', target_user_email);
    }

    const { data: subscriptions, error: dbError } = await query;

    if (dbError) {
      console.error('Push Subscription DB fetch error:', dbError);
    }

    let sentCount = 0;
    let failedCount = 0;
    const notificationPayload = JSON.stringify({
      title: title || '💬 [클릭 시 채팅창 열림] 쪽지가 도착했습니다!',
      body: body || '상대방이 채팅창을 흔듭니다! ⚡\n👉 알림창 아무 곳이나 클릭하면 채팅창으로 바로 이동합니다.',
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
          console.log(`✅ Push sent to ${sub.user_email || sub.user_id}`);
        } catch (err: any) {
          failedCount++;
          console.warn(`푸시 전송 실패 (endpoint: ${sub.endpoint}):`, err.statusCode || err.message);

          // 404/410 등 만료된 푸시 엔드포인트는 DB에서 자동으로 제거 정리
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    } else {
      console.warn(`⚠️ 대상 사용자(ID: ${target_user_id}, Email: ${target_user_email})의 push_subscriptions 정보가 없습니다.`);
    }

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
