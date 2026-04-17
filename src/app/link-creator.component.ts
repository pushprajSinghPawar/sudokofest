import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { GameSessionService, type Difficulty as SessionDifficulty } from './game-session.service';
import { type PuzzleAssetEntry } from './sudoku-puzzle';

type PlayerLink = {
  route: string;
  link: string;
  shortLink: string;
};

type CreatorDifficulty = 'any' | SessionDifficulty;

@Component({
  selector: 'app-link-creator',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './link-creator.component.html',
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        background: radial-gradient(circle at top, #1f2937 0, #020617 50%, #000 100%);
        color: #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
        padding: 1.5rem;
        box-sizing: border-box;
      }

      .card {
        width: 100%;
        max-width: 880px;
        background: rgba(15, 23, 42, 0.92);
        border-radius: 1.25rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.75);
        padding: 2rem;
        backdrop-filter: blur(18px);
      }

      .title {
        font-size: 1.9rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        margin: 0 0 0.4rem;
      }

      .subtitle {
        font-size: 0.96rem;
        color: #9ca3af;
        margin: 0 0 1.5rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .field,
      .player-section,
      .result-card {
        border-radius: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.7);
        padding: 1rem;
        min-width: 0;
      }

      .player-section,
      .result-card,
      .actions-row,
      .helper-card {
        margin-top: 1rem;
      }

      .label {
        display: block;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #94a3b8;
        margin-bottom: 0.55rem;
      }

      .input,
      .select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(129, 140, 248, 0.38);
        border-radius: 0.8rem;
        background: rgba(2, 6, 23, 0.82);
        color: #e5e7eb;
        padding: 0.8rem 0.9rem;
        font-size: 0.95rem;
      }

      .helper {
        margin: 0.55rem 0 0;
        font-size: 0.8rem;
        color: #94a3b8;
      }

      .players-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
        margin-top: 0.85rem;
      }

      .tag-card {
        border-radius: 0.9rem;
        border: 1px solid rgba(129, 140, 248, 0.24);
        background: rgba(2, 6, 23, 0.45);
        padding: 0.85rem;
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border-radius: 999px;
        border: 1px solid rgba(129, 140, 248, 0.45);
        background: rgba(30, 41, 59, 0.82);
        color: #c7d2fe;
        padding: 0.35rem 0.7rem;
        font-size: 0.8rem;
        margin-bottom: 0.7rem;
      }

      .actions-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .primary-button,
      .secondary-button,
      .copy-button,
      .open-link {
        appearance: none;
        border: none;
        cursor: pointer;
        border-radius: 999px;
        padding: 0.8rem 1.2rem;
        font-size: 0.92rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        text-decoration: none;
      }

      .primary-button {
        color: #fff;
        background-image: linear-gradient(135deg, #f97316, #ec4899, #6366f1);
        box-shadow: 0 16px 40px rgba(79, 70, 229, 0.45);
      }

      .secondary-button,
      .copy-button,
      .open-link {
        color: #e5e7eb;
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(129, 140, 248, 0.45);
      }

      .result-title {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 0.5rem;
      }

      .result-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .badge {
        border-radius: 999px;
        padding: 0.35rem 0.7rem;
        font-size: 0.78rem;
        border: 1px solid rgba(129, 140, 248, 0.55);
        color: #c7d2fe;
        background: rgba(30, 41, 59, 0.72);
      }

      .player-link-list {
        display: grid;
        gap: 0.85rem;
      }

      .player-link-card {
        border-radius: 0.95rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(2, 6, 23, 0.5);
        padding: 0.9rem;
      }

      .player-link-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 0.65rem;
      }

      .player-name {
        font-size: 0.95rem;
        font-weight: 700;
      }

      .player-url {
        width: 100%;
        box-sizing: border-box;
        padding: 0.75rem 0.85rem;
        border-radius: 0.8rem;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(71, 85, 105, 0.9);
        color: #cbd5e1;
        font-size: 0.82rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 0.7rem;
        direction: ltr;
      }

      .player-actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .status {
        margin-top: 0.8rem;
        font-size: 0.82rem;
        color: #a5b4fc;
      }

      .helper-card {
        border-radius: 1rem;
        padding: 1rem;
        background: rgba(2, 6, 23, 0.45);
        border: 1px dashed rgba(148, 163, 184, 0.28);
        color: #94a3b8;
        font-size: 0.86rem;
      }

      @media (max-width: 720px) {
        .card {
          padding: 1.25rem;
        }

        .grid,
        .players-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LinkCreatorComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly gameSessions = inject(GameSessionService);

  readonly playerCount = signal(2);
  readonly difficulty = signal<CreatorDifficulty>('any');
  readonly durationMinutes = signal(2);
  // This value is in seconds; default to 5 seconds.
  readonly startBufferMinutes = signal(5);
  readonly startAt = signal<number | null>(null);
  readonly createdAt = signal<number | null>(null);
  readonly inviteLink = signal<PlayerLink | null>(null);
  readonly copyStatus = signal<string | null>(null);
  readonly isCreating = signal(false);

  private origin(): string {
    return typeof window !== 'undefined' && window.location ? window.location.origin : '';
  }

  readonly startTimeLabel = computed(() => {
    const startAt = this.startAt();
    if (!startAt) {
      return null;
    }
    return new Date(startAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  });
  readonly inviteLinkText = computed(() => this.inviteLink()?.link ?? '');

  // Values are in seconds; start from 5 seconds.
  readonly bufferOptions = [5, 10, 15, 20, 30, 45, 60];
  readonly durationOptions = [0.5, 1, ...Array.from({ length: 9 }, (_, index) => index + 2)];
  readonly difficultyOptions: CreatorDifficulty[] = ['any', 'easy', 'medium', 'hard'];

  formatDurationOption(minutes: number): string {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)} seconds`;
    }

    if (minutes === 1) {
      return '60 seconds';
    }

    return `${minutes} minutes`;
  }

  updatePlayerCount(rawValue: number | string): void {
    const nextCount = Math.max(1, Math.min(8, Number(rawValue) || 1));
    this.playerCount.set(nextCount);
    this.inviteLink.set(null);
    this.copyStatus.set(null);
  }

  updateDifficulty(value: CreatorDifficulty): void {
    this.difficulty.set(value);
    this.inviteLink.set(null);
    this.copyStatus.set(null);
  }

  updateDuration(rawValue: number | string): void {
    this.durationMinutes.set(Number(rawValue));
    this.inviteLink.set(null);
    this.copyStatus.set(null);
  }

  updateStartBuffer(rawValue: number | string): void {
    this.startBufferMinutes.set(Number(rawValue));
    this.inviteLink.set(null);
    this.copyStatus.set(null);
  }

  private shortenLink(link: string): string {
    if (link.length <= 72) {
      return link;
    }
    return `${link.slice(0, 34)}...${link.slice(-22)}`;
  }

  createLobbyLink(): void {
    if (this.isCreating()) {
      return;
    }

    this.isCreating.set(true);
    this.copyStatus.set(null);

    const dataUrl = '/assets/sudoku.json';
    this.http.get<PuzzleAssetEntry[]>(dataUrl).subscribe({
      next: (puzzles) => {
        if (!Array.isArray(puzzles) || puzzles.length === 0) {
          this.inviteLink.set(null);
          this.copyStatus.set('No puzzles are available locally.');
          this.isCreating.set(false);
          return;
        }

        const puzzleIndex = this.choosePuzzleIndex(puzzles);
        this.createLobbyLinkWithPuzzleId(String(puzzleIndex)).catch((error) => {
          console.error('Failed to create local game session', error);
          this.inviteLink.set(null);
          this.copyStatus.set('Unable to create a game session. Please try again.');
          this.isCreating.set(false);
        });
      },
      error: (error) => {
        console.error('Failed to load local puzzle list', {
          dataUrl,
          error,
        });
        this.inviteLink.set(null);
        this.copyStatus.set('Unable to load local puzzles. Please try again.');
        this.isCreating.set(false);
      },
    });
  }

  private choosePuzzleIndex(puzzles: PuzzleAssetEntry[]): number {
    const difficulty = this.difficulty();
    if (difficulty === 'any') {
      return Math.floor(Math.random() * puzzles.length);
    }

    const difficultyIndex = ['easy', 'medium', 'hard'].indexOf(difficulty);
    const matchingIndexes = puzzles
      .map((puzzle, index) => ({ puzzle, index }))
      .filter(({ puzzle }) => {
        if (Array.isArray(puzzle)) {
          return puzzle.at(-1) === difficultyIndex;
        }

        return puzzle.difficulty === difficulty;
      })
      .map(({ index }) => index);
    const source = matchingIndexes.length ? matchingIndexes : puzzles.map((_, index) => index);
    return source[Math.floor(Math.random() * source.length)];
  }

  private async createLobbyLinkWithPuzzleId(puzzleId: string): Promise<void> {
    const createdAt = Date.now();
    const startAt = createdAt + this.startBufferMinutes() * 1000;
    const origin = this.origin();
    const difficulty = this.difficulty();
    const session = await this.gameSessions.createSession({
      puzzleId,
      maxPlayers: this.playerCount(),
      durationMinutes: this.durationMinutes(),
      startAt,
      difficulty: difficulty === 'any' ? undefined : difficulty,
    });

    const route = this.router.serializeUrl(this.router.createUrlTree(['/lobby', session.id]));
    this.createdAt.set(createdAt);
    this.startAt.set(startAt);
    this.inviteLink.set({
      route,
      link: `${origin}${route}`,
      shortLink: this.shortenLink(`${origin}${route}`),
    });
    this.copyStatus.set(null);
    this.isCreating.set(false);

    console.log('Created multiplayer Sudoku lobby', {
      sessionId: session.id,
      durationMinutes: this.durationMinutes(),
      maxPlayers: this.playerCount(),
      startAt: new Date(startAt).toISOString(),
    });
  }

  async copyInviteLink(): Promise<void> {
    const text = this.inviteLinkText();
    if (!text) {
      return;
    }

    try {
      if (navigator && 'clipboard' in navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error('execCommand copy returned false');
        }
      }

      this.copyStatus.set('Copied lobby link for sharing.');
    } catch (error) {
      this.copyStatus.set('Could not copy the lobby link.');
      console.error('Failed to copy lobby link', error);
    }
  }

  async copyPlayerLink(link: string): Promise<void> {
    try {
      if (navigator && 'clipboard' in navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error('execCommand copy returned false');
        }
      }

      this.copyStatus.set('Copied lobby link.');
    } catch (error) {
      this.copyStatus.set('Could not copy the lobby link.');
      console.error('Failed to copy lobby link', error);
    }
  }
}
