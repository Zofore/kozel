import { GameState, PlayerId } from './state';
import { Card } from './card';
import { canBeat } from './trick';

export function getLegalMoves(state: GameState, playerId: PlayerId): string[][] {
  if (state.phase !== 'playing') return [];
  const me = state.players[playerId];
  if (!me) return [];
  const hand = me.hand;
  
  const serialize = (cards: Card[]) => cards.map(c => `${c.rank}_${c.suit}`);

  // 1. Ход без взятки (Атака)
  if (!state.trick && state.currentPlayer === playerId) {
    const opponent = state.players[(playerId + 1) % state.players.length];
    const maxCards = opponent.hand.length || 1;
    const moves: string[][] = [];
    hand.forEach(c => moves.push(serialize([c])));
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        if (hand[i].suit === hand[j].suit && maxCards >= 2) moves.push(serialize([hand[i], hand[j]]));
      }
    }
    return moves;
  }

  // 2. Перебитие (Есть взятка, и сейчас мой ход — неважно, защищаюсь я или перебиваю)
  if (state.trick && state.currentPlayer === playerId) {
    const required = state.trick.required;
    const top = state.trick.topCards;
    const moves: string[][] = [];
    
    if (required === 1) {
      hand.forEach(c => { if (canBeat([c], top, state.trump!)) moves.push(serialize([c])); });
    }
    if (required === 2) {
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          if (hand[i].suit === hand[j].suit && canBeat([hand[i], hand[j]], top, state.trump!)) {
            moves.push(serialize([hand[i], hand[j]]));
          }
        }
      }
    }
    return moves;
  }

  return [];
}