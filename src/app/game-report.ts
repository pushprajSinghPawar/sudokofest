import type { GameSession, ScoreboardEntry } from './game-session.service';

export type GameReportInput = {
  session: GameSession;
  playerName: string;
  playerScore: number;
  puzzle: string;
  currentValues: string[];
  scoreboard: ScoreboardEntry[];
};

export function downloadGameReport(input: GameReportInput): void {
  const html = buildGameReportHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeSessionId = input.session.id.replace(/[^a-zA-Z0-9_-]/g, '');
  anchor.href = url;
  anchor.download = `sudokofest-report-${safeSessionId}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildGameReportHtml(input: GameReportInput): string {
  const { session, playerName, playerScore, puzzle, currentValues, scoreboard } = input;
  const startLabel = formatTimestamp(session.startAt);
  const endLabel = formatTimestamp(session.endAt ?? session.startAt + session.durationMinutes * 60_000);
  const createdLabel = formatTimestamp(session.createdAt);
  const difficulty = session.difficulty ?? 'medium';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SudokuFest Report — ${escapeHtml(session.id)}</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #020617;
      color: #e5e7eb;
      line-height: 1.5;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      padding: 2rem 1.25rem 3rem;
    }
    h1, h2 { margin: 0 0 0.5rem; letter-spacing: -0.03em; }
    h1 { font-size: 2rem; }
    h2 { font-size: 1.15rem; margin-top: 2rem; color: #c7d2fe; }
    .muted { color: #94a3b8; }
    .card {
      margin-top: 1.25rem;
      padding: 1.25rem;
      border-radius: 1rem;
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: rgba(15, 23, 42, 0.92);
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .meta div {
      padding: 0.85rem;
      border-radius: 0.85rem;
      background: rgba(2, 6, 23, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.18);
    }
    .meta strong {
      display: block;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin-bottom: 0.35rem;
    }
    table.scoreboard {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
    }
    table.scoreboard th,
    table.scoreboard td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }
    .board {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      gap: 0;
      width: min(100%, 420px);
      margin-top: 0.75rem;
      border: 2px solid #6366f1;
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .cell {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      border: 1px solid rgba(71, 85, 105, 0.9);
      background: #111827;
    }
    .cell.fixed { color: #f8fafc; }
    .cell.filled { color: #86efac; }
    .cell.empty { color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="muted">SudokuFest game report</p>
    <h1>${escapeHtml(playerName)}</h1>
    <p class="muted">Session <strong>${escapeHtml(session.id)}</strong> • ${escapeHtml(difficulty)} • Final score <strong>${playerScore}</strong></p>

    <div class="card">
      <h2>Session details</h2>
      <div class="meta">
        <div><strong>Created</strong>${createdLabel}</div>
        <div><strong>Started</strong>${startLabel}</div>
        <div><strong>Ended</strong>${endLabel}</div>
        <div><strong>Duration</strong>${formatDuration(session.durationMinutes)}</div>
        <div><strong>Players</strong>${session.players.length} / ${session.maxPlayers}</div>
        <div><strong>Status</strong>${escapeHtml(session.status)}</div>
      </div>
    </div>

    <div class="card">
      <h2>Final scoreboard</h2>
      <table class="scoreboard">
        <thead>
          <tr><th>Rank</th><th>Player</th><th>Score</th></tr>
        </thead>
        <tbody>
          ${scoreboard
            .map(
              (entry, index) => `<tr>
            <td>#${index + 1}</td>
            <td>${escapeHtml(entry.playerName)}</td>
            <td>${entry.score}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Your final board</h2>
      <div class="board">
        ${renderBoardCells(puzzle, currentValues)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderBoardCells(puzzle: string, currentValues: string[]): string {
  return Array.from({ length: 81 }, (_, index) => {
    const puzzleDigit = puzzle[index] ?? '0';
    const isFixed = puzzleDigit !== '0' && puzzleDigit !== '.';
    const value = isFixed ? puzzleDigit : (currentValues[index] ?? '');
    const classes = ['cell', isFixed ? 'fixed' : value ? 'filled' : 'empty'].join(' ');
    return `<div class="${classes}">${escapeHtml(value || '·')}</div>`;
  }).join('');
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} seconds`;
  }

  if (minutes === 1) {
    return '1 minute';
  }

  return `${minutes} minutes`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
