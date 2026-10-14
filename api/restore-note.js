import { createClient } from '@supabase/supabase-js';
import { requireApprovedDevice } from '../src/device-signature.mjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { verifyRequestUser, isAllowedWriteOrigin } from '../src/auth-session.mjs';
import { verifyPrivateNoteSnapshot, noteDigest } from '../src/note-recovery.mjs';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

const sha256 = bytes =>
  createHash('sha256').update(bytes).digest('hex');

const equalHash = (a, b) =>
  SHA256.test(a ?? '') &&
  SHA256.test(b ?? '') &&
  timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

const snapshotHash = (title, content) =>
  sha256(Buffer.concat([
    Buffer.from(title, 'utf8'),
    Buffer.from([0]),
    Buffer.from(content, 'utf8')
  ]));

function verifyDbSnapshot(snapshot, id, ownerId) {
  if (
    !snapshot ||
    snapshot.note_uuid !== id ||
    snapshot.owner_id !== ownerId ||
    snapshot.snapshot_version !== 1 ||
    typeof snapshot.title !== 'string' ||
    !snapshot.title.trim() ||
    typeof snapshot.content !== 'string' ||
    !snapshot.content.trim() ||
    !equalHash(
      snapshotHash(snapshot.title, snapshot.content),
      snapshot.content_sha256
    )
  ) {
    throw new Error('backup_verification_failed');
  }

  return {
    id,
    ownerId,
    title: snapshot.title,
    body: snapshot.content,
    version: snapshot.snapshot_version,
    sha256: snapshot.content_sha256,
    capturedAt: snapshot.captured_at ?? null,
    source: 'private_snapshot'
  };
}

async function readSnapshot(supabase, id, ownerId) {
  const { data, error } = await supabase.rpc(
    'stage10_read_note_snapshot',
    { p_note_uuid: id }
  );

  if (error) throw new Error('backup_read_failed');

  if (!Array.isArray(data) || data.length > 1) {
    throw new Error('ambiguous_backup');
  }

  if (data.length === 1) {
    return verifyDbSnapshot(data[0], id, ownerId);
  }

  // 기존 학생 B의 비공개 백업 호환.
  const encoded = process.env.RESTORE_NOTE_SNAPSHOT_B64;
  const expected = process.env.RESTORE_NOTE_SNAPSHOT_SHA256;

  if (!encoded || !SHA256.test(expected ?? '')) {
    throw new Error('backup_missing');
  }

  const raw = Buffer.from(encoded, 'base64');

  if (!equalHash(sha256(raw), expected)) {
    throw new Error('backup_hash_mismatch');
  }

  const old = verifyPrivateNoteSnapshot(
    JSON.parse(raw.toString('utf8')),
    id,
    ownerId
  );

  return {
    ...old,
    version: 1,
    capturedAt: null,
    source: 'legacy_snapshot'
  };
}

function safePreview(backup, current) {
  return {
    version: backup.version,
    id: backup.id,
    ownerId: backup.ownerId,
    source: backup.source,
    backupSha256: backup.sha256,
    changedFields: current
      ? [
          ...(current.title === backup.title ? [] : ['title']),
          ...(current.content === backup.body ? [] : ['content'])
        ]
      : ['missing_note'],
    requiresConfirmation: true
  };
}



