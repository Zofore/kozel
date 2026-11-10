import { describe, it, expect } from 'vitest';
import { cardPoints, RANK_ORDER } from '../src/card';

describe('Старшинство карт и очки', () => {
  it('Твоё правило: A > 10 > K > Q > J > 9', () => {
    expect(RANK_ORDER.A).toBeGreaterThan(RANK_ORDER['10']);
    expect(RANK_ORDER['10']).toBeGreaterThan(RANK_ORDER.K);
    expect(RANK_ORDER.K).toBeGreaterThan(RANK_ORDER.Q);
    expect(RANK_ORDER.J).toBeGreaterThan(RANK_ORDER['9']);
  });

  it('Очки: A=11, 10=10, K=4, Q=3, J=2, 6-9=0', () => {
    expect(cardPoints({ suit: '♠', rank: 'A' })).toBe(11);
    expect(cardPoints({ suit: '♠', rank: '10' })).toBe(10);
    expect(cardPoints({ suit: '♠', rank: 'K' })).toBe(4);
    expect(cardPoints({ suit: '♠', rank: 'J' })).toBe(2);
    expect(cardPoints({ suit: '♠', rank: '9' })).toBe(0);
  });
}); 