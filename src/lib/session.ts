const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;

type SessionPayload = {
  sub: string;
  iat: number;
};

export type VerifiedSession = {
  userId: string;
  issuedAt: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }

  return 'development-session-secret-change-me';
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeString(value: string) {
  return new TextDecoder().decode(base64UrlDecode(value));
}

async function getHmacKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(value: string) {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verify(value: string, signature: string) {
  const key = await getHmacKey();
  return crypto.subtle.verify('HMAC', key, base64UrlDecode(signature), new TextEncoder().encode(value));
}

export async function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    sub: userId,
    iat: Date.now(),
  };
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<VerifiedSession | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const validSignature = await verify(encodedPayload, signature);
  if (!validSignature) return null;

  const payload = JSON.parse(base64UrlDecodeString(encodedPayload)) as Partial<SessionPayload>;
  if (!payload.sub || typeof payload.iat !== 'number') return null;

  const age = Date.now() - payload.iat;
  if (age < 0 || age > SESSION_MAX_AGE_MS) return null;

  return {
    userId: payload.sub,
    issuedAt: payload.iat,
  };
}
