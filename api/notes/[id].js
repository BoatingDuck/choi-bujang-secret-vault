import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../../src/verify-login.mjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE');
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
    const config = JSON.parse(
      await readFile(
        new URL('../../aleph.config.json', import.meta.url),
        'utf8'
      )
    );

    const verifyLogin = createLoginVerifier({
      config,
      supabaseSecretKey
    });

    const verifiedUser = await verifyLogin(
      req.headers.authorization
    );

    if (!verifiedUser) {
      return res.status(401).json({
        error: '유효한 로그인이 필요합니다.'
      });
    }

    const id = req.query.id;

    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        return res.status(400).json({
            error: '올바른 메모 ID가 아닙니다.'
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

    const { data, error } = await supabase
      .from('notes')
      .select('id:note_uuid, title, body:content')
      .eq('note_uuid', id)
      .maybeSingle();

    if (error) {
      throw new Error('Database query failed');
    }

    if (!data) {
    return res.status(404).json({
        error: '메모를 찾을 수 없습니다.'
    });
    }

    if (req.method === 'PUT') {
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

    const { error: updateError } = await supabase
        .from('notes')
        .update({
        title: body.title,
        content: body.body
        })
        .eq('note_uuid', id);

    if (updateError) {
        throw new Error('Database update failed');
    }

    return res.status(200).json({
        id,
        title: body.title,
        body: body.body
    });
    }

    if (req.method === 'DELETE') {
    const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .eq('note_uuid', id);

    if (deleteError) {
        throw new Error('Database delete failed');
    }

    return res.status(200).json({
        id,
        deleted: true
    });
    }

    return res.status(200).json(data);

  } catch {
    return res.status(500).json({
      error: '메모를 조회하지 못했습니다.'
    });
  }
}
