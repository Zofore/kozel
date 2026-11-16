import { GameState, PlayerId } from './state';
import { Card } from './card';
import { applyEvent } from './apply';

export function getLegalMoves(state: GameState, playerId: PlayerId): string[][] {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return [];
  const hand = state.players[playerId]?.hand || [];
  const moves: string[][] = [];
  function visit(start: number, cards: Card[]) {
    if (cards.length) {
      const result = applyEvent(state, { type: state.trick ? 'BEAT' : 'ATTACK', player: playerId, cards });
      if (result.ok) moves.push(cards.map(c => `${c.rank}_${c.suit}`));
    }
    for (let i = start; i < hand.length; i++) visit(i + 1, [...cards, hand[i]]);
  }
  visit(0, []);
  return moves;
}
