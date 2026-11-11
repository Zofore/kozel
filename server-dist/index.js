var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// apps/server/src/index.ts
var import_fastify = __toESM(require("fastify"), 1);
var import_socket = require("socket.io");

// packages/game-core/src/card.ts
var RANK_VALUE = {
  "6": 1,
  "7": 2,
  "8": 3,
  "9": 4,
  "J": 5,
  "Q": 6,
  "K": 7,
  "10": 8,
  "A": 9
};
var CARD_POINTS = {
  "6": 0,
  "7": 0,
  "8": 0,
  "9": 0,
  "J": 2,
  "Q": 3,
  "K": 4,
  "10": 10,
  "A": 11
};
function cardEquals(a, b) {
  return a.suit === b.suit && a.rank === b.rank;
}

// packages/game-core/src/deck.ts
function createDeck() {
  const suits = ["\u2660", "\u2665", "\u2666", "\u2663"];
  const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}
function mulberry32(a) {
  return function() {
    let t = a += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(deck, rng = Math.random) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// packages/game-core/src/trick.ts
function canBeat(newCards, tableCards, trump) {
  if (newCards.length !== tableCards.length) return false;
  const sortedNew = [...newCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const sortedTable = [...tableCards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const used = new Array(sortedNew.length).fill(false);
  function match(tableIndex) {
    if (tableIndex === sortedTable.length) return true;
    const tableCard = sortedTable[tableIndex];
    for (let i = 0; i < sortedNew.length; i++) {
      if (used[i]) continue;
      const newCard = sortedNew[i];
      let valid = false;
      if (newCard.suit === tableCard.suit) {
        if (RANK_VALUE[newCard.rank] > RANK_VALUE[tableCard.rank]) valid = true;
      } else if (newCard.suit === trump && tableCard.suit !== trump) {
        valid = true;
      }
      if (valid) {
        used[i] = true;
        if (match(tableIndex + 1)) return true;
        used[i] = false;
      }
    }
    return false;
  }
  return match(0);
}

// packages/game-core/src/special.ts
function validateSpecial(cards, trump) {
  if (cards.length <= 1) return true;
  const firstSuit = cards[0].suit;
  return cards.every((c) => c.suit === firstSuit);
}

// packages/game-core/src/scoring.ts
function calculatePoints(cards) {
  return cards.reduce((sum, c) => sum + (CARD_POINTS[c.rank] || 0), 0);
}

// packages/game-core/src/apply.ts
function takeFromHand(hand, cards) {
  const rest = [...hand];
  for (const c of cards) {
    const i = rest.findIndex((h) => cardEquals(h, c));
    if (i === -1) return null;
    rest.splice(i, 1);
  }
  return rest;
}
function applyEvent(state, event) {
  const nextState = (s) => ({
    ok: true,
    state: { ...state, ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 3e4 }
  });
  if (event.type === "START_ROUND") {
    const rng = mulberry32(event.seed || Math.floor(Math.random() * 1e6));
    const deck = shuffle(createDeck(), rng);
    const numPlayers = state.mode === "1v1" ? 2 : 4;
    const players = state.players.map((p, i) => {
      if (i < numPlayers) return { ...p, hand: deck.slice(i * 6, (i + 1) * 6) };
      return { ...p, hand: [] };
    });
    const trump = deck[numPlayers * 6];
    const rest = deck.slice(numPlayers * 6 + 1);
    const mid = Math.floor(rest.length / 2);
    return nextState({
      players,
      deck: [...rest.slice(0, mid), trump, ...rest.slice(mid)],
      trumpCard: trump,
      trump: trump.suit,
      trumpChanged: false,
      trumpChangeEvent: null,
      currentPlayer: event.firstPlayer,
      trick: null,
      lastTrickWinner: null,
      phase: "playing",
      bita: { A: [], B: [] },
      roundNumber: (state.roundNumber || 0) + 1,
      lastRoundPoints: null,
      diceRolls: null,
      seed: event.seed
    });
  }
  if (event.type === "ATTACK") {
    if (state.phase !== "playing") return { ok: false, error: "WRONG_PHASE" };
    if (state.currentPlayer !== event.player) return { ok: false, error: "NOT_YOUR_TURN" };
    if (state.trick) return { ok: false, error: "TRICK_EXISTS" };
    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: "CARD_NOT_IN_HAND" };
    const players = state.players.map((p) => p.id === event.player ? { ...p, hand: newHand } : p);
    const nextRespondent = (event.player + 1) % (state.mode === "1v1" ? 2 : 4);
    const trick = {
      attacker: event.player,
      attackCards: event.cards,
      attackLength: event.cards.length,
      topCards: event.cards,
      topPlayer: event.player,
      cardsOnTable: [...event.cards],
      respondent: nextRespondent,
      required: event.cards.length
    };
    return nextState({ players, trick, currentPlayer: nextRespondent });
  }
  if (event.type === "BEAT") {
    if (state.phase !== "playing") return { ok: false, error: "WRONG_PHASE" };
    if (state.currentPlayer !== event.player) return { ok: false, error: "NOT_YOUR_TURN" };
    if (!state.trick) return { ok: false, error: "NO_TRICK" };
    if (!canBeat(event.cards, state.trick.topCards, state.trump)) return { ok: false, error: "CANNOT_BEAT" };
    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: "CARD_NOT_IN_HAND" };
    const players = state.players.map((p) => p.id === event.player ? { ...p, hand: newHand } : p);
    const nextRespondent = (event.player + 1) % (state.mode === "1v1" ? 2 : 4);
    const trick = {
      ...state.trick,
      topCards: event.cards,
      topPlayer: event.player,
      cardsOnTable: [...state.trick.cardsOnTable, ...event.cards],
      respondent: nextRespondent
    };
    return nextState({ players, trick, currentPlayer: nextRespondent });
  }
  if (event.type === "PASS") {
    if (state.phase !== "playing") return { ok: false, error: "WRONG_PHASE" };
    if (state.currentPlayer !== event.player) return { ok: false, error: "NOT_YOUR_TURN" };
    if (!state.trick) return { ok: false, error: "NO_TRICK" };
    if (event.cards.length > 0 && event.cards.length !== state.trick.required) {
      return { ok: false, error: "WRONG_COUNT" };
    }
    const player = state.players[event.player];
    const newHand = takeFromHand(player.hand, event.cards);
    if (!newHand) return { ok: false, error: "CARD_NOT_IN_HAND" };
    const players = state.players.map((p) => p.id === event.player ? { ...p, hand: newHand } : p);
    const lastTrickWinner = state.trick.topPlayer;
    const winnerSide = state.players[lastTrickWinner].side;
    const bita = { ...state.bita, [winnerSide]: [...state.bita[winnerSide] || [], ...state.trick.cardsOnTable, ...event.cards] };
    return nextState({ players, bita, trick: null, lastTrickWinner, currentPlayer: lastTrickWinner });
  }
  if (event.type === "DRAW") {
    let s = { ...state, deck: [...state.deck], players: state.players.map((p) => ({ ...p, hand: [...p.hand] })) };
    s.trick = null;
    s.lastTrickWinner = event.winner;
    s.currentPlayer = event.winner;
    let current = event.winner;
    const numPlayers = s.mode === "1v1" ? 2 : 4;
    let iterations = 0;
    while (s.deck.length > 0 && s.players.slice(0, numPlayers).some((p) => p.hand.length < 6) && iterations < 100) {
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
        } else {
          s.players[current].hand.push(card);
          if (s.trumpChanged && s.trumpCard && cardEquals(card, s.trumpCard)) {
            s.trumpCard = null;
          }
        }
      }
      current = (current + 1) % numPlayers;
    }
    return { ok: true, state: { ...s, stateVersion: (state.stateVersion || 0) + 1, turnDeadline: Date.now() + 3e4 } };
  }
  if (event.type === "SCORE_ROUND") {
    if (state.phase !== "playing") return { ok: false, error: "WRONG_PHASE" };
    const pointsA = calculatePoints(state.bita.A);
    const pointsB = calculatePoints(state.bita.B);
    let winnerSide = null;
    let basePenalty = 0;
    if (pointsA === 60 && pointsB === 60) {
      return nextState({ multiplier: state.multiplier * 2, phase: "round-scored", lastRoundPoints: { A: pointsA, B: pointsB } });
    }
    if (pointsA === pointsB) {
      return nextState({ phase: "round-scored", lastRoundPoints: { A: pointsA, B: pointsB } });
    }
    if (pointsA > 60) {
      winnerSide = "A";
      basePenalty = pointsB === 0 ? 6 : pointsB < 32 ? 4 : 2;
    } else if (pointsB > 60) {
      winnerSide = "B";
      basePenalty = pointsA === 0 ? 6 : pointsA < 32 ? 4 : 2;
    } else {
      winnerSide = pointsA > pointsB ? "A" : "B";
      basePenalty = 6;
    }
    const loserSide = winnerSide === "A" ? "B" : "A";
    const matchScore = { ...state.matchScore, [loserSide]: state.matchScore[loserSide] + basePenalty * state.multiplier };
    return nextState({ matchScore, multiplier: 1, phase: matchScore[loserSide] >= 24 ? "finished" : "round-scored", lastRoundPoints: { A: pointsA, B: pointsB } });
  }
  return { ok: false, error: "WRONG_PHASE" };
}

