# Backend Framework Choice

This document captures the recommended backend direction for SudokuFest.

## Short Recommendation

Use this stack for the current lightweight implementation:

- Backend framework: Fastify
- Realtime transport: `@fastify/websocket`
- Temporary storage: filesystem JSON under `server/data`
- Puzzle source: private server-side `server/data/sudoku.json`
- Future database: PostgreSQL, Supabase, Firebase, or another realtime DB

Why this is a good first backend:

- Fastify is lightweight and fast.
- It keeps the project simple while fair play is being introduced.
- It supports REST and WebSocket endpoints without a large framework layer.
- It lets the frontend stop reading `sudoku.json` directly.
- It can be replaced or expanded later without changing the game flow.

Current implemented backend files:

```text
server/server.mjs
server/data/sudoku.json
server/data/sessions.json
```

Use this stack later if the app grows:

- Backend framework: NestJS
- Realtime transport: WebSockets with Socket.IO through NestJS gateways
- Database: PostgreSQL
- ORM/query layer: Prisma or Drizzle
- Cache/pub-sub for scaling later: Redis
- Auth: anonymous/player session tokens first, real auth later if needed

Why NestJS is a good later fit:

- The frontend is Angular/TypeScript, so a TypeScript backend keeps the project language consistent.
- NestJS has a structured module/service/controller style that maps well to Angular thinking.
- NestJS has official WebSocket gateway support.
- PostgreSQL is reliable for game sessions, players, moves, and score history.
- Socket.IO rooms map naturally to game lobbies.

References:

- Fastify: https://fastify.dev/
- Fastify WebSocket plugin: https://github.com/fastify/fastify-websocket
- NestJS WebSocket gateways: https://docs.nestjs.com/websockets/gateways
- NestJS WebSocket adapters: https://docs.nestjs.com/websockets/adapter
- Socket.IO rooms: https://socket.io/docs/v4/rooms/

## Alternative: Supabase

Supabase is the fastest path if you want less backend code.

Use Supabase if:

- you want managed PostgreSQL,
- you want auth and database hosting included,
- you are comfortable using Supabase Realtime for lobby/score subscriptions,
- you do not need heavy custom server-side game validation at first.

References:

- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Supabase Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes

Important note: for fair play, the server should validate moves and scoring. Supabase can still do this with Edge Functions or database functions, but a custom NestJS backend is cleaner once anti-cheat matters.

## Alternative: Firebase

Firebase Cloud Firestore is also workable for fast realtime development.

Use Firebase if:

- you want realtime listeners quickly,
- you want simple managed auth,
- you prefer document storage over relational modelling.

References:

- Cloud Firestore: https://firebase.google.com/docs/firestore
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen

Tradeoff: SudokuFest has relational concepts: sessions, players, moves, puzzles, score events. PostgreSQL models those relationships more naturally than document collections.

## Recommended Database

Use PostgreSQL.

Reasons:

- Strong relational modelling for sessions, players, moves, score events, and puzzles.
- Easy ranking queries for scoreboards.
- Good transaction support for validating a move and updating score atomically.
- Easy to move between local development, Supabase, Neon, Railway, Render, AWS RDS, etc.

## Recommended Production Shape

The backend should expose:

- REST endpoints for creating sessions, joining sessions, and fetching initial state.
- WebSocket events for live lobby updates, score updates, timer updates, and game finish.
- Server-side move validation so the solution is never required in browser code.

Suggested service modules:

- `AuthModule`: anonymous player identity and optional JWT handling.
- `PuzzleModule`: puzzle lookup and server-side solution access.
- `SessionModule`: create/join/start/finish game sessions.
- `MoveModule`: validate moves and produce score events.
- `ScoreboardModule`: current leaderboard and final results.
- `RealtimeModule`: WebSocket rooms/events.

## Data Models

### GameSession

Stores one game/lobby.

```ts
type GameSession = {
  id: string;
  hostPlayerId?: string;
  puzzleId: string;
  maxPlayers: number;
  durationSeconds: number;
  startAt: Date | null;
  status: 'lobby' | 'running' | 'finished' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
};
```

Suggested PostgreSQL table:

```sql
create table game_sessions (
  id uuid primary key,
  host_player_id uuid null,
  puzzle_id text not null,
  max_players int not null check (max_players between 1 and 8),
  duration_seconds int not null,
  start_at timestamptz null,
  status text not null check (status in ('lobby', 'running', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### GamePlayer

Stores a player inside one game session.

```ts
type GamePlayer = {
  id: string;
  sessionId: string;
  displayName: string;
  joinOrder: number;
  isHost: boolean;
  score: number;
  joinedAt: Date;
  lastSeenAt: Date;
};
```

Suggested PostgreSQL table:

```sql
create table game_players (
  id uuid primary key,
  session_id uuid not null references game_sessions(id),
  display_name text not null,
  join_order int not null,
  is_host boolean not null default false,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id, display_name),
  unique (session_id, join_order)
);
```

### Puzzle

Stores puzzle metadata. The solution must be server-only.

```ts
type Puzzle = {
  id: string;
  puzzle: string;
  solution: string; // server-only
  difficulty: 'easy' | 'medium' | 'hard';
};
```

Suggested PostgreSQL table:

```sql
create table puzzles (
  id text primary key,
  puzzle text not null,
  solution text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard'))
);
```

Do not expose `solution` through public APIs.

### MoveEvent

Stores each attempted move for audit and replay.

```ts
type MoveEvent = {
  id: string;
  sessionId: string;
  playerId: string;
  cellIndex: number;
  value: string;
  isCorrect: boolean;
  scoreDelta: number;
  scoreAfter: number;
  createdAt: Date;
};
```

Suggested PostgreSQL table:

```sql
create table move_events (
  id uuid primary key,
  session_id uuid not null references game_sessions(id),
  player_id uuid not null references game_players(id),
  cell_index int not null check (cell_index between 0 and 80),
  value text not null check (value ~ '^[1-9]$'),
  is_correct boolean not null,
  score_delta int not null,
  score_after int not null,
  created_at timestamptz not null default now()
);
```

### PlayerCellState

Stores each player's solved/locked cells.

```ts
type PlayerCellState = {
  sessionId: string;
  playerId: string;
  cellIndex: number;
  value: string;
  isLocked: boolean;
  updatedAt: Date;
};
```

Suggested PostgreSQL table:

```sql
create table player_cell_states (
  session_id uuid not null references game_sessions(id),
  player_id uuid not null references game_players(id),
  cell_index int not null check (cell_index between 0 and 80),
  value text not null check (value ~ '^[1-9]$'),
  is_locked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id, cell_index)
);
```

## API Endpoints

Minimum REST endpoints:

```text
POST /api/sessions
GET  /api/sessions/:sessionId
POST /api/sessions/:sessionId/join
POST /api/sessions/:sessionId/start
POST /api/sessions/:sessionId/moves
GET  /api/sessions/:sessionId/scoreboard
```

Minimum WebSocket events:

```text
client -> server: join_room
server -> client: session_updated
server -> client: player_joined
client -> server: submit_move
server -> client: move_result
server -> client: scoreboard_updated
server -> client: game_finished
```
