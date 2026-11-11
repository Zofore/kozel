import { describe, it, expect } from 'vitest';
import { scoreRound } from '../src/scoring';
describe('Подсчет очков (Баллы)', () => {
    it('Яйца 60:60 — никому баллов, множитель x2', () => {
        const r = scoreRound({ teamPoints: { A: 60, B: 60 }, teamTricks: { A: 3, B: 3 }, multiplier: 1 });
        expect(r.kind).toBe('eggs');
        expect(r.awarded.A).toBe(0);
        expect(r.multiplierAfter).toBe(2);
    });
    it('0 взяток — 6 баллов', () => {
        const r = scoreRound({ teamPoints: { A: 90, B: 30 }, teamTricks: { A: 5, B: 0 }, multiplier: 1 });
        expect(r.awarded.B).toBe(6);
    });
    it('31 очко — 4 балла', () => {
        const r = scoreRound({ teamPoints: { A: 89, B: 31 }, teamTricks: { A: 3, B: 3 }, multiplier: 1 });
        expect(r.awarded.B).toBe(4);
    });
    it('32 очка — 2 балла', () => {
        const r = scoreRound({ teamPoints: { A: 88, B: 32 }, teamTricks: { A: 4, B: 2 }, multiplier: 1 });
        expect(r.awarded.B).toBe(2);
    });
    it('Удвоение: 2 балла * множитель 2 = 4', () => {
        const r = scoreRound({ teamPoints: { A: 88, B: 32 }, teamTricks: { A: 4, B: 2 }, multiplier: 2 });
        expect(r.awarded.B).toBe(4);
    });
});