// packages/game-core/src/project.ts
function project(state, meId, legalMoves = []) {
  return {
    mode: state.mode,
    me: meId,
    hand: state.players[meId]?.hand || [],
    players: state.players.map((p) => ({
      id: p.id,
      side: p.side,
      name: p.name,
      handCount: p.hand.length,
      connected: p.connected ?? true
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
    turnDeadline: state.turnDeadline
  };
}

// packages/game-core/src/legalMoves.ts
function getLegalMoves(state, playerId) {
  if (state.phase !== "playing") return [];
  const me = state.players[playerId];
  if (!me) return [];
  const hand = me.hand;
  const serialize = (cards) => cards.map((c) => `${c.rank}_${c.suit}`);
  if (!state.trick && state.currentPlayer === playerId) {
    const opponent = state.players[(playerId + 1) % state.players.length];
    const maxCards = opponent.hand.length || 1;
    const moves = [];
    hand.forEach((c) => moves.push(serialize([c])));
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        if (hand[i].suit === hand[j].suit && maxCards >= 2) moves.push(serialize([hand[i], hand[j]]));
      }
    }
    return moves;
  }
  if (state.trick && state.currentPlayer === playerId) {
    const required = state.trick.required;
    const top = state.trick.topCards;
    const moves = [];
    if (required === 1) {
      hand.forEach((c) => {
        if (canBeat([c], top, state.trump)) moves.push(serialize([c]));
      });
    }
    if (required === 2) {
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          if (hand[i].suit === hand[j].suit && canBeat([hand[i], hand[j]], top, state.trump)) {
            moves.push(serialize([hand[i], hand[j]]));
          }
        }
      }
    }
    return moves;
  }
  return [];
}

// apps/server/src/index.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);

// apps/server/src/db.ts
var import_pg = __toESM(require("pg"), 1);
var { Pool } = import_pg.default;
var connectionString = "postgresql://kaiki_c_514a2ba2ad0bacfc5179120b:Kk1!nI4jRycMWUGDUk-1HFzTJrgNY6CH@ep-20ca23b6c9a6.kaiki.ru:5432/kozel-game?sslmode=require&connection_limit=10";
var pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
  // Обязательно для облачных баз
});
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar TEXT,
    status VARCHAR(255),
    friends JSONB DEFAULT '[]',
    friendRequests JSONB DEFAULT '[]',
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
  );
