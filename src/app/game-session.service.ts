import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export type GameSessionStatus = 'lobby' | 'running' | 'finished' | 'cancelled';
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
  hostPlayerId: string | null;
  puzzleId: string;
  difficulty?: Difficulty;
  maxPlayers: number;
  durationMinutes: number;
  status: GameSessionStatus;
  startAt: number;
  createdAt: number;
  updatedAt: number;
  players: GameSessionPlayer[];
};

export type CreateGameSessionInput = {
  maxPlayers: number;
  durationMinutes: number;
  startBufferSeconds: number;
  difficulty?: Difficulty;
};

export type JoinGameSessionInput = {
  sessionId: string;
  playerName: string;
};

export type PuzzleResponse = {
  puzzleId: string;
  puzzle: string;
  difficulty: Difficulty;
  currentValues: string[] | null;
  lockedCells: boolean[] | null;
};

export type SubmitMoveInput = {
  sessionId: string;
  playerId: string;
  cellIndex: number;
  value: string;
  clientMoveId: string;
};

export type MoveResult = {
  clientMoveId: string;
  accepted: boolean;
  isCorrect: boolean;
  scoreDelta: number;
  score: number;
  lockedCell: {
    cellIndex: number;
    value: string;
  } | null;
};

export type ScoreboardEntry = {
  playerName: string;
  score: number;
  updatedAt: number;
};

type ServerEvent =
  | {
      type: 'connected';
      sessionId: string;
    }
  | {
      type: 'session_updated';
      session: GameSession;
    }
  | {
      type: 'scoreboard_updated';
      scoreboard: ScoreboardEntry[];
    };

export abstract class GameSessionService {
  abstract createSession(input: CreateGameSessionInput): Promise<GameSession>;
  abstract getSession(sessionId: string): Promise<GameSession | null>;
  abstract watchSession(sessionId: string): Observable<GameSession | null>;
  abstract joinSession(input: JoinGameSessionInput): Promise<GameSessionPlayer>;
  abstract getPuzzle(sessionId: string, playerId: string): Promise<PuzzleResponse>;
  abstract submitMove(input: SubmitMoveInput): Promise<MoveResult>;
  abstract getScoreboard(sessionId: string): Promise<ScoreboardEntry[]>;
  abstract watchScoreboard(sessionId: string): Observable<ScoreboardEntry[]>;
}

@Injectable()
export class RemoteGameSessionService extends GameSessionService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly socketBaseUrl = this.apiBaseUrl
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://')
    .replace(/\/api$/, '');

  createSession(input: CreateGameSessionInput): Promise<GameSession> {
    return firstValue(this.http.post<GameSession>(`${this.apiBaseUrl}/sessions`, input));
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    try {
      return await firstValue(this.http.get<GameSession>(`${this.apiBaseUrl}/sessions/${sessionId}`));
    } catch {
      return null;
    }
  }

  watchSession(sessionId: string): Observable<GameSession | null> {
    return new Observable((subscriber) => {
      let closed = false;

      this.getSession(sessionId)
        .then((session) => {
          if (!closed) {
            subscriber.next(session);
          }
        })
        .catch((error) => subscriber.error(error));

      const socket = this.openSocket(sessionId);
      socket.onmessage = (event) => {
        const message = parseServerEvent(event.data);
        if (message?.type === 'session_updated') {
          subscriber.next(message.session);
        }
      };
      socket.onerror = () => subscriber.error(new Error('Session socket failed'));

      return () => {
        closed = true;
        socket.close();
      };
    });
  }

  joinSession(input: JoinGameSessionInput): Promise<GameSessionPlayer> {
    return firstValue(
      this.http.post<GameSessionPlayer>(
        `${this.apiBaseUrl}/sessions/${input.sessionId}/join`,
        {
          playerName: input.playerName,
        },
      ),
    );
  }

  getPuzzle(sessionId: string, playerId: string): Promise<PuzzleResponse> {
    return firstValue(
      this.http.get<PuzzleResponse>(`${this.apiBaseUrl}/sessions/${sessionId}/puzzle`, {
        params: {
          playerId,
        },
      }),
    );
  }

  submitMove(input: SubmitMoveInput): Promise<MoveResult> {
    return firstValue(
      this.http.post<MoveResult>(`${this.apiBaseUrl}/sessions/${input.sessionId}/moves`, {
        playerId: input.playerId,
        cellIndex: input.cellIndex,
        value: input.value,
        clientMoveId: input.clientMoveId,
      }),
    );
  }

  getScoreboard(sessionId: string): Promise<ScoreboardEntry[]> {
    return firstValue(
      this.http.get<ScoreboardEntry[]>(`${this.apiBaseUrl}/sessions/${sessionId}/scoreboard`),
    );
  }

  watchScoreboard(sessionId: string): Observable<ScoreboardEntry[]> {
    return new Observable((subscriber) => {
      let closed = false;

      this.getScoreboard(sessionId)
        .then((scoreboard) => {
          if (!closed) {
            subscriber.next(scoreboard);
          }
        })
        .catch((error) => subscriber.error(error));

      const socket = this.openSocket(sessionId);
      socket.onmessage = (event) => {
        const message = parseServerEvent(event.data);
        if (message?.type === 'scoreboard_updated') {
          subscriber.next(message.scoreboard);
        }
      };
      socket.onerror = () => subscriber.error(new Error('Scoreboard socket failed'));

      return () => {
        closed = true;
        socket.close();
      };
    });
  }

  private openSocket(sessionId: string): WebSocket {
    return new WebSocket(`${this.socketBaseUrl}/ws/${sessionId}`);
  }
}

function firstValue<T>(observable: Observable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = observable.subscribe({
      next: (value) => {
        resolve(value);
        subscription.unsubscribe();
      },
      error: reject,
    });
  });
}

function parseServerEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    return JSON.parse(raw) as ServerEvent;
  } catch {
    return null;
  }
}
