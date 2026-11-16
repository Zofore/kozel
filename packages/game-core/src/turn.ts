import { applyEvent, ApplyResult, GameEvent } from './apply';
import { GameState } from './state';
import { getLegalMoves } from './legalMoves';

export function applyTurn(state: GameState, event: GameEvent): ApplyResult {
  const result = applyEvent(state, event);
  if (result.ok && event.type === 'PASS' && result.state.lastTrickWinner !== null) {
    return applyEvent(result.state, { type: 'DRAW', winner: result.state.lastTrickWinner });
  }
  return result;
}
export function automaticTurn(state: GameState, preferBeat = false): ApplyResult {
  const player = state.currentPlayer;
  const hand = state.players[player].hand;
  const move = getLegalMoves(state, player)[0];
  if (move && (!state.trick || preferBeat)) {
    return applyTurn(state, { type: state.trick ? 'BEAT' : 'ATTACK', player, cards: hand.filter(c => move.includes(`${c.rank}_${c.suit}`)) });
  }
  if (state.trick) return applyTurn(state, { type: 'PASS', player, cards: hand.slice(0, state.trick.required) });
  return { ok: false, error: 'ILLEGAL_SET' };
}
