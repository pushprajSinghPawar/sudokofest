# SudokuFest

SudokuFest is an Angular multiplayer Sudoku frontend. A host creates one lobby
link, players join with their names, and the game uses a shared puzzle, timer,
and scoreboard flow.

## Prerequisites

Install these before running the app:

- Node.js 22 or newer
- npm 10 or newer
- Git

Check your versions:

```bash
node --version
npm --version
git --version
```

This project was created with Angular 21 and uses `npm@10.8.2`.

## Setup

From the project folder, install dependencies:

```bash
npm install
```

The Sudoku puzzle data is loaded from:

```text
public/assets/sudoku.json
```

Make sure this file exists before running the app.

## Run Locally

Start the Angular development server:

```bash
npm start
```

Open the app in your browser:

```text
http://localhost:4200
```

If port `4200` is already in use, run:

```bash
npx ng serve --port 4300
```

Then open:

```text
http://localhost:4300
```

## Local Multiplayer Flow

1. Open the home page.
2. Select the maximum number of players.
3. Select the game time.
4. Select the start buffer.
5. Select a difficulty.
6. Click `Create lobby link`.
7. Open or share the generated lobby link.
8. Each player enters their name and joins the game.

The current lobby/session service is a local dummy implementation backed by
browser `localStorage`. It is useful for local testing and frontend development,
but it does not sync players across different devices yet.

For real online multiplayer, replace `LocalGameSessionService` in
`src/app/game-session.service.ts` with a backend implementation using Firebase,
Supabase, WebSockets, or a custom API.

## Build

Create a production build:

```bash
npm run build
```

The build output is written to:

```text
dist/sudokofest
```

## Watch Build

Run a development build that watches for changes:

```bash
npm run watch
```

## Tests

Run the test command:

```bash
npm test
```

## Assets

Angular copies everything from `public/` into the deployed app. The active
Sudoku data file is:

```text
public/assets/sudoku.json
```

`public/assets/app.py` is only a helper script for compressing/converting Sudoku
JSON data. It is not required to run the Angular application.

## Useful Commands

```bash
npm install
npm start
npm run build
npm run watch
npm test
```
