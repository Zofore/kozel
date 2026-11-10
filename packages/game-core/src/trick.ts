import { Card, Suit, RANK_ORDER } from './card';

export function canBeat(played: Card[], attack: Card[], trump: Suit): boolean {
  if (played.length !== attack.length) return false;
  if (played.length === 0) return false;

  const check = (remainingPlayed: Card[], remainingAttack: Card[]): boolean => {
    if (remainingPlayed.length === 0) return true;
    const p = remainingPlayed[0];
    for (let i = 0; i < remainingAttack.length; i++) {
      const a = remainingAttack[i];
      let beats = false;
      if (p.suit === a.suit) { beats = RANK_ORDER[p.rank] > RANK_ORDER[a.rank]; }
      else if (p.suit === trump && a.suit !== trump) { beats = true; }
      else if (p.suit === trump && a.suit === trump) { beats = RANK_ORDER[p.rank] > RANK_ORDER[a.rank]; }
      if (beats) {
        const newPlayed = remainingPlayed.slice(1);
        const newAttack = [...remainingAttack.slice(0, i), ...remainingAttack.slice(i + 1)];
        if (check(newPlayed, newAttack)) return true;
      }
    }
    return false;
  };
  return check(played, attack);
}
