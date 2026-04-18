# Server Connectivity And Live Score Workflow

This document describes how SudokuFest should move from browser-only state to a
server-connected multiplayer flow.

## Goal

Send score updates to the server on every move instead of storing shared game
state in browser cookies, session storage, or local storage.

Browser storage can still be used for non-authoritative convenience, such as:

- remembering the player's local token,
- remembering the last opened session,
- recovering UI state after refresh.

The server must become authoritative for:

- lobby players,
- game timer,
- puzzle assignment,
- move correctness,
- score,
- final scoreboard.

## Current Frontend Abstraction

The current Angular app already has an abstraction point:

```ts
GameSessionService
```

Today it is backed by:

```ts
RemoteGameSessionService
```

The current backend is a lightweight Fastify server:

```text
server/server.mjs
```

It reads puzzles privately from:

```text
server/data/sudoku.json
```

and stores temporary session, score, and move data in:

```text
server/data/sessions.json
```

This is intentionally filesystem-backed for now. Later, the same service
contract can point to PostgreSQL, Firebase, Supabase, or another realtime DB.

## High-Level Workflow

### 1. Host Creates Lobby

Frontend request:

```http
POST /api/sessions
```

Example body:

```json
{
  "maxPlayers": 4,
  "difficulty": "medium",
  "durationSeconds": 60,
  "startBufferSeconds": 10
}
```

Server does:

1. Selects a puzzle by difficulty.
2. Stores `puzzleId` in `game_sessions`.
3. Stores `startAt`.
4. Returns a short session id.

Example response:

```json
{
  "sessionId": "8b6768d4-4f8e-44e5-9ec5-588b62fd20ac",
  "lobbyUrl": "/lobby/8b6768d4-4f8e-44e5-9ec5-588b62fd20ac",
  "maxPlayers": 4,
  "durationSeconds": 60,
  "startAt": "2026-04-18T14:30:10.000Z"
}
```

### 2. Player Opens Lobby Link

Frontend request:

```http
GET /api/sessions/:sessionId
```

Server returns public session state:

```json
{
  "id": "8b6768d4-4f8e-44e5-9ec5-588b62fd20ac",
  "maxPlayers": 4,
  "durationSeconds": 60,
  "status": "lobby",
  "players": [
    {
      "id": "player-1",
      "displayName": "Asha",
      "score": 0
    }
  ]
}
```

Do not return the puzzle solution here.

### 3. Player Joins

Frontend request:

```http
POST /api/sessions/:sessionId/join
```

Example body:

```json
{
  "displayName": "Ravi"
}
```

Server does:

1. Checks that the session exists.
2. Checks that the lobby is not full.
3. Checks that the display name is unique in that session.
4. Creates a `game_players` row.
5. Returns a short-lived player token.

Example response:

```json
{
  "playerId": "3e23b6c3-56cc-4f1b-8b02-166cd45a9f7b",
  "playerToken": "signed-player-token",
  "joinOrder": 2
}
```

The frontend stores `playerToken` locally. The token identifies the player for
move submission.

### 4. Game Page Loads Puzzle

Frontend request:

```http
GET /api/sessions/:sessionId/puzzle
Authorization: Bearer signed-player-token
```

Server returns only the puzzle clues:

```json
{
  "puzzleId": "1234",
  "puzzle": "070000043040009610...",
  "difficulty": "medium"
}
```

Do not return:

```json
{
  "solution": "..."
}
```

### 5. Player Makes A Move

When a player enters a number, the browser sends the move to the server.

Frontend request:

```http
POST /api/sessions/:sessionId/moves
Authorization: Bearer signed-player-token
```

Example body:

```json
{
  "cellIndex": 17,
  "value": "8",
  "clientMoveId": "move-172938"
}
```

Server does:

1. Verifies player token.
2. Verifies session is running.
3. Verifies timer has not expired.
4. Verifies cell index is editable.
5. Looks up solution on the server.
6. Checks whether the value is correct.
7. Calculates score delta.
8. Writes `move_events`.
9. Updates `game_players.score`.
10. Updates `player_cell_states` if correct.
11. Broadcasts the new scoreboard to the session room.

