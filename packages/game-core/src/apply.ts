import { GameState, PlayerId, TrickState, Side } from './state';
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

export type RuleError =
  | 'NOT_YOUR_TURN' | 'WRONG_PHASE' | 'CARD_NOT_IN_HAND'
  | 'DUPLICATE_CARDS' | 'ILLEGAL_SET' | 'CANNOT_BEAT'
  | 'WRONG_COUNT' | 'NO_TRICK' | 'TRICK_EXISTS';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: RuleError };

// Защита от читов: проверяем, что карты реально есть в руке, и удаляем их по одной (ловит дубликаты)
function takeFromHand(hand: Card[], cards: Card[]): Card[] | null {
  const rest = [...hand];
  for (const c of cards) {
    const i = rest.findIndex(h => h.suit === c.suit && h.rank === c.rank);
    if (i === -1) return null; // Карты нет в руке или это дубликат
    rest.splice(i, 1);
  }
  return rest;
}

export function applyEvent(state: GameState, event: GameEvent): ApplyResult {
  const nextState = (s: Partial<GameState>): ApplyResult => ({ 
    ok: true, 
    state: { ...state, ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 30000 } 
  });

  if (event.type === 'START_ROUND') {
    const deck = shuffle(createDeck());
    const numPlayers = state.mode === '1v1' ? 2 : 4;
    
    // Раздаем только активным игрокам (исправлен баг с бесконечным циклом и дублем козыря в 1v1)
    const players = state.players.map((p, i) => {
      if (i < numPlayers) return { ...p, hand: deck.slice(i * 6, (i + 1) * 6) };
      return { ...p, hand: [] };
    });
    
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
    if (state.phase !== 'playing') return { ok: false, error: 'WRONG_PHASE' };
    if (state.currentPlayer !== event.player) return { ok: false, error: 'NOT_YOUR_TURN' };
    if (state.trick) return { ok: false, error: 'TRICK_EXISTS' }; 

    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: 'CARD_NOT_IN_HAND' };

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
    if (state.phase !== 'playing') return { ok: false, error: 'WRONG_PHASE' };
    if (state.currentPlayer !== event.player) return { ok: false, error: 'NOT_YOUR_TURN' };
    if (!state.trick) return { ok: false, error: 'NO_TRICK' };
    if (!canBeat(event.cards, state.trick.topCards, state.trump!)) return { ok: false, error: 'CANNOT_BEAT' };
    
    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: 'CARD_NOT_IN_HAND' };

    const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
    const nextRespondent = (event.player + 1) % (state.mode === '1v1' ? 2 : 4) as PlayerId;
    
    const trick = { 
      ...state.trick, topCards: event.cards, topPlayer: event.player, 
      cardsOnTable: [...state.trick.cardsOnTable, ...event.cards], respondent: nextRespondent
    };
    return nextState({ players, trick, currentPlayer: nextRespondent });
  }

  if (event.type === 'PASS') {
    if (state.phase !== 'playing') return { ok: false, error: 'WRONG_PHASE' };
    if (state.currentPlayer !== event.player) return { ok: false, error: 'NOT_YOUR_TURN' };
    if (!state.trick) return { ok: false, error: 'NO_TRICK' };

    // Если сбрасываем карты, их должно быть ровно столько же, сколько на столе
    if (event.cards.length > 0 && event.cards.length !== state.trick.required) {
      return { ok: false, error: 'WRONG_COUNT' };
    }

    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: 'CARD_NOT_IN_HAND' };
      
    const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
    
    const lastTrickWinner = state.trick.topPlayer;
    const winnerSide = state.players[lastTrickWinner].side;
    const bita = { ...state.bita, [winnerSide]: [...(state.bita[winnerSide] || []), ...state.trick.cardsOnTable, ...event.cards] };
    
    return nextState({ players, bita, trick: null, lastTrickWinner, currentPlayer: lastTrickWinner });
  }

  if (event.type === 'DRAW') {
    // Честное копирование, чтобы не мутировать стейт (защита от рассинхрона)
    let s = { ...state, deck: [...state.deck], players: state.players.map(p => ({ ...p, hand: [...p.hand] })) };
    s.trick = null; s.lastTrickWinner = event.winner; s.currentPlayer = event.winner;
    
    let current = event.winner;
    const numPlayers = s.mode === '1v1' ? 2 : 4;
    let iterations = 0; // Страховка от зацикливания

    // Проверяем только активных игроков
    while (s.deck.length > 0 && s.players.slice(0, numPlayers).some(p => p.hand.length < 6) && iterations < 100) {
      iterations++;
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
    return { ok: true, state: { ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 30000 } };
  }

  if (event.type === 'SCORE_ROUND') {
    if (state.phase !== 'playing') return { ok: false, error: 'WRONG_PHASE' };

    const pointsA = state.bita.A.reduce((sum, c) => sum + ({ '6':0, '7':0, '8':0, '9':0, 'J':2, 'Q':3, 'K':4, '10':10, 'A':11 }[c.rank] || 0), 0);
    const pointsB = state.bita.B.reduce((sum, c) => sum + ({ '6':0, '7':0, '8':0, '9':0, 'J':2, 'Q':3, 'K':4, '10':10, 'A':11 }[c.rank] || 0), 0);
    
    let winnerSide: Side | null = null; 
    let basePenalty = 0;

    if (pointsA === 60 && pointsB === 60) { return nextState({ multiplier: state.multiplier * 2, phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } }); }
    if (pointsA === pointsB) { return nextState({ phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } }); }

    if (pointsA > 60) { winnerSide = 'A'; basePenalty = pointsB === 0 ? 4 : (pointsB < 32 ? 4 : 2); }
    else if (pointsB > 60) { winnerSide = 'B'; basePenalty = pointsA === 0 ? 4 : (pointsA < 32 ? 4 : 2); }
    else { winnerSide = pointsA > pointsB ? 'A' : 'B'; basePenalty = 6; }
    
    const loserSide: Side = winnerSide === 'A' ? 'B' : 'A';
    const matchScore = { ...state.matchScore, [loserSide]: state.matchScore[loserSide] + (basePenalty * state.multiplier) };
    return nextState({ matchScore, multiplier: 1, phase: matchScore[loserSide] >= 24 ? 'finished' : 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } });
  }
  
  return { ok: false, error: 'WRONG_PHASE' };
}