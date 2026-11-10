import { Card, Suit, cardsPoints } from './card';

export type SpecialCombo =
  | { type: 'youngka'; cards: Card[]; suit: Suit; length: 5 | 6 }
  | { type: 'forty-one'; cards: Card[]; points: number }
  | { type: 'four-aces'; cards: Card[] };

export function validateSpecial(cards: Card[], trump: Suit): SpecialCombo | null {
  if (cards.length === 0) return null;

  // 4 туза
  if (cards.length === 4 && cards.every(c => c.rank === 'A')) {
    return { type: 'four-aces', cards };
  }

  // 41+: 4 или 6 карт, только A и 10, сумма >= 41
  if ((cards.length === 4 || cards.length === 6)
      && cards.every(c => c.rank === 'A' || c.rank === '10')) {
    const pts = cardsPoints(cards);
    if (pts >= 41) return { type: 'forty-one', cards, points: pts };
  }

  // Молодка: 5 или 6 карт одной масти
  if (cards.length === 5 || cards.length === 6) {
    const suit = cards[0].suit;
    if (cards.every(c => c.suit === suit)) {
      return { type: 'youngka', cards, suit, length: cards.length as 5 | 6 };
    }
  }

  return null;
}
