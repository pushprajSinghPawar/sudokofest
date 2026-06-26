import { initializeApp } from 'firebase/app';
import { get, getDatabase, ref, set } from 'firebase/database';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill in your values.`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('FIREBASE_API_KEY'),
  authDomain: requireEnv('FIREBASE_AUTH_DOMAIN'),
  databaseURL: requireEnv('FIREBASE_DATABASE_URL'),
  projectId: requireEnv('FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('FIREBASE_APP_ID'),
  measurementId: requireEnv('FIREBASE_MEASUREMENT_ID'),
};

const databasePath = requireEnv('FIREBASE_DATABASE_PATH');
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storeRef = ref(database, databasePath);

export async function initializeFirebaseStore() {
  const store = await readStoreFromFirebase();
  await writeStoreToFirebase(store);
}

export async function readStoreFromFirebase() {
  const snapshot = await get(storeRef);
  const value = snapshot.val();
  return normalizeStore(value);
}

export async function writeStoreToFirebase(store) {
  await set(storeRef, normalizeStore(store));
}

function normalizeStore(store) {
  const rawSessions = store?.sessions && typeof store.sessions === 'object' ? store.sessions : {};
  const sessions = Object.fromEntries(
    Object.entries(rawSessions).map(([sessionId, session]) => [sessionId, normalizeSession(session, sessionId)]),
  );

  return {
    sessions,
  };
}

function normalizeSession(session, sessionId) {
  const value = session && typeof session === 'object' ? session : {};
  const { moves, ...sessionData } = value;

  return {
    ...sessionData,
    id: sessionData.id ?? sessionId,
    players: normalizeCollection(value.players).map(normalizePlayer),
    playerStates: normalizePlayerStates(value.playerStates),
  };
}

function normalizePlayer(player) {
  const value = player && typeof player === 'object' ? player : {};

  return {
    ...value,
    name: String(value.name ?? ''),
    score: Number(value.score ?? 0),
    updatedAt: Number(value.updatedAt ?? value.joinedAt ?? 0),
  };
}

function normalizePlayerStates(playerStates) {
  const rawStates = playerStates && typeof playerStates === 'object' ? playerStates : {};

  return Object.fromEntries(
    Object.entries(rawStates).map(([playerId, state]) => [
      playerId,
      {
        currentValues: normalizeIndexedArray(state?.currentValues, 81, ''),
        lockedCells: normalizeIndexedArray(state?.lockedCells, 81, false).map(Boolean),
        attemptedCells: state?.attemptedCells && typeof state.attemptedCells === 'object' ? state.attemptedCells : {},
      },
    ]),
  );
}

function normalizeCollection(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter(Boolean);
  }

  return [];
}

function normalizeIndexedArray(value, length, fallback) {
  return Array.from({ length }, (_, index) => value?.[index] ?? fallback);
}
