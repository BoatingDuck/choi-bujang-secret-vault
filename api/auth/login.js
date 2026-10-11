import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

    const origin = req.headers.origin;
    const host = req.headers.host;

    let allowedOrigin = false;

    try {
    allowedOrigin =
        typeof origin === 'string' &&
        typeof host === 'string' &&
        new URL(origin).origin === `https://${host}`;
    } catch {
    allowedOrigin = false;
    }

    if (!allowedOrigin) {
    return res.status(403).json({
        error: '허용되지 않은 요청 출처입니다.'
    });
    }

  const { email, password } = req.body ?? {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: '이메일과 비밀번호를 입력해야 합니다.'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseAuthKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey || !supabaseAuthKey) {
    return res.status(500).json({
        error: '서버 설정을 확인할 수 없습니다.'
    });
    }
  try {
    const supabase = createClient(
        supabaseUrl,
        supabaseAuthKey,
        {
            auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
            }
        }
    );

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

    if (error || !data.session?.access_token) {
      return res.status(401).json({
        error: '이메일 또는 비밀번호를 확인해 주세요.'
      });
    }

    const expiresIn = Math.max(
        1,
        Math.min(
            data.session.expires_at - Math.floor(Date.now() / 1000),
            3600
        )
    );

    res.setHeader(
        'Set-Cookie',
        `bb_access=${data.session.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${expiresIn}`
    );

    return res.status(200).json({
      ok: true,
      email: data.user?.email ?? email.trim()
    });
  } catch {
    return res.status(500).json({
      error: '로그인 처리 중 오류가 발생했습니다.'
    });
  }
}