
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error: '서버 설정을 확인할 수 없습니다.'
    });
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, created_at')
      .order('id', { ascending: true });

    if (error) {
      throw new Error('Database query failed');
    }

    return res.status(200).json({
      notes: data
    });
  } catch {
    return res.status(500).json({
      error: '자료를 불러오지 못했습니다.'
    });
  }
}
