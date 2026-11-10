export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const RANK_VALUE: Record<Rank, number> = { 
  '6': 1, '7': 2, '8': 3, '9': 4, 'J': 5, 'Q': 6, 'K': 7, '10': 8, 'A': 9 
};

export const CARD_POINTS: Record<Rank, number> = { 
  '6': 0, '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 
};

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}