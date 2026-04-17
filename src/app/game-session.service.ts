import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type GameSessionStatus = 'lobby' | 'running' | 'finished';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameSessionPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  joinedAt: number;
  updatedAt: number;
};

export type GameSession = {
  id: string;
  hostPlayerId: string;
  puzzleId: string;
  difficulty?: Difficulty;
  maxPlayers: number;
  durationMinutes: number;
  status: GameSessionStatus;
  startAt: number | null;
  createdAt: number;
  updatedAt: number;
  players: GameSessionPlayer[];
};

export type CreateGameSessionInput = {
  puzzleId: string;
  maxPlayers: number;
  durationMinutes: number;
  startAt: number | null;
  players?: Array<{
    id?: string;
    name: string;
    isHost?: boolean;
  }>;
  difficulty?: Difficulty;
};

export type JoinGameSessionInput = {
  sessionId: string;
  playerId?: string;
  playerName: string;
  isHost?: boolean;
};

export type ScoreboardEntry = {
  playerName: string;
  score: number;
  updatedAt: number;
};

export abstract class GameSessionService {
  abstract createSession(input: CreateGameSessionInput): Promise<GameSession>;
  abstract getSession(sessionId: string): Promise<GameSession | null>;
  abstract watchSession(sessionId: string): Observable<GameSession | null>;
  abstract joinSession(input: JoinGameSessionInput): Promise<GameSessionPlayer>;
  abstract startSession(sessionId: string, startAt: number): Promise<GameSession | null>;
  abstract finishSession(sessionId: string): Promise<GameSession | null>;
  abstract updatePlayerScore(
    sessionId: string,
    playerName: string,
    score: number,
  ): Promise<void>;
  abstract getScoreboard(sessionId: string): Promise<ScoreboardEntry[]>;
  abstract watchScoreboard(sessionId: string): Observable<ScoreboardEntry[]>;
}

@Injectable()
export class LocalGameSessionService extends GameSessionService {
  private readonly sessionPrefix = 'sudokofest:sessions:';
  private readonly scorePrefix = 'sudokofest:session:';

  async createSession(input: CreateGameSessionInput): Promise<GameSession> {
    const now = Date.now();
    const sessionId = this.createId('game');
    const inputPlayers = input.players ?? [];
    const hostPlayer = inputPlayers.find((player) => player.isHost) ?? inputPlayers[0];
    const hostPlayerId = hostPlayer?.id ?? this.createId('player');
    const players = inputPlayers.map((player, index) => ({
      id: player.id ?? (index === 0 ? hostPlayerId : this.createId('player')),
      name: player.name,
      isHost: player.isHost ?? index === 0,
      score: 0,
      joinedAt: now,
      updatedAt: now,
    }));

    const session: GameSession = {
      id: sessionId,
      hostPlayerId,
      puzzleId: input.puzzleId,
      difficulty: input.difficulty,
      maxPlayers: input.maxPlayers,
      durationMinutes: input.durationMinutes,
      status: input.startAt && input.startAt <= now ? 'running' : 'lobby',
      startAt: input.startAt,
      createdAt: now,
      updatedAt: now,
      players,
    };

    this.saveSession(session);
    await Promise.all(players.map((player) => this.updatePlayerScore(session.id, player.name, 0)));

    return session;
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    return this.readSession(sessionId);
  }

