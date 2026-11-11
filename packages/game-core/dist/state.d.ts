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
    respondent: PlayerId;
    required: number;
}
export interface GameState {
    mode: '1v1' | '2v2';
    players: PlayerState[];
    deck: Card[];
    trumpCard: Card | null;
    trump: Suit | null;
    trumpChanged: boolean;
    trumpChangeEvent: {
        player: PlayerId;
        card: Card;
    } | null;
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
    stateVersion: number;
    turnDeadline: number | null;
    settled?: boolean;
    seed?: number;
}
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
    hand: Card[];
    players: PublicPlayer[];
    deckCount: number;
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
    bitaCount: Record<Side, number>;
    lastRoundPoints: Record<Side, number> | null;
    diceRolls: Partial<Record<PlayerId, number>> | null;
    legalMoves: string[][];
    stateVersion: number;
    turnDeadline: number | null;
}
