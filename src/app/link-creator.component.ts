import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameSessionService, type Difficulty as SessionDifficulty } from './game-session.service';

type PlayerLink = {
  route: string;
  link: string;
  shortLink: string;
};

type CreatorDifficulty = 'any' | SessionDifficulty;

@Component({
  selector: 'app-link-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        box-sizing: border-box;
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

      .primary-button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        box-shadow: none;
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
        overflow-wrap: anywhere;
        word-break: break-word;
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
        :host {
          padding: 0.85rem;
        }

        .card {
          padding: 1.25rem;
        }

        .grid,
        .players-grid {
          grid-template-columns: 1fr;
        }

        .actions-row > * {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .card {
          padding: 1rem;
          border-radius: 1rem;
        }

        .title {
          font-size: 1.45rem;
        }

        .field,
        .result-card,
        .helper-card {
          padding: 0.85rem;
        }

        .player-link-head {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class LinkCreatorComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly gameSessions = inject(GameSessionService);
  private cooldownTimer: number | null = null;

  private static readonly CREATE_COOLDOWN_SECONDS = 15;

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
  readonly createCooldownSeconds = signal(0);

  readonly canCreateLobby = computed(
    () => !this.isCreating() && this.createCooldownSeconds() === 0,
  );
  readonly createButtonLabel = computed(() => {
    if (this.isCreating()) {
      return 'Creating lobby...';
    }

    const cooldown = this.createCooldownSeconds();
    if (cooldown > 0) {
      return `Create lobby link (${cooldown}s)`;
    }

    return 'Create lobby link';
  });

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

  ngOnDestroy(): void {
    this.clearCreateCooldown();
  }

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
    if (!this.canCreateLobby()) {
      return;
    }

    this.isCreating.set(true);
    this.copyStatus.set(null);

    this.createLobbyLinkOnServer().catch((error) => {
      console.error('Failed to create game lobby', error);
      this.inviteLink.set(null);
      this.copyStatus.set('Unable to create a game lobby. Is the API server running?');
      this.isCreating.set(false);
    });
  }

  private async createLobbyLinkOnServer(): Promise<void> {
    const origin = this.origin();
    const difficulty = this.difficulty();
    const session = await this.gameSessions.createSession({
      maxPlayers: this.playerCount(),
      durationMinutes: this.durationMinutes(),
      startBufferSeconds: this.startBufferMinutes(),
      difficulty: difficulty === 'any' ? undefined : difficulty,
    });

    const route = this.router.serializeUrl(this.router.createUrlTree(['/lobby', session.id]));
    this.createdAt.set(session.createdAt);
    this.startAt.set(session.startAt);
    this.inviteLink.set({
      route,
      link: `${origin}${route}`,
      shortLink: this.shortenLink(`${origin}${route}`),
    });
    this.copyStatus.set(null);
    this.isCreating.set(false);
    this.startCreateCooldown();

    console.log('Created multiplayer Sudoku lobby', {
      sessionId: session.id,
      durationMinutes: this.durationMinutes(),
      maxPlayers: this.playerCount(),
      startAt: new Date(session.startAt).toISOString(),
    });
  }

  private startCreateCooldown(): void {
    this.clearCreateCooldown();
    this.createCooldownSeconds.set(LinkCreatorComponent.CREATE_COOLDOWN_SECONDS);

    if (typeof window === 'undefined') {
      return;
    }

    this.cooldownTimer = window.setInterval(() => {
      const nextValue = this.createCooldownSeconds() - 1;
      if (nextValue <= 0) {
        this.createCooldownSeconds.set(0);
        this.clearCreateCooldown();
        return;
      }

      this.createCooldownSeconds.set(nextValue);
    }, 1000);
  }

  private clearCreateCooldown(): void {
    if (this.cooldownTimer != null) {
      window.clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
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
