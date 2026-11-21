import { Card, Suit, RANK_VALUE } from './card';

// newCards - это твои карты (которыми ты бьешь).
// tableCards - это карты, которые лежат на столе.
export function canBeat(newCards: Card[], tableCards: Card[], trump: Suit): boolean {
  if (!newCards.length || newCards.length !== tableCards.length || newCards.some(c => !c)) return false;
  
  // Сортируем обе группы по убыванию, чтобы сравнивать самые сильные карты
  const sortedNew = [...newCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const sortedTable = [...tableCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);

  const used = new Array(sortedNew.length).fill(false);

  // Рекурсивная функция (поиск с возвратом)
  function match(tableIndex: number): boolean {
    if (tableIndex === sortedTable.length) return true;
    
    const tableCard = sortedTable[tableIndex];
    
    for (let i = 0; i < sortedNew.length; i++) {
      if (used[i]) continue;
      const newCard = sortedNew[i];
      
      let valid = false;
      // Если масть совпадает — наша карта должна быть старше
      if (newCard.suit === tableCard.suit) {
        if (RANK_VALUE[newCard.rank] > RANK_VALUE[tableCard.rank]) valid = true;
      } 
      // Если бьем козырем, а на столе не козырь — бьем
      else if (newCard.suit === trump && tableCard.suit !== trump) {
        valid = true;
      }
      
      if (valid) {
        used[i] = true;
        if (match(tableIndex + 1)) return true; // Если сработало — отлично
        used[i] = false; // Если нет — откатываем (backtracking)
      }
    }
    return false;
  }

  return match(0);
}

export function passCardCount(mode: '1v1' | '2v2', trick: { attacker: number; required: number }, player: number, handSize: number): number {
  // In 1v1 the original attacker has already matched the opponent's contribution.
  return mode === '1v1' && trick.attacker === player ? 0 : Math.min(trick.required, handSize);
}
