import { createDeck, shuffle, mulberry32 } from './deck';
import { cardEquals } from './card';
import { canBeat } from './trick';
import { calculatePoints } from './scoring';
function takeFromHand(hand, cards) {
    const rest = [...hand];
    for (const c of cards) {
        const i = rest.findIndex(h => cardEquals(h, c));
        if (i === -1)
            return null;
        rest.splice(i, 1);
    }
    return rest;
}
export function applyEvent(state, event) {
    const nextState = (s) => ({
        ok: true,
        state: { ...state, ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 30000 }
    });
    if (event.type === 'START_ROUND') {
        const rng = mulberry32(event.seed || Math.floor(Math.random() * 1000000));
        const deck = shuffle(createDeck(), rng);
        const numPlayers = state.mode === '1v1' ? 2 : 4;
        const players = state.players.map((p, i) => {
            if (i < numPlayers)
                return { ...p, hand: deck.slice(i * 6, (i + 1) * 6) };
            return { ...p, hand: [] };
        });
        const trump = deck[numPlayers * 6];
        const rest = deck.slice(numPlayers * 6 + 1);
        const mid = Math.floor(rest.length / 2);
        return nextState({
            players, deck: [...rest.slice(0, mid), trump, ...rest.slice(mid)],
            trumpCard: trump, trump: trump.suit, trumpChanged: false, trumpChangeEvent: null,
            currentPlayer: event.firstPlayer, trick: null, lastTrickWinner: null, phase: 'playing',
            bita: { A: [], B: [] }, roundNumber: (state.roundNumber || 0) + 1, lastRoundPoints: null, diceRolls: null, seed: event.seed
        });
    }
    if (event.type === 'ATTACK') {
        if (state.phase !== 'playing')
            return { ok: false, error: 'WRONG_PHASE' };
        if (state.currentPlayer !== event.player)
            return { ok: false, error: 'NOT_YOUR_TURN' };
        if (state.trick)
            return { ok: false, error: 'TRICK_EXISTS' };
        const player = state.players[event.player];
        const newHand = takeFromHand(player.hand, event.cards);
        if (!newHand)
            return { ok: false, error: 'CARD_NOT_IN_HAND' };
        const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
        const nextRespondent = (event.player + 1) % (state.mode === '1v1' ? 2 : 4);
        const trick = {
            attacker: event.player, attackCards: event.cards, attackLength: event.cards.length,
            topCards: event.cards, topPlayer: event.player, cardsOnTable: [...event.cards],
            respondent: nextRespondent, required: event.cards.length
        };
        return nextState({ players, trick, currentPlayer: nextRespondent });
    }
    if (event.type === 'BEAT') {
        if (state.phase !== 'playing')
            return { ok: false, error: 'WRONG_PHASE' };
        if (state.currentPlayer !== event.player)
            return { ok: false, error: 'NOT_YOUR_TURN' };
        if (!state.trick)
            return { ok: false, error: 'NO_TRICK' };
        if (!canBeat(event.cards, state.trick.topCards, state.trump))
            return { ok: false, error: 'CANNOT_BEAT' };
        const player = state.players[event.player];
        const newHand = takeFromHand(player.hand, event.cards);
        if (!newHand)
            return { ok: false, error: 'CARD_NOT_IN_HAND' };
        const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
        const nextRespondent = (event.player + 1) % (state.mode === '1v1' ? 2 : 4);
        const trick = {
            ...state.trick, topCards: event.cards, topPlayer: event.player,
            cardsOnTable: [...state.trick.cardsOnTable, ...event.cards], respondent: nextRespondent
        };
        return nextState({ players, trick, currentPlayer: nextRespondent });
    }
    if (event.type === 'PASS') {
        if (state.phase !== 'playing')
            return { ok: false, error: 'WRONG_PHASE' };
        if (state.currentPlayer !== event.player)
            return { ok: false, error: 'NOT_YOUR_TURN' };
        if (!state.trick)
            return { ok: false, error: 'NO_TRICK' };
        if (event.cards.length > 0 && event.cards.length !== state.trick.required) {
            return { ok: false, error: 'WRONG_COUNT' };
        }
        const player = state.players[event.player];
        const newHand = takeFromHand(player.hand, event.cards);
        if (!newHand)
            return { ok: false, error: 'CARD_NOT_IN_HAND' };
        const players = state.players.map(p => p.id === event.player ? { ...p, hand: newHand } : p);
        const lastTrickWinner = state.trick.topPlayer;
        const winnerSide = state.players[lastTrickWinner].side;
        const bita = { ...state.bita, [winnerSide]: [...(state.bita[winnerSide] || []), ...state.trick.cardsOnTable, ...event.cards] };
        return nextState({ players, bita, trick: null, lastTrickWinner, currentPlayer: lastTrickWinner });
    }
    if (event.type === 'DRAW') {
        let s = { ...state, deck: [...state.deck], players: state.players.map(p => ({ ...p, hand: [...p.hand] })) };
        s.trick = null;
        s.lastTrickWinner = event.winner;
        s.currentPlayer = event.winner;
        let current = event.winner;
        const numPlayers = s.mode === '1v1' ? 2 : 4;
        let iterations = 0;
        while (s.deck.length > 0 && s.players.slice(0, numPlayers).some(p => p.hand.length < 6) && iterations < 100) {
            iterations++;
            if (s.players[current].hand.length < 6) {
                const card = s.deck.shift();
                if (!s.trumpChanged && s.trumpCard && cardEquals(card, s.trumpCard)) {
                    s.players[current].hand.push(card);
                    s.trumpChanged = true;
                    if (s.deck.length > 0) {
                        const newTrump = s.deck[0];
                        s.trump = newTrump.suit;
                        s.trumpCard = newTrump;
                        s.trumpChangeEvent = { player: current, card: newTrump };
                    }
                }
                else {
                    s.players[current].hand.push(card);
                    if (s.trumpChanged && s.trumpCard && cardEquals(card, s.trumpCard)) {
                        s.trumpCard = null;
                    }
                }
            }
            current = (current + 1) % numPlayers;
        }
        return { ok: true, state: { ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 30000 } };
    }
    if (event.type === 'SCORE_ROUND') {
        if (state.phase !== 'playing')
            return { ok: false, error: 'WRONG_PHASE' };
        const pointsA = calculatePoints(state.bita.A);
        const pointsB = calculatePoints(state.bita.B);
        let winnerSide = null;
        let basePenalty = 0;
        if (pointsA === 60 && pointsB === 60) {
            return nextState({ multiplier: state.multiplier * 2, phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } });
        }
        if (pointsA === pointsB) {
            return nextState({ phase: 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } });
        }
        if (pointsA > 60) {
            winnerSide = 'A';
            basePenalty = pointsB === 0 ? 4 : (pointsB < 32 ? 4 : 2);
        }
        else if (pointsB > 60) {
            winnerSide = 'B';
            basePenalty = pointsA === 0 ? 4 : (pointsA < 32 ? 4 : 2);
        }
        else {
            winnerSide = pointsA > pointsB ? 'A' : 'B';
            basePenalty = 6;
        }
        const loserSide = winnerSide === 'A' ? 'B' : 'A';
        const matchScore = { ...state.matchScore, [loserSide]: state.matchScore[loserSide] + (basePenalty * state.multiplier) };
        return nextState({ matchScore, multiplier: 1, phase: matchScore[loserSide] >= 24 ? 'finished' : 'round-scored', lastRoundPoints: { A: pointsA, B: pointsB } });
    }
    return { ok: false, error: 'WRONG_PHASE' };
}
