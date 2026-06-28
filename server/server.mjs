import 'dotenv/config';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionMemoryProvider } from './session-memory-provider.mjs';
import { createPlayerToken, verifyPlayerToken } from './player-token.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PUZZLES_FILE = join(DATA_DIR, 'sudoku.json');
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const FULL_MASK = 0b1111111110;
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Use 'memory' for in-memory storage or 'firebase' for Firebase
const STORAGE_TYPE = process.env.STORAGE_TYPE ?? 'memory';
const RESULTS_RETENTION_MINUTES = Number(process.env.RESULTS_RETENTION_MINUTES ?? 60);
const sessionProvider = createSessionMemoryProvider(STORAGE_TYPE, {
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  resultsRetentionMs: RESULTS_RETENTION_MINUTES * 60 * 1000,
});

const app = Fastify({ logger: true });
const rooms = new Map();
let puzzleCache = null;

await app.register(cors, {
  origin: true,
});
await app.register(websocket);

app.get('/health', async () => ({ ok: true }));

app.get('/api/puzzles/summary', async () => {
  const puzzles = await loadPuzzles();
  return {
    total: puzzles.length,
    byDifficulty: puzzles.reduce((acc, puzzle) => {
      acc[puzzle.difficulty] = (acc[puzzle.difficulty] ?? 0) + 1;
      return acc;
    }, {}),
  };
});

app.post('/api/sessions', async (request, reply) => {
  const body = request.body ?? {};
  const maxPlayers = clampNumber(body.maxPlayers, 1, 8, 2);
  const durationMinutes = clampNumber(body.durationMinutes, 0.5, 10, 2);
  const startBufferSeconds = clampNumber(body.startBufferSeconds, 0, 300, 5);
  const difficulty = parseDifficulty(body.difficulty);
  const puzzles = await loadPuzzles();
  const puzzle = choosePuzzle(puzzles, difficulty);
  const store = await readStore();
  const now = Date.now();
  const sessionId = createSessionId(store.sessions);
  const session = {
    id: sessionId,
    hostPlayerId: null,
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    maxPlayers,
    durationMinutes,
    status: 'lobby',
    startAt: now + startBufferSeconds * 1000,
    createdAt: now,
    updatedAt: now,
    players: [],
    playerStates: {},
  };

  store.sessions[sessionId] = session;
  await writeStore(store);
  broadcastSession(sessionId);

  reply.code(201);
  return toPublicSession(session);
});

app.get('/api/sessions/:sessionId', async (request, reply) => {
  const session = await getSession(request.params.sessionId, { sync: true });
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  return toPublicSession(session);
});

app.post('/api/sessions/:sessionId/join', async (request, reply) => {
  const sessionId = request.params.sessionId;
  const body = request.body ?? {};
  const playerName = sanitizeName(body.playerName);

  if (!playerName) {
    reply.code(400);
    return { message: 'Player name is required' };
  }

  const store = await readStore();
  const session = store.sessions[sessionId];
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  syncSessionLifecycle(session);
  const existingPlayer = session.players.find((player) => player.name === playerName);
  if (existingPlayer) {
    return withPlayerToken(sessionId, existingPlayer);
  }

  if (session.players.length >= session.maxPlayers) {
    reply.code(409);
    return { message: 'This lobby is full' };
  }

  const now = Date.now();
  const player = {
    id: createPlayerId(session),
    name: playerName,
    isHost: session.players.length === 0,
    score: 0,
    joinedAt: now,
    updatedAt: now,
  };

  if (player.isHost) {
    session.hostPlayerId = player.id;
  }

  session.players.push(player);
  session.playerStates[player.id] = {
    currentValues: [],
    lockedCells: [],
    attemptedCells: {},
  };
  session.updatedAt = now;

  await writeStore(store);
  broadcastSession(sessionId);
  broadcastScoreboard(sessionId);

  reply.code(201);
  return withPlayerToken(sessionId, player);
});

app.get('/api/sessions/:sessionId/puzzle', async (request, reply) => {
  const session = await getSession(request.params.sessionId, { sync: true });
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  const puzzle = await getPuzzleById(session.puzzleId);
  if (!puzzle) {
    reply.code(404);
    return { message: 'Puzzle not found' };
  }

  const playerToken = request.query?.playerToken;
  const resolvedPlayer = resolvePlayerFromToken(session, request.params.sessionId, playerToken);
  if (!resolvedPlayer) {
    reply.code(403);
    return { message: 'Invalid or missing player token' };
  }

  const playerState = session.playerStates[resolvedPlayer.playerId] ?? null;

  return {
    puzzleId: puzzle.id,
    puzzle: puzzle.puzzle,
    difficulty: puzzle.difficulty,
    currentValues: playerState?.currentValues ?? null,
    lockedCells: playerState?.lockedCells ?? null,
  };
});

