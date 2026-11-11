import { CARD_POINTS } from './card';
export function calculatePoints(cards) {
    return cards.reduce((sum, c) => sum + (CARD_POINTS[c.rank] || 0), 0);
}
