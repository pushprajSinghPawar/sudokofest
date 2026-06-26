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
import { GameSessionService, type Difficulty, type GameSession, type ScoreboardEntry } from './game-session.service';
import { downloadGameReport } from './game-report';
import { readPlayerSessionFor } from './player-session.storage';

@Component({
  selector: 'app-sudoku-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sudoku-game.component.html',
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        background:
          radial-gradient(circle at top, rgba(245, 158, 11, 0.12), transparent 24%),
          radial-gradient(circle at right, rgba(59, 130, 246, 0.1), transparent 30%),
          linear-gradient(180deg, #111111 0%, #171717 48%, #0b0b0c 100%);
        color: #f8fafc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
        padding: 0.75rem;
        box-sizing: border-box;
      }

      .shell {
        width: 100%;
        max-width: 1120px;
        min-height: min(100dvh - 1.5rem, 920px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.7rem;
        background: rgba(17, 17, 19, 0.96);
        border-radius: 1.1rem;
        border: 1px solid rgba(250, 204, 21, 0.14);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.5);
        padding: clamp(0.75rem, 2vw, 1.1rem);
        backdrop-filter: blur(12px);
        overflow: hidden;
      }

      .topbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
        align-items: stretch;
      }

      .user-panel {
        grid-column: 1 / -1;
      }

      .panel {
        box-sizing: border-box;
        border-radius: 0.95rem;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: linear-gradient(180deg, rgba(28, 28, 31, 0.98), rgba(19, 19, 22, 0.98));
        padding: 0.7rem 0.75rem;
        min-width: 0;
      }

      .panel-label {
        display: block;
        font-size: 0.64rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #a3a3a3;
        margin-bottom: 0.32rem;
      }

      .field-value {
        min-height: 2.55rem;
        display: flex;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
        gap: 0.45rem;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 0.8rem;
        background: rgba(10, 10, 12, 0.92);
        color: #f8fafc;
        padding: 0.65rem 0.75rem;
        font-size: 0.92rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .panel-icon {
        width: 1.5rem;
        height: 1.5rem;
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.14);
        color: #fbbf24;
      }

      .panel-icon svg {
        width: 0.92rem;
        height: 0.92rem;
        fill: currentColor;
      }

      .field-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .stat-value {
        font-size: clamp(1rem, 1.7vw, 1.35rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #ffffff;
      }

      .play-area {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.5rem;
        align-items: start;
        flex: 1;
        min-height: 0;
      }

      .board-shell {
        width: min(100%, clamp(15.25rem, 63vmin, 27rem));
        justify-self: center;
        min-width: 0;
      }

      .number-pad {
        margin-top: 0.55rem;
        padding: 0.55rem;
        border-radius: 0.95rem;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(14, 14, 16, 0.94);
      }

      .number-pad-grid {
        display: grid;
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 0.3rem;
      }

      .number-button,
      .clear-button {
        appearance: none;
        border: 1px solid rgba(245, 158, 11, 0.28);
        border-radius: 0.75rem;
        background: linear-gradient(180deg, rgba(34, 34, 37, 0.98), rgba(17, 17, 19, 0.98));
        color: #f8fafc;
        font-weight: 700;
        cursor: pointer;
      }

      .number-button {
        min-height: 2.35rem;
        font-size: 0.92rem;
      }

      .clear-button {
        width: 100%;
        margin-top: 0.45rem;
        padding: 0.65rem 0.9rem;
        font-size: 0.82rem;
      }

      .number-button:disabled,
      .clear-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .board {
        position: relative;
        display: grid;
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 0;
        width: 100%;
        padding: clamp(0.35rem, 1.2vw, 0.55rem);
        border-radius: 0.95rem;
        background: linear-gradient(180deg, rgba(24, 24, 27, 0.99), rgba(10, 10, 12, 0.99));
        border: 1px solid rgba(245, 158, 11, 0.18);
        overflow: hidden;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .board::after {
        content: '';
        position: absolute;
        inset: clamp(0.35rem, 1.2vw, 0.55rem);
        pointer-events: none;
        background-image:
          linear-gradient(
            to right,
            transparent 32.9%,
            rgba(251, 191, 36, 0.82) 32.9%,
            rgba(251, 191, 36, 0.82) 33.6%,
            transparent 33.6%,
            transparent 66.2%,
            rgba(251, 191, 36, 0.82) 66.2%,
            rgba(251, 191, 36, 0.82) 66.9%,
            transparent 66.9%
          ),
          linear-gradient(
            to bottom,
            transparent 32.9%,
            rgba(251, 191, 36, 0.82) 32.9%,
            rgba(251, 191, 36, 0.82) 33.6%,
            transparent 33.6%,
            transparent 66.2%,
            rgba(251, 191, 36, 0.82) 66.2%,
            rgba(251, 191, 36, 0.82) 66.9%,
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
        font-size: clamp(0.82rem, 2vw, 1.12rem);
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(21, 21, 24, 0.96);
        color: #f3f4f6;
        cursor: pointer;
        transition: background-color 0.15s ease, transform 0.12s ease,
          box-shadow 0.15s ease, color 0.15s ease;
      }

      .cell:hover {
        background: rgba(33, 33, 37, 0.98);
      }

      .cell.fixed {
        color: #f8fafc;
      }

      .cell.editable {
        color: #f1f5f9;
      }

      .cell.related {
        background: rgba(251, 191, 36, 0.08);
      }

      .cell.same-value {
        border: 2px solid rgba(34, 197, 94, 0.7);
        background: rgba(21, 128, 61, 0.18);
      }

      .cell.selected {
        background: rgba(245, 158, 11, 0.18);
        border: 2px solid rgba(251, 191, 36, 0.95);
        box-shadow: inset 0 0 0 1px rgba(254, 240, 138, 0.85);
        transform: scale(0.98);
      }

      .cell.correct {
        color: #bbf7d0;
      }

      .cell.incorrect {
        color: #fecaca;
        background: rgba(127, 29, 29, 0.58);
      }

      .cell.disabled {
        cursor: not-allowed;
        opacity: 0.72;
      }

      .cell.empty {
        color: #4b5563;
      }

      .completion-message {
        text-align: center;
        padding: 0.75rem;
        margin-top: 0.55rem;
        border-radius: 0.85rem;
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.5);
        color: #86efac;
        font-weight: 600;
        font-size: 0.86rem;
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .error {
        font-size: 0.8rem;
        color: #fecaca;
        margin-bottom: 0.35rem;
      }

      .game-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        padding: 0.45rem 0.1rem 0.1rem;
        color: #a3a3a3;
        font-size: 0.68rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .footer-signature {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
        justify-content: center;
      }

      .footer-credit {
        color: #f5f5f5;
        font-weight: 600;
        white-space: nowrap;
      }

      .footer-separator {
        width: 0.3rem;
        height: 0.3rem;
        flex: 0 0 auto;
        border-radius: 999px;
        background: rgba(251, 191, 36, 0.7);
      }

      .footer-role {
        color: #a3a3a3;
      }

      .footer-links {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .footer-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #f5f5f5;
        text-decoration: none;
        width: 1.9rem;
        height: 1.9rem;
        border-radius: 999px;
        background: rgba(27, 27, 31, 0.86);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .footer-link svg {
        width: 0.95rem;
        height: 0.95rem;
        fill: currentColor;
      }

      @media (max-width: 640px) {
        .shell {
          min-height: calc(100dvh - 1rem);
          border-radius: 1rem;
        }
      }

      @media (max-width: 420px) {
        :host {
          padding: 0.35rem;
        }

        .shell {
          min-height: calc(100dvh - 0.7rem);
          padding: 0.55rem;
          gap: 0.45rem;
        }

        .topbar {
          grid-template-columns: 1fr;
          gap: 0.35rem;
        }

        .user-panel {
          grid-column: auto;
        }

        .cell {
          font-size: 0.72rem;
        }

        .number-pad {
          margin-top: 0.4rem;
          padding: 0.45rem;
        }

        .number-button {
          min-height: 2rem;
          font-size: 0.8rem;
        }

        .clear-button {
          padding: 0.55rem 0.75rem;
          font-size: 0.75rem;
        }

        .field-value {
          min-height: 2.1rem;
          padding: 0.55rem 0.6rem;
          font-size: 0.82rem;
        }

        .stat-value {
          font-size: 0.96rem;
        }

        .panel {
          padding: 0.52rem 0.56rem;
        }

        .game-footer {
          font-size: 0.64rem;
          gap: 0.35rem;
        }

        .footer-signature {
          gap: 0.3rem;
        }

        .footer-link {
          width: 1.7rem;
          height: 1.7rem;
        }
      }

      @media (max-height: 820px) {
        :host {
          padding-block: 0.35rem;
        }
      }

      .finish-dialog-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(2, 6, 23, 0.78);
        backdrop-filter: blur(8px);
        z-index: 20;
      }

      .finish-dialog {
        width: min(100%, 460px);
        border-radius: 1.25rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.98);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.85);
        padding: 1.5rem;
      }

      .finish-dialog h2 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        letter-spacing: -0.03em;
      }

      .finish-dialog p {
        margin: 0 0 1.25rem;
        color: #94a3b8;
        font-size: 0.95rem;
      }

      .finish-dialog-actions {
        display: grid;
        gap: 0.75rem;
      }

      .finish-primary-button,
      .finish-secondary-button {
        appearance: none;
        border: none;
        cursor: pointer;
        border-radius: 999px;
        padding: 0.85rem 1.2rem;
        font-size: 0.95rem;
        font-weight: 600;
        text-decoration: none;
        text-align: center;
      }

      .finish-primary-button {
        color: #fff;
        background-image: linear-gradient(135deg, #f97316, #ec4899, #6366f1);
      }

      .finish-secondary-button {
        color: #e5e7eb;
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(129, 140, 248, 0.45);
      }
    `,
  ],
})
export class SudokuGameComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameSessions = inject(GameSessionService);
  private timerHandle: number | null = null;
  private finishHandled = false;
  private readonly incorrectClearTimers = new Map<number, number>();

  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  readonly username = signal('Guest Player');
  readonly playerId = signal<string | null>(null);
  readonly playerToken = signal<string | null>(null);
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
  readonly incorrectCells = signal<boolean[]>(Array.from({ length: 81 }, () => false));
  readonly startAt = signal<number | null>(null);
  readonly endAt = signal<number | null>(null);
  readonly createdAt = signal<number | null>(null);
  readonly durationMinutes = signal(2);
  readonly gameStatus = signal<'waiting' | 'running' | 'finished'>('waiting');
  readonly countdownLabel = signal('Waiting to start');
  readonly sessionId = signal<string | null>(null);
  readonly puzzleId = signal<string | null>(null);
  readonly showFinishDialog = signal(false);
  readonly finishedSession = signal<GameSession | null>(null);
  readonly scoreboard = signal<ScoreboardEntry[]>([]);

  readonly puzzleGrid = computed(() => this.buildGrid(this.puzzle()));
  readonly puzzleCells = computed(() => {
    const puzzle = this.puzzle();
    const currentValues = this.currentValues();
    const lockedCells = this.lockedCells();
    const incorrectCells = this.incorrectCells();
    const selectedCell = this.selectedCell();

    if (!puzzle || currentValues.length < 81 || lockedCells.length < 81) {
      return [];
    }

    const selectedValue = selectedCell != null ? currentValues[selectedCell] : null;

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
      const sameValue = selectedValue != null && value === selectedValue && value !== '' && !isSelected;
      const correct = !originalFixed && lockedCells[index];
      const incorrect = incorrectCells[index] ?? false;

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
        sameValue,
        correct,
        incorrect,
      };
    });
  });
  readonly isAllFilled = computed(() => {
    const currentValues = this.currentValues();
    if (currentValues.length < 81) {
      return false;
    }
    return currentValues.every((value) => value !== '');
  });

  ngOnInit(): void {
    void this.initializeGame();
    this.startClock();
  }

  ngOnDestroy(): void {
    if (this.timerHandle != null) {
      window.clearInterval(this.timerHandle);
    }
    for (const timer of this.incorrectClearTimers.values()) {
      window.clearTimeout(timer);
    }
    this.incorrectClearTimers.clear();
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

  private async initializeGame(): Promise<void> {
    const routeSessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!routeSessionId) {
      this.loadError.set('Missing game session id.');
      return;
    }

    const storedPlayer = await readPlayerSessionFor(routeSessionId);
    if (!storedPlayer) {
      this.loadError.set('Join the lobby first to start playing.');
      await this.router.navigate(['/lobby', routeSessionId]);
      return;
    }

    this.sessionId.set(routeSessionId);
    this.playerId.set(storedPlayer.playerId);
    this.playerToken.set(storedPlayer.playerToken);
    this.username.set(storedPlayer.playerName);

    try {
      const session = await this.gameSessions.getSession(routeSessionId);
      if (!session) {
        this.loadError.set('Game session not found.');
        return;
      }

      this.difficulty.set(session.difficulty ?? 'medium');
      this.totalPlayers.set(session.maxPlayers);
      this.durationMinutes.set(session.durationMinutes);
      this.startAt.set(session.startAt ?? Date.now());
      this.endAt.set(session.endAt ?? null);
      this.createdAt.set(session.createdAt);
      this.puzzleId.set(session.puzzleId ?? null);
      if (session.status === 'finished') {
        this.finishHandled = true;
        this.gameStatus.set('finished');
        this.endAt.set(session.endAt ?? null);
        await this.fetchPuzzle();
        await this.openFinishDialog(session);
        return;
      }

      await this.fetchPuzzle();
    } catch (error) {
      console.error('Failed to load game session', error);
      this.loadError.set('Unable to load game session from the server.');
    }
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

  private async fetchPuzzle(): Promise<void> {
    const sessionId = this.sessionId();
    const playerToken = this.playerToken();
    if (!sessionId || !playerToken) {
      this.loadError.set('Missing session or player details.');
      return;
    }

    try {
      const selectedPuzzle = await this.gameSessions.getPuzzle(sessionId, playerToken);
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
      this.incorrectCells.set(Array.from({ length: 81 }, () => false));
      const session = await this.gameSessions.getSession(sessionId);
      const player = session?.players.find((currentPlayer) => currentPlayer.id === this.playerId());
      this.score.set(player?.score ?? 0);
      this.lastScoreChange.set('Select a blank cell and type 1-9.');
      this.selectedCell.set(this.findFirstEditableCell(puzzle));
      this.loadError.set(null);
    } catch (error) {
      console.error('Failed to load Sudoku puzzle from server', error);
      this.loadError.set('Unable to load puzzle data from the server.');
    }
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
      if (this.gameStatus() !== 'finished') {
        this.gameStatus.set('finished');
        void this.handleGameFinished();
      }
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

  canUseNumberPad(): boolean {
    return this.gameStatus() === 'running' && this.selectedCell() != null;
  }

  enterDigit(digit: string): void {
    const selectedIndex = this.selectedCell();
    if (selectedIndex == null || !/^[1-9]$/.test(digit)) {
      return;
    }

    void this.updateCell(selectedIndex, digit);
  }

  clearSelectedCell(): void {
    const selectedIndex = this.selectedCell();
    if (selectedIndex == null) {
      return;
    }

    this.clearCell(selectedIndex);
  }

  downloadReport(): void {
    const session = this.finishedSession();
    const puzzle = this.puzzle();
    const currentValues = this.currentValues();
    if (!session || !puzzle || currentValues.length < 81) {
      return;
    }

    downloadGameReport({
      session,
      playerName: this.username(),
      playerScore: this.score(),
      puzzle,
      currentValues,
      scoreboard: this.scoreboard(),
    });
  }

  viewResults(): void {
    const sessionId = this.sessionId();
    if (!sessionId) {
      return;
    }

    void this.router.navigate(['/results', sessionId]);
  }

  private async handleGameFinished(): Promise<void> {
    if (this.finishHandled) {
      return;
    }

    this.finishHandled = true;
    const sessionId = this.sessionId();
    if (!sessionId) {
      return;
    }

    try {
      const session = await this.gameSessions.finalizeSession(sessionId);
      await this.openFinishDialog(session);
    } catch (error) {
      console.error('Failed to finalize game session', error);
      const session = await this.gameSessions.getSession(sessionId);
      if (session) {
        await this.openFinishDialog(session);
        return;
      }
      this.showFinishDialog.set(true);
    }
  }

  private async openFinishDialog(session: GameSession): Promise<void> {
    const scoreboard = await this.gameSessions.getScoreboard(session.id);
    this.finishedSession.set(session);
    this.endAt.set(session.endAt ?? null);
    this.scoreboard.set(scoreboard);
    this.showFinishDialog.set(true);
  }

  private async updateCell(index: number, nextValue: string): Promise<void> {
    const sessionId = this.sessionId();
    const playerToken = this.playerToken();
    const puzzle = this.puzzle();
    const currentValues = [...this.currentValues()];
    const lockedCells = [...this.lockedCells()];
    if (!sessionId || !playerToken || !puzzle || currentValues.length < 81 || lockedCells.length < 81) {
      return;
    }

    const originalValue = puzzle[index] ?? '0';
    if ((originalValue !== '0' && originalValue !== '.') || lockedCells[index]) {
      return;
    }

    const previousValue = currentValues[index] ?? '';
    this.clearIncorrectState(index);
    currentValues[index] = nextValue;
    this.currentValues.set(currentValues);
    this.lastScoreChange.set('Checking move...');

    try {
      const result = await this.gameSessions.submitMove({
        sessionId,
        playerToken,
        cellIndex: index,
        value: nextValue,
        clientMoveId: `move-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      this.score.set(result.score);
      if (result.isCorrect) {
        lockedCells[index] = true;
        this.lockedCells.set(lockedCells);
        this.clearIncorrectState(index);
        this.lastScoreChange.set(`Correct move: +${result.scoreDelta}`);
        this.selectedCell.set(this.findNextEditableCell(index));
        return;
      }

      this.markIncorrectEntry(index, previousValue, nextValue);
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

    this.clearIncorrectState(index);
    currentValues[index] = '';
    this.currentValues.set(currentValues);
    this.lastScoreChange.set('Cell cleared.');
  }

  private markIncorrectEntry(index: number, previousValue: string, submittedValue: string): void {
    const nextIncorrectCells = [...this.incorrectCells()];
    nextIncorrectCells[index] = true;
    this.incorrectCells.set(nextIncorrectCells);
    this.clearIncorrectTimer(index);

    const timer = window.setTimeout(() => {
      const latestValues = [...this.currentValues()];
      if (latestValues[index] === submittedValue) {
        latestValues[index] = previousValue;
        this.currentValues.set(latestValues);
      }
      this.clearIncorrectState(index);
      this.lastScoreChange.set('Wrong move cleared. Try another number.');
    }, 900);

    this.incorrectClearTimers.set(index, timer);
  }

  private clearIncorrectState(index: number): void {
    this.clearIncorrectTimer(index);
    const nextIncorrectCells = [...this.incorrectCells()];
    if (!nextIncorrectCells[index]) {
      return;
    }
    nextIncorrectCells[index] = false;
    this.incorrectCells.set(nextIncorrectCells);
  }

  private clearIncorrectTimer(index: number): void {
    const timer = this.incorrectClearTimers.get(index);
    if (timer != null) {
      window.clearTimeout(timer);
      this.incorrectClearTimers.delete(index);
    }
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