app.post('/api/sessions/:sessionId/moves', async (request, reply) => {
  const sessionId = request.params.sessionId;
  const body = request.body ?? {};
  const playerToken = String(body.playerToken ?? '');
  const cellIndex = Number(body.cellIndex);
  const value = String(body.value ?? '');
  const clientMoveId = String(body.clientMoveId ?? '');

  if (!playerToken) {
    reply.code(400);
    return { message: 'Invalid move payload' };
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 80 || !/^[1-9]$/.test(value)) {
    reply.code(400);
    return { message: 'Invalid move payload' };
  }

  const store = await readStore();
  const session = store.sessions[sessionId];
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  const resolvedPlayer = resolvePlayerFromToken(session, sessionId, playerToken);
  if (!resolvedPlayer) {
    reply.code(403);
    return { message: 'Invalid or missing player token' };
  }

  const playerId = resolvedPlayer.playerId;
  const player = session.players.find((currentPlayer) => currentPlayer.id === playerId);
  if (!player) {
    reply.code(403);
    return { message: 'Player is not in this session' };
  }

  const now = Date.now();
  const statusChanged = syncSessionLifecycle(session);
  if (session.status !== 'running') {
    if (statusChanged) {
      await writeStore(store);
      broadcastSession(sessionId);
      if (session.status === 'finished') {
        broadcastScoreboard(sessionId);
      }
    }
    reply.code(409);
    return { message: 'The game is not accepting moves right now' };
  }

  const puzzle = await getPuzzleById(session.puzzleId);
  if (!puzzle) {
    reply.code(404);
    return { message: 'Puzzle not found' };
  }

  const originalValue = puzzle.puzzle[cellIndex] ?? '0';
  if (originalValue !== '0' && originalValue !== '.') {
    reply.code(409);
    return { message: 'This cell is part of the original puzzle' };
  }

  const playerState = ensurePlayerState(session, playerId);
  if (playerState.lockedCells[cellIndex]) {
    reply.code(409);
    return { message: 'This cell is already locked' };
  }

  const isCorrect = puzzle.solution[cellIndex] === value;
  const scoreDelta = isCorrect ? 150 : -80;
  const scoreAfter = player.score + scoreDelta;

  player.score = scoreAfter;
  player.updatedAt = now;
  playerState.currentValues[cellIndex] = value;

  if (isCorrect) {
    playerState.lockedCells[cellIndex] = true;
  }

  const moveResult = {
    clientMoveId,
    cellIndex,
    value,
    isCorrect,
    scoreDelta,
  };
  session.updatedAt = now;

  await writeStore(store);
  broadcastSession(sessionId);
  broadcastScoreboard(sessionId);

  return toMoveResponse(moveResult, player);
});

app.get('/api/sessions/:sessionId/scoreboard', async (request, reply) => {
  const session = await getSession(request.params.sessionId, { sync: true });
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  return toScoreboard(session);
});

app.post('/api/sessions/:sessionId/finalize', async (request, reply) => {
  const sessionId = request.params.sessionId;
  const store = await readStore();
  const session = store.sessions[sessionId];
  if (!session) {
    reply.code(404);
    return { message: 'Session not found' };
  }

  const changed = syncSessionLifecycle(session);
  if (changed) {
    await writeStore(store);
    broadcastSession(sessionId);
    broadcastScoreboard(sessionId);
  }

  return toPublicSession(session);
});

