export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card { suit: Suit; rank: Rank; }

export const RANK_ORDER: Record<Rank, number> = { '6': 0, '7': 1, '8': 2, '9': 3, 'J': 4, 'Q': 5, 'K': 6, '10': 7, 'A': 8 };
export const RANK_POINTS: Record<Rank, number> = { '6': 0, '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
export function cardPoints(c: Card): number { return RANK_POINTS[c.rank]; }
export function cardsPoints(cards: Card[]): number { return cards.reduce((sum, c) => sum + cardPoints(c), 0); }
