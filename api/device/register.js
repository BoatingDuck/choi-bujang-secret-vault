import { verifyRequestUser, isAllowedWriteOrigin } from '../../src/auth-session.mjs';
import { DEVICE_UUID, deviceDb, validPublicJwk, checkSignature, enrollmentPayload } from '../../src/device-signature.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!isAllowedWriteOrigin(req)) return res.status(403).json({ error: '출처 거부' });
  const user = await verifyRequestUser(req).catch(() => null);
  if (!user?.userId) return res.status(401).json({ error: '로그인 필요' });
  const { deviceId, publicKey, proof } = req.body ?? {};
  if (!DEVICE_UUID.test(deviceId ?? '') || !validPublicJwk(publicKey) ||
      !checkSignature(publicKey, enrollmentPayload(deviceId), proof)) {
    return res.status(400).json({ error: '기기 키 소유 증명 실패' });
  }
  try {
    const { data, error } = await deviceDb().rpc('stage11_register_device', {
      p_owner: user.userId, p_id: deviceId, p_public_key: publicKey
    });
    if (error || !['pending', 'approved', 'rejected', 'revoked'].includes(data)) throw new Error();
    return res.status(200).json({ deviceId, status: data });
  } catch { return res.status(409).json({ error: '기기 등록에 실패했습니다.' }); }
}
