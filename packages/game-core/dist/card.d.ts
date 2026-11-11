export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export interface Card {
    suit: Suit;
    rank: Rank;
}
export declare const RANK_VALUE: Record<Rank, number>;
export declare const CARD_POINTS: Record<Rank, number>;
export declare function cardEquals(a: Card, b: Card): boolean;
