import { GameState, PlayerId, TrickState } from './state';
import { createDeck, shuffle } from './deck';
import { Card } from './card';
import { canBeat } from './trick';

export type GameEvent =
  | { type: 'START_ROUND'; firstPlayer: PlayerId }
  | { type: 'ATTACK'; player: PlayerId; cards: Card[] }
  | { type: 'BEAT'; player: PlayerId; cards: Card[] }
  | { type: 'PASS'; player: PlayerId; cards: Card[] }
  | { type: 'DRAW'; winner: PlayerId }
  | { type: 'SCORE_ROUND' };

export function applyEvent(state: GameState, event: GameEvent): GameState {
  const nextState = (s: Partial<GameState>) => ({ ...state, ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 30000 });

  if (event.type === 'START_ROUND') {
    const deck = shuffle(createDeck());
    const players = state.players.map((p, i) => ({ ...p, hand: deck.slice(i * 6, (i + 1) * 6) }));
    const numPlayers = state.mode === '1v1' ? 2 : 4;
    const trump = deck[numPlayers * 6];
    const rest = deck.slice(numPlayers * 6 + 1);
    const mid = Math.floor(rest.length / 2);
    
    return nextState({ 
      players, deck: [...rest.slice(0, mid), trump, ...rest.slice(mid)], 
      trumpCard: trump, trump: trump.suit, trumpChanged: false, trumpChangeEvent: null, 
      currentPlayer: event.firstPlayer, trick: null, lastTrickWinner: null, phase: 'playing', 
      bita: { A: [], B: [] }, roundNumber: (state.roundNumber || 0) + 1, lastRoundPoints: null, diceRolls: null 
    });
  }

  if (event.type === 'ATTACK') {
    const player = state.players[event.player];
    const newHand = player.hand.filter(c => !event.cards.some(ec => ec.suit === c.suit && ec.rank === c.rank));
    const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
    
    const nextRespondent = (event.player + 1) % (state.mode === '1v1' ? 2 : 4) as PlayerId;
    const trick: TrickState = { 
      attacker: event.player, attackCards: event.cards, attackLength: event.cards.length, 
      topCards: event.cards, topPlayer: event.player, cardsOnTable: [...event.cards],
      respondent: nextRespondent, required: event.cards.length
    };
    return nextState({ players, trick, currentPlayer: nextRespondent });
  }

  if (event.type === 'BEAT') {
    if (!state.trick) return state;
    if (!canBeat(event.cards, state.trick.topCards, state.trump!)) return state;
    
    const player = state.players[event.player];
    const newHand = player.hand.filter(c => !event.cards.some(ec => ec.suit === c.suit && ec.rank === c.rank));
    const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
    
    const nextRespondent = (event.player + 1) % (state.mode === '1v1' ? 2 : 4) as PlayerId;
    
    const trick = { 
      ...state.trick, topCards: event.cards, topPlayer: event.player, 
      cardsOnTable: [...state.trick.cardsOnTable, ...event.cards], respondent: nextRespondent
    };
    return nextState({ players, trick, currentPlayer: nextRespondent });
  }

  if (event.type === 'PASS') {
    if (!state.trick) return state;
    const player = state.players[event.player];
    
    // УДАЛЯЕМ СБРОШЕННЫЕ КАРТЫ ИЗ РУКИ
    const newHand = event.cards.length === 0 
      ? player.hand 
      : player.hand.filter(c => !event.cards.some(ec => ec.suit === c.suit && ec.rank === c.rank));
      
    const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
    
    const lastTrickWinner = state.trick.topPlayer;
    const winnerSide = state.players[lastTrickWinner].side;
    // ДОБАВЛЯЕМ КАРТЫ СО СТОЛА И СБРОШЕННЫЕ КАРТЫ В БИТУ
    const bita = { ...state.bita, [winnerSide]: [...(state.bita[winnerSide] || []), ...state.trick.cardsOnTable, ...event.cards] };
    
    return nextState({ players, bita, trick: null, lastTrickWinner, currentPlayer: lastTrickWinner });
  }

  if (event.type === 'DRAW') {
    let s = { ...state, trick: null, lastTrickWinner: event.winner, currentPlayer: event.winner };
    let current = event.winner;
    const numPlayers = s.mode === '1v1' ? 2 : 4;
    
    s.players = s.players.map(p => ({ ...p, hand: [...p.hand] }));

    while (s.deck.length > 0 && s.players.some(p => p.hand.length < 6)) {
      if (s.players[current].hand.length < 6) {
        const card = s.deck.shift()!;
        
        if (!s.trumpChanged && s.trumpCard && card.suit === s.trumpCard.suit && card.rank === s.trumpCard.rank) {
          s.players[current].hand.push(card); s.trumpChanged = true;
          if (s.deck.length > 0) {
            const newTrump = s.deck[0]; s.trump = newTrump.suit; s.trumpCard = newTrump;
            s.trumpChangeEvent = { player: current, card: newTrump };
          }
        } else {
          s.players[current].hand.push(card);
          if (s.trumpChanged && s.trumpCard && card.suit === s.trumpCard.suit && card.rank === s.trumpCard.rank) {
            s.trumpCard = null;
          }
        }
      }
      current = (current + 1) % numPlayers;
    }
    return nextState(s);
  }

  if (event.type === 'SCORE_ROUND') {
    const pointsA = state.bita.A.reduce((sum, c) => sum + ({ '6':0, '7':0, '8':0, '9':0, 'J':2, 'Q':3, 'K':4, '10':10, 'A':11 }[c.rank] || 0), 0);
    const pointsB = state.bita.B.reduce((sum, c) => sum + ({ '6':0, '7':0, '8':0, '9':0, 'J':2, 'Q':3, 'K':4, '10':10, 'A':11 }[c.rank] || 0), 0);
    
    let winnerSide = null; let basePenalty = 0;

    if (pointsA === 60 && pointsB === 60) { return nextState({ multiplier: state.multiplier * 2, phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } }); }
    
    // Если 51 на 51 (или любой другой равный счет), штраф никому не даем
    if (pointsA === pointsB) { return nextState({ phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } }); }

    if (pointsA > 60) { winnerSide = 'A'; basePenalty = pointsB === 0 ? 4 : (pointsB < 32 ? 4 : 2); }
    else if (pointsB > 60) { winnerSide = 'B'; basePenalty = pointsA === 0 ? 4 : (pointsA < 32 ? 4 : 2); }
    else { winnerSide = pointsA > pointsB ? 'A' : 'B'; basePenalty = 6; }
    
    const loserSide = winnerSide === 'A' ? 'B' : 'A';
    const matchScore = { ...state.matchScore, [loserSide]: state.matchScore[loserSide] + (basePenalty * state.multiplier) };
    return nextState({ matchScore, multiplier: 1, phase: matchScore[loserSide] >= 24 ? 'finished' : 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } });
  }
  return state;
}