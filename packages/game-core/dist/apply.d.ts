import { GameState, PlayerId } from './state';
import { Card } from './card';
export type GameEvent = {
    type: 'START_ROUND';
    firstPlayer: PlayerId;
    seed?: number;
} | {
    type: 'ATTACK';
    player: PlayerId;
    cards: Card[];
} | {
    type: 'BEAT';
    player: PlayerId;
    cards: Card[];
} | {
    type: 'PASS';
    player: PlayerId;
    cards: Card[];
} | {
    type: 'DRAW';
    winner: PlayerId;
} | {
    type: 'SCORE_ROUND';
};
export type RuleError = 'NOT_YOUR_TURN' | 'WRONG_PHASE' | 'CARD_NOT_IN_HAND' | 'DUPLICATE_CARDS' | 'ILLEGAL_SET' | 'CANNOT_BEAT' | 'WRONG_COUNT' | 'NO_TRICK' | 'TRICK_EXISTS';
export type ApplyResult = {
    ok: true;
    state: GameState;
} | {
    ok: false;
    error: RuleError;
};
export declare function applyEvent(state: GameState, event: GameEvent): ApplyResult;
