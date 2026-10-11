
import { createClient } from '@supabase/supabase-js';
import { verifyRequestUser } from '../../src/auth-session.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  try {
    const user = await verifyRequestUser({
      headers: {
        cookie: req.headers.cookie
      }
    });

    if (!user || user.kind !== 'student') {
      return res.status(401).json({
        error: '로그인이 필요합니다.'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } =
      await supabase.auth.admin.getUserById(user.userId);

    if (error || !data.user) {
      return res.status(401).json({
        error: '로그인 정보를 확인할 수 없습니다.'
      });
    }

    return res.status(200).json({
      loggedIn: true,
      email: data.user.email
    });
  } catch {
    return res.status(500).json({
      error: '로그인 상태 확인에 실패했습니다.'
    });
  }
}
