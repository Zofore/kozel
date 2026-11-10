import Fastify from 'fastify';
import { Server } from 'socket.io';
import { applyEvent, GameState, canBeat, validateSpecial, project, getLegalMoves, PlayerId } from '@kozel/game-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const app = Fastify({ logger: true });
const PORT = 3005;
const rooms = new Map<string, GameState>();
const playersInRoom = new Map<string, string[]>();
const turnTimers = new Map<string, NodeJS.Timeout>();
const onlineUsers = new Map<string, string>();
const frozenPlayers = new Map<string, Set<number>>();

const REGEX_NICKNAME = /^[a-zA-Zа-яА-ЯёЁ\s]{1,21}$/;
const REGEX_PASSWORD = /^.{1,21}$/;
const REGEX_FULLNAME = /^[a-zA-Zа-яА-ЯёЁ\s-]{1,50}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') reply.status(200).send();
  });

  app.post('/api/register', async (req, reply) => {
    const { username, password, fullname, email } = req.body as any;
    if (!username || !password || !fullname || !email) return reply.code(400).send({ error: 'Заполните все поля' });
    if (!REGEX_NICKNAME.test(username)) return reply.code(400).send({ error: 'Никнейм: только буквы и пробелы, до 21 символа' });
    if (!REGEX_PASSWORD.test(password)) return reply.code(400).send({ error: 'Пароль: до 21 символа' });
    if (!REGEX_FULLNAME.test(fullname)) return reply.code(400).send({ error: 'ФИО некорректно' });
    if (!REGEX_EMAIL.test(email)) return reply.code(400).send({ error: 'Некорректный Email' });

    const users = db.getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return reply.code(400).send({ error: 'Этот никнейм уже занят' });

    try {
      const hash = await bcrypt.hash(password, 10);
      users.push({ id: users.length + 1, username, password: hash, fullname, email, avatar: '', status: 'В сети', friends: [], friendRequests: [], wins: 0, losses: 0 });
      db.saveUsers(users);
      return { success: true };
    } catch (e) { return reply.code(500).send({ error: 'Ошибка сервера' }); }
  });

  app.post('/api/login', async (req, reply) => {
    const { username, password } = req.body as any;
    const users = db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return reply.code(400).send({ error: 'Неверный логин или пароль' });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return reply.code(400).send({ error: 'Неверный логин или пароль' });
    const token = jwt.sign({ id: user.id, username: user.username, fullname: user.fullname }, 'SUPER_SECRET_KEY_123', { expiresIn: '7d' });
    return { success: true, token, user: { username: user.username, fullname: user.fullname, avatar: user.avatar || '', status: user.status || 'В сети', friends: user.friends || [], wins: user.wins || 0, losses: user.losses || 0 } };
  });

  app.post('/api/user/update', async (req, reply) => {
    const { username, status, avatar } = req.body as any;
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (status !== undefined) users[userIndex].status = status;
    if (avatar !== undefined) users[userIndex].avatar = avatar;
    db.saveUsers(users);
    return { success: true };
  });

  app.get('/api/users/search', async (req, reply) => {
    const queryParams = req.query as any;
    let q = queryParams.q;
    if (!q || typeof q !== 'string') return { users: [] };
    const searchString = q.replace(/@/g, '').trim().toLowerCase();
    if (!searchString) return { users: [] };
    const users = db.getUsers();
    const results = users.filter(u => u.username.toLowerCase().includes(searchString)).map(u => ({
      username: u.username, fullname: u.fullname, avatar: u.avatar, status: u.status, online: onlineUsers.has(u.username), wins: u.wins || 0, losses: u.losses || 0
    }));
    return { users: results };
  });

  app.post('/api/friends/request', async (req, reply) => {
    const { username, targetUsername } = req.body as any;
    const users = db.getUsers();
    const user = users.find(u => u.username === username);
    const target = users.find(u => u.username === targetUsername);
    if (!user || !target) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (user.username === target.username) return reply.code(400).send({ error: 'Нельзя добавить себя' });
    if (user.friends?.includes(targetUsername)) return reply.code(400).send({ error: 'Уже в друзьях' });
    if (!target.friendRequests) target.friendRequests = [];
    if (!target.friendRequests.includes(username)) { target.friendRequests.push(username); db.saveUsers(users); }
    return { success: true };
  });

  app.post('/api/friends/respond', async (req, reply) => {
    const { username, requesterUsername, action } = req.body as any;
    const users = db.getUsers();
    const user = users.find(u => u.username === username);
    const requester = users.find(u => u.username === requesterUsername);
    if (!user || !requester) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (user.friendRequests) user.friendRequests = user.friendRequests.filter((r: string) => r !== requesterUsername);
    if (action === 'accept') {
      if (!user.friends) user.friends = [];
      if (!requester.friends) requester.friends = [];
      if (!user.friends.includes(requesterUsername)) user.friends.push(requesterUsername);
      if (!requester.friends.includes(username)) requester.friends.push(username);
    }
    db.saveUsers(users);
    return { success: true };
  });

  app.post('/api/friends/remove', async (req, reply) => {
    const { username, friendUsername } = req.body as any;
    const users = db.getUsers();
    const user = users.find(u => u.username === username);
    const friend = users.find(u => u.username === friendUsername);
    if (!user || !friend) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (user.friends) user.friends = user.friends.filter((f: string) => f !== friendUsername);
    if (friend.friends) friend.friends = friend.friends.filter((f: string) => f !== username);
    db.saveUsers(users);
    return { success: true };
  });

  app.get('/api/friends/list/:username', async (req, reply) => {
    const { username } = req.params as any;
    const users = db.getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return reply.code(404).send({ error: 'Пользователь не найден' });
    const friendsList = (user.friends || []).map((fName: string) => {
      const f = users.find(u => u.username === fName);
      return f ? { username: f.username, fullname: f.fullname, avatar: f.avatar, status: f.status, online: onlineUsers.has(f.username), wins: f.wins || 0, losses: f.losses || 0 } : null;
    }).filter(Boolean);
    const requestsList = (user.friendRequests || []).map((rName: string) => {
      const r = users.find(u => u.username === rName);
      return r ? { username: r.username, fullname: r.fullname, avatar: r.avatar } : null;
    }).filter(Boolean);
    return { friends: friendsList, requests: requestsList };
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log('Server started on http://localhost:' + PORT);

  const io = new Server(app.server, { cors: { origin: '*' } });

  function clearTurnTimer(roomId: string) { if (turnTimers.has(roomId)) { clearTimeout(turnTimers.get(roomId)); turnTimers.delete(roomId); } }

  function startTurnTimer(io: Server, roomId: string) {
    clearTurnTimer(roomId);
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    const player = room.currentPlayer;
    const frozen = frozenPlayers.get(roomId);
    if (frozen?.has(player)) return;

    const timer = setTimeout(() => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom || currentRoom.phase !== 'playing') return;
      const player = currentRoom.currentPlayer;
      const hand = currentRoom.players[player]?.hand;
      
      if (!hand || hand.length === 0) {
        let newState = applyEvent(currentRoom, { type: 'PASS', player: player as any, cards: [] });
        if (newState !== currentRoom) {
           if (newState.trick === null && newState.lastTrickWinner !== null) newState = applyEvent(newState, { type: 'DRAW', winner: newState.lastTrickWinner });
           rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState);
        }
        return;
      }

      if (currentRoom.trick) {
        const cardToPass = [hand[hand.length - 1]];
        const newState = applyEvent(currentRoom, { type: 'PASS', player: player as any, cards: cardToPass });
        if (newState !== currentRoom) { rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); }
      } else {
        const cardToAttack = [hand[hand.length - 1]];
        const newState = applyEvent(currentRoom, { type: 'ATTACK', player: player as any, cards: cardToAttack });
        if (newState !== currentRoom) { rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); }
      }
    }, 30000);
    turnTimers.set(roomId, timer);
  }

  function rollDiceForRoom(io: Server, roomId: string) {
    const room = rooms.get(roomId); if (!room) return;
    const rolls: Partial<Record<PlayerId, number>> = {};
    let maxRoll = 0; let winners: PlayerId[] = [];

    room.players.forEach(p => {
      const roll = Math.floor(Math.random() * 6) + 1; rolls[p.id] = roll;
      if (roll > maxRoll) { maxRoll = roll; winners = [p.id]; } else if (roll === maxRoll) { winners.push(p.id); }
    });

    const newState = { ...room, phase: 'dice-roll' as const, diceRolls: rolls, stateVersion: (room.stateVersion || 0) + 1 };
    rooms.set(roomId, newState); broadcastState(io, roomId, newState);

    setTimeout(() => {
      const currentRoom = rooms.get(roomId); if (!currentRoom) return;
      if (winners.length === 1) {
        const winnerId = winners[0];
        const gameState = applyEvent(currentRoom, { type: 'START_ROUND', firstPlayer: winnerId });
        rooms.set(roomId, gameState); checkAndBroadcast(io, roomId, gameState);
      } else { rollDiceForRoom(io, roomId); }
    }, 4000);
  }

  function botMove(io: Server, roomId: string) {
    const room = rooms.get(roomId); if (!room || room.phase !== 'playing') return;
    if (room.mode !== '1v1') return;
    const botId = 1; const bot = room.players[botId]; if (!bot) return;

    try {
      if (!room.trick && room.currentPlayer === botId) {
        const card = bot.hand[0];
        const newState = applyEvent(room, { type: 'ATTACK', player: botId, cards: [card] });
        if (newState !== room) { rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); }
        return;
      }

      if (room.trick && room.trick.respondent === botId) {
        const required = room.trick.required; const top = room.trick.topCards;
        const rankVal = (r: string) => ({ '6':1, '7':2, '8':3, '9':4, 'J':5, 'Q':6, 'K':7, '10':8, 'A':9 }[r] || 0);
        const sortedHand = [...bot.hand].sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
        
        let beatCards: any[] | null = null;
        const targetSuit = top[0].suit; const sameSuit = sortedHand.filter(c => c.suit === targetSuit);
        if (sameSuit.length >= required) {
          const highest = sameSuit.slice(-required);
          try { if (canBeat(highest, top, room.trump!)) beatCards = highest; } catch {}
        }
        if (!beatCards && room.trump) {
          const trumpCards = sortedHand.filter(c => c.suit === room.trump);
          if (trumpCards.length >= required) {
            const highestTrumps = trumpCards.slice(-required);
            try { if (canBeat(highestTrumps, top, room.trump!)) beatCards = highestTrumps; } catch {}
          }
        }

        if (beatCards) {
          const newState = applyEvent(room, { type: 'BEAT', player: botId, cards: beatCards });
          if (newState !== room) { rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); return; }
        }
        
        let newState = applyEvent(room, { type: 'PASS', player: botId, cards: [] });
        if (newState !== room) {
          if (newState.trick === null && newState.lastTrickWinner !== null) newState = applyEvent(newState, { type: 'DRAW', winner: newState.lastTrickWinner });
          rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState);
        }
        return;
      }
    } catch (e) {
      console.error('Bot exception', e);
      try {
        let newState = applyEvent(room, { type: 'PASS', player: botId, cards: [] });
        if (newState !== room) {
          if (newState.trick === null && newState.lastTrickWinner !== null) newState = applyEvent(newState, { type: 'DRAW', winner: newState.lastTrickWinner });
          rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState);
        }
      } catch (err) {}
    }
  }

  function createDevRoom(socket: any): string {
    const roomId = 'DEV'; const name = 'Vladislav';
    const initialState: GameState = {
      mode: '1v1', players: [{ id: 0, side: 'A', hand: [], name }, { id: 1, side: 'B', hand: [], name: '🤖 BOT' }],
      deck: [], trumpCard: null, trump: null, trumpChanged: false, trumpChangeEvent: null,
      currentPlayer: 0, trick: null, lastTrickWinner: null, phase: 'finished',
      matchScore: { A: 0, B: 0 }, multiplier: 1, roundNumber: 0, bita: { A: [], B: [] }, lastRoundPoints: null, diceRolls: null,
      stateVersion: 0, turnDeadline: null
    };
    rooms.set(roomId, initialState); playersInRoom.set(roomId, [socket.id, '__BOT__']); socket.join(roomId); return roomId;
  }

  function findRoomOfSocket(socketId: string): string | null {
    for (const [roomId, players] of playersInRoom.entries()) { if (players.includes(socketId)) return roomId; }
    return null;
  }

  io.on('connection', (socket) => {
    socket.on('register_online', (username: string) => { onlineUsers.set(username, socket.id); socket.broadcast.emit('user_status_change', { username, online: true }); });
    socket.on('disconnect', () => {
      for (const [username, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) { onlineUsers.delete(username); socket.broadcast.emit('user_status_change', { username, online: false }); break; }
      }
    });

    socket.on('new_friend_request', ({ targetUsername, fromUsername }) => { const targetSocket = onlineUsers.get(targetUsername); if (targetSocket) io.to(targetSocket).emit('friend_request_received', { fromUsername }); });
    socket.on('send_invite', ({ from, to, roomId }) => { const targetSocket = onlineUsers.get(to); if (targetSocket) io.to(targetSocket).emit('receive_invite', { from, roomId }); });
    socket.on('accept_invite', ({ from, roomId }) => { const senderSocket = onlineUsers.get(from); if (senderSocket) io.to(senderSocket).emit('invite_accepted', { roomId }); });

    socket.on('create_room', (mode: '1v1' | '2v2', dataOrCallback: any, maybeCallback?: any) => {
      let name = 'Игрок'; let callback = maybeCallback;
      if (typeof dataOrCallback === 'function') { callback = dataOrCallback; } else if (dataOrCallback && typeof dataOrCallback === 'object') { name = dataOrCallback.name || 'Игрок'; }

      const roomId = Math.random().toString(36).substring(2, 8);
      const initialState: GameState = {
        mode, players: mode === '1v1' 
          ? [{ id: 0, side: 'A', hand: [], name }, { id: 1, side: 'B', hand: [], name: 'Ожидание...' }] 
          : [{ id: 0, side: 'A', hand: [], name }, { id: 1, side: 'B', hand: [], name: 'Ожидание...' }, { id: 2, side: 'A', hand: [], name: 'Ожидание...' }, { id: 3, side: 'B', hand: [], name: 'Ожидание...' }],
        deck: [], trumpCard: null, trump: null, trumpChanged: false, trumpChangeEvent: null,
        currentPlayer: 0, trick: null, lastTrickWinner: null, phase: 'finished', matchScore: { A: 0, B: 0 }, multiplier: 1, roundNumber: 0, bita: { A: [], B: [] }, lastRoundPoints: null, diceRolls: null,
        stateVersion: 0, turnDeadline: null
      };
      rooms.set(roomId, initialState); playersInRoom.set(roomId, []); socket.join(roomId); 
      if (typeof callback === 'function') callback({ roomId });
    });

    socket.on('create_dev_room', (name: string, callback: any) => { const roomId = createDevRoom(socket); if (typeof callback === 'function') callback({ roomId }); });

    socket.on('join_room', (roomId: string, playerName?: string) => {
      const room = rooms.get(roomId); if (!room) return; socket.join(roomId);
      const players = playersInRoom.get(roomId) || [];
      if (!players.includes(socket.id)) { 
        players.push(socket.id); playersInRoom.set(roomId, players); 
        const newPlayerIdx = players.length - 1;
        if (playerName && room.players[newPlayerIdx]) room.players[newPlayerIdx].name = playerName;
        if (playerName === 'Vladislav' && roomId !== 'DEV') io.to(roomId).emit('dev_joined', { name: 'Vladislav' });
      }
      const maxPlayers = room.mode === '1v1' ? 2 : 4;
      if (players.length === maxPlayers && room.phase === 'finished') rollDiceForRoom(io, roomId);
      else broadcastState(io, roomId, room);
    });

    socket.on('next_round', (roomId: string) => {
      const room = rooms.get(roomId); if (!room || room.phase !== 'round-scored') return;
      const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
      const newState = applyEvent(cleanState, { type: 'START_ROUND', firstPlayer: room.lastTrickWinner ?? 0 });
      rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState);
    });

    socket.on('chat_message', ({ roomId, sender, text }) => {
      const msgId = Math.random().toString(36).substring(7);
      const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      if (sender === 'Vladislav' && typeof text === 'string' && text.startsWith('/')) {
        const parts = text.trim().split(/\s+/); const cmd = parts[0].toLowerCase(); const arg = parts[1]; const room = rooms.get(roomId);

        if (cmd === '/kick' && arg) {
          if (!room) return; const players = playersInRoom.get(roomId) || []; const targetIdx = room.players.findIndex(p => p.name === arg);
          if (targetIdx !== -1 && players[targetIdx] && players[targetIdx] !== '__BOT__') {
            io.to(players[targetIdx]).emit('kicked', `Вас исключил администратор`);
            io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: `👢 Игрок ${arg} исключён из комнаты`, time: now });
          } else { socket.emit('chat_message', { id: msgId, sender: 'DEBUG', text: `Игрок ${arg} не найден`, time: now }); }
          return;
        }
        if (cmd === '/rain') { io.to(roomId).emit('admin_rain'); io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: '🎉 Дождь из эмодзи!', time: now }); return; }
        if (cmd === '/stats') {
          if (!room) return; const myIdx = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1; const hands = room.players.map(p => `${p.name}: ${p.hand.length} карт`).join(' | ');
          const info = `📊 Колода: ${room.deck.length} | Козырь: ${room.trump} | Фаза: ${room.phase} | Чей ход: ${room.currentPlayer} | Твой индекс: ${myIdx} | ${hands}`;
          socket.emit('chat_message', { id: msgId, sender: 'DEBUG', text: info, time: now }); return;
        }
        if (cmd === '/reset') {
          if (!room) return; const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
          const newState = applyEvent(cleanState, { type: 'START_ROUND', firstPlayer: room.lastTrickWinner ?? 0 });
          rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: '🔄 Кон перезапущен администратором', time: now }); return;
        }
        if (cmd === '/secret') { io.to(roomId).emit('admin_secret_fx'); io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: '👑 Создатель наблюдает за вами... Удачи, смертные! 🃏', time: now }); return; }
        socket.emit('chat_message', { id: msgId, sender: 'DEBUG', text: `Игровые команды: /kick, /rain, /stats, /reset, /secret. Остальное — в Dev Console (🛠️)`, time: now }); return;
      }
      io.to(roomId).emit('chat_message', { id: msgId, sender, text, time: now });
    });

    socket.on('dev_command', ({ username, command }: { username: string; command: string }) => {
      if (username !== 'Vladislav') return;
      const cmd = command.trim(); const parts = cmd.split(/\s+/); const base = parts[0].toLowerCase(); const arg = parts[1];
      const reply = (text: string, type: 'info' | 'error' | 'success' = 'info') => { socket.emit('dev_command_result', { command: cmd, text, type }); };
      const myRoomId = findRoomOfSocket(socket.id); const myRoom = myRoomId ? rooms.get(myRoomId) : null;

      if (base === '/gold') { socket.emit('admin_gold'); reply('💰 Золотой дождь запущен (виден только тебе)', 'success'); return; }
      if (base === '/whoami') {
        if (!myRoomId || !myRoom) { reply('❌ Ты не в комнате', 'error'); return; }
        const myIdx = playersInRoom.get(myRoomId)?.indexOf(socket.id) ?? -1; const me = myRoom.players[myIdx];
        reply(`👤 Ты: ${me?.name}`, 'success'); reply(`Индекс: ${myIdx} | Сторона: ${me?.side} | Карт: ${me?.hand.length}`);
        reply(`Фаза: ${myRoom.phase} | Кон: ${myRoom.roundNumber} | Козырь: ${myRoom.trump} | Колода: ${myRoom.deck.length}`); return;
      }
      if (base === '/freeze' && arg) {
        if (!myRoomId || !myRoom) { reply('❌ Ты не в комнате', 'error'); return; }
        const targetIdx = myRoom.players.findIndex(p => p.name === arg); if (targetIdx === -1) { reply(`❌ Игрок ${arg} не найден в комнате`, 'error'); return; }
        const frozen = frozenPlayers.get(myRoomId) || new Set<number>();
        if (frozen.has(targetIdx)) { frozen.delete(targetIdx); reply(`🔥 ${arg} разморожен`, 'success'); } 
        else { frozen.add(targetIdx); reply(`❄️ ${arg} заморожен — таймер стоит`, 'success'); if (myRoom.currentPlayer === targetIdx) clearTurnTimer(myRoomId); }
        frozenPlayers.set(myRoomId, frozen);
        io.to(myRoomId).emit('chat_message', { id: Math.random().toString(36).substring(7), sender: 'СИСТЕМА', text: frozen.has(targetIdx) ? `❄️ ${arg} заморожен` : `🔥 ${arg} разморожен`, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }); return;
      }
      if (base === '/reverse') {
        if (!myRoomId || !myRoom) { reply('❌ Ты не в комнате', 'error'); return; }
        io.to(myRoomId).emit('admin_reverse'); io.to(myRoomId).emit('chat_message', { id: Math.random().toString(36).substring(7), sender: 'СИСТЕМА', text: '🔄 Стол перевёрнут!', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }); reply('🔄 Стол перевернут у всех', 'success'); return;
      }
      if (base === '/broadcast') {
        const broadcastText = parts.slice(1).join(' '); if (!broadcastText) { reply('Использование: /broadcast [текст]', 'error'); return; }
        io.emit('global_broadcast', { text: broadcastText, from: 'Vladislav' }); reply(`📢 Отправлено всем: "${broadcastText}"`, 'success'); return;
      }
      if (base === '/listrooms') {
        reply(`📋 Активных комнат: ${rooms.size}`, 'success'); if (rooms.size === 0) { reply('(пусто)'); return; }
        for (const [id, state] of rooms.entries()) reply(`• ${id} | ${state.mode} | ${state.phase} | Кон ${state.roundNumber} | ${state.players.map(p => p.name).join(' vs ')}`);
        return;
      }
      if (base === '/spawnbot') {
        if (myRoomId) { reply(`⚠️ Ты уже в комнате ${myRoomId}. Сначала выйди из неё.`, 'error'); return; }
        const newRoomId = createDevRoom(socket); reply(`✅ DEV-комната ${newRoomId} создана. Перехожу в игру...`, 'success');
        socket.emit('dev_room_created', { roomId: newRoomId }); rollDiceForRoom(io, newRoomId); return;
      }
      reply(`❌ Неизвестная команда: ${base}`, 'error'); reply(`Доступные: /gold, /whoami, /freeze [ник], /reverse, /broadcast [текст], /listrooms, /spawnbot`);
    });

    socket.on('send_reaction', ({ roomId, emoji, sender }) => { const left = Math.floor(Math.random() * 80) + 10; io.to(roomId).emit('reaction', { id: Date.now(), emoji, sender, left }); });

    socket.on('play_card', (roomId: string, cards: any[]) => {
      const room = rooms.get(roomId); if (!room || room.phase !== 'playing') return;
      const playerIndex = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1; if (playerIndex === -1) return;
      
      if (room.currentPlayer !== playerIndex || room.trick) return; // Только первая атака здесь

      const opponentIdx = (playerIndex + 1) % (room.mode === '1v1' ? 2 : 4);
      const opponentHandSize = room.players[opponentIdx].hand.length;
      if (opponentHandSize > 0 && cards.length > opponentHandSize) { socket.emit('error', 'Нельзя ходить картами больше, чем есть у соперника!'); return; }
      
      const hand = room.players[playerIndex].hand;
      const hasAllCards = cards.every(c => hand.some(h => h.suit === c.suit && h.rank === c.rank));
      if (!hasAllCards) { socket.emit('error', 'У тебя нет таких карт!'); return; }

      const isSpecial = validateSpecial(cards, room.trump!);
      if (!isSpecial && cards.length > 1) { 
        const suit = cards[0].suit; if (!cards.every(c => c.suit === suit)) { socket.emit('error', 'Ходить можно только картами одной масти!'); return; } 
      }
      
      const newState = applyEvent(room, { type: 'ATTACK', player: playerIndex as any, cards });
      rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState);
    });

    socket.on('pass_or_beat', (roomId: string, action: 'beat' | 'pass', cards: any[]) => {
      const room = rooms.get(roomId); if (!room || room.phase !== 'playing') return;
      const playerIndex = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1; if (playerIndex === -1) return;
      
      if (room.currentPlayer !== playerIndex || !room.trick) return;

      try {
        let newState = room;
        if (action === 'beat') {
          if (!canBeat(cards, room.trick.topCards, room.trump!)) { socket.emit('error', 'Эти карты не бьют!'); return; }
          newState = applyEvent(room, { type: 'BEAT', player: playerIndex as any, cards });
        } else { newState = applyEvent(room, { type: 'PASS', player: playerIndex as any, cards }); }
        
        if (newState.trick === null && newState.lastTrickWinner !== null) {
          const drawnState = applyEvent(newState, { type: 'DRAW', winner: newState.lastTrickWinner });
          rooms.set(roomId, drawnState); checkAndBroadcast(io, roomId, drawnState);
        } else { rooms.set(roomId, newState); checkAndBroadcast(io, roomId, newState); }
      } catch (e: any) { socket.emit('error', e.message); }
    });

    socket.on('admin_get_rooms', (username: string) => {
      if (username !== 'Vladislav') return;
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map(p => p.name), matchScore: state.matchScore }));
      socket.emit('admin_rooms_list', roomsList);
    });

    socket.on('admin_close_room', (username: string, roomId: string) => {
      if (username !== 'Vladislav') return;
      const room = rooms.get(roomId); if (!room) return;
      io.to(roomId).emit('kicked', 'Комната закрыта администратором');
      rooms.delete(roomId); playersInRoom.delete(roomId); frozenPlayers.delete(roomId); clearTurnTimer(roomId);
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map(p => p.name), matchScore: state.matchScore }));
      socket.emit('admin_rooms_list', roomsList);
    });
  });

  function checkAndBroadcast(io: Server, roomId: string, state: GameState) {
    let currentState = state;
    
    // АВТО-ПАС: Если у игрока, чей сейчас ход, закончились карты, он не может ходить. Автоматически засчитываем "Биту".
    while (currentState.phase === 'playing' && currentState.trick && currentState.players[currentState.currentPlayer]?.hand.length === 0) {
      let nextState = applyEvent(currentState, { type: 'PASS', player: currentState.currentPlayer, cards: [] });
      if (nextState.trick === null && nextState.lastTrickWinner !== null) nextState = applyEvent(nextState, { type: 'DRAW', winner: nextState.lastTrickWinner });
      if (nextState === currentState) break; // Защита от зависания
      currentState = nextState;
    }

    const someoneHasNoCards = currentState.players.some(p => p.hand.length === 0);
    if (currentState.deck.length === 0 && currentState.trick === null && someoneHasNoCards && currentState.phase === 'playing') {
      const scored = applyEvent(currentState, { type: 'SCORE_ROUND' });
      rooms.set(roomId, scored); broadcastState(io, roomId, scored); clearTurnTimer(roomId);
    } else { 
      rooms.set(roomId, currentState); broadcastState(io, roomId, currentState); 
      if (currentState.phase === 'playing') startTurnTimer(io, roomId); 
      else if (currentState.phase === 'finished') {
        const users = db.getUsers(); const p1Name = currentState.players[0]?.name; const p2Name = currentState.players[1]?.name;
        const p1 = users.find(u => u.username === p1Name); const p2 = users.find(u => u.username === p2Name);
        if (p1 && p2) {
          if (currentState.matchScore.A >= 24) { p2.wins = (p2.wins || 0) + 1; p1.losses = (p1.losses || 0) + 1; }
          else if (currentState.matchScore.B >= 24) { p1.wins = (p1.wins || 0) + 1; p2.losses = (p2.losses || 0) + 1; }
          db.saveUsers(users);
        }
        clearTurnTimer(roomId);
      } else clearTurnTimer(roomId);
    }
  }

  function broadcastState(io: Server, roomId: string, state: GameState) {
    const players = playersInRoom.get(roomId) || [];
    players.forEach((sockId, index) => {
      if (sockId && sockId !== '__BOT__') {
        const legalMoves = getLegalMoves(state, index as PlayerId);
        const view = project(state, index as PlayerId, legalMoves);
        io.to(sockId).emit('game_state', view);
      }
    });
    if (roomId === 'DEV' && state.phase === 'playing') setTimeout(() => botMove(io, roomId), 1200);
  }
}

main().catch(console.error);