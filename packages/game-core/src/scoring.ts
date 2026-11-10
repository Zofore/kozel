import { Card, CARD_POINTS } from './card';

export function calculatePoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + (CARD_POINTS[c.rank] || 0), 0);
}