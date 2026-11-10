import { Card, cardsPoints } from './card';

export type Side = 'A' | 'B';

export interface RoundInput { teamPoints: Record<Side, number>; teamTricks: Record<Side, number>; multiplier: number; }

export interface RoundResult { kind: 'eggs' | 'win-loss'; winner?: Side; loser?: Side; basePenalty: number; multiplierApplied: number; awarded: Record<Side, number>; multiplierAfter: number; }

export function scoreRound(input: RoundInput): RoundResult {
  const { teamPoints, teamTricks, multiplier } = input;
  if (teamPoints.A === 60 && teamPoints.B === 60) {
    return { kind: 'eggs', basePenalty: 0, multiplierApplied: multiplier, awarded: { A: 0, B: 0 }, multiplierAfter: multiplier * 2 };
  }
  const winner: Side = teamPoints.A > teamPoints.B ? 'A' : 'B';
  const loser: Side = winner === 'A' ? 'B' : 'A';
  const lp = teamPoints[loser];
  const lt = teamTricks[loser];
  let basePenalty = 0;
  if (lt === 0) basePenalty = 6;
  else if (lp === 0) basePenalty = 4;
  else if (lp < 32) basePenalty = 4;
  else basePenalty = 2;
  const awarded: Record<Side, number> = { A: 0, B: 0 };
  awarded[loser] = basePenalty * multiplier;
  return { kind: 'win-loss', winner, loser, basePenalty, multiplierApplied: multiplier, awarded, multiplierAfter: 1 };
}