`).catch((err) => console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u044B:", err));
var db = {
  getUsers: async () => {
    try {
      const res = await pool.query("SELECT * FROM users ORDER BY id ASC");
      return res.rows;
    } catch (e) {
      console.error("DB Error getUsers:", e);
      return [];
    }
  },
  saveUsers: async (users) => {
    try {
      for (const u of users) {
        await pool.query(`
          INSERT INTO users (id, username, password, fullname, email, avatar, status, friends, friendRequests, wins, losses)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password,
            fullname = EXCLUDED.fullname,
            email = EXCLUDED.email,
            avatar = EXCLUDED.avatar,
            status = EXCLUDED.status,
            friends = EXCLUDED.friends,
            friendRequests = EXCLUDED.friendRequests,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses;
        `, [
          u.id,
          u.username,
          u.password,
          u.fullname,
          u.email,
          u.avatar || "",
          u.status || "\u0412 \u0441\u0435\u0442\u0438",
          JSON.stringify(u.friends || []),
          JSON.stringify(u.friendRequests || []),
          u.wins || 0,
          u.losses || 0
        ]);
      }
    } catch (e) {
      console.error("DB Error saveUsers:", e);
    }
  }
};

// apps/server/src/index.ts
var app = (0, import_fastify.default)({ logger: true });
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;
var rooms = /* @__PURE__ */ new Map();
var playersInRoom = /* @__PURE__ */ new Map();
var turnTimers = /* @__PURE__ */ new Map();
var botTimeouts = /* @__PURE__ */ new Map();
var onlineUsers = /* @__PURE__ */ new Map();
var frozenPlayers = /* @__PURE__ */ new Map();
var REGEX_NICKNAME = /^[a-zA-Zа-яА-ЯёЁ\s]{1,21}$/;
var REGEX_PASSWORD = /^.{1,21}$/;
var REGEX_FULLNAME = /^[a-zA-Zа-яА-ЯёЁ\s-]{1,50}$/;
var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function main() {
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") reply.status(200).send();
  });
  app.post("/api/register", async (req, reply) => {
    const { username, password, fullname, email } = req.body;
    if (!username || !password || !fullname || !email) return reply.code(400).send({ error: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0432\u0441\u0435 \u043F\u043E\u043B\u044F" });
    if (!REGEX_NICKNAME.test(username)) return reply.code(400).send({ error: "\u041D\u0438\u043A\u043D\u0435\u0439\u043C: \u0442\u043E\u043B\u044C\u043A\u043E \u0431\u0443\u043A\u0432\u044B \u0438 \u043F\u0440\u043E\u0431\u0435\u043B\u044B, \u0434\u043E 21 \u0441\u0438\u043C\u0432\u043E\u043B\u0430" });
    if (!REGEX_PASSWORD.test(password)) return reply.code(400).send({ error: "\u041F\u0430\u0440\u043E\u043B\u044C: \u0434\u043E 21 \u0441\u0438\u043C\u0432\u043E\u043B\u0430" });
    if (!REGEX_FULLNAME.test(fullname)) return reply.code(400).send({ error: "\u0424\u0418\u041E \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E" });
    if (!REGEX_EMAIL.test(email)) return reply.code(400).send({ error: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 Email" });
    const users = await db.getUsers();
    if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) return reply.code(400).send({ error: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442" });
    try {
      const hash = await import_bcryptjs.default.hash(password, 10);
      const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
      users.push({ id: newId, username, password: hash, fullname, email, avatar: "", status: "\u0412 \u0441\u0435\u0442\u0438", friends: [], friendRequests: [], wins: 0, losses: 0 });
      await db.saveUsers(users);
      return { success: true };
    } catch (e) {
      return reply.code(500).send({ error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430" });
    }
  });
  app.post("/api/login", async (req, reply) => {
    const { username, password } = req.body;
    const users = await db.getUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return reply.code(400).send({ error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C" });
    const isValid = await import_bcryptjs.default.compare(password, user.password);
    if (!isValid) return reply.code(400).send({ error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C" });
    const token = import_jsonwebtoken.default.sign({ id: user.id, username: user.username, fullname: user.fullname }, "SUPER_SECRET_KEY_123", { expiresIn: "7d" });
    return { success: true, token, user: { username: user.username, fullname: user.fullname, avatar: user.avatar || "", status: user.status || "\u0412 \u0441\u0435\u0442\u0438", friends: user.friends || [], wins: user.wins || 0, losses: user.losses || 0 } };
  });
  app.get("/api/user/profile/:username", async (req, reply) => {
    const { username } = req.params;
    const users = await db.getUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    return { username: user.username, wins: user.wins || 0, losses: user.losses || 0, avatar: user.avatar || "", status: user.status || "\u0412 \u0441\u0435\u0442\u0438" };
  });
  app.post("/api/user/update", async (req, reply) => {
    const { username, status, avatar } = req.body;
    const users = await db.getUsers();
    const userIndex = users.findIndex((u) => u.username === username);
    if (userIndex === -1) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    if (status !== void 0) users[userIndex].status = status;
    if (avatar !== void 0) users[userIndex].avatar = avatar;
    await db.saveUsers(users);
    return { success: true };
  });
  app.get("/api/users/search", async (req, reply) => {
    const queryParams = req.query;
    let q = queryParams.q;
    if (!q || typeof q !== "string") return { users: [] };
    const searchString = q.replace(/@/g, "").trim().toLowerCase();
    if (!searchString) return { users: [] };
    const users = await db.getUsers();
    const results = users.filter((u) => u.username.toLowerCase().includes(searchString)).map((u) => ({
      username: u.username,
      fullname: u.fullname,
      avatar: u.avatar,
      status: u.status,
      online: onlineUsers.has(u.username),
      wins: u.wins || 0,
      losses: u.losses || 0
    }));
    return { users: results };
  });
  app.post("/api/friends/request", async (req, reply) => {
    const { username, targetUsername } = req.body;
    const users = await db.getUsers();
    const user = users.find((u) => u.username === username);
    const target = users.find((u) => u.username === targetUsername);
    if (!user || !target) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    if (user.username === target.username) return reply.code(400).send({ error: "\u041D\u0435\u043B\u044C\u0437\u044F \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0435\u0431\u044F" });
    if (user.friends?.includes(targetUsername)) return reply.code(400).send({ error: "\u0423\u0436\u0435 \u0432 \u0434\u0440\u0443\u0437\u044C\u044F\u0445" });
    if (!target.friendRequests) target.friendRequests = [];
    if (!target.friendRequests.includes(username)) {
      target.friendRequests.push(username);
      await db.saveUsers(users);
    }
    return { success: true };
  });
  app.post("/api/friends/respond", async (req, reply) => {
    const { username, requesterUsername, action } = req.body;
    const users = await db.getUsers();
    const user = users.find((u) => u.username === username);
    const requester = users.find((u) => u.username === requesterUsername);
    if (!user || !requester) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    if (user.friendRequests) user.friendRequests = user.friendRequests.filter((r) => r !== requesterUsername);
    if (action === "accept") {
      if (!user.friends) user.friends = [];
      if (!requester.friends) requester.friends = [];
      if (!user.friends.includes(requesterUsername)) user.friends.push(requesterUsername);
      if (!requester.friends.includes(username)) requester.friends.push(username);
    }
    await db.saveUsers(users);
    return { success: true };
  });
  app.post("/api/friends/remove", async (req, reply) => {
    const { username, friendUsername } = req.body;
    const users = await db.getUsers();
    const user = users.find((u) => u.username === username);
    const friend = users.find((u) => u.username === friendUsername);
    if (!user || !friend) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    if (user.friends) user.friends = user.friends.filter((f) => f !== friendUsername);
    if (friend.friends) friend.friends = friend.friends.filter((f) => f !== username);
    await db.saveUsers(users);
    return { success: true };
  });
  app.get("/api/friends/list/:username", async (req, reply) => {
    const { username } = req.params;
    const users = await db.getUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return reply.code(404).send({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    const friendsList = (user.friends || []).map((fName) => {
      const f = users.find((u) => u.username === fName);
      return f ? { username: f.username, fullname: f.fullname, avatar: f.avatar, status: f.status, online: onlineUsers.has(f.username), wins: f.wins || 0, losses: f.losses || 0 } : null;
    }).filter(Boolean);
    const requestsList = (user.friendRequests || []).map((rName) => {
      const r = users.find((u) => u.username === rName);
      return r ? { username: r.username, fullname: r.fullname, avatar: r.avatar } : null;
    }).filter(Boolean);
    return { friends: friendsList, requests: requestsList };
  });
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log("Server started on port " + PORT);
  const io = new import_socket.Server(app.server, { cors: { origin: "*" } });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044F"));
    try {
      const decoded = import_jsonwebtoken.default.verify(token, "SUPER_SECRET_KEY_123");
      socket.data = { user: decoded };
      next();
    } catch (err) {
      next(new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D"));
    }
  });
  function clearTurnTimer(roomId) {
    if (turnTimers.has(roomId)) {
      clearTimeout(turnTimers.get(roomId));
      turnTimers.delete(roomId);
    }
    if (botTimeouts.has(roomId)) {
      clearTimeout(botTimeouts.get(roomId));
      botTimeouts.delete(roomId);
    }
  }
  function startTurnTimer(io2, roomId) {
    clearTurnTimer(roomId);
    const room = rooms.get(roomId);
    if (!room || room.phase !== "playing") return;
    const player = room.trick ? room.trick.respondent : room.currentPlayer;
    const frozen = frozenPlayers.get(roomId);
    if (frozen?.has(player)) return;
    const timer = setTimeout(async () => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom || currentRoom.phase !== "playing") return;
      const player2 = currentRoom.trick ? currentRoom.trick.respondent : currentRoom.currentPlayer;
      const hand = currentRoom.players[player2]?.hand;
      if (!hand || hand.length === 0) {
        const res = applyEvent(currentRoom, { type: "PASS", player: player2, cards: [] });
        if (!res.ok) return;
        let state = res.state;
        if (state.trick === null && state.lastTrickWinner !== null) {
          const drawRes = applyEvent(state, { type: "DRAW", winner: state.lastTrickWinner });
          if (drawRes.ok) state = drawRes.state;
        }
        rooms.set(roomId, state);
        await checkAndBroadcast(io2, roomId, state);
        return;
      }
      if (currentRoom.trick) {
        const cardToPass = [hand[hand.length - 1]];
        const res = applyEvent(currentRoom, { type: "PASS", player: player2, cards: cardToPass });
        if (res.ok) {
          rooms.set(roomId, res.state);
          await checkAndBroadcast(io2, roomId, res.state);
        }
      } else {
        const cardToAttack = [hand[hand.length - 1]];
        const res = applyEvent(currentRoom, { type: "ATTACK", player: player2, cards: cardToAttack });
        if (res.ok) {
          rooms.set(roomId, res.state);
          await checkAndBroadcast(io2, roomId, res.state);
        }
      }
    }, 3e4);
    turnTimers.set(roomId, timer);
  }
  function rollDiceForRoom(io2, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const rolls = {};
    let maxRoll = 0;
    let winners = [];
    room.players.forEach((p) => {
      const roll = Math.floor(Math.random() * 6) + 1;
      rolls[p.id] = roll;
      if (roll > maxRoll) {
        maxRoll = roll;
        winners = [p.id];
      } else if (roll === maxRoll) {
        winners.push(p.id);
      }
    });
    const newState = { ...room, phase: "dice-roll", diceRolls: rolls, stateVersion: (room.stateVersion || 0) + 1 };
    rooms.set(roomId, newState);
    broadcastState(io2, roomId, newState);
    setTimeout(async () => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom) return;
      if (winners.length === 1) {
        const winnerId = winners[0];
        const seed = Math.floor(Math.random() * 1e6);
        const res = applyEvent(currentRoom, { type: "START_ROUND", firstPlayer: winnerId, seed });
        if (res.ok) {
          rooms.set(roomId, res.state);
          await checkAndBroadcast(io2, roomId, res.state);
        }
      } else {
        rollDiceForRoom(io2, roomId);
      }
    }, 4e3);
  }
  async function botMove(io2, roomId) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "playing") return;
    if (room.mode !== "1v1") return;
    const botId = 1;
    const bot = room.players[botId];
    if (!bot) return;
    try {
      if (!room.trick && room.currentPlayer === botId) {
        const card = bot.hand[0];
        const res = applyEvent(room, { type: "ATTACK", player: botId, cards: [card] });
        if (res.ok) {
          rooms.set(roomId, res.state);
          await checkAndBroadcast(io2, roomId, res.state);
        }
        return;
      }
      if (room.trick && room.trick.respondent === botId) {
        const required = room.trick.required;
        const top = room.trick.topCards;
        const sortedHand = [...bot.hand].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
        let beatCards = null;
        const targetSuit = top[0].suit;
        const sameSuit = sortedHand.filter((c) => c.suit === targetSuit);
        if (sameSuit.length >= required) {
          const highest = sameSuit.slice(-required);
          try {
            if (canBeat(highest, top, room.trump)) beatCards = highest;
          } catch {
          }
        }
        if (!beatCards && room.trump) {
          const trumpCards = sortedHand.filter((c) => c.suit === room.trump);
          if (trumpCards.length >= required) {
            const highestTrumps = trumpCards.slice(-required);
            try {
              if (canBeat(highestTrumps, top, room.trump)) beatCards = highestTrumps;
            } catch {
            }
          }
        }
        if (beatCards) {
          const res2 = applyEvent(room, { type: "BEAT", player: botId, cards: beatCards });
          if (res2.ok) {
            rooms.set(roomId, res2.state);
            await checkAndBroadcast(io2, roomId, res2.state);
            return;
          }
        }
        const res = applyEvent(room, { type: "PASS", player: botId, cards: [] });
        if (res.ok) {
          let state = res.state;
          if (state.trick === null && state.lastTrickWinner !== null) {
            const drawRes = applyEvent(state, { type: "DRAW", winner: state.lastTrickWinner });
            if (drawRes.ok) state = drawRes.state;
          }
          rooms.set(roomId, state);
          await checkAndBroadcast(io2, roomId, state);
        }
        return;
      }
    } catch (e) {
      console.error("Bot exception", e);
    }
  }
  function createDevRoom(socket) {
    const roomId = "DEV";
    const name = socket.data.user.username;
    const initialState = {
      mode: "1v1",
      players: [{ id: 0, side: "A", hand: [], name }, { id: 1, side: "B", hand: [], name: "\u{1F916} BOT" }],
      deck: [],
      trumpCard: null,
      trump: null,
      trumpChanged: false,
      trumpChangeEvent: null,
      currentPlayer: 0,
      trick: null,
      lastTrickWinner: null,
      phase: "finished",
      matchScore: { A: 0, B: 0 },
      multiplier: 1,
      roundNumber: 0,
      bita: { A: [], B: [] },
      lastRoundPoints: null,
      diceRolls: null,
      stateVersion: 0,
      turnDeadline: null,
      settled: false
    };
    rooms.set(roomId, initialState);
    playersInRoom.set(roomId, [socket.id, "__BOT__"]);
    socket.join(roomId);
    return roomId;
  }
  function findRoomOfSocket(socketId) {
    for (const [roomId, players] of playersInRoom.entries()) {
      if (players.includes(socketId)) return roomId;
    }
    return null;
  }
  io.on("connection", (socket) => {
    const myName = socket.data.user.username;
    socket.on("register_online", () => {
      onlineUsers.set(myName, socket.id);
      socket.broadcast.emit("user_status_change", { username: myName, online: true });
    });
    socket.on("disconnect", () => {
      onlineUsers.delete(myName);
      socket.broadcast.emit("user_status_change", { username: myName, online: false });
    });
    socket.on("new_friend_request", ({ targetUsername, fromUsername }) => {
      const targetSocket = onlineUsers.get(targetUsername);
      if (targetSocket) io.to(targetSocket).emit("friend_request_received", { fromUsername });
    });
    socket.on("send_invite", ({ from, to, roomId }) => {
      const targetSocket = onlineUsers.get(to);
      if (targetSocket) io.to(targetSocket).emit("receive_invite", { from, roomId });
    });
    socket.on("accept_invite", ({ from, roomId }) => {
      const senderSocket = onlineUsers.get(from);
      if (senderSocket) io.to(senderSocket).emit("invite_accepted", { roomId });
    });
    socket.on("create_room", (mode, dataOrCallback, maybeCallback) => {
      let callback = maybeCallback;
      if (typeof dataOrCallback === "function") {
        callback = dataOrCallback;
      }
      const roomId = Math.random().toString(36).substring(2, 8);
      const initialState = {
        mode,
        players: mode === "1v1" ? [{ id: 0, side: "A", hand: [], name: myName }, { id: 1, side: "B", hand: [], name: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435..." }] : [{ id: 0, side: "A", hand: [], name: myName }, { id: 1, side: "B", hand: [], name: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435..." }, { id: 2, side: "A", hand: [], name: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435..." }, { id: 3, side: "B", hand: [], name: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435..." }],
        deck: [],
        trumpCard: null,
        trump: null,
        trumpChanged: false,
        trumpChangeEvent: null,
        currentPlayer: 0,
        trick: null,
        lastTrickWinner: null,
        phase: "finished",
        matchScore: { A: 0, B: 0 },
        multiplier: 1,
        roundNumber: 0,
        bita: { A: [], B: [] },
        lastRoundPoints: null,
        diceRolls: null,
        stateVersion: 0,
        turnDeadline: null,
        settled: false
      };
      rooms.set(roomId, initialState);
      playersInRoom.set(roomId, []);
      socket.join(roomId);
      if (typeof callback === "function") callback({ roomId });
    });
    socket.on("create_dev_room", (callback) => {
      const roomId = createDevRoom(socket);
      if (typeof callback === "function") callback({ roomId });
    });
    socket.on("join_room", (roomId) => {
      const room = rooms.get(roomId);
      if (!room) return;
      socket.join(roomId);
      const players = playersInRoom.get(roomId) || [];
      if (!players.includes(socket.id)) {
        players.push(socket.id);
        playersInRoom.set(roomId, players);
        const newPlayerIdx = players.length - 1;
        if (room.players[newPlayerIdx]) room.players[newPlayerIdx].name = myName;
        if (myName === "Vladislav" && roomId !== "DEV") io.to(roomId).emit("dev_joined", { name: "Vladislav" });
      }
      const maxPlayers = room.mode === "1v1" ? 2 : 4;
      if (players.length === maxPlayers && room.phase === "finished") rollDiceForRoom(io, roomId);
      else broadcastState(io, roomId, room);
    });
    socket.on("next_round", async (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== "round-scored") return;
      const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
      const seed = Math.floor(Math.random() * 1e6);
      const res = applyEvent(cleanState, { type: "START_ROUND", firstPlayer: room.lastTrickWinner ?? 0, seed });
      if (res.ok) {
        rooms.set(roomId, res.state);
        await checkAndBroadcast(io, roomId, res.state);
      }
    });
    socket.on("chat_message", ({ roomId, text }) => {
      const msgId = Math.random().toString(36).substring(7);
      const now = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (myName === "Vladislav" && typeof text === "string" && text.startsWith("/")) {
        const parts = text.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts[1];
        const room = rooms.get(roomId);
        if (cmd === "/kick" && arg) {
          if (!room) return;
          const players = playersInRoom.get(roomId) || [];
          const targetIdx = room.players.findIndex((p) => p.name === arg);
          if (targetIdx !== -1 && players[targetIdx] && players[targetIdx] !== "__BOT__") {
            io.to(players[targetIdx]).emit("kicked", `\u0412\u0430\u0441 \u0438\u0441\u043A\u043B\u044E\u0447\u0438\u043B \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440`);
            io.to(roomId).emit("chat_message", { id: msgId, sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: `\u{1F462} \u0418\u0433\u0440\u043E\u043A ${arg} \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D \u0438\u0437 \u043A\u043E\u043C\u043D\u0430\u0442\u044B`, time: now });
          } else {
            socket.emit("chat_message", { id: msgId, sender: "DEBUG", text: `\u0418\u0433\u0440\u043E\u043A ${arg} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`, time: now });
          }
          return;
        }
        if (cmd === "/rain") {
          io.to(roomId).emit("admin_rain");
          io.to(roomId).emit("chat_message", { id: msgId, sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: "\u{1F389} \u0414\u043E\u0436\u0434\u044C \u0438\u0437 \u044D\u043C\u043E\u0434\u0437\u0438!", time: now });
          return;
        }
        if (cmd === "/stats") {
          if (!room) return;
          const myIdx = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1;
          const hands = room.players.map((p) => `${p.name}: ${p.hand.length} \u043A\u0430\u0440\u0442`).join(" | ");
          const info = `\u{1F4CA} \u041A\u043E\u043B\u043E\u0434\u0430: ${room.deck.length} | \u041A\u043E\u0437\u044B\u0440\u044C: ${room.trump} | \u0424\u0430\u0437\u0430: ${room.phase} | \u0427\u0435\u0439 \u0445\u043E\u0434: ${room.currentPlayer} | \u0422\u0432\u043E\u0439 \u0438\u043D\u0434\u0435\u043A\u0441: ${myIdx} | ${hands}`;
          socket.emit("chat_message", { id: msgId, sender: "DEBUG", text: info, time: now });
          return;
        }
        if (cmd === "/reset") {
          if (!room) return;
          const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
          const seed = Math.floor(Math.random() * 1e6);
          const res = applyEvent(cleanState, { type: "START_ROUND", firstPlayer: room.lastTrickWinner ?? 0, seed });
          if (res.ok) {
            rooms.set(roomId, res.state);
            checkAndBroadcast(io, roomId, res.state);
          }
          io.to(roomId).emit("chat_message", { id: msgId, sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: "\u{1F504} \u041A\u043E\u043D \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C", time: now });
          return;
        }
        if (cmd === "/secret") {
          io.to(roomId).emit("admin_secret_fx");
          io.to(roomId).emit("chat_message", { id: msgId, sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: "\u{1F451} \u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u0442 \u0437\u0430 \u0432\u0430\u043C\u0438... \u0423\u0434\u0430\u0447\u0438, \u0441\u043C\u0435\u0440\u0442\u043D\u044B\u0435! \u{1F0CF}", time: now });
          return;
        }
        socket.emit("chat_message", { id: msgId, sender: "DEBUG", text: `\u0418\u0433\u0440\u043E\u0432\u044B\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B: /kick, /rain, /stats, /reset, /secret. \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u2014 \u0432 Dev Console (\u{1F6E0}\uFE0F)`, time: now });
        return;
      }
      io.to(roomId).emit("chat_message", { id: msgId, sender: myName, text, time: now });
    });
    socket.on("dev_command", ({ command }) => {
      if (myName !== "Vladislav") return;
      const cmd = command.trim();
      const parts = cmd.split(/\s+/);
      const base = parts[0].toLowerCase();
      const arg = parts[1];
      const reply = (text, type = "info") => {
        socket.emit("dev_command_result", { command: cmd, text, type });
      };
      const myRoomId = findRoomOfSocket(socket.id);
      const myRoom = myRoomId ? rooms.get(myRoomId) : null;
      if (base === "/gold") {
        socket.emit("admin_gold");
        reply("\u{1F4B0} \u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0434\u043E\u0436\u0434\u044C \u0437\u0430\u043F\u0443\u0449\u0435\u043D (\u0432\u0438\u0434\u0435\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u0431\u0435)", "success");
        return;
      }
      if (base === "/whoami") {
        if (!myRoomId || !myRoom) {
          reply("\u274C \u0422\u044B \u043D\u0435 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435", "error");
          return;
        }
        const myIdx = playersInRoom.get(myRoomId)?.indexOf(socket.id) ?? -1;
        const me = myRoom.players[myIdx];
        reply(`\u{1F464} \u0422\u044B: ${me?.name}`, "success");
        reply(`\u0418\u043D\u0434\u0435\u043A\u0441: ${myIdx} | \u0421\u0442\u043E\u0440\u043E\u043D\u0430: ${me?.side} | \u041A\u0430\u0440\u0442: ${me?.hand.length}`);
        reply(`\u0424\u0430\u0437\u0430: ${myRoom.phase} | \u041A\u043E\u043D: ${myRoom.roundNumber} | \u041A\u043E\u0437\u044B\u0440\u044C: ${myRoom.trump} | \u041A\u043E\u043B\u043E\u0434\u0430: ${myRoom.deck.length}`);
        return;
      }
      if (base === "/freeze" && arg) {
        if (!myRoomId || !myRoom) {
          reply("\u274C \u0422\u044B \u043D\u0435 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435", "error");
          return;
        }
        const targetIdx = myRoom.players.findIndex((p) => p.name === arg);
        if (targetIdx === -1) {
          reply(`\u274C \u0418\u0433\u0440\u043E\u043A ${arg} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435`, "error");
          return;
        }
        const frozen = frozenPlayers.get(myRoomId) || /* @__PURE__ */ new Set();
        if (frozen.has(targetIdx)) {
          frozen.delete(targetIdx);
          reply(`\u{1F525} ${arg} \u0440\u0430\u0437\u043C\u043E\u0440\u043E\u0436\u0435\u043D`, "success");
        } else {
          frozen.add(targetIdx);
          reply(`\u2744\uFE0F ${arg} \u0437\u0430\u043C\u043E\u0440\u043E\u0436\u0435\u043D \u2014 \u0442\u0430\u0439\u043C\u0435\u0440 \u0441\u0442\u043E\u0438\u0442`, "success");
          if (myRoom.currentPlayer === targetIdx) clearTurnTimer(myRoomId);
        }
        frozenPlayers.set(myRoomId, frozen);
        io.to(myRoomId).emit("chat_message", { id: Math.random().toString(36).substring(7), sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: frozen.has(targetIdx) ? `\u2744\uFE0F ${arg} \u0437\u0430\u043C\u043E\u0440\u043E\u0436\u0435\u043D` : `\u{1F525} ${arg} \u0440\u0430\u0437\u043C\u043E\u0440\u043E\u0436\u0435\u043D`, time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
        return;
      }
      if (base === "/reverse") {
        if (!myRoomId || !myRoom) {
          reply("\u274C \u0422\u044B \u043D\u0435 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435", "error");
          return;
        }
        io.to(myRoomId).emit("admin_reverse");
        io.to(myRoomId).emit("chat_message", { id: Math.random().toString(36).substring(7), sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410", text: "\u{1F504} \u0421\u0442\u043E\u043B \u043F\u0435\u0440\u0435\u0432\u0451\u0440\u043D\u0443\u0442!", time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
        reply("\u{1F504} \u0421\u0442\u043E\u043B \u043F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u0442 \u0443 \u0432\u0441\u0435\u0445", "success");
        return;
      }
      if (base === "/broadcast") {
        const broadcastText = parts.slice(1).join(" ");
        if (!broadcastText) {
          reply("\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435: /broadcast [\u0442\u0435\u043A\u0441\u0442]", "error");
          return;
        }
        io.emit("global_broadcast", { text: broadcastText, from: "Vladislav" });
        reply(`\u{1F4E2} \u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u0432\u0441\u0435\u043C: "${broadcastText}"`, "success");
        return;
      }
      if (base === "/listrooms") {
        reply(`\u{1F4CB} \u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u043A\u043E\u043C\u043D\u0430\u0442: ${rooms.size}`, "success");
        if (rooms.size === 0) {
          reply("(\u043F\u0443\u0441\u0442\u043E)");
          return;
        }
        for (const [id, state] of rooms.entries()) reply(`\u2022 ${id} | ${state.mode} | ${state.phase} | \u041A\u043E\u043D ${state.roundNumber} | ${state.players.map((p) => p.name).join(" vs ")}`);
        return;
      }
      if (base === "/spawnbot") {
        if (myRoomId) {
          reply(`\u26A0\uFE0F \u0422\u044B \u0443\u0436\u0435 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435 ${myRoomId}. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0439\u0434\u0438 \u0438\u0437 \u043D\u0435\u0451.`, "error");
          return;
        }
        const newRoomId = createDevRoom(socket);
        reply(`\u2705 DEV-\u043A\u043E\u043C\u043D\u0430\u0442\u0430 ${newRoomId} \u0441\u043E\u0437\u0434\u0430\u043D\u0430. \u041F\u0435\u0440\u0435\u0445\u043E\u0436\u0443 \u0432 \u0438\u0433\u0440\u0443...`, "success");
        socket.emit("dev_room_created", { roomId: newRoomId });
        rollDiceForRoom(io, newRoomId);
        return;
      }
      reply(`\u274C \u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430: ${base}`, "error");
      reply(`\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435: /gold, /whoami, /freeze [\u043D\u0438\u043A], /reverse, /broadcast [\u0442\u0435\u043A\u0441\u0442], /listrooms, /spawnbot`);
    });
    socket.on("send_reaction", ({ roomId, emoji }) => {
      const left = Math.floor(Math.random() * 80) + 10;
      io.to(roomId).emit("reaction", { id: Date.now(), emoji, sender: myName, left });
    });
    socket.on("play_card", async (roomId, cards) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== "playing") return;
      const playerIndex = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1;
      if (playerIndex === -1) return;
      const opponentIdx = (playerIndex + 1) % (room.mode === "1v1" ? 2 : 4);
      const opponentHandSize = room.players[opponentIdx].hand.length;
      if (opponentHandSize > 0 && cards.length > opponentHandSize) {
        socket.emit("error", "\u041D\u0435\u043B\u044C\u0437\u044F \u0445\u043E\u0434\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u0430\u043C\u0438 \u0431\u043E\u043B\u044C\u0448\u0435, \u0447\u0435\u043C \u0435\u0441\u0442\u044C \u0443 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430!");
        return;
      }
      const isSpecial = validateSpecial(cards, room.trump);
      if (!isSpecial && cards.length > 1) {
        const suit = cards[0].suit;
        if (!cards.every((c) => c.suit === suit)) {
          socket.emit("error", "\u0425\u043E\u0434\u0438\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u0440\u0442\u0430\u043C\u0438 \u043E\u0434\u043D\u043E\u0439 \u043C\u0430\u0441\u0442\u0438!");
          return;
        }
      }
      const res = applyEvent(room, { type: "ATTACK", player: playerIndex, cards });
      if (!res.ok) {
        socket.emit("error", `\u041E\u0448\u0438\u0431\u043A\u0430: ${res.error}`);
        return;
      }
      rooms.set(roomId, res.state);
      await checkAndBroadcast(io, roomId, res.state);
    });
    socket.on("pass_or_beat", async (roomId, action, cards) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== "playing") return;
      const playerIndex = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1;
      if (playerIndex === -1) return;
      const res = action === "beat" ? applyEvent(room, { type: "BEAT", player: playerIndex, cards }) : applyEvent(room, { type: "PASS", player: playerIndex, cards });
      if (!res.ok) {
        socket.emit("error", `\u041E\u0448\u0438\u0431\u043A\u0430: ${res.error}`);
        return;
      }
      let state = res.state;
      if (state.trick === null && state.lastTrickWinner !== null) {
        const drawRes = applyEvent(state, { type: "DRAW", winner: state.lastTrickWinner });
        if (drawRes.ok) state = drawRes.state;
      }
      rooms.set(roomId, state);
      await checkAndBroadcast(io, roomId, state);
    });
    socket.on("admin_get_rooms", async () => {
      if (myName !== "Vladislav") return;
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map((p) => p.name), matchScore: state.matchScore }));
      socket.emit("admin_rooms_list", roomsList);
    });
    socket.on("admin_close_room", async (roomId) => {
      if (myName !== "Vladislav") return;
      const room = rooms.get(roomId);
      if (!room) return;
      io.to(roomId).emit("kicked", "\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C");
      rooms.delete(roomId);
      playersInRoom.delete(roomId);
      frozenPlayers.delete(roomId);
      clearTurnTimer(roomId);
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map((p) => p.name), matchScore: state.matchScore }));
      socket.emit("admin_rooms_list", roomsList);
    });
  });
  async function checkAndBroadcast(io2, roomId, state) {
    let currentState = state;
    while (currentState.phase === "playing" && currentState.trick && currentState.players[currentState.trick.respondent]?.hand.length === 0) {
      const res = applyEvent(currentState, { type: "PASS", player: currentState.trick.respondent, cards: [] });
      if (!res.ok) break;
      currentState = res.state;
      if (currentState.trick === null && currentState.lastTrickWinner !== null) {
        const drawRes = applyEvent(currentState, { type: "DRAW", winner: currentState.lastTrickWinner });
        if (drawRes.ok) currentState = drawRes.state;
      }
    }
    const numPlayers = currentState.mode === "1v1" ? 2 : 4;
    const activePlayers = currentState.players.slice(0, numPlayers);
    const endOfRound = currentState.deck.length === 0 && currentState.trick === null && activePlayers.every((p) => p.hand.length === 0);
    if (endOfRound && currentState.phase === "playing") {
      const res = applyEvent(currentState, { type: "SCORE_ROUND" });
      if (res.ok) {
        rooms.set(roomId, res.state);
        broadcastState(io2, roomId, res.state);
        clearTurnTimer(roomId);
      }
    } else {
      rooms.set(roomId, currentState);
      broadcastState(io2, roomId, currentState);
      if (currentState.phase === "playing") startTurnTimer(io2, roomId);
      else if (currentState.phase === "finished") {
        if (!currentState.settled) {
          const users = await db.getUsers();
          const p1Name = currentState.players[0]?.name;
          const p2Name = currentState.players[1]?.name;
          const p1 = users.find((u) => u.username === p1Name);
          const p2 = users.find((u) => u.username === p2Name);
          if (p1 && p2) {
            if (currentState.matchScore.A >= 24) {
              p2.wins = (p2.wins || 0) + 1;
              p1.losses = (p1.losses || 0) + 1;
            } else if (currentState.matchScore.B >= 24) {
              p1.wins = (p1.wins || 0) + 1;
              p2.losses = (p2.losses || 0) + 1;
            }
            await db.saveUsers(users);
          }
          currentState.settled = true;
          rooms.set(roomId, currentState);
        }
        clearTurnTimer(roomId);
      } else clearTurnTimer(roomId);
    }
  }
  function broadcastState(io2, roomId, state) {
    const players = playersInRoom.get(roomId) || [];
    players.forEach((sockId, index) => {
      if (sockId && sockId !== "__BOT__") {
        const legalMoves = getLegalMoves(state, index);
        const view = project(state, index, legalMoves);
        io2.to(sockId).emit("game_state", view);
      }
    });
    if (roomId === "DEV" && state.phase === "playing") {
      if (botTimeouts.has(roomId)) clearTimeout(botTimeouts.get(roomId));
      const timeout = setTimeout(() => botMove(io2, roomId), 1200);
      botTimeouts.set(roomId, timeout);
    }
  }
}
main().catch(console.error);
