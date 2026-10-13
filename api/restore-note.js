import { createClient } from '@supabase/supabase-js';
import { verifyRequestUser, isAllowedWriteOrigin } from '../src/auth-session.mjs';
import { verifyPrivateNoteSnapshot, noteDigest } from '../src/note-recovery.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST 요청만 허용합니다.' });
  }
  if (!req.headers.authorization && !req.headers.cookie) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  if (!isAllowedWriteOrigin(req)) {
    return res.status(403).json({ error: '요청 출처가 허용되지 않습니다.' });
  }
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, RESTORE_NOTE_SNAPSHOT_B64 } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !RESTORE_NOTE_SNAPSHOT_B64) {
    return res.status(503).json({ error: '검증된 비공개 복구 사본이 준비되지 않았습니다.' });
  }
  try {
    const user = await verifyRequestUser(req);
    if (!user?.userId || user.kind !== 'student') {
      return res.status(403).json({ error: '시험 계정 사용자만 복구할 수 있습니다.' });
    }
    const { id, confirm } = req.body ?? {};
    if (typeof id !== 'string' || confirm !== true) {
      return res.status(400).json({ error: '복구 ID 및 실행 확인이 필요합니다.' });
    }
    const raw = Buffer.from(RESTORE_NOTE_SNAPSHOT_B64, 'base64').toString('utf8');
    const privateSnapshot = JSON.parse(raw);
    const backup = verifyPrivateNoteSnapshot(privateSnapshot, id, user.userId);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: existing, error: readError } = await supabase.from('notes')
      .select('note_uuid, owner_id').eq('note_uuid', id).maybeSingle();
    if (readError) throw new Error('snapshot_restore_read_failed');
    if (existing && existing.owner_id !== backup.ownerId) {
      return res.status(409).json({ error: '기존 소유자와 일치하지 않아 중단했습니다.' });
    }
    const values = { title: backup.title, content: backup.body };
    const result = existing
      ? await supabase.from('notes').update(values).eq('note_uuid', id).eq('owner_id', backup.ownerId).select('note_uuid, owner_id, title, content').single()
      : await supabase.from('notes').insert({ note_uuid: id, owner_id: backup.ownerId, ...values }).select('note_uuid, owner_id, title, content').single();
    if (result.error || !result.data || result.data.note_uuid !== id || result.data.owner_id !== backup.ownerId ||
        noteDigest({ id, ownerId: result.data.owner_id, title: result.data.title, body: result.data.content }) !== backup.sha256) {
      throw new Error('snapshot_restore_verify_failed');
    }
    return res.status(200).json({ restored: true, id, sha256: backup.sha256 });
  } catch {
    return res.status(409).json({ error: '사본 검증 또는 단일 메모 복원에 실패했습니다.' });
  }
}
