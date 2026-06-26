import { decodePlayerTokenPayload } from './player-token';

export type StoredPlayerSession = {
  sessionId: string;
  playerToken: string;
};

export type ResolvedPlayerSession = StoredPlayerSession & {
  playerId: string;
  playerName: string;
};

const STORAGE_KEY = 'sudokofest.playerSession';
const STORAGE_SALT = 'sudokofest-player-session-v1';

export async function savePlayerSession(session: StoredPlayerSession): Promise<void> {
  if (typeof sessionStorage === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    return;
  }

  const encrypted = await encryptStoredSession(session);
  sessionStorage.setItem(STORAGE_KEY, encrypted);
}

export async function readPlayerSession(): Promise<ResolvedPlayerSession | null> {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const stored = await decryptStoredSession(raw);
    if (!stored?.sessionId || !stored.playerToken) {
      return null;
    }

    const payload = decodePlayerTokenPayload(stored.playerToken);
    if (!payload || payload.sessionId !== stored.sessionId) {
      return null;
    }

    return {
      sessionId: stored.sessionId,
      playerToken: stored.playerToken,
      playerId: payload.playerId,
      playerName: payload.playerName,
    };
  } catch {
    return null;
  }
}

export async function readPlayerSessionFor(sessionId: string): Promise<ResolvedPlayerSession | null> {
  const stored = await readPlayerSession();
  if (!stored || stored.sessionId !== sessionId) {
    return null;
  }

  return stored;
}

async function encryptStoredSession(session: StoredPlayerSession): Promise<string> {
  const key = await deriveStorageKey(session.sessionId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ playerToken: session.playerToken }));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${session.sessionId}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptStoredSession(raw: string): Promise<StoredPlayerSession | null> {
  const parts = raw.split('.');
  if (parts.length < 3) {
    return null;
  }

  const sessionId = parts[0];
  const iv = toArrayBufferView(fromBase64Url(parts[1]));
  const ciphertext = toArrayBufferView(fromBase64Url(parts.slice(2).join('.')));
  const key = await deriveStorageKey(sessionId);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as { playerToken?: string };
  if (!parsed.playerToken) {
    return null;
  }

  return {
    sessionId,
    playerToken: parsed.playerToken,
  };
}

async function deriveStorageKey(sessionId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`sudokofest:${sessionId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(STORAGE_SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLength));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