Example response:

```json
{
  "clientMoveId": "move-172938",
  "accepted": true,
  "isCorrect": true,
  "scoreDelta": 150,
  "score": 450,
  "lockedCell": {
    "cellIndex": 17,
    "value": "8"
  }
}
```

For a wrong move:

```json
{
  "clientMoveId": "move-172939",
  "accepted": true,
  "isCorrect": false,
  "scoreDelta": -80,
  "score": 370
}
```

### 6. Server Broadcasts Live Score

WebSocket event:

```text
scoreboard_updated
```

Payload:

```json
{
  "sessionId": "8b6768d4-4f8e-44e5-9ec5-588b62fd20ac",
  "players": [
    {
      "playerId": "player-1",
      "displayName": "Asha",
      "score": 600
    },
    {
      "playerId": "player-2",
      "displayName": "Ravi",
      "score": 370
    }
  ]
}
```

The frontend updates the scoreboard from this event.

References:

- Fastify: https://fastify.dev/
- Fastify WebSocket plugin: https://github.com/fastify/fastify-websocket
- NestJS WebSocket gateways: https://docs.nestjs.com/websockets/gateways
- Socket.IO rooms: https://socket.io/docs/v4/rooms/
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen

## Frontend Service Shape

The Angular service should eventually look like this:

```ts
export abstract class GameSessionService {
  abstract createSession(input: CreateGameSessionInput): Promise<GameSession>;
  abstract getSession(sessionId: string): Promise<GameSession | null>;
  abstract watchSession(sessionId: string): Observable<GameSession | null>;
  abstract joinSession(input: JoinGameSessionInput): Promise<GameSessionPlayer>;
  abstract submitMove(input: SubmitMoveInput): Promise<MoveResult>;
  abstract watchScoreboard(sessionId: string): Observable<ScoreboardEntry[]>;
}
```

Then provide the remote implementation:

```ts
providers: [
  {
    provide: GameSessionService,
    useClass: RemoteGameSessionService
  }
]
```

## RemoteGameSessionService Responsibilities

The remote service should:

- call `POST /api/sessions` when creating a lobby,
- call `POST /api/sessions/:id/join` when a player joins,
- call `GET /api/sessions/:id/puzzle` when opening the game,
- call `POST /api/sessions/:id/moves` for every move,
- connect to WebSocket room `session:{sessionId}`,
- update Angular signals from server events.

## Move Submission Rules

The client should optimistically show the typed value only as pending.

Flow:

1. Player enters a number.
2. UI marks the cell as pending.
3. Client sends move to server.
4. Server validates move.
5. Server returns accepted/rejected result.
6. UI locks correct cells only after server confirmation.
7. UI applies score only after server confirmation.

This prevents the browser from being the source of truth.

## Idempotency

Every move should include a `clientMoveId`.

Purpose:

- avoids double scoring on retry,
- makes reconnection safer,
- allows the server to return the previous result for duplicate requests.

Suggested unique constraint:

```sql
create unique index move_events_player_client_move_id
on move_events (player_id, client_move_id);
```

## Timer Authority

The server should decide whether the game is running or finished.

The browser can display countdown using `startAt` and `durationSeconds`, but
the server should reject moves after the end time.

## Final Results

Results page should call:

```http
GET /api/sessions/:sessionId/scoreboard
```

Server returns final sorted results:

```json
{
  "sessionId": "8b6768d4-4f8e-44e5-9ec5-588b62fd20ac",
  "status": "finished",
  "players": [
    {
      "displayName": "Asha",
      "score": 1200
    }
  ]
}
```

## Environment Configuration

The frontend already has:

```ts
environment.apiBaseUrl
```

Development:

```ts
apiBaseUrl: 'http://localhost:4000/api'
```

Production:

```ts
apiBaseUrl: 'https://your-api-domain.com/api'
```

When WebSockets are added, also add:

```ts
socketUrl: 'http://localhost:4000'
```

and in production:

```ts
socketUrl: 'https://your-api-domain.com'
```
