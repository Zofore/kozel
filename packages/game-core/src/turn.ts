import { passCardCount } from './trick';
import { applyEvent, ApplyResult, GameEvent } from './apply';
import { GameState } from './state';
import { chooseBotMove, chooseBotDiscard, BotDifficulty } from './bot';
import { getLegalMoves } from './legalMoves';

export function applyTurn(state: GameState, event: GameEvent): ApplyResult {
  const result = applyEvent(state, event);
  if (result.ok && event.type === 'PASS' && result.state.lastTrickWinner !== null) {
    return applyEvent(result.state, { type: 'DRAW', winner: result.state.lastTrickWinner });
  }
  return result;
}
export function automaticTurn(state: GameState, preferBeat = false, difficulty?: BotDifficulty): ApplyResult {
  const player = state.currentPlayer;
  const move = difficulty ? chooseBotMove(state, difficulty) : getLegalMoves(state, player)[0]?.map(k => state.players[player].hand.find(c => `${c.rank}_${c.suit}` === k)!).filter(Boolean);
  if (move && (!state.trick || preferBeat)) {
    return applyTurn(state, { type: state.trick ? 'BEAT' : 'ATTACK', player, cards: move });
  }
  if (state.trick) return applyTurn(state, { type: 'PASS', player, cards: difficulty ? chooseBotDiscard(state, difficulty) : state.players[player].hand.slice(0, passCardCount(state.mode, state.trick, player, state.players[player].hand.length)) });
  return { ok: false, error: 'ILLEGAL_SET' };
}