  watchSession(sessionId: string): Observable<GameSession | null> {
    return new Observable((subscriber) => {
      const emit = () => subscriber.next(this.readSession(sessionId));
      emit();

      if (typeof window === 'undefined') {
        return undefined;
      }

      const intervalId = window.setInterval(emit, 1000);
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `${this.sessionPrefix}${sessionId}`) {
          emit();
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener('storage', handleStorage);
      };
    });
  }

  async joinSession(input: JoinGameSessionInput): Promise<GameSessionPlayer> {
    const session = this.readSession(input.sessionId);
    if (!session) {
      throw new Error(`Game session ${input.sessionId} was not found.`);
    }

    const now = Date.now();
    const existingPlayer = session.players.find((player) => player.name === input.playerName);
    if (existingPlayer) {
      return existingPlayer;
    }

    if (session.players.length >= session.maxPlayers) {
      throw new Error('This lobby is full.');
    }

    const player: GameSessionPlayer = {
      id: input.playerId ?? this.createId('player'),
      name: input.playerName,
      isHost: input.isHost ?? session.players.length === 0,
      score: 0,
      joinedAt: now,
      updatedAt: now,
    };

    const nextSession = {
      ...session,
      updatedAt: now,
      players: [...session.players, player],
    };

    this.saveSession(nextSession);
    await this.updatePlayerScore(session.id, player.name, player.score);
    return player;
  }

  async startSession(sessionId: string, startAt: number): Promise<GameSession | null> {
    return this.updateSession(sessionId, {
      status: 'running',
      startAt,
    });
  }

  async finishSession(sessionId: string): Promise<GameSession | null> {
    return this.updateSession(sessionId, {
      status: 'finished',
    });
  }

  async updatePlayerScore(
    sessionId: string,
    playerName: string,
    score: number,
  ): Promise<void> {
    if (!sessionId || typeof localStorage === 'undefined') {
      return;
    }

    const session = this.readSession(sessionId);
    if (session) {
      const now = Date.now();
      this.saveSession({
        ...session,
        updatedAt: now,
        players: session.players.map((player) =>
          player.name === playerName
            ? {
                ...player,
                score,
                updatedAt: now,
              }
            : player,
        ),
      });
    }

    const key = `${this.scorePrefix}${sessionId}`;
    const entries = this.readScoreEntries(key);
    const nextEntries = entries.filter((entry) => entry.playerName !== playerName);
    nextEntries.push({
      playerName,
      score,
      updatedAt: Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(nextEntries));
  }

  async getScoreboard(sessionId: string): Promise<ScoreboardEntry[]> {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const session = this.readSession(sessionId);
    const scoresFromSession =
      session?.players.map((player) => ({
        playerName: player.name,
        score: player.score,
        updatedAt: player.updatedAt,
      })) ?? [];
    const storedScores = this.readScoreEntries(`${this.scorePrefix}${sessionId}`);
    const merged = new Map<string, ScoreboardEntry>();

    for (const entry of [...scoresFromSession, ...storedScores]) {
      const previous = merged.get(entry.playerName);
      if (!previous || entry.updatedAt >= previous.updatedAt) {
        merged.set(entry.playerName, entry);
      }
    }

    return [...merged.values()].sort(
      (a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName),
    );
  }

  watchScoreboard(sessionId: string): Observable<ScoreboardEntry[]> {
    return new Observable((subscriber) => {
      const emit = () => {
        this.getScoreboard(sessionId)
          .then((scoreboard) => subscriber.next(scoreboard))
          .catch((error) => subscriber.error(error));
      };
      emit();

      if (typeof window === 'undefined') {
        return undefined;
      }

      const intervalId = window.setInterval(emit, 1000);
      const handleStorage = (event: StorageEvent) => {
        if (
          event.key === `${this.sessionPrefix}${sessionId}` ||
          event.key === `${this.scorePrefix}${sessionId}`
        ) {
          emit();
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener('storage', handleStorage);
      };
    });
  }

  private updateSession(
    sessionId: string,
    patch: Pick<Partial<GameSession>, 'status' | 'startAt'>,
  ): GameSession | null {
    const session = this.readSession(sessionId);
    if (!session) {
      return null;
    }

    const nextSession = {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
    this.saveSession(nextSession);
    return nextSession;
  }

  private readSession(sessionId: string): GameSession | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(`${this.sessionPrefix}${sessionId}`);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as GameSession;
    } catch {
      return null;
    }
  }

  private saveSession(session: GameSession): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(`${this.sessionPrefix}${session.id}`, JSON.stringify(session));
  }

  private readScoreEntries(key: string): ScoreboardEntry[] {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as ScoreboardEntry[];
    } catch {
      return [];
    }
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
