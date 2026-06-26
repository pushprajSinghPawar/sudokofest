# SudokuFest
Hosted site link https://sudokofest-web.onrender.com/ 

Host a timed Sudoku round for up to 8 players. Everyone gets the same puzzle and shared countdown; scores update live on a leaderboard.

**Stack:**
- **Frontend:** Angular (`src/app/`)
- **Backend:** Node.js server (`server/server.mjs`) — HTTP REST API (`/api/...`) plus WebSocket (`/ws/:sessionId`) for live lobby and scoreboard updates. Built with [Fastify](https://fastify.dev/).
- **Database:** Firebase Realtime Database (read/written by the server only; the browser never connects to Firebase)

## Requirements

- Node.js 22+
- npm 10+
- A Firebase project (web app config + Realtime Database)

## Setup

```bash
cd Frontend/sudokofest
npm install
cp .env.example .env
```

Edit `.env` with your Firebase values and set `X_MASTER_KEY` (used to sign player session tokens). Never commit `.env`.

## Run locally

Use two terminals in `Frontend/sudokofest`:

```bash
# Terminal 1 — API (http://localhost:4000)
npm run start:api

# Terminal 2 — web app (http://localhost:4200)
npm run start:web
```

Open `http://localhost:4200`. If port 4200 is busy: `npx ng serve --port 4300`.

## How it works

1. **Create lobby** — host sets players, timer, difficulty, and gets a short link: `/lobby/{sessionId}`. The create button is disabled for 15 seconds after a link is generated.
2. **Join** — players open the lobby link, enter a name, and join. Identity is saved in encrypted browser session storage as a server-signed token.
3. **Play** — game URL is `/game/{sessionId}` (same ID as the lobby). Moves are validated on the server.
4. **Finish** — when time ends, players see a dialog to download an HTML game report or view `/results/{sessionId}`.

Session status in Firebase moves through `lobby` → `running` → `finished`, with `startAt` and `endAt` timestamps.

## Project layout

```text
server/server.mjs   Node backend (Fastify REST + WebSocket)
server/firebase.mjs Firebase persistence
server/data/        sudoku.json puzzle bank
src/app/            Angular UI
.env                Local secrets (gitignored)
```

Puzzle answers are never sent to the browser for validation; the API checks every move.

## Other commands

```bash
npm run build    # production build → dist/sudokofest
npm test         # unit tests
```

## Troubleshooting

- API won't start → check `.env` and Firebase credentials; the server requires Firebase (no local session file fallback).
- Can't join or play → re-join the lobby to refresh your signed player token in session storage.
- CORS / connection errors → confirm `npm run start:api` is running on port 4000.
