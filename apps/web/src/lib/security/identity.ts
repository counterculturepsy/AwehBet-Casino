import 'server-only';

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { getServerEnv } from '@/lib/env';

const VERSION = 'v1';

function normalized(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function identityFingerprint(value: string) {
  return createHmac('sha256', getServerEnv().PLAYER_IDENTITY_HASH_SECRET)
    .update(normalized(value), 'utf8')
    .digest('hex');
}

export function encryptIdentity(value: string) {
  const key = Buffer.from(getServerEnv().PLAYER_DATA_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalized(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptIdentity(payload: string) {
  const [version, ivPart, tagPart, dataPart] = payload.split('.');
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) throw new Error('Unsupported encrypted identity payload.');
  const key = Buffer.from(getServerEnv().PLAYER_DATA_ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}
