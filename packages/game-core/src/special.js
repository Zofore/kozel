export function validateSpecial(cards, trump) {
    if (cards.length <= 1)
        return true;
    // Разрешаем мульти-ход, только если все карты одной масти
    const firstSuit = cards[0].suit;
    return cards.every(c => c.suit === firstSuit);
}
