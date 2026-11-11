import { Card } from './card';
export declare function createDeck(): Card[];
export declare function mulberry32(a: number): () => number;
export declare function shuffle(deck: Card[], rng?: () => number): Card[];
