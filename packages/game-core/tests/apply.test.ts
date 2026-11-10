import { describe, it, expect } from 'vitest';
import { applyEvent } from '../src/apply';
import { GameState } from '../src/state';

const createTestState = (): GameState => ({
  mode: '1v1',
  players: [
    { id: 0, side: 'A', hand: [{suit:'♠', rank:'6'}, {suit:'♠', rank:'7'}, {suit:'♠', rank:'8'}, {suit:'♠', rank:'9'}, {suit:'♠', rank:'10'}, {suit:'♠', rank:'J'}] },
    { id: 1, side: 'B', hand: [{suit:'♥', rank:'6'}, {suit:'♥', rank:'7'}, {suit:'♥', rank:'8'}, {suit:'♥', rank:'9'}, {suit:'♥', rank:'10'}, {suit:'♥', rank:'J'}] }
  ],
  deck: [{suit:'♦', rank:'6'}, {suit:'♠', rank:'A'}, {suit:'♣', rank:'7'}, {suit:'♣', rank:'8'}],
  trumpCard: {suit:'♦', rank:'6'},
  trump: '♦',
  trumpChanged: false,
  currentPlayer: 0,
  trick: null,
  lastTrickWinner: null,
  phase: 'playing',
  matchScore: { A: 0, B: 0 },
  multiplier: 1
});

describe('Ходы и добор', () => {
  it('Смена козыря: 1-й берет старый, 2-й берет новый козырь', () => {
    let state = createTestState();
    state.players[0].hand = state.players[0].hand.slice(0, 5);
    state.players[1].hand = state.players[1].hand.slice(0, 5);
    
    state = applyEvent(state, { type: 'DRAW', winner: 0 });
    
    expect(state.trump).toBe('♠');
    expect(state.trumpChanged).toBe(true);
    expect(state.players[0].hand.length).toBe(6);
    expect(state.players[1].hand.length).toBe(6);
    // В колоде было 4, забрали 2 (козырь и новый козырь), осталось 2
    expect(state.deck.length).toBe(2);
  });
});
