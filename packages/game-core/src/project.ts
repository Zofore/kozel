import { GameState, PlayerView, PlayerId } from './state';

export function project(state: GameState, meId: PlayerId, legalMoves: string[][] = []): PlayerView {
  return {
    mode: state.mode,
    me: meId,
    hand: state.players[meId]?.hand || [],
    players: state.players.map(p => ({
      id: p.id,
      side: p.side,
      name: p.name,
      handCount: p.hand.length,
      connected: p.connected ?? true,
    })),
    deckCount: state.deck.length,
    trumpCard: state.trumpCard,
    trump: state.trump,
    trumpChanged: state.trumpChanged,
    trumpChangeEvent: state.trumpChangeEvent,
    currentPlayer: state.currentPlayer,
    trick: state.trick,
    lastTrickWinner: state.lastTrickWinner,
    phase: state.phase,
    matchScore: state.matchScore,
    multiplier: state.multiplier,
    roundNumber: state.roundNumber,
    bitaCount: { A: state.bita.A.length, B: state.bita.B.length },
    lastRoundPoints: state.lastRoundPoints,
    diceRolls: state.diceRolls,
    legalMoves,
    stateVersion: state.stateVersion,
    turnDeadline: state.turnDeadline,
  };
}