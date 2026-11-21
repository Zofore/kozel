import { passCardCount } from './trick';
import { Card, CARD_POINTS, RANK_VALUE, Suit } from './card';
import { GameState } from './state';
import { getLegalMoves } from './legalMoves';

export type BotDifficulty = 'novice' | 'amateur' | 'professional' | 'master' | 'legend';
export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['novice','amateur','professional','master','legend'];

export function normalizeBotDifficulty(value: unknown): BotDifficulty {
  return typeof value === 'string' && BOT_DIFFICULTIES.includes(value as BotDifficulty)
    ? value as BotDifficulty : 'professional';
}

const key = (card: Card) => `${card.rank}_${card.suit}`;
const rank = (card: Card) => RANK_VALUE[card.rank];
const points = (card: Card) => CARD_POINTS[card.rank];

// Only public cards and this bot's own hand are used. Never read another player's hand.
function knownCards(state: GameState): Set<string> {
  const result = new Set<string>();
  for (const card of state.bita.A) result.add(key(card));
  for (const card of state.bita.B) result.add(key(card));
  for (const card of state.trick?.cardsOnTable || []) result.add(key(card));
  return result;
}

function cost(card: Card, trump: Suit | null, level: BotDifficulty, seen: ReadonlySet<string>): number {
  const tr = card.suit === trump;
  const base = rank(card);
  if (level === 'novice') return 0;
  if (level === 'amateur') return base + (tr ? 10 : 0);
  // Valuable cards are normally retained when throwing away cards, but can be offered on attack.
  const publicGoneSameSuit = [...seen].filter(k => k.endsWith(`_${card.suit}`)).length;
  const rarity = level === 'legend' ? publicGoneSameSuit * 0.2 : 0;
  return base * 1.3 + (tr ? (level === 'master' || level === 'legend' ? 19 : 14) : 0)
    + points(card) * (level === 'professional' ? 1.0 : 1.4) + rarity;
}

/** Choose legal cards for attack/beat. Does not mutate state. */
export function chooseBotMove(state: GameState, difficulty: BotDifficulty = 'professional'): Card[] | null {
  const level = normalizeBotDifficulty(difficulty);
  const player = state.players[state.currentPlayer];
  if (!player || state.phase !== 'playing') return null;
  const moves = getLegalMoves(state, state.currentPlayer);
  if (!moves.length) return null;
  const hand = player.hand;
  const byKey = new Map(hand.map(c => [key(c), c]));
  const seen = knownCards(state);
  if (level === 'novice') return moves[0].map(k => byKey.get(k)!).filter(Boolean);
  let best: Card[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    const cards = move.map(k => byKey.get(k)!).filter(Boolean);
    if (cards.length !== move.length) continue;
    // On defense, spend as few high cards/trumps as possible; on attack prefer cheap singles.
    const spend = cards.reduce((sum, c) => sum + cost(c, state.trump, level, seen), 0);
    let score = spend + (cards.length - 1) * (level === 'amateur' ? 9 : 7);
    if (!state.trick && (level === 'master' || level === 'legend')) {
      // Offering points is useful if the attack is likely to survive; avoid gifting 10/A early.
      score += cards.reduce((sum, c) => sum + points(c) * (state.deck.length ? 0.85 : 0.35), 0);
      if (!state.deck.length && cards.length === hand.length) score -= 12; // shed the last hand
    }
    if (level === 'legend' && state.trick) {
      // Keep trump for later when many cards are unseen. Deck length is public information.
      score += cards.filter(c => c.suit === state.trump).length * Math.min(state.deck.length, 12) / 3;
    }
    if (score < bestScore) { bestScore = score; best = cards; }
  }
  return best;
}

/** If unable/unwilling to beat, discard exactly the amount required by game rules. */
export function chooseBotDiscard(state: GameState, difficulty: BotDifficulty = 'professional'): Card[] {
  const hand = state.players[state.currentPlayer]?.hand || [];
  const required = state.trick ? passCardCount(state.mode, state.trick, state.currentPlayer, hand.length) : 0;
  if (!required) return [];
  const level = normalizeBotDifficulty(difficulty);
  if (level === 'novice') return hand.slice(0, required);
  const seen = knownCards(state);
  const sorted = [...hand].sort((a,b) => cost(a,state.trump,level,seen)-cost(b,state.trump,level,seen) || key(a).localeCompare(key(b)));
  return sorted.slice(0,required);
}