async function runRecoveryRetests(req, supabase, user, id, expected) {
  const { default: noteHandler } = await import('./notes/[id].js');
  const { default: listHandler } = await import('./notes.js');

  const checks = {};

  // ?? ??? ?? API ???? ????.
  // ?? ??? ?? ??? URL? ???? ???.
  async function invoke(handler, method, headers, query = {}) {
    let statusCode = 200;
    let result = null;

    const response = {
      setHeader() { return this; },
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        result = value;
        return this;
      }
    };

    await handler({
      method,
      headers,
      query,
      body: undefined
    }, response);

    return {
      http: statusCode,
      data: result
    };
  }

  async function check(name, fn) {
    try {
      checks[name] = await fn();
    } catch {
      checks[name] = {
        status: 'FAIL',
        reason: 'HANDLER_EXECUTION_FAILED'
      };
    }
  }

  const credentials = req.headers.authorization
    ? { authorization: req.headers.authorization }
    : { cookie: req.headers.cookie };

  // ??: ??? ???? ?? ??? ?? ? ??? ??.
  await check('owner_read', async () => {
    const r = await invoke(noteHandler, 'GET', credentials, { id });

    if (r.http === 403) return { status: 'NOT_RUN', reason: 'SIGNED_DEVICE_REQUEST_REQUIRED' };
    const passed =
      r.http === 200 &&
      r.data?.id === id &&
      r.data?.title === expected.title &&
      r.data?.body === expected.content;

    return {
      status: passed ? 'PASS' : 'FAIL',
      http: r.http
    };
  });

  // ??: ???? ?? ??
  await check('unauthenticated_read', async () => {
    const r = await invoke(listHandler, 'GET', {});
    return {
      status: r.http === 401 ? 'PASS' : 'FAIL',
      http: r.http
    };
  });

  // ??: ??? ?? ??
  await check('invalid_token_read', async () => {
    const r = await invoke(listHandler, 'GET', {
      authorization: 'Bearer invalid.invalid.invalid'
    });

    return {
      status: r.http === 401 ? 'PASS' : 'FAIL',
      http: r.http
    };
  });

  // ??: ?? ??? ?? ?? ??
  await check('cross_owner_read', async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('note_uuid')
      .neq('owner_id', user.userId)
      .limit(1);

    if (error) {
      return {
        status: 'FAIL',
        reason: 'TARGET_LOOKUP_FAILED'
      };
    }

    if (!data?.length) {
      return {
        status: 'NOT_RUN',
        reason: 'NO_OTHER_OWNER_NOTE'
      };
    }

    const r = await invoke(
      noteHandler,
      'GET',
      credentials,
      { id: data[0].note_uuid }
    );

    if (r.http === 403) return { status: 'NOT_RUN', reason: 'SIGNED_DEVICE_REQUEST_REQUIRED' };
    return {
      status: r.http === 404 ? 'PASS' : 'FAIL',
      http: r.http
    };
  });

  // ?? ???? ?? ??? PASS? ??? ???.
  checks.cross_owner_put = {
    status: 'NOT_RUN',
    reason: 'DESTRUCTIVE_REQUEST_NOT_SENT'
  };

  checks.cross_owner_delete = {
    status: 'NOT_RUN',
    reason: 'DESTRUCTIVE_REQUEST_NOT_SENT'
  };

  checks.audit_history = {
    status: 'NOT_RUN',
    reason: 'NO_AUDIT_BASELINE'
  };

  checks.prior_stage_full_replay = {
    status: 'NOT_RUN',
    reason: 'NOT_EXECUTED'
  };

  const values = Object.values(checks);
  const failed = values.some(x => x.status === 'FAIL');
  const incomplete = values.some(x => x.status === 'NOT_RUN');

  return {
    status: failed
      ? 'FAIL'
      : incomplete
        ? 'PARTIAL_PASS'
        : 'PASS',
    execution: 'IN_PROCESS_API_HANDLERS',
    checks
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'POST 요청만 허용합니다.'
    });
  }

  if (!req.headers.authorization && !req.headers.cookie) {
    return res.status(401).json({
      error: '로그인이 필요합니다.'
    });
  }

  if (!isAllowedWriteOrigin(req)) {
    return res.status(403).json({
      error: '허용되지 않은 요청 출처입니다.'
    });
  }

  let user;

  try {
    user = await verifyRequestUser(req);
  } catch {
    // 인증 실패 시 거부.
  }

  if (!user?.userId || !UUID.test(user.userId)) {
    return res.status(401).json({
      error: '유효한 인증이 필요합니다.'
    });
  }

  if (user.kind === 'judge' && user.identity !== 'b') {
    return res.status(403).json({
      error: 'B 시험 계정만 복원 가능합니다.'
    });
  }

  if (user.kind !== 'judge' && user.kind !== 'student') {
    return res.status(403).json({
      error: '허용되지 않은 신원입니다.'
    });
  }

  if (!await requireApprovedDevice(req, user).catch(() => false)) {
    return res.status(403).json({ error: '승인된 기기 서명이 필요합니다.' });
  }

  const input = req.body;

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !UUID.test(input.id ?? '') ||
    (input.confirm !== true && input.confirm !== false)
  ) {
    return res.status(400).json({
      error: '메모 ID와 확인 값이 필요합니다.'
    });
  }

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return res.status(503).json({
      error: '서버 DB 설정이 준비되지 않았습니다.'
    });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const id = input.id;
    const backup = await readSnapshot(supabase, id, user.userId);

    const { data: current, error: currentError } = await supabase
      .from('notes')
      .select('note_uuid,owner_id,title,content')
      .eq('note_uuid', id)
      .maybeSingle();

    if (currentError) {
      throw new Error('current_read_failed');
    }

    if (current && current.owner_id !== user.userId) {
      throw new Error('owner_mismatch');
    }

    const preview = safePreview(backup, current);

    if (input.confirm === false) {
      return res.status(200).json({
        preview,
        applied: false
      });
    }

    // 복원 직전에 사본을 다시 읽고 검증.
    const rechecked = await readSnapshot(
      supabase,
      id,
      user.userId
    );

    if (
      rechecked.source !== backup.source ||
      rechecked.version !== backup.version ||
      rechecked.ownerId !== backup.ownerId ||
      rechecked.id !== backup.id ||
      !equalHash(rechecked.sha256, backup.sha256) ||
      rechecked.title !== backup.title ||
      rechecked.body !== backup.body
    ) {
      throw new Error('snapshot_changed');
    }

    const values = {
      title: rechecked.title,
      content: rechecked.body
    };

    const outcome = current
      ? await supabase
          .from('notes')
          .update(values)
          .eq('note_uuid', id)
          .eq('owner_id', user.userId)
          .select('note_uuid,owner_id,title,content')
          .single()
      : await supabase
          .from('notes')
          .insert({
            note_uuid: id,
            owner_id: user.userId,
            ...values
          })
          .select('note_uuid,owner_id,title,content')
          .single();

    if (outcome.error || !outcome.data) {
      throw new Error('restore_write_failed');
    }

    // 복원 후 DB를 별도로 다시 조회.
    const { data: verified, error: verifyError } = await supabase
      .from('notes')
      .select('note_uuid,owner_id,title,content')
      .eq('note_uuid', id)
      .eq('owner_id', user.userId)
      .single();

    if (
      verifyError ||
      !verified ||
      verified.note_uuid !== rechecked.id ||
      verified.owner_id !== rechecked.ownerId ||
      !equalHash(
        rechecked.source === 'legacy_snapshot'
          ? noteDigest({
              id,
              ownerId: user.userId,
              title: verified.title,
              body: verified.content
            })
          : snapshotHash(verified.title, verified.content),
        rechecked.sha256
      )
    ) {
      throw new Error('post_restore_mismatch');
    }

    return res.status(200).json({
      restored: true,
      id,
      ownerId: user.userId,
      version: rechecked.version,
      sha256: rechecked.sha256,
      hashScheme: rechecked.source === 'private_snapshot'
        ? 'sha256(title-NUL-content)'
        : 'sha256(note-json)',
      preview,
      retest: await runRecoveryRetests(
        req, supabase, user, id, verified
      ).catch(() => ({
        status: 'FAIL',
        reason: 'RETEST_EXECUTION_FAILED'
      }))
    });
  } catch (error) {
    const code = error?.message === 'backup_missing' ? 503 : 409;

    return res.status(code).json({
      error: '검증된 대상 사본을 찾거나 복원하지 못했습니다.'
    });
  }
}
