import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSessionService, type Difficulty } from './game-session.service';

type GameTokenPayload = {
  batch: number;
  entry: number;
  difficulty?: Difficulty;
  durationMinutes?: number;
  startAt?: number;
  createdAt?: number;
  playerIndex?: number;
  playerId?: string;
  playerName?: string;
  totalPlayers?: number;
  sessionId?: string;
  puzzleId?: string;
};

@Component({
  selector: 'app-sudoku-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sudoku-game.component.html',
  styles: [
    `
      :host {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        min-height: 100dvh;
        background: radial-gradient(circle at top, #020617 0, #000 60%);
        color: #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
        padding: 1.5rem;
        box-sizing: border-box;
      }

      .shell {
        width: 100%;
        max-width: 1120px;
        background: rgba(15, 23, 42, 0.94);
        border-radius: 1.25rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.75);
        padding: clamp(1rem, 2.4vw, 1.75rem);
        backdrop-filter: blur(18px);
      }

      .topbar {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) repeat(2, minmax(140px, 180px));
        gap: 0.9rem;
        align-items: stretch;
        margin-bottom: 1.2rem;
      }

      .panel {
        box-sizing: border-box;
        border-radius: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.72);
        padding: 0.95rem 1rem;
        min-width: 0;
      }

      .panel-label {
        display: block;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #94a3b8;
        margin-bottom: 0.55rem;
      }

      .field-value {
        min-height: 3.15rem;
        display: flex;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
        border: 1px solid rgba(129, 140, 248, 0.32);
        border-radius: 0.85rem;
        background: rgba(2, 6, 23, 0.72);
        color: #e5e7eb;
        padding: 0.85rem 0.95rem;
        font-size: 0.98rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stat-value {
        font-size: clamp(1.15rem, 2vw, 1.7rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #f8fafc;
      }

      .stat-subtext {
        margin-top: 0.35rem;
        font-size: 0.82rem;
        color: #94a3b8;
      }

      .eyebrow {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #9ca3af;
        margin-bottom: 0.5rem;
      }

      .title {
        font-size: 1.7rem;
        font-weight: 600;
        letter-spacing: -0.03em;
        margin-bottom: 0.35rem;
      }

      .description {
        font-size: 0.96rem;
        color: #9ca3af;
        margin-bottom: 1.5rem;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
        font-size: 0.8rem;
        color: #9ca3af;
      }

      .badge {
        border-radius: 999px;
        padding: 0.35rem 0.75rem;
        font-size: 0.78rem;
        border: 1px solid rgba(129, 140, 248, 0.85);
        background: rgba(15, 23, 42, 0.85);
        color: #a5b4fc;
      }

      .game-id {
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
          Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      }

      .play-area {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }

      .board-shell {
        width: min(100%, clamp(17rem, 72vmin, 40rem));
        justify-self: center;
        min-width: 0;
      }

      .side-panel {
        border-radius: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.62);
        padding: 1rem;
      }

      .board {
        position: relative;
        display: grid;
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 0;
        width: 100%;
        padding: clamp(0.45rem, 1.5vw, 0.7rem);
        border-radius: 1rem;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
        border: 1px solid rgba(55, 65, 81, 0.9);
        overflow: hidden;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .board::after {
        content: '';
        position: absolute;
        inset: clamp(0.45rem, 1.5vw, 0.7rem);
        pointer-events: none;
        background-image:
          linear-gradient(
            to right,
            transparent 32.9%,
            rgba(165, 180, 252, 0.95) 32.9%,
            rgba(165, 180, 252, 0.95) 33.6%,
            transparent 33.6%,
            transparent 66.2%,
            rgba(165, 180, 252, 0.95) 66.2%,
            rgba(165, 180, 252, 0.95) 66.9%,
            transparent 66.9%
          ),
          linear-gradient(
            to bottom,
            transparent 32.9%,
            rgba(165, 180, 252, 0.95) 32.9%,
            rgba(165, 180, 252, 0.95) 33.6%,
            transparent 33.6%,
            transparent 66.2%,
            rgba(165, 180, 252, 0.95) 66.2%,
            rgba(165, 180, 252, 0.95) 66.9%,
            transparent 66.9%
          );
        z-index: 2;
      }

      .cell {
        position: relative;
        z-index: 1;
        width: 100%;
        aspect-ratio: 1 / 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.88rem, 2.2vw, 1.35rem);
        font-weight: 600;
        border: 1px solid rgba(71, 85, 105, 0.85);
        background: rgba(17, 24, 39, 0.9);
        color: #e5e7eb;
        cursor: pointer;
        transition: background-color 0.15s ease, transform 0.12s ease,
          box-shadow 0.15s ease, color 0.15s ease;
      }

      .cell:hover {
        background: rgba(30, 41, 59, 0.95);
      }

      .cell.fixed {
        color: #f8fafc;
      }

      .cell.editable {
        color: #cbd5e1;
      }

      .cell.related {
        background: rgba(49, 46, 129, 0.3);
      }

      .cell.selected {
        background: rgba(79, 70, 229, 0.42);
        box-shadow: inset 0 0 0 2px rgba(196, 181, 253, 0.9);
        transform: scale(0.98);
      }

      .cell.correct {
        color: #bbf7d0;
      }

      .cell.incorrect {
        color: #fecaca;
        background: rgba(127, 29, 29, 0.4);
      }

      .cell.disabled {
        cursor: not-allowed;
        opacity: 0.72;
      }

      .footer-actions {
        display: flex;
        justify-content: center;
        margin-top: 1rem;
      }

      .result-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.8rem 1.1rem;
        border-radius: 999px;
        border: 1px solid rgba(129, 140, 248, 0.5);
        background: rgba(15, 23, 42, 0.82);
        color: #e5e7eb;
        text-decoration: none;
        font-weight: 600;
      }

      .cell.empty {
        color: #4b5563;
      }

      .error {
        font-size: 0.85rem;
        color: #fecaca;
        margin-bottom: 1rem;
      }

      .actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        font-size: 0.8rem;
        color: #9ca3af;
      }

      .back-link {
        color: #a5b4fc;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .back-link:hover {
        text-decoration: underline;
      }

      @media (max-width: 640px) {
        .shell {
          border-radius: 1rem;
        }

        .topbar {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .title {
          font-size: 1.4rem;
        }

        .description {
          margin-bottom: 1rem;
        }

      }

      @media (max-width: 420px) {
        :host {
          padding: 0.75rem;
        }

        .topbar {
          grid-template-columns: 1fr;
        }

        .cell {
          font-size: 0.82rem;
        }
      }

      @media (max-height: 820px) {
        :host {
          padding-block: 0.75rem;
        }

        .topbar {
          margin-bottom: 0.9rem;
        }

        .description {
          margin-bottom: 0.9rem;
        }
      }
    `,
  ],
})
export class SudokuGameComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameSessions = inject(GameSessionService);
  private timerHandle: number | null = null;

  private readonly batch = signal<number | null>(null);
  private readonly entry = signal<number | null>(null);

  readonly username = signal('Guest Player');
  readonly playerId = signal<string | null>(null);
  readonly difficulty = signal<Difficulty>('medium');
  readonly totalPlayers = signal(1);
  readonly puzzle = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly timerLabel = signal('00:00');
  readonly score = signal(0);
  readonly lastScoreChange = signal<string>('Select a blank cell and type 1-9.');
  readonly selectedCell = signal<number | null>(null);
  readonly currentValues = signal<string[]>([]);
  readonly lockedCells = signal<boolean[]>([]);
  readonly startAt = signal<number | null>(null);
  readonly createdAt = signal<number | null>(null);
  readonly durationMinutes = signal(2);
  readonly gameStatus = signal<'waiting' | 'running' | 'finished'>('waiting');
  readonly countdownLabel = signal('Waiting to start');
  readonly sessionId = signal<string | null>(null);
  readonly puzzleId = signal<string | null>(null);
  readonly resultRoute = computed(() => {
    const token = this.route.snapshot.paramMap.get('token');
    return token ? this.router.serializeUrl(this.router.createUrlTree(['/results', token])) : null;
  });

  readonly puzzleGrid = computed(() => this.buildGrid(this.puzzle()));
  readonly puzzleCells = computed(() => {
    const puzzle = this.puzzle();
    const currentValues = this.currentValues();
    const lockedCells = this.lockedCells();
    const selectedCell = this.selectedCell();

    if (!puzzle || currentValues.length < 81 || lockedCells.length < 81) {
      return [];
    }

    return Array.from({ length: 81 }, (_, index) => {
      const rowIndex = Math.floor(index / 9);
      const colIndex = index % 9;
      const boxIndex = Math.floor(rowIndex / 3) * 3 + Math.floor(colIndex / 3);
      const puzzleDigit = puzzle[index] ?? '0';
      const value = currentValues[index] ?? '';
      const fixed = (puzzleDigit !== '0' && puzzleDigit !== '.') || lockedCells[index];
      const originalFixed = puzzleDigit !== '0' && puzzleDigit !== '.';
      const editable = !fixed;
      const isEmpty = value === '';
      const isSelected = selectedCell === index;
      const selectedRow =
        selectedCell == null ? null : Math.floor(selectedCell / 9);
      const selectedCol = selectedCell == null ? null : selectedCell % 9;
      const selectedBox =
        selectedCell == null
          ? null
          : Math.floor(selectedRow! / 3) * 3 + Math.floor(selectedCol! / 3);
      const related =
        selectedCell != null &&
        (selectedRow === rowIndex ||
          selectedCol === colIndex ||
          selectedBox === boxIndex);
      const correct = !originalFixed && lockedCells[index];
      const incorrect = editable && value !== '';

      return {
        index,
        rowIndex,
        colIndex,
        value,
        fixed,
        editable,
        isEmpty,
        isSelected,
        related,
        correct,
        incorrect,
      };
    });
  });
  readonly selectedBatch = computed(() => this.batch());
  readonly selectedEntry = computed(() => this.entry());

  ngOnInit(): void {
    this.decodeToken();
    this.ensureSessionPlayer();
    this.fetchPuzzle();
    this.startClock();
  }

  ngOnDestroy(): void {
    if (this.timerHandle != null) {
      window.clearInterval(this.timerHandle);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.gameStatus() !== 'running') {
      return;
    }

    const selectedIndex = this.selectedCell();
    if (selectedIndex == null) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      void this.updateCell(selectedIndex, event.key);
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      this.clearCell(selectedIndex);
      return;
    }

    const movement: Record<string, number> = {
      ArrowUp: -9,
      ArrowDown: 9,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    if (!(event.key in movement)) {
      return;
    }

    event.preventDefault();
    const nextIndex = this.getNextIndex(selectedIndex, event.key);
    if (nextIndex != null) {
      this.selectedCell.set(nextIndex);
    }
  }

  private decodeToken(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loadError.set('Missing game token in the URL.');
      return;
    }

    try {
      let decodedRaw = token;
      if (typeof atob !== 'undefined') {
        const padded = token.replace(/-/g, '+').replace(/_/g, '/');
        const padLength = (4 - (padded.length % 4)) % 4;
        const withPadding = padded + '='.repeat(padLength);
        decodedRaw = atob(withPadding);
      }

      let payload: GameTokenPayload;
      if (decodedRaw.trim().startsWith('{')) {
        payload = JSON.parse(decodedRaw) as GameTokenPayload;
      } else {
        const [batchStr, entryStr] = decodedRaw.split(':');
        payload = {
          batch: Number(batchStr),
          entry: Number(entryStr),
        };
      }

      const batch = Number(payload.batch);
      const entry = Number(payload.entry);

      if (!Number.isFinite(batch) || !Number.isFinite(entry)) {
        throw new Error('Invalid token payload');
      }

      this.batch.set(batch);
      this.entry.set(entry);
      this.username.set(payload.playerName?.trim() || 'Guest Player');
      this.playerId.set(payload.playerId ?? null);
      this.difficulty.set(payload.difficulty ?? 'medium');
      this.totalPlayers.set(payload.totalPlayers ?? 1);
      this.durationMinutes.set(payload.durationMinutes ?? 2);
      this.startAt.set(payload.startAt ?? Date.now());
      this.createdAt.set(payload.createdAt ?? Date.now());
      this.sessionId.set(payload.sessionId ?? null);
      this.puzzleId.set(payload.puzzleId ?? null);
    } catch (e) {
      console.error('Failed to decode token', e);
      this.loadError.set('Invalid game link token.');
    }
  }

  private ensureSessionPlayer(): void {
    const sessionId = this.sessionId();
    const playerName = this.username();
    if (!sessionId || !playerName) {
      return;
    }

    this.gameSessions.joinSession({ sessionId, playerName }).catch((error) => {
      console.warn('Could not register player in local game session', error);
    });
  }

  private buildGrid(value: string | null): string[][] {
    if (!value || value.length < 81) {
      return [];
    }
    const cells = value.slice(0, 81).split('');
    const rows: string[][] = [];
    for (let i = 0; i < 9; i++) {
      rows.push(cells.slice(i * 9, i * 9 + 9));
    }
    return rows;
  }

  private fetchPuzzle(): void {
    const sessionId = this.sessionId();
    const playerId = this.playerId();
    if (!sessionId || !playerId) {
      this.loadError.set('Missing session or player details.');
      return;
    }

    this.gameSessions.getPuzzle(sessionId, playerId).then((selectedPuzzle) => {
      const puzzle = selectedPuzzle.puzzle;
      const originalValues = puzzle.slice(0, 81).split('').map((digit) =>
        digit === '0' || digit === '.' ? '' : digit,
      );
      const originalLocked = puzzle.slice(0, 81).split('').map((digit) => digit !== '0' && digit !== '.');
      const serverValues = selectedPuzzle.currentValues?.length === 81 ? selectedPuzzle.currentValues : [];
      const serverLocked = selectedPuzzle.lockedCells?.length === 81 ? selectedPuzzle.lockedCells : [];

      this.puzzle.set(puzzle);
      this.puzzleId.set(selectedPuzzle.puzzleId);
      this.difficulty.set(selectedPuzzle.difficulty);
      this.currentValues.set(
        Array.from({ length: 81 }, (_, index) => serverValues[index] || originalValues[index] || ''),
      );
      this.lockedCells.set(
        Array.from({ length: 81 }, (_, index) => originalLocked[index] || Boolean(serverLocked[index])),
      );
      this.gameSessions.getSession(sessionId).then((session) => {
        const player = session?.players.find((currentPlayer) => currentPlayer.id === playerId);
        this.score.set(player?.score ?? 0);
      });
      this.lastScoreChange.set('Select a blank cell and type 1-9.');
      this.selectedCell.set(this.findFirstEditableCell(puzzle));
      this.loadError.set(null);
    }).catch((error) => {
      console.error('Failed to load Sudoku puzzle from server', error);
      this.loadError.set('Unable to load puzzle data from the server.');
    });
  }

  private startClock(): void {
    this.updateClockState();
    if (typeof window === 'undefined') {
      return;
    }

    this.timerHandle = window.setInterval(() => this.updateClockState(), 1000);
  }

  private updateClockState(): void {
    const startAt = this.startAt();
    const durationMinutes = this.durationMinutes();

    if (!startAt) {
      this.gameStatus.set('waiting');
      this.timerLabel.set('00:00');
      this.countdownLabel.set('Waiting to start');
      return;
    }

    const now = Date.now();
    const roundEnd = startAt + durationMinutes * 60_000;

    if (now < startAt) {
      this.gameStatus.set('waiting');
      this.timerLabel.set(this.formatDuration(startAt - now));
      this.countdownLabel.set('Game starts in');
      return;
    }

    if (now >= roundEnd) {
      this.gameStatus.set('finished');
      this.timerLabel.set('00:00');
      this.countdownLabel.set('Time over');
      return;
    }

    this.gameStatus.set('running');
    this.timerLabel.set(this.formatDuration(roundEnd - now));
    this.countdownLabel.set('Time left');
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  selectCell(index: number): void {
    if (this.gameStatus() !== 'running') {
      return;
    }
    this.selectedCell.set(index);
  }

  private async updateCell(index: number, nextValue: string): Promise<void> {
    const sessionId = this.sessionId();
    const playerId = this.playerId();
    const puzzle = this.puzzle();
    const currentValues = [...this.currentValues()];
    const lockedCells = [...this.lockedCells()];
    if (!sessionId || !playerId || !puzzle || currentValues.length < 81 || lockedCells.length < 81) {
      return;
    }

    const originalValue = puzzle[index] ?? '0';
    if ((originalValue !== '0' && originalValue !== '.') || lockedCells[index]) {
      return;
    }

    const previousValue = currentValues[index] ?? '';
    currentValues[index] = nextValue;
    this.currentValues.set(currentValues);
    this.lastScoreChange.set('Checking move...');

    try {
      const result = await this.gameSessions.submitMove({
        sessionId,
        playerId,
        cellIndex: index,
        value: nextValue,
        clientMoveId: `move-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      this.score.set(result.score);
      if (result.isCorrect) {
        lockedCells[index] = true;
        this.lockedCells.set(lockedCells);
        this.lastScoreChange.set(`Correct move: +${result.scoreDelta}`);
        this.selectedCell.set(this.findNextEditableCell(index));
        return;
      }

      this.lastScoreChange.set(`Wrong move: ${result.scoreDelta}`);
    } catch (error) {
      console.error('Failed to submit move', error);
      currentValues[index] = previousValue;
      this.currentValues.set(currentValues);
      this.lastScoreChange.set('Move was rejected by the server.');
    }
  }

  private clearCell(index: number): void {
    const puzzle = this.puzzle();
    const currentValues = [...this.currentValues()];
    const lockedCells = this.lockedCells();
    if (!puzzle || currentValues.length < 81 || lockedCells.length < 81) {
      return;
    }

    const originalValue = puzzle[index] ?? '0';
    if ((originalValue !== '0' && originalValue !== '.') || lockedCells[index]) {
      return;
    }

    currentValues[index] = '';
    this.currentValues.set(currentValues);
    this.lastScoreChange.set('Cell cleared.');
  }

  private findFirstEditableCell(puzzle: string): number | null {
    const index = puzzle.slice(0, 81).split('').findIndex((digit) => digit === '0' || digit === '.');
    return index === -1 ? null : index;
  }

  private findNextEditableCell(startIndex: number): number | null {
    const puzzle = this.puzzle();
    const lockedCells = this.lockedCells();
    if (!puzzle || lockedCells.length < 81) {
      return null;
    }

    for (let offset = 1; offset <= 81; offset++) {
      const index = (startIndex + offset) % 81;
      const puzzleDigit = puzzle[index] ?? '0';
      const originalFixed = puzzleDigit !== '0' && puzzleDigit !== '.';
      if (!originalFixed && !lockedCells[index]) {
        return index;
      }
    }

    return null;
  }

  private getNextIndex(index: number, key: string): number | null {
    const row = Math.floor(index / 9);
    const col = index % 9;

    switch (key) {
      case 'ArrowUp':
        return row > 0 ? index - 9 : index;
      case 'ArrowDown':
        return row < 8 ? index + 9 : index;
      case 'ArrowLeft':
        return col > 0 ? index - 1 : index;
      case 'ArrowRight':
        return col < 8 ? index + 1 : index;
      default:
        return null;
    }
  }
}
