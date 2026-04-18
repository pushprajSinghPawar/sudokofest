# Fair Play And Solution Security

This document answers the main fair-play question:

Can the Sudoku solution be cracked from the browser?

Short answer: yes, if the solution is sent to the browser, it is not fair-play
proof.

## Current Risk

If the frontend receives the full solution string, a user can find it using:

- browser DevTools,
- source maps,
- Angular component state inspection,
- network responses,
- console JavaScript,
- breakpoints,
- local storage inspection,
- the downloaded JavaScript bundle.

Even if the variable is renamed, minified, or hidden behind a service, the data
is still present in the user's browser. If the browser can check the answer
locally, the user can extract or reproduce that check.

## Example Attack Paths

### 1. Inspect Network Response

If an API or asset returns:

```json
{
  "puzzle": "...",
  "solution": "679518243..."
}
```

the player can open DevTools and read the response.

### 2. Inspect Runtime State

If Angular stores the solution in a signal/component/service, a user can inspect
runtime state or set breakpoints around the move-checking code.

### 3. Read Bundled JavaScript

If solution logic or solution data is included in the built frontend bundle,
minification only slows people down. It does not protect the data.

### 4. Call Internal Functions

If the browser has a function like:

```ts
isMoveCorrect(cellIndex, value)
```

then a player can use console scripts to call or reverse that logic.

## Is Client-Side Validation Fair-Play Proof?

No.

Client-side validation is useful for:

- fast UI feedback,
- offline play,
- casual games,
- single-player mode.

It is not enough for:

- competitive multiplayer,
- prize games,
- anti-cheat,
- trusted leaderboards.

Rule: anything the browser knows, the player can know.

## Recommended Fair-Play Architecture

Move solution checking to the server.

The browser should receive:

```json
{
  "puzzle": "070000043040009610...",
  "difficulty": "medium"
}
```

The browser should not receive:

```json
{
  "solution": "679518243543729618..."
}
```

When the player enters a move, the browser sends:

```json
{
  "cellIndex": 12,
  "value": "5"
}
```

The server returns:

```json
{
  "isCorrect": true,
  "scoreDelta": 150,
  "score": 450
}
```

The server stores the solution and performs the check.

## Recommended Move Validation

Server should check:

1. Session exists.
2. Player belongs to session.
3. Game is running.
4. Timer has not expired.
5. Cell index is between `0` and `80`.
6. Cell was blank in the original puzzle.
7. Cell is not already locked for that player.
8. Value is between `1` and `9`.
9. Value matches the server-side solution.
10. Score delta is calculated server-side.

The client should never send:

- `isCorrect`,
- `scoreDelta`,
- `score`,
- `solution`,
- trusted timer values.

Those must be decided by the server.

## Suggested Scoring Flow

For correct move:

```text
+150 points
lock cell
broadcast scoreboard
```

For wrong move:

```text
-80 points
do not lock cell
broadcast scoreboard
```

The exact scoring rules can change, but the server must be the only authority.

## Anti-Cheat Levels

### Level 1: Casual

Acceptable for friends/testing:

- solution in browser,
- local scoring,
- local storage,
- no backend.

This is the current basic frontend-friendly mode.

### Level 2: Server-Validated

Good for real multiplayer:

- puzzle clues sent to browser,
- solution stored only on server,
- moves validated by server,
- score stored in database,
- scoreboard broadcast from server.

This is the recommended target.

### Level 3: Stronger Competitive Mode

Use this if rankings/prizes matter:

- rate-limit move submissions,
- store full move audit log,
- use signed player tokens,
- reject impossible move speed,
- reject moves after timer expiry server-side,
- detect repeated reconnect/name abuse,
- optionally require login,
- optionally hide detailed wrong/correct feedback until after submission is accepted.

## Can A User Still Cheat?

Even with server validation, a player can still use external Sudoku solvers by
copying the visible puzzle clues. You cannot fully prevent that in a web game.

What you can prevent:

- reading the official solution from browser memory,
- self-awarding score,
- submitting moves after time expires,
- editing local storage to change the leaderboard,
- spoofing another player without a token.

What you cannot fully prevent:

- using another website/app to solve the puzzle,
- screen sharing answers,
- manually colluding.

For friendly multiplayer, server-side validation is usually enough.

## Practical Recommendation

Do this next:

1. Stop shipping solutions in `public/assets/sudoku.json` for multiplayer mode.
2. Store puzzle solutions in the backend database.
3. Add a backend endpoint for move submission.
4. Update the frontend to call `submitMove` instead of checking `solution[index]`.
5. Update scores only from server responses.
6. Subscribe to server scoreboard events.

## Browser-Side Puzzle File

For fair play, the public asset should contain only:

```json
[
  ["070000043040009610...", 1]
]
```

This means:

- puzzle clues are public,
- difficulty code is public,
- solution is private.

The backend can have a private puzzle table/file with:

```json
{
  "puzzle": "070000043040009610...",
  "solution": "679518243543729618...",
  "difficulty": "medium"
}
```

## Important Design Rule

Do not rely on obfuscation.

These are not real protection:

- minifying JavaScript,
- renaming variables,
- hiding data in services,
- storing solution in encoded/base64 form,
- disabling right-click,
- hiding source maps.

The only reliable protection is not sending the solution to the browser.
