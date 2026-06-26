import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameSessionService, type GameSession } from './game-session.service';
import { readPlayerSessionFor, savePlayerSession } from './player-session.storage';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card">
      <header>
        <div class="eyebrow">Game Lobby</div>
        <h1 class="title">Join SudokuFest</h1>
        <p class="subtitle" *ngIf="session() as currentSession">
          {{ currentSession.players.length }}/{{ currentSession.maxPlayers }} players •
          {{ formatDuration(currentSession.durationMinutes) }} •
          {{ currentSession.difficulty ?? 'any difficulty' }}
        </p>
      </header>

      <p class="error" *ngIf="error() as message">{{ message }}</p>

      <ng-container *ngIf="session() as currentSession">
        <section class="field">
          <label class="label" for="player-name">Your Name</label>
          <input
            id="player-name"
            class="input"
            type="text"
            [ngModel]="playerName()"
            (ngModelChange)="playerName.set($event)"
            placeholder="Enter player name"
            maxlength="32"
          />
          <p class="helper">
            First come, first served. The lobby accepts up to {{ currentSession.maxPlayers }} players.
          </p>
        </section>

        <section class="players">
          <div class="label">Joined Players</div>
          <div class="player-list" *ngIf="currentSession.players.length; else emptyLobby">
            @for (player of currentSession.players; track player.id; let index = $index) {
              <div class="player-row">
                <span>#{{ index + 1 }}</span>
                <strong>{{ player.name }}</strong>
                <small *ngIf="player.isHost">Host</small>
              </div>
            }
          </div>
          <ng-template #emptyLobby>
            <p class="helper">No players have joined yet.</p>
          </ng-template>
        </section>

        <div class="actions-row">
          <button class="primary-button" type="button" (click)="joinAndPlay()" [disabled]="isJoining()">
            {{ isJoining() ? 'Joining...' : 'Join and play' }}
          </button>
          <a class="secondary-button" routerLink="/">Create another lobby</a>
        </div>

        <section class="helper-card">
          The round uses the lobby timer and puzzle selected by the creator. Share this same lobby link
          with every player.
        </section>
      </ng-container>
    </section>
  `,
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
        max-width: 720px;
        background: rgba(15, 23, 42, 0.92);
        border-radius: 1.25rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.75);
        padding: 2rem;
        backdrop-filter: blur(18px);
      }

      .eyebrow,
      .label {
        display: block;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #94a3b8;
        margin-bottom: 0.55rem;
      }

      .title {
        font-size: 1.9rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        margin: 0 0 0.4rem;
      }

      .subtitle,
      .helper {
        color: #94a3b8;
        font-size: 0.9rem;
      }

      .field,
      .players,
      .helper-card {
        margin-top: 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.7);
        padding: 1rem;
      }

      .input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(129, 140, 248, 0.38);
        border-radius: 0.8rem;
        background: rgba(2, 6, 23, 0.82);
        color: #e5e7eb;
        padding: 0.8rem 0.9rem;
        font-size: 0.95rem;
      }

      .player-list {
        display: grid;
        gap: 0.65rem;
      }

      .player-row {
        display: grid;
        grid-template-columns: 3rem 1fr auto;
        align-items: center;
        gap: 0.75rem;
        border: 1px solid rgba(129, 140, 248, 0.24);
        border-radius: 0.85rem;
        background: rgba(2, 6, 23, 0.45);
        padding: 0.8rem;
      }

      .player-row small {
        border-radius: 999px;
        padding: 0.3rem 0.65rem;
        color: #c7d2fe;
        background: rgba(30, 41, 59, 0.82);
        border: 1px solid rgba(129, 140, 248, 0.45);
      }

      .actions-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }

      .primary-button,
      .secondary-button {
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
        text-decoration: none;
      }

      .primary-button {
        color: #fff;
        background-image: linear-gradient(135deg, #f97316, #ec4899, #6366f1);
        box-shadow: 0 16px 40px rgba(79, 70, 229, 0.45);
      }

      .primary-button:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      .secondary-button {
        color: #e5e7eb;
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(129, 140, 248, 0.45);
      }

      .error {
        color: #fecaca;
      }

      @media (max-width: 640px) {
        .card {
          padding: 1.25rem;
        }
      }
    `,
  ],
})
export class LobbyComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameSessions = inject(GameSessionService);
  private sessionSubscription: Subscription | null = null;

  readonly session = signal<GameSession | null>(null);
  readonly playerName = signal('');
  readonly error = signal<string | null>(null);
  readonly isJoining = signal(false);
  readonly canJoin = computed(() => {
    const session = this.session();
    return session != null && session.players.length < session.maxPlayers;
  });

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      this.error.set('Missing lobby id.');
      return;
    }

    void this.loadStoredPlayer(sessionId);

    this.sessionSubscription = this.gameSessions.watchSession(sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        if (!session) {
          this.error.set('Lobby was not found on this browser.');
          return;
        }
        this.error.set(null);
      },
      error: (error) => {
        console.error('Failed to watch lobby session', error);
        this.error.set('Could not load lobby.');
      },
    });
  }

  ngOnDestroy(): void {
    this.sessionSubscription?.unsubscribe();
  }

  private async loadStoredPlayer(sessionId: string): Promise<void> {
    const storedPlayer = await readPlayerSessionFor(sessionId);
    if (storedPlayer) {
      this.playerName.set(storedPlayer.playerName);
    }
  }

  async joinAndPlay(): Promise<void> {
    const session = this.session();
    const playerName = this.playerName().trim();

    if (!session) {
      this.error.set('Lobby is not available.');
      return;
    }

    if (!playerName) {
      this.error.set('Enter your player name first.');
      return;
    }

    if (!this.canJoin() && !session.players.some((player) => player.name === playerName)) {
      this.error.set('This lobby is full.');
      return;
    }

    this.isJoining.set(true);
    try {
      const player = await this.gameSessions.joinSession({
        sessionId: session.id,
        playerName,
      });

      if (!player.playerToken) {
        throw new Error('Server did not return a player session token.');
      }

      await savePlayerSession({
        sessionId: session.id,
        playerToken: player.playerToken,
      });

      await this.router.navigate(['/game', session.id]);
    } catch (error) {
      console.error('Failed to join lobby', error);
      this.error.set(error instanceof Error ? error.message : 'Could not join this lobby.');
    } finally {
      this.isJoining.set(false);
    }
  }

  formatDuration(minutes: number): string {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)} seconds`;
    }

    if (minutes === 1) {
      return '60 seconds';
    }

    return `${minutes} minutes`;
  }
}
