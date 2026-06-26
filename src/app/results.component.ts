import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameSessionService, type GameSession, type ScoreboardEntry } from './game-session.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="shell">
      <div class="card">
        <div class="eyebrow">Final Results</div>
        <h1 class="title">Sudoku scoreboard</h1>
        <p class="subtitle" *ngIf="sessionSummary() as summary">
          {{ summary }}
        </p>

        <p class="error" *ngIf="error() as error">{{ error }}</p>

        <div class="list" *ngIf="results().length">
          @for (entry of results(); track entry.playerName; let index = $index) {
            <div class="row">
              <div class="rank">#{{ index + 1 }}</div>
              <div class="name">{{ entry.playerName }}</div>
              <div class="score">{{ entry.score }}</div>
            </div>
          }
        </div>

        <p class="empty" *ngIf="!error() && !results().length">
          No scores have been recorded for this browser yet.
        </p>

        <div class="actions">
          <a routerLink="/">Create another game</a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        justify-content: center;
        min-height: 100dvh;
        background: radial-gradient(circle at top, #020617 0, #000 60%);
        color: #e5e7eb;
        padding: 1.5rem;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
      }

      .shell {
        width: 100%;
        max-width: 760px;
      }

      .card {
        border-radius: 1.25rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.75);
        padding: 1.5rem;
      }

      .eyebrow {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #94a3b8;
        margin-bottom: 0.5rem;
      }

      .title {
        margin: 0 0 0.35rem;
        font-size: 1.8rem;
      }

      .subtitle,
      .empty {
        color: #94a3b8;
      }

      .error {
        color: #fecaca;
      }

      .list {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .row {
        display: grid;
        grid-template-columns: 64px 1fr auto;
        gap: 0.8rem;
        align-items: center;
        padding: 0.9rem 1rem;
        border-radius: 0.95rem;
        background: rgba(2, 6, 23, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }

      .rank {
        color: #c7d2fe;
        font-weight: 700;
      }

      .name {
        font-weight: 600;
      }

      .score {
        font-size: 1.15rem;
        font-weight: 700;
      }

      .actions {
        margin-top: 1rem;
      }

      .actions a {
        color: #a5b4fc;
        text-decoration: none;
      }
    `,
  ],
})
export class ResultsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly gameSessions = inject(GameSessionService);
  private scoreboardSubscription: Subscription | null = null;

  readonly error = signal<string | null>(null);
  readonly session = signal<GameSession | null>(null);
  readonly results = signal<ScoreboardEntry[]>([]);
  readonly sessionSummary = computed(() => {
    const currentSession = this.session();
    if (!currentSession) {
      return null;
    }

    const difficulty = currentSession.difficulty ?? 'medium';
    const totalPlayers = currentSession.maxPlayers;
    const duration = currentSession.durationMinutes;
    return `${totalPlayers} players • ${difficulty} • ${this.formatDuration(duration)}`;
  });

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      this.error.set('Missing session id.');
      return;
    }

    void this.loadSession(sessionId);
    this.loadResults(sessionId);
  }

  ngOnDestroy(): void {
    this.scoreboardSubscription?.unsubscribe();
  }

  private async loadSession(sessionId: string): Promise<void> {
    try {
      const session = await this.gameSessions.getSession(sessionId);
      if (!session) {
        this.error.set('Results are not available for this game session.');
        return;
      }

      this.session.set(session);
    } catch (error) {
      console.error('Failed to load session for results', error);
      this.error.set('Could not load the results page.');
    }
  }

  private formatDuration(minutes: number): string {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)} seconds`;
    }

    if (minutes === 1) {
      return '60 seconds';
    }

    return `${minutes} minutes`;
  }

  private loadResults(sessionId: string): void {
    this.scoreboardSubscription = this.gameSessions.watchScoreboard(sessionId)
      .subscribe({
        next: (results) => this.results.set(results),
        error: (error) => {
          console.error('Failed to load shared results', error);
          this.error.set('Could not load results for this game.');
        },
      });
  }
}
