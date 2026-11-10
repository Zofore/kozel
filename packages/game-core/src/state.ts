import { Card, Suit } from './card';

export type Side = 'A' | 'B';
export type PlayerId = 0 | 1 | 2 | 3;

export interface PlayerState {
  id: PlayerId;
  side: Side;
  hand: Card[];
  name: string;
  connected?: boolean;
}

export interface TrickState {
  attacker: PlayerId;
  attackCards: Card[];
  attackLength: number;
  topCards: Card[];
  topPlayer: PlayerId;
  cardsOnTable: Card[];
  respondent: PlayerId; // Кто должен ответить
  required: number;     // Сколько карт нужно положить
}

export interface GameState {
  mode: '1v1' | '2v2';
  players: PlayerState[];
  deck: Card[];
  trumpCard: Card | null;
  trump: Suit | null;
  trumpChanged: boolean;
  trumpChangeEvent: { player: PlayerId; card: Card } | null;
  currentPlayer: PlayerId;
  trick: TrickState | null;
  lastTrickWinner: PlayerId | null;
  phase: 'waiting' | 'dice-roll' | 'playing' | 'round-scored' | 'paused' | 'finished' | 'abandoned';
  matchScore: Record<Side, number>;
  multiplier: number;
  roundNumber: number;
  bita: Record<Side, Card[]>;
  lastRoundPoints: Record<Side, number> | null;
  diceRolls: Partial<Record<PlayerId, number>> | null;
  // Новые поля для синхронизации
  stateVersion: number;
  turnDeadline: number | null;
}

// --- ТО, ЧТО ВИДИТ КЛИЕНТ ---
export interface PublicPlayer {
  id: PlayerId;
  side: Side;
  name: string;
  handCount: number;
  connected: boolean;
}

export interface PlayerView {
  mode: GameState['mode'];
  me: PlayerId;
  hand: Card[];              // Только свои карты
  players: PublicPlayer[];   // У остальных — только счётчик
  deckCount: number;         // Не сам deck
  trumpCard: Card | null;
  trump: Suit | null;
  trumpChanged: boolean;
  trumpChangeEvent: GameState['trumpChangeEvent'];
  currentPlayer: PlayerId;
  trick: TrickState | null;
  lastTrickWinner: PlayerId | null;
  phase: GameState['phase'];
  matchScore: Record<Side, number>;
  multiplier: number;
  roundNumber: number;
  bitaCount: Record<Side, number>; // Только количество карт в бите
  lastRoundPoints: Record<Side, number> | null;
  diceRolls: Partial<Record<PlayerId, number>> | null;
  legalMoves: string[][];    // Подсказки ходов (строки карт)
  stateVersion: number;
  turnDeadline: number | null;
}