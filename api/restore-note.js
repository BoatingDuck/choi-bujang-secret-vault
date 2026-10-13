import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { verifyRequestUser, isAllowedWriteOrigin } from '../src/auth-session.mjs';
import { verifyPrivateNoteSnapshot, noteDigest } from '../src/note-recovery.mjs';

const SHA256 = /^[0-9a-f]{64}$/i;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const equalHex = (a, b) => SHA256.test(a ?? '') && SHA256.test(b ?? '') &&
  timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

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
    return res.status(403).json({ error: '허용되지 않은 요청 출처입니다.' });
  }
  let user;
  try { user = await verifyRequestUser(req); } catch { /* deny */ }
  if (!user?.userId || !UUID.test(user.userId)) {
    return res.status(401).json({ error: '유효한 인증이 필요합니다.' });
  }
  // Only verified judge identity B or the exact owner of the private B snapshot.
  if (user.kind === 'judge' && user.identity !== 'b') {
    return res.status(403).json({ error: 'B 시험 계정만 복원 가능합니다.' });
  }
  if (user.kind !== 'judge' && user.kind !== 'student') {
    return res.status(403).json({ error: '허용되지 않은 신원입니다.' });
  }
  const { SUPABASE_URL, SUPABASE_SECRET_KEY,
    RESTORE_NOTE_SNAPSHOT_B64, RESTORE_NOTE_SNAPSHOT_SHA256 } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !RESTORE_NOTE_SNAPSHOT_B64 ||
      !SHA256.test(RESTORE_NOTE_SNAPSHOT_SHA256 ?? '')) {
    return res.status(503).json({ error: '검증된 사전 비공개 사본이 준비되지 않았습니다.' });
  }
  const input = req.body;
  const id = input?.id;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !UUID.test(id ?? '') || input.confirm !== true) {
    return res.status(400).json({ error: '메모 ID와 확인 값이 필요합니다.' });
  }
  try {
    const raw = Buffer.from(RESTORE_NOTE_SNAPSHOT_B64, 'base64');
    // Hash must have been recorded independently BEFORE the incident.
    const rawHash = createHash('sha256').update(raw).digest('hex');
    if (!equalHex(rawHash, RESTORE_NOTE_SNAPSHOT_SHA256)) {
      return res.status(409).json({ error: '사전 사본 무결성 검증 실패' });
    }
    const saved = JSON.parse(raw.toString('utf8'));
    const backup = verifyPrivateNoteSnapshot(saved, id, user.userId);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: existing, error: getError } = await supabase.from('notes')
      .select('note_uuid,owner_id').eq('note_uuid', id).maybeSingle();
    if (getError) throw new Error('read_failed');
    if (existing && existing.owner_id !== backup.ownerId) {
      return res.status(409).json({ error: '기존 메모 소유자 불일치' });
    }
    const values = { title: backup.title, content: backup.body };
    const outcome = existing
      ? await supabase.from('notes').update(values).eq('note_uuid', id)
          .eq('owner_id', backup.ownerId).select('note_uuid,owner_id,title,content').single()
      : await supabase.from('notes').insert({ note_uuid: id, owner_id: backup.ownerId, ...values })
          .select('note_uuid,owner_id,title,content').single();
    if (outcome.error || !outcome.data) throw new Error('write_failed');
    const row = outcome.data;
    const digest = noteDigest({ id: row.note_uuid, ownerId: row.owner_id,
      title: row.title, body: row.content });
    if (row.note_uuid !== backup.id || row.owner_id !== backup.ownerId ||
        !equalHex(digest, backup.sha256)) throw new Error('post_restore_mismatch');
    return res.status(200).json({ restored: true, id: backup.id,
      ownerId: backup.ownerId, sha256: backup.sha256 });
  } catch {
    return res.status(409).json({ error: '사본 검증 또는 단일 메모 복원 실패' });
  }
}