app.get('/ws/:sessionId', { websocket: true }, (socket, request) => {
  const sessionId = request.params.sessionId;
  const room = rooms.get(sessionId) ?? new Set();
  room.add(socket);
  rooms.set(sessionId, room);

  sendSocket(socket, {
    type: 'connected',
    sessionId,
  });

  getSession(sessionId, { sync: true }).then((session) => {
    if (session) {
      sendSocket(socket, {
        type: 'session_updated',
        session: toPublicSession(session),
      });
      sendSocket(socket, {
        type: 'scoreboard_updated',
        scoreboard: toScoreboard(session),
      });
    }
  });

  socket.on('close', () => {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(sessionId);
    }
  });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
await ensureDataDir();
await initializeCloudStorage();
await app.listen({ port, host });

async function loadPuzzles() {
  if (puzzleCache) {
    return puzzleCache;
  }

  const raw = await readFile(PUZZLES_FILE, 'utf-8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error('sudoku.json must contain an array');
  }

  puzzleCache = entries
    .map((entry, index) => normalizePuzzleEntry(entry, index))
    .filter(Boolean);
  return puzzleCache;
}

function normalizePuzzleEntry(entry, index) {
  const puzzle = Array.isArray(entry) ? entry[0] : entry?.puzzle;
  const providedSolution = Array.isArray(entry)
    ? typeof entry[1] === 'string' && entry[1].length >= 81
      ? entry[1]
      : null
    : entry?.solution;
  const rawDifficulty = Array.isArray(entry) ? entry.at(-1) : entry?.difficulty;
  const difficulty = typeof rawDifficulty === 'number'
    ? DIFFICULTIES[rawDifficulty] ?? 'easy'
    : DIFFICULTIES.includes(rawDifficulty)
      ? rawDifficulty
      : 'easy';

  if (typeof puzzle !== 'string' || puzzle.length < 81) {
    return null;
  }

  const normalizedPuzzle = puzzle.trim().slice(0, 81);
  const solution = typeof providedSolution === 'string' && providedSolution.length >= 81
    ? providedSolution.trim().slice(0, 81)
    : solveSudoku(normalizedPuzzle);

  if (!solution) {
    return null;
  }

  return {
    id: String(index),
    puzzle: normalizedPuzzle,
    solution,
    difficulty,
  };
}

function choosePuzzle(puzzles, difficulty) {
  const pool = difficulty ? puzzles.filter((puzzle) => puzzle.difficulty === difficulty) : puzzles;
  const source = pool.length ? pool : puzzles;
  return source[Math.floor(Math.random() * source.length)];
}

async function getPuzzleById(puzzleId) {
  const puzzles = await loadPuzzles();
  return puzzles.find((puzzle) => puzzle.id === String(puzzleId)) ?? null;
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function initializeCloudStorage() {
  await sessionProvider.initialize();
}

async function readStore() {
  return sessionProvider.read();
}

function compactSessionStore(store) {
  const sessions = store?.sessions && typeof store.sessions === 'object' ? store.sessions : {};

  return {
    sessions: Object.fromEntries(
      Object.entries(sessions).map(([sessionId, session]) => {
        const { moves, ...compactSession } = session && typeof session === 'object' ? session : {};
        return [sessionId, compactSession];
      }),
    ),
  };
}

async function writeStore(store) {
  const compactStore = compactSessionStore(store);
  await sessionProvider.write(compactStore);
}

async function getSession(sessionId, { sync = false } = {}) {
  const store = await readStore();
  const session = store.sessions[sessionId] ?? null;
  if (!session) {
    return null;
  }

  if (sync && syncSessionLifecycle(session)) {
    await writeStore(store);
    broadcastSession(sessionId);
    if (session.status === 'finished') {
      broadcastScoreboard(sessionId);
    }
  }

  return session;
}

function withPlayerToken(sessionId, player) {
  return {
    ...player,
    playerToken: createPlayerToken(sessionId, player),
  };
}

function resolvePlayerFromToken(session, sessionId, playerToken) {
  if (!playerToken) {
    return null;
  }

  const payload = verifyPlayerToken(playerToken, sessionId);
  if (!payload) {
    return null;
  }

  const player = session.players.find((currentPlayer) => currentPlayer.id === payload.playerId);
  if (!player || player.name !== payload.playerName) {
    return null;
  }

  return {
    playerId: payload.playerId,
    playerName: payload.playerName,
  };
}

function toPublicSession(session) {
  return {
    id: session.id,
    hostPlayerId: session.hostPlayerId,
    puzzleId: session.puzzleId,
    difficulty: session.difficulty,
    maxPlayers: session.maxPlayers,
    durationMinutes: session.durationMinutes,
    status: session.status ?? currentStatus(session),
    startAt: session.startAt,
    endAt: session.endAt ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    players: session.players,
  };
}

function syncSessionLifecycle(session) {
  const now = Date.now();
  const roundEnd = session.startAt + session.durationMinutes * 60_000;
  let changed = false;

  if (session.status === 'lobby' && now >= session.startAt) {
    session.status = 'running';
    session.updatedAt = now;
    changed = true;
  }

  if (session.status !== 'finished' && session.status !== 'cancelled' && now >= roundEnd) {
    session.status = 'finished';
    session.endAt = roundEnd;
    session.updatedAt = now;
    changed = true;
  }

  return changed;
}

function currentStatus(session) {
  const now = Date.now();
  const roundEnd = session.startAt + session.durationMinutes * 60_000;
  if (now < session.startAt) {
    return 'lobby';
  }
  if (now >= roundEnd) {
    return 'finished';
  }
  return 'running';
}

function toScoreboard(session) {
  return [...session.players]
    .map((player) => ({
      playerName: player.name,
      score: player.score,
      updatedAt: player.updatedAt,
    }))
    .sort((a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName));
}

function toMoveResponse(move, player) {
  return {
    clientMoveId: move.clientMoveId,
    accepted: true,
    isCorrect: move.isCorrect,
    scoreDelta: move.scoreDelta,
    score: player.score,
    lockedCell: move.isCorrect
      ? {
          cellIndex: move.cellIndex,
          value: move.value,
        }
      : null,
  };
}

function ensurePlayerState(session, playerId) {
  const state = session.playerStates[playerId] ?? {
    currentValues: [],
    lockedCells: [],
    attemptedCells: {},
  };
  state.currentValues = Array.from({ length: 81 }, (_, index) => state.currentValues[index] ?? '');
  state.lockedCells = Array.from({ length: 81 }, (_, index) => Boolean(state.lockedCells[index]));
  session.playerStates[playerId] = state;
  return state;
}

function broadcastSession(sessionId) {
  getSession(sessionId).then((session) => {
    if (!session) {
      return;
    }
    broadcast(sessionId, {
      type: 'session_updated',
      session: toPublicSession(session),
    });
  });
}

function broadcastScoreboard(sessionId) {
  getSession(sessionId).then((session) => {
    if (!session) {
      return;
    }
    broadcast(sessionId, {
      type: 'scoreboard_updated',
      scoreboard: toScoreboard(session),
    });
  });
}

function broadcast(sessionId, payload) {
  const room = rooms.get(sessionId);
  if (!room) {
    return;
  }

  for (const socket of room) {
    sendSocket(socket, payload);
  }
}

function sendSocket(socket, payload) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
}

function sanitizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function parseDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : undefined;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function createSessionId(existingSessions) {
  let id = '';
  do {
    id = Array.from({ length: 6 }, () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]).join('');
  } while (existingSessions[id]);
  return id;
}

