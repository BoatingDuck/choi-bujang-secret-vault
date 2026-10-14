import { verifyRequestUser } from '../../src/auth-session.mjs';
import { DEVICE_UUID, deviceDb } from '../../src/device-signature.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const user = await verifyRequestUser(req).catch(() => null);
  if (!user?.userId) return res.status(401).json({ error: '로그인 필요' });
  const id = req.query?.deviceId;
  if (!DEVICE_UUID.test(id ?? '')) return res.status(400).json({ error: '잘못된 ID' });
  try {
    const { data, error } = await deviceDb().rpc('stage11_device_status', {
      p_owner: user.userId, p_id: id
    });
    if (error) throw new Error();
    return res.status(200).json({ deviceId: id, status: data ?? 'not_found' });
  } catch { return res.status(503).json({ error: '기기 상태 확인 실패' }); }
}
