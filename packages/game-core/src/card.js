export const RANK_VALUE = {
    '6': 1, '7': 2, '8': 3, '9': 4, 'J': 5, 'Q': 6, 'K': 7, '10': 8, 'A': 9
};
export const CARD_POINTS = {
    '6': 0, '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11
};
export function cardEquals(a, b) {
    return a.suit === b.suit && a.rank === b.rank;
}
