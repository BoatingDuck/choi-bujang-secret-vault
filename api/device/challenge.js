import { randomBytes, createHash } from 'node:crypto';
import { verifyRequestUser } from '../../src/auth-session.mjs';
import { DEVICE_UUID, deviceDb } from '../../src/device-signature.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const user = await verifyRequestUser(req).catch(() => null);
  if (!user?.userId) return res.status(401).json({ error: '로그인 필요' });
  const id = req.query?.deviceId;
  if (!DEVICE_UUID.test(id ?? '')) return res.status(400).json({ error: '잘못된 ID' });
  const nonce = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(nonce).digest('hex');
  try {
    const { data, error } = await deviceDb().rpc('stage11_issue_nonce', {
      p_owner: user.userId, p_id: id, p_nonce_hash: hash
    });
    if (error) throw new Error();
    if (!data) return res.status(403).json({ error: '승인된 기기가 아닙니다.' });
    return res.status(200).json({ nonce, expiresInSeconds: 90 });
  } catch { return res.status(503).json({ error: '서명 요청 준비 실패' }); }
}
