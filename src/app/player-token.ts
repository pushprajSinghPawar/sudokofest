export type PlayerTokenPayload = {
  sessionId: string;
  playerId: string;
  playerName: string;
  issuedAt?: number;
};

export function decodePlayerTokenPayload(token: string): PlayerTokenPayload | null {
  if (!token.includes('.')) {
    return null;
  }

  const separatorIndex = token.lastIndexOf('.');
  const encodedPayload = token.slice(0, separatorIndex);
  if (!encodedPayload) {
    return null;
  }

  try {
    const decoded = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(decoded) as PlayerTokenPayload;
    if (!payload?.sessionId || !payload?.playerId || !payload?.playerName) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
