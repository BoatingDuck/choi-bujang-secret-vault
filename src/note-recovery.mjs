import { createHash, timingSafeEqual } from 'node:crypto';

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function noteDigest(note) {
  return createHash('sha256').update(JSON.stringify({
    id: note.id, ownerId: note.ownerId, title: note.title, body: note.body
  })).digest('hex');
}
export function verifyPrivateNoteSnapshot(snapshot, id, ownerId) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      !UUID.test(snapshot.id) || !UUID.test(snapshot.ownerId) ||
      typeof snapshot.title !== 'string' || !snapshot.title.trim() ||
      typeof snapshot.body !== 'string' || !snapshot.body.trim() ||
      typeof snapshot.sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(snapshot.sha256) ||
      snapshot.id !== id || snapshot.ownerId !== ownerId) {
    throw new Error('snapshot_mismatch');
  }
  const calculated = Buffer.from(noteDigest(snapshot), 'hex');
  const given = Buffer.from(snapshot.sha256, 'hex');
  if (!timingSafeEqual(calculated, given)) throw new Error('snapshot_hash_mismatch');
  return { id: snapshot.id, ownerId: snapshot.ownerId, title: snapshot.title, body: snapshot.body, sha256: snapshot.sha256 };
}