function createPlayerId(session) {
  return `p${session.players.length + 1}`;
}

function solveSudoku(puzzle) {
  const cells = puzzle.split('').map((digit) => Number(digit));
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  const emptyCells = [];

  for (let index = 0; index < 81; index++) {
    const rawValue = puzzle[index] ?? '0';
    if (rawValue === '0' || rawValue === '.') {
      cells[index] = 0;
      emptyCells.push(index);
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 9) {
      return null;
    }

    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const bit = 1 << value;

    if ((rows[row] & bit) !== 0 || (cols[col] & bit) !== 0 || (boxes[box] & bit) !== 0) {
      return null;
    }

    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }

  return fillCells(cells, rows, cols, boxes, emptyCells) ? cells.join('') : null;
}

function fillCells(cells, rows, cols, boxes, emptyCells) {
  let bestOffset = -1;
  let bestMask = 0;
  let bestCount = 10;

  for (let offset = 0; offset < emptyCells.length; offset++) {
    const index = emptyCells[offset];
    if (cells[index] !== 0) {
      continue;
    }

    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const mask = FULL_MASK & ~(rows[row] | cols[col] | boxes[box]);
    const count = countBits(mask);

    if (count === 0) {
      return false;
    }

    if (count < bestCount) {
      bestOffset = offset;
      bestMask = mask;
      bestCount = count;
    }
  }

  if (bestOffset === -1) {
    return true;
  }

  const index = emptyCells[bestOffset];
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

  for (let value = 1; value <= 9; value++) {
    const bit = 1 << value;
    if ((bestMask & bit) === 0) {
      continue;
    }

    cells[index] = value;
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;

    if (fillCells(cells, rows, cols, boxes, emptyCells)) {
      return true;
    }

    cells[index] = 0;
    rows[row] &= ~bit;
    cols[col] &= ~bit;
    boxes[box] &= ~bit;
  }

  return false;
}

function countBits(value) {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count++;
  }
  return count;
}
