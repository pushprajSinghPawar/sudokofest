# SudokuFest (Beginner Guide)

SudokuFest is a multiplayer Sudoku app with:
- Angular frontend
- Fastify backend API + WebSocket server

If you are running this project for the first time, follow the steps below in order.

## 1) What you need before running

Install these tools:
- Node.js `22+`
- npm `10+`
- Git

Check versions:

```bash
node --version
npm --version
git --version
```

## 2) Which folder to run commands in

Run commands inside this folder:

```text
Frontend/sudokofest
```

Example:

```bash
cd /home/pushpraj/git/sudokofest/Frontend/sudokofest
```

## 3) Install dependencies (first time only)

```bash
npm install
```

## 4) Start the app (you need 2 terminals)

Open **Terminal 1** in `Frontend/sudokofest`:

```bash
npm run start:api
```

This starts the backend on:

```text
http://localhost:4000
```

Open **Terminal 2** in `Frontend/sudokofest`:

```bash
npm run start:web
```

This starts the frontend on:

```text
http://localhost:4200
```

Now open your browser and go to `http://localhost:4200`.

## 5) If it does not start

- Confirm both terminals are still running (no red error text).
- Make sure you are in `Frontend/sudokofest` before running commands.
- If port `4200` is busy:

```bash
npx ng serve --port 4300
```

Then open `http://localhost:4300`.

## 6) Build for production (optional)

```bash
npm run build
```

Output folder:

```text
dist/sudokofest
```

## 7) Run tests (optional)

```bash
npm test
```

## 8) Important data files

Backend puzzle and session files:

```text
server/data/sudoku.json
server/data/sessions.json
```

The frontend does not read puzzle answers directly; validation happens on the backend.

## Quick command list

```bash
cd /home/pushpraj/git/sudokofest/Frontend/sudokofest
npm install
npm run start:api
npm run start:web
npm run build
npm test
```
