import {
  verifyRequestUser,
  isAllowedWriteOrigin
} from '../src/auth-session.mjs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  // Bearer 토큰 또는 브라우저 로그인 쿠키 확인
  if (!req.headers.authorization && !req.headers.cookie) {
    return res.status(401).json({
      error: '로그인이 필요합니다.'
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
    // 기존 JWT 검증과 새로운 쿠키 인증을 공통 처리
    const verifiedUser = await verifyRequestUser(req);

    if (!verifiedUser) {
      return res.status(401).json({
        error: '유효하지 않거나 만료된 로그인 토큰입니다.'
      });
    }

    if (req.method === 'POST' && !isAllowedWriteOrigin(req)) {
      return res.status(403).json({
        error: '허용되지 않은 요청 출처입니다.'
      });
    }

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

    if (req.method === 'POST') {
      const body = req.body;

      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        typeof body.title !== 'string' ||
        typeof body.body !== 'string' ||
        !body.title.trim() ||
        !body.body.trim()
      ) {
        return res.status(400).json({
          error: '제목과 내용을 입력해야 합니다.'
        });
      }

      const requestedId = body.id;

      if (
        requestedId !== undefined &&
        (
          typeof requestedId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)
        )
      ) {
        return res.status(400).json({
          error: '올바른 UUID를 입력해야 합니다.'
        });
      }

      const id = requestedId ?? randomUUID();

      const { error } = await supabase
        .from('notes')
        .insert({
          note_uuid: id,
          owner_id: verifiedUser.userId,
          title: body.title,
          content: body.body
        });

      if (error) {
        throw new Error('Database insert failed');
      }

      return res.status(201).json({ id });
    }

    const { data, error } = await supabase
      .from('notes')
      .select('id:note_uuid, title, body:content, created_at')
      .eq('owner_id', verifiedUser.userId)
      .order('note_uuid', { ascending: true });

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
