import { RANK_VALUE } from './card';
// newCards - это твои карты (которыми ты бьешь).
// tableCards - это карты, которые лежат на столе.
export function canBeat(newCards, tableCards, trump) {
    if (newCards.length !== tableCards.length)
        return false;
    // Сортируем обе группы по убыванию, чтобы сравнивать самые сильные карты
    const sortedNew = [...newCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
    const sortedTable = [...tableCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
    const used = new Array(sortedNew.length).fill(false);
    // Рекурсивная функция (поиск с возвратом)
    function match(tableIndex) {
        if (tableIndex === sortedTable.length)
            return true;
        const tableCard = sortedTable[tableIndex];
        for (let i = 0; i < sortedNew.length; i++) {
            if (used[i])
                continue;
            const newCard = sortedNew[i];
            let valid = false;
            // Если масть совпадает — наша карта должна быть старше
            if (newCard.suit === tableCard.suit) {
                if (RANK_VALUE[newCard.rank] > RANK_VALUE[tableCard.rank])
                    valid = true;
            }
            // Если бьем козырем, а на столе не козырь — бьем
            else if (newCard.suit === trump && tableCard.suit !== trump) {
                valid = true;
            }
            if (valid) {
                used[i] = true;
                if (match(tableIndex + 1))
                    return true; // Если сработало — отлично
                used[i] = false; // Если нет — откатываем (backtracking)
            }
        }
        return false;
    }
    return match(0);
}
