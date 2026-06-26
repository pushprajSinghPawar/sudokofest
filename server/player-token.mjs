import { createHmac, timingSafeEqual } from 'node:crypto';

function getPlayerTokenSecret() {
  const secret = process.env.X_MASTER_KEY;
  if (!secret) {
    throw new Error('X_MASTER_KEY is required for player session tokens');
  }
  return secret;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signPlayerToken(payload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', getPlayerTokenSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyPlayerToken(token, expectedSessionId) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const separatorIndex = token.lastIndexOf('.');
  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', getPlayerTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.playerId !== 'string' ||
    typeof payload.playerName !== 'string' ||
    payload.sessionId !== expectedSessionId
  ) {
    return null;
  }

  return payload;
}

export function createPlayerToken(sessionId, player) {
  return signPlayerToken({
    sessionId,
    playerId: player.id,
    playerName: player.name,
    issuedAt: Date.now(),
  });
}
