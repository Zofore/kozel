import { describe, it, expect } from 'vitest';
import { canBeat } from '../src/trick';
import { createDeck } from '../src/deck';
describe('Логика боя карт', () => {
    it('Колода создается из 36 карт', () => {
        const deck = createDeck();
        expect(deck.length).toBe(36);
    });
    it('Битва одной картой (масть)', () => {
        expect(canBeat([{ suit: '♠', rank: '7' }], [{ suit: '♠', rank: '6' }], '♥')).toBe(true);
        expect(canBeat([{ suit: '♠', rank: '6' }], [{ suit: '♠', rank: '7' }], '♥')).toBe(false);
    });
    it('Твоё правило: 10 бьет K, но не бьет A', () => {
        expect(canBeat([{ suit: '♠', rank: '10' }], [{ suit: '♠', rank: 'K' }], '♥')).toBe(true);
        expect(canBeat([{ suit: '♠', rank: '10' }], [{ suit: '♠', rank: 'A' }], '♥')).toBe(false);
    });
    it('Козырь бьет некозырь', () => {
        expect(canBeat([{ suit: '♥', rank: '6' }], [{ suit: '♠', rank: 'A' }], '♥')).toBe(true);
    });
    it('Групповой бой: 7-10 бьет 6-K', () => {
        expect(canBeat([{ suit: '♠', rank: '7' }, { suit: '♠', rank: '10' }], [{ suit: '♠', rank: '6' }, { suit: '♠', rank: 'K' }], '♥')).toBe(true);
    });
});
