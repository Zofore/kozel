import 'dotenv/config';
import { randomUUID, randomInt, createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { applyEvent, applyTurn, automaticTurn, GameState, project, getLegalMoves, PlayerId, normalizeBotDifficulty } from '@kozel/game-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const app = Fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;
const rooms = new Map<string, GameState>();
const playersInRoom = new Map<string, string[]>();
const turnTimers = new Map<string, NodeJS.Timeout>();
const botTimeouts = new Map<string, NodeJS.Timeout>();
const onlineUsers = new Map<string, string>();
const frozenPlayers = new Map<string, Set<number>>();

const JWT_SECRET = process.env.JWT_SECRET || '';
if (JWT_SECRET.length < 32 || JWT_SECRET.startsWith('REPLACE_WITH_')) throw new Error('JWT_SECRET must have at least 32 characters');
const ADMIN_IDS = new Set((process.env.ADMIN_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x => x.trim());
const attempts = new Map<string, { count: number; expires: number }>();
const roomActivity = new Map<string, number>();
const invitations = new Map<string, { from: string; expires: number }>();
const settling = new Set<string>();
const isAdminId = (id: number) => ADMIN_IDS.has(String(id));
function allowedAttempt(key: string) {
  const now = Date.now(); const old = attempts.get(key);
  const item = !old || old.expires <= now ? { count: 0, expires: now + 15 * 60_000 } : old;
  item.count++; attempts.set(key, item); return item.count <= 10;
}
function verifyToken(token: unknown) {
  if (typeof token !== 'string') throw new Error('Missing token');
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; username: string };
  if (!Number.isInteger(decoded.id) || typeof decoded.username !== 'string') throw new Error('Invalid token');
  return decoded;
}
const playerProgress = (u: any) => {
  const wins = Number(u.wins || 0);
  const losses = Number(u.losses || 0);
  const xp = Number(u.xp || 0);
  const rating = Number(u.rating ?? 1000);
  return { xp, rating, level: Math.floor(xp / 500) + 1, league: rating >= 1800 ? 'Алмаз' : rating >= 1500 ? 'Платина' : rating >= 1300 ? 'Золото' : rating >= 1100 ? 'Серебро' : 'Бронза', achievements: [
    ...(wins >= 1 ? ['first_win'] : []),
    ...(wins >= 10 ? ['ten_wins'] : []),
    ...(wins >= 100 ? ['hundred_wins'] : []),
    ...(wins + losses >= 10 ? ['ten_games'] : [])
  ] };
};
const publicUser = (u: any) => ({ ...playerProgress(u), username: u.username, fullname: u.fullname, avatar: u.avatar || '', status: u.status || 'В сети', wins: u.wins || 0, losses: u.losses || 0, online: onlineUsers.has(u.username), isAdmin: isAdminId(u.id) });
const validText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
async function main() {
  await db.init();
  app.get('/health',async()=>({ok:true}));
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) { reply.header('Access-Control-Allow-Origin', origin); reply.header('Vary', 'Origin'); }
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });
  app.options('/*', async (_req, reply) => reply.code(204).send());
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ code: (err as any).code }, 'Request failed');
    reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({ error: 'Ошибка запроса или сервера' });
  });
  app.addHook('preHandler', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/') || path === '/api/login' || path === '/api/register') return;
    try {
      const decoded = verifyToken(req.headers.authorization?.replace(/^Bearer /i, ''));
      const body = req.body as any; const params = req.params as any;
      if ((body?.username !== undefined && body.username !== decoded.username) || (path.startsWith('/api/friends/list/') && params?.username !== decoded.username)) return reply.code(403).send({ error: 'Доступ запрещён' });
      (req as any).identity = decoded;
    } catch { return reply.code(401).send({ error: 'Требуется авторизация' }); }
  });
  app.post('/api/register', async (req, reply) => {
    if (!allowedAttempt('register:'+req.ip)) return reply.code(429).send({ error: 'Слишком много попыток' });
    const { username, password, fullname, email } = (req.body || {}) as any;
    if (typeof username !== 'string' || !/^[a-zA-Zа-яА-ЯёЁ ]{1,21}$/.test(username) || username !== username.trim() || ['система','debug'].includes(username.toLowerCase())) return reply.code(400).send({ error: 'Некорректный никнейм' });
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) return reply.code(400).send({ error: 'Пароль: от 8 символов, не более 72 байт' });
    if (typeof fullname !== 'string' || !/^[a-zA-Zа-яА-ЯёЁ -]{1,50}$/.test(fullname) || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Некорректные ФИО или Email' });
    try { await db.register(username, await bcrypt.hash(password, 12), fullname, email); }
    catch (e: any) { if (e.code === '23505') return reply.code(409).send({ error: 'Этот никнейм уже занят' }); throw e; }
    return { success: true };
  });
  app.post('/api/login', async (req, reply) => {
    const { username, password } = (req.body || {}) as any;
    if (!allowedAttempt('login:'+req.ip)) return reply.code(429).send({ error: 'Слишком много попыток' });
    if (typeof username !== 'string' || username.length > 255 || typeof password !== 'string' || Buffer.byteLength(password) > 72) return reply.code(400).send({ error: 'Неверный логин или пароль' });
    const user = await db.getUser(username);
    if (!user || !await bcrypt.compare(password,user.password)) return reply.code(401).send({ error: 'Неверный логин или пароль' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    return { success: true, token, user: { ...publicUser(user), friends: user.friends || [], isAdmin: isAdminId(user.id) } };
  });
  app.get('/api/me', async (req, reply) => {
    const identity = (req as any).identity;
    const u = await db.getUser(identity.username);
    if (!u || u.id !== identity.id) return reply.code(401).send({error:'Требуется авторизация'});
    return { ...publicUser(u), isAdmin: isAdminId(u.id) };
  });
  app.get('/api/matches/history', async (req) => {
    const identity = (req as any).identity;
    return { matches: await db.getMatchHistory(identity.username, 20) };
  });
  // WebRTC ICE config is available only to authenticated players.
  // Metered static TURN credentials are intended for initial testing: authenticated
  // browsers necessarily receive them. Rotate them and prefer ephemeral credentials
  // from a provider API for a public launch.
  app.get('/api/voice/ice', async (req) => {
    const identity = (req as any).identity;
    const urls = (process.env.TURN_URLS || '').split(',').map(v => v.trim()).filter(Boolean);
    const username = process.env.TURN_USERNAME || '';
    const password = process.env.TURN_PASSWORD || '';
    const secret = process.env.TURN_SHARED_SECRET || '';
    const iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (urls.length && username && password) {
      // Managed TURN providers (e.g. Metered): static username/password.
      iceServers.push({ urls, username, credential: password });
    } else if (urls.length && secret.length >= 32) {
      // Self-hosted coturn with use-auth-secret: short-lived HMAC credentials.
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const temporaryUsername = `${expires}:${identity.id}`;
      const credential = createHmac('sha1', secret).update(temporaryUsername).digest('base64');
      iceServers.push({ urls, username: temporaryUsername, credential });
    }
    return { iceServers };
  });
  app.get('/api/leaderboard', async () => {
    const rows = await db.getLeaderboard(50);
    return { players: rows.map(row => ({ ...row, ...playerProgress(row) })) };
  });
  app.get('/api/user/profile/:username', async (req, reply) => {
    const user = await db.getUser((req.params as any).username);
    if (!user) return reply.code(404).send({ error: 'Пользователь не найден' });
    return publicUser(user);
  });
  app.post('/api/user/update', async (req, reply) => {
    const { status, avatar } = (req.body || {}) as any;
    if ((status !== undefined && !validText(status,255)) || (avatar !== undefined && (!validText(avatar,180000) || (avatar && !/^https?:\/\//i.test(avatar) && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar))))) return reply.code(400).send({ error: 'Некорректный профиль' });
    if (!await db.updateProfile((req as any).identity.username,status,avatar)) return reply.code(404).send({ error: 'Пользователь не найден' });
    return { success: true };
  });
  app.get('/api/users/search', async (req, reply) => {
    const q = (req.query as any).q;
    if (typeof q !== 'string' || q.length > 100) return { users: [] };
    const search = q.replace(/@/g,'').trim().toLowerCase();
    return { users: search ? (await db.getUsers()).filter(u=>u.username.toLowerCase().includes(search)).slice(0,50).map(publicUser) : [] };
  });
  app.post('/api/friends/request', async (req, reply) => {
    const { targetUsername } = (req.body || {}) as any;
    if (typeof targetUsername !== 'string') return reply.code(400).send({error:'Некорректная заявка'});
    const username = (req as any).identity.username;
    const error = await db.friends(username,targetUsername,'request');
    if (error) return reply.code(400).send({error});
    const targetSocket = onlineUsers.get(targetUsername);
    if (targetSocket) io.to(targetSocket).emit('friend_request_received',{fromUsername:username});
    return {success:true};
  });
  app.post('/api/friends/respond', async (req, reply) => {
    const { requesterUsername, action } = (req.body || {}) as any;
    if (typeof requesterUsername !== 'string' || !['accept','decline'].includes(action)) return reply.code(400).send({error:'Некорректная заявка'});
    const error = await db.friends((req as any).identity.username,requesterUsername,action);
    if (error) return reply.code(400).send({error}); return {success:true};
  });
  app.post('/api/friends/remove', async (req, reply) => {
    const {friendUsername} = (req.body || {}) as any;
    if (typeof friendUsername !== 'string') return reply.code(400).send({error:'Некорректная заявка'});
    const error = await db.friends((req as any).identity.username,friendUsername,'remove');
    if (error) return reply.code(400).send({error}); return {success:true};
  });
  app.get('/api/friends/list/:username', async (req, reply) => {
    const users = await db.getUsers(); const u = users.find(x=>x.username === (req as any).identity.username);
    if (!u) return reply.code(404).send({error:'Пользователь не найден'});
    return { friends: users.filter(x=>u.friends?.includes(x.username)).map(publicUser), requests: users.filter(x=>u.friendRequests?.includes(x.username)).map(x=>({username:x.username,fullname:x.fullname,avatar:x.avatar,isAdmin:isAdminId(x.id)})) };
  });

  const io = new Server(app.server, { cors: { origin: origins }, maxHttpBufferSize: 64 * 1024, allowRequest: (req, cb) => cb(null, !req.headers.origin || origins.includes(req.headers.origin)) });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Требуется авторизация'));
    
    try {
      const decoded = verifyToken(token);
      const account = await db.getUser(decoded.username);
      if (!account || account.id !== decoded.id || account.username !== decoded.username) return next(new Error('Неверный токен'));
      (socket as any).data = { user: decoded };
      next();
    } catch (err) {
      next(new Error('Неверный токен'));
    }
  });

  function clearTurnTimer(roomId: string) { 
    if (turnTimers.has(roomId)) { clearTimeout(turnTimers.get(roomId)!); turnTimers.delete(roomId); } 
    if (botTimeouts.has(roomId)) { clearTimeout(botTimeouts.get(roomId)!); botTimeouts.delete(roomId); }
  }

  function startTurnTimer(io: Server, roomId: string) {
    clearTurnTimer(roomId);
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    if (frozenPlayers.get(roomId)?.has(room.currentPlayer)) { room.turnDeadline=null; return; }
    room.turnDeadline = Date.now() + 30000;
    const version = room.stateVersion;
    const run = async (bot = false) => {
      const current = rooms.get(roomId);
      if (!current || current.phase !== 'playing' || current.stateVersion !== version) return;
      const res = bot ? automaticTurn(current, true, normalizeBotDifficulty(process.env.BOT_DIFFICULTY)) : automaticTurn(current);
      if (res.ok) await checkAndBroadcast(io, roomId, res.state);
      else { app.log.error({roomId, error:res.error}, 'Automatic turn failed'); startTurnTimer(io,roomId); broadcastState(io,roomId,current); }
    };
    turnTimers.set(roomId,setTimeout(()=>void run().catch(err=>app.log.error(err)),30000));
    if (playersInRoom.get(roomId)?.[room.currentPlayer] === '__BOT__') botTimeouts.set(roomId,setTimeout(()=>void run(true).catch(err=>app.log.error(err)),1200));
  }

  function rollDiceForRoom(io: Server, roomId: string) {
    const room = rooms.get(roomId); if (!room) return;
    const rolls: Partial<Record<PlayerId, number>> = {};
    let maxRoll = 0; let winners: PlayerId[] = [];

    room.players.forEach(p => {
      const roll = randomInt(1,7); rolls[p.id] = roll;
      if (roll > maxRoll) { maxRoll = roll; winners = [p.id]; } else if (roll === maxRoll) { winners.push(p.id); }
    });

    const newState = { ...room, phase: 'dice-roll' as const, diceRolls: rolls, stateVersion: (room.stateVersion || 0) + 1 };
    rooms.set(roomId, newState); broadcastState(io, roomId, newState);

    setTimeout(async () => {
      const currentRoom = rooms.get(roomId); if (!currentRoom || currentRoom.phase !== 'dice-roll' || currentRoom.stateVersion !== newState.stateVersion) return;
      if (winners.length === 1) {
        const winnerId = winners[0];
        const seed = randomInt(0, 0x100000000);
        const res = applyEvent(currentRoom, { type: 'START_ROUND', firstPlayer: winnerId, seed });
        if (res.ok) { rooms.set(roomId, res.state); await checkAndBroadcast(io, roomId, res.state); }
      } else { rollDiceForRoom(io, roomId); }
    }, 4000);
  }

  function createDevRoom(socket: any): string {
    const roomId = 'DEV-' + randomUUID(); 
    const name = socket.data.user.username;
    const initialState: GameState = {
      mode: '1v1', players: [{ id: 0, side: 'A', hand: [], name, connected: true, isAdmin: isAdminId(socket.data.user.id) }, { id: 1, side: 'B', hand: [], name: '🤖 BOT', connected: true }],
      deck: [], trumpCard: null, trump: null, trumpChanged: false, trumpChangeEvent: null,
      currentPlayer: 0, trick: null, lastTrickWinner: null, phase: 'waiting',
      matchScore: { A: 0, B: 0 }, multiplier: 1, roundNumber: 0, bita: { A: [], B: [] }, lastRoundPoints: null, diceRolls: null,
      stateVersion: 0, turnDeadline: null, settled: false
    };
    rooms.set(roomId, initialState); roomActivity.set(roomId,Date.now()); playersInRoom.set(roomId, [socket.id, '__BOT__']); socket.join(roomId); return roomId;
  }

  function findRoomOfSocket(socketId: string): string | null {
    for (const [roomId, players] of playersInRoom.entries()) { if (players.includes(socketId)) return roomId; }
    return null;
  }

  function removeRoom(roomId: string, reason: string) {
    io.to(roomId).emit('kicked',reason); io.in(roomId).socketsLeave(roomId);
    for (const id of playersInRoom.get(roomId) || []) if(id) leaveVoice(id);
    rooms.delete(roomId); playersInRoom.delete(roomId); frozenPlayers.delete(roomId); roomActivity.delete(roomId); clearTurnTimer(roomId);
  }
  function detach(socket: any, roomId: string, explicit = false) {
    const room = rooms.get(roomId), seats = playersInRoom.get(roomId);
    if (!room || !seats) return;
    const idx = seats.indexOf(socket.id); if (idx < 0) return;
    leaveVoice(socket.id);
    seats[idx] = ''; room.players[idx].connected = false; socket.leave(roomId);
    if (explicit && room.phase === 'waiting') {
      const name=room.players[idx].name;
      room.players[idx].name = 'Ожидание...'; room.players[idx].isAdmin=false;
      for(const [key,invite] of invitations) if(key.startsWith(roomId+':') && invite.from===name) invitations.delete(key);
    }
    roomActivity.set(roomId,Date.now());
    if (explicit && (room.phase === 'waiting' && !seats.some(x=>x && x !== '__BOT__') || roomId.startsWith('DEV-'))) removeRoom(roomId,'Комната закрыта');
    else broadcastState(io,roomId,room);
  }
  function join(socket: any, roomId: string, notify = true): boolean {
    const room = rooms.get(roomId), seats = playersInRoom.get(roomId);
    if (!room || !seats) { if(notify) socket.emit('kicked','Комната не найдена'); return false; }
    const name = socket.data.user.username;
    let idx = room.players.findIndex((p,i)=>p.name === name && seats[i] !== '__BOT__');
    if (idx < 0 && room.phase === 'waiting' && !roomId.startsWith('DEV-')) idx = room.players.findIndex((p,i)=>p.name === 'Ожидание...' && !seats[i]);
    if (idx < 0) { if(notify) socket.emit('kicked','Комната заполнена или игра уже началась'); return false; }
    const otherRoom = findRoomOfSocket(socket.id);
    if (otherRoom && otherRoom !== roomId) detach(socket,otherRoom,true);
    const newSeat=room.players[idx].name !== name;
    const oldSocket = seats[idx];
    if (oldSocket && oldSocket !== socket.id) { io.to(oldSocket).emit('kicked','Вход выполнен с другого подключения'); io.sockets.sockets.get(oldSocket)?.leave(roomId); }
    seats[idx] = socket.id; room.players[idx].name = name; room.players[idx].connected = true; room.players[idx].isAdmin=isAdminId(socket.data.user.id);
    if (oldSocket && oldSocket !== socket.id) leaveVoice(oldSocket);
    socket.join(roomId); roomActivity.set(roomId,Date.now());
    if (newSeat && room.players[idx].isAdmin && !roomId.startsWith('DEV-')) io.to(roomId).emit('dev_joined',{name});
    if (room.phase === 'waiting' && seats.every(Boolean)) rollDiceForRoom(io,roomId);
    else broadcastState(io,roomId,room);
    return true;
  }
  const maintenance = setInterval(()=>{
    const now = Date.now();
    for (const [k,v] of attempts) if (v.expires <= now) attempts.delete(k);
    for (const [k,v] of invitations) if (v.expires <= now || !rooms.has(k.split(':')[0])) invitations.delete(k);
    for (const [id,room] of rooms) {
      if (room.phase === 'finished' && !room.settled && !id.startsWith('DEV-')) void settle(id,room);
      if (now - (roomActivity.get(id) || now) > 30*60_000 && !settling.has(id) && (room.phase !== 'finished' || room.settled || id.startsWith('DEV-'))) removeRoom(id,'Комната закрыта из-за неактивности');
    }
  },60_000); maintenance.unref();

  // Room-scoped voice signalling; audio never travels through the game server.
  // Peers must explicitly opt in, and signalling is restricted to permitted seats.
  type VoiceSettings = { roomId: string; mode: 'team' | 'all' };
  const voiceMembers = new Map<string, VoiceSettings>();
  const voiceAllowed = (a: string, b: string): boolean => {
    const settingsA = voiceMembers.get(a), settingsB = voiceMembers.get(b);
    if (!settingsA || !settingsB || settingsA.roomId !== settingsB.roomId) return false;
    const seats = playersInRoom.get(settingsA.roomId);
    const room = rooms.get(settingsA.roomId);
    if (!seats || !room) return false;
    const ia = seats.indexOf(a), ib = seats.indexOf(b);
    if (ia < 0 || ib < 0 || ia === ib) return false;
    if (room.mode === '1v1') return settingsA.mode === 'all' && settingsB.mode === 'all';
    return room.players[ia].side === room.players[ib].side || (settingsA.mode === 'all' && settingsB.mode === 'all');
  };
  const refreshVoice = (roomId: string) => {
    const seats = playersInRoom.get(roomId), room = rooms.get(roomId);
    if (!seats || !room) return;
    for (let i = 0; i < seats.length; i++) {
      const id = seats[i];
      if (!id || !voiceMembers.has(id)) continue;
      io.to(id).emit('voice_roster', {
        selfIndex: i,
        mode: room.mode,
        peers: seats.flatMap((other, j) => other && other !== id && voiceAllowed(id, other)
          ? [{ index:j, name:room.players[j].name }] : [])
      });
    }
  };
  const leaveVoice = (socketId: string) => {
    const current = voiceMembers.get(socketId);
    if (current) { voiceMembers.delete(socketId); refreshVoice(current.roomId); }
  };

  io.on('connection', (socket) => {
    const myName = socket.data.user.username as string;
    const isAdmin = isAdminId(socket.data.user.id);
    const isMember = (roomId: string) => playersInRoom.get(roomId)?.includes(socket.id) === true;
    const oldSocket = onlineUsers.get(myName);
    onlineUsers.set(myName,socket.id);
    if (oldSocket && oldSocket !== socket.id) io.sockets.sockets.get(oldSocket)?.disconnect(true);
    socket.broadcast.emit('user_status_change',{username:myName,online:true});
    // Reject expired tokens and malformed or overly frequent socket events before handlers run.
    let count = 0, windowStart = Date.now();
    socket.use((packet,next)=>{
      try { verifyToken(socket.handshake.auth.token); } catch { socket.disconnect(true); return; }
      if (Date.now()-windowStart > 1000) { windowStart=Date.now(); count=0; }
      if (++count > 30) return next(new Error('Слишком много запросов'));
      const [event, data] = packet;
      if (['send_invite','accept_invite','chat_message','send_reaction','dev_command'].includes(event) && (!data || typeof data !== 'object')) return next(new Error('Некорректный запрос'));
      next();
    });
    socket.on('error',()=>{});
    socket.on('register_online', () => {});
    socket.on('voice_join', (data: any, callback?: (result:any)=>void) => {
      const respond = (result: any) => { if (typeof callback === 'function') callback(result); };
      if (!data || typeof data.roomId !== 'string' || !['all','team'].includes(data.mode)
        || !isMember(data.roomId) || !rooms.has(data.roomId)) return respond({error:'Голосовой чат недоступен'});
      const room = rooms.get(data.roomId)!;
      if (room.mode === '1v1' && data.mode === 'team') return respond({error:'Для 1×1 доступен режим «Все»'});
      const previous = voiceMembers.get(socket.id);
      voiceMembers.set(socket.id,{roomId:data.roomId,mode:data.mode});
      if (previous && previous.roomId !== data.roomId) refreshVoice(previous.roomId);
      respond({ok:true}); refreshVoice(data.roomId);
    });
    socket.on('voice_leave', () => leaveVoice(socket.id));
    socket.on('voice_signal', (data: any) => {
      if (!data || typeof data.roomId !== 'string' || !Number.isInteger(data.toIndex)
        || !data.signal || typeof data.signal !== 'object') return;
      const signal = data.signal;
      if (!['offer','answer','candidate'].includes(signal.type)) return;
      if (JSON.stringify(signal).length > 12000) return;
      const seats = playersInRoom.get(data.roomId);
      if (!seats || !isMember(data.roomId) || voiceMembers.get(socket.id)?.roomId !== data.roomId) return;
      if (data.toIndex < 0 || data.toIndex >= seats.length) return;
      const target = seats[data.toIndex];
      if (!target || !voiceAllowed(socket.id,target)) return;
      const fromIndex = seats.indexOf(socket.id);
      if (fromIndex < 0) return;
      io.to(target).emit('voice_signal',{fromIndex,signal});
    });
    socket.on('disconnect', () => { leaveVoice(socket.id);
      if (onlineUsers.get(myName) === socket.id) { onlineUsers.delete(myName); socket.broadcast.emit('user_status_change',{username:myName,online:false}); }
      const id = findRoomOfSocket(socket.id); if (id) detach(socket,id);
    });
    socket.on('leave_room', (roomId: string) => { if (isMember(roomId)) { leaveVoice(socket.id); detach(socket,roomId,true); } });
    socket.on('send_invite', ({ to, roomId }, callback?: (res:any)=>void) => {
      const respond=(result:any)=>{if(typeof callback==='function') callback(result);};
      if (typeof to !== 'string' || typeof roomId !== 'string' || !isMember(roomId) || rooms.get(roomId)?.phase !== 'waiting' || to === myName) return respond({error:'Приглашение недоступно'});
      const target = onlineUsers.get(to); if (!target) return respond({error:'Игрок не в сети'});
      invitations.set(roomId+':'+to,{from:myName,expires:Date.now()+120000});
      io.to(target).emit('receive_invite',{from:myName,roomId}); respond({success:true});
    });
    socket.on('accept_invite', ({ roomId }, callback?: (res: any)=>void) => {
      if (typeof roomId !== 'string') { if(typeof callback==='function') callback({error:'Неверная комната'}); return; }
      const key=roomId+':'+myName, invite=invitations.get(key);
      if (typeof roomId !== 'string' || !invite || invite.expires < Date.now() || rooms.get(roomId)?.phase !== 'waiting' || !join(socket,roomId,false)) { if(typeof callback==='function') callback({error:'Приглашение недействительно'}); return; }
      invitations.delete(key); const sender=onlineUsers.get(invite.from);
      if(sender) io.to(sender).emit('invite_accepted',{roomId}); if(typeof callback==='function') callback({roomId});
    });
    socket.on('create_room', (mode: '1v1' | '2v2', dataOrCallback: any, maybeCallback?: any) => {
      const callback = typeof dataOrCallback === 'function' ? dataOrCallback : maybeCallback;
      if (!['1v1','2v2'].includes(mode)) { if(typeof callback==='function') callback({error:'Неверный режим'}); return; }
      const previous = findRoomOfSocket(socket.id); if(previous) detach(socket,previous,true);
      const roomId = randomUUID();
      const initialState: GameState = {
        mode, players: Array.from({length:mode==='1v1'?2:4},(_,i)=>({id:i as PlayerId, side:i%2?'B':'A',hand:[],name:i===0?myName:'Ожидание...',connected:i===0,isAdmin:i===0 && isAdmin})),
        deck: [], trumpCard: null, trump: null, trumpChanged: false, trumpChangeEvent: null,
        currentPlayer: 0, trick: null, lastTrickWinner: null, phase: 'waiting', matchScore: { A: 0, B: 0 }, multiplier: 1, roundNumber: 0, bita: { A: [], B: [] }, lastRoundPoints: null, diceRolls: null,
        stateVersion: 0, turnDeadline: null, settled: false
      };
      const seats = initialState.players.map((_,i)=>i===0?socket.id:'');
      rooms.set(roomId,initialState); playersInRoom.set(roomId,seats); roomActivity.set(roomId,Date.now()); socket.join(roomId);
      if(typeof callback==='function') callback({roomId});
    });
    socket.on('create_dev_room', (callback: any) => {
      if (!isAdmin) { if(typeof callback==='function') callback({error:'Доступ запрещён'}); return; }
      const previous=findRoomOfSocket(socket.id); if(previous) detach(socket,previous,true);
      const id=createDevRoom(socket); if(typeof callback==='function') callback({roomId:id}); rollDiceForRoom(io,id);
    });
    socket.on('join_room', (roomId: string, legacyOrCallback?: any, callback?: any) => {
      const ack = typeof legacyOrCallback === 'function' ? legacyOrCallback : callback;
      const ok = typeof roomId === 'string' && join(socket,roomId,typeof ack!=='function');
      if(typeof ack==='function') ack(ok ? {roomId} : {error:'Не удалось войти в комнату'});
    });

    socket.on('next_round', async (roomId: string, version: number) => {
      const room = rooms.get(roomId); if (!room || !isMember(roomId) || room.phase !== 'round-scored' || version !== room.stateVersion) return;
      roomActivity.set(roomId,Date.now());
      const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
      const seed = randomInt(0, 0x100000000);
      const res = applyEvent(cleanState, { type: 'START_ROUND', firstPlayer: room.lastTrickWinner ?? 0, seed });
      if (res.ok) { rooms.set(roomId, res.state); await checkAndBroadcast(io, roomId, res.state); }
    });

    socket.on('chat_message', ({ roomId, text }) => {
      if (!isMember(roomId) || typeof text !== 'string' || !text.trim() || text.length > 500) return;
      const msgId = Math.random().toString(36).substring(7);
      const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      if (isAdmin && typeof text === 'string' && text.startsWith('/')) {
        const parts = text.trim().split(/\s+/); const cmd = parts[0].toLowerCase(); const arg = parts[1]; const room = rooms.get(roomId);

        if (cmd === '/kick' && arg) {
          if (!room) return; const players = playersInRoom.get(roomId) || []; const targetIdx = room.players.findIndex(p => p.name === arg);
          if (targetIdx !== -1 && players[targetIdx] && players[targetIdx] !== '__BOT__') {
            const target=io.sockets.sockets.get(players[targetIdx]); if(target) { detach(target,roomId,true); target.emit('kicked','Вас исключил администратор'); }
            if(room.phase !== 'waiting') { removeRoom(roomId,'Матч закрыт администратором'); return; }
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
          if (!room || room.phase !== 'playing') return; const cleanState = { ...room, bita: { A: [], B: [] }, trumpChanged: false, diceRolls: null };
          const seed = randomInt(0, 0x100000000);
          const res = applyEvent(cleanState, { type: 'START_ROUND', firstPlayer: room.lastTrickWinner ?? 0, seed });
          if (res.ok) { rooms.set(roomId, res.state); checkAndBroadcast(io, roomId, res.state); }
          io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: '🔄 Кон перезапущен администратором', time: now }); return;
        }
        if (cmd === '/secret') { io.to(roomId).emit('admin_secret_fx'); io.to(roomId).emit('chat_message', { id: msgId, sender: 'СИСТЕМА', text: '👑 Создатель наблюдает за вами... Удачи, смертные! 🃏', time: now }); return; }
        socket.emit('chat_message', { id: msgId, sender: 'DEBUG', text: `Игровые команды: /kick, /rain, /stats, /reset, /secret. Остальное — в Dev Console (🛠️)`, time: now }); return;
      }
      io.to(roomId).emit('chat_message', { id: msgId, sender: myName, isAdmin, text, time: now });
    });

    socket.on('dev_command', ({ command }: { command: string }) => {
      if (!isAdmin) return;
      if (typeof command !== 'string' || command.length > 500) return;
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
        else { frozen.add(targetIdx); reply(`❄️ ${arg} заморожен — таймер стоит`, 'success'); if (myRoom.currentPlayer === targetIdx) { clearTurnTimer(myRoomId); myRoom.turnDeadline=null; broadcastState(io,myRoomId,myRoom); } }
        frozenPlayers.set(myRoomId, frozen);
        if (!frozen.has(targetIdx) && myRoom.currentPlayer === targetIdx) { startTurnTimer(io,myRoomId); broadcastState(io,myRoomId,myRoom); }
        io.to(myRoomId).emit('chat_message', { id: Math.random().toString(36).substring(7), sender: 'СИСТЕМА', text: frozen.has(targetIdx) ? `❄️ ${arg} заморожен` : `🔥 ${arg} разморожен`, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }); return;
      }
      if (base === '/reverse') {
        if (!myRoomId || !myRoom) { reply('❌ Ты не в комнате', 'error'); return; }
        io.to(myRoomId).emit('admin_reverse'); io.to(myRoomId).emit('chat_message', { id: Math.random().toString(36).substring(7), sender: 'СИСТЕМА', text: '🔄 Стол перевёрнут!', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }); reply('🔄 Стол перевернут у всех', 'success'); return;
      }
      if (base === '/broadcast') {
        const broadcastText = parts.slice(1).join(' '); if (!broadcastText) { reply('Использование: /broadcast [текст]', 'error'); return; }
        io.emit('global_broadcast', { text: broadcastText, from: myName }); reply(`📢 Отправлено всем: "${broadcastText}"`, 'success'); return;
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

    socket.on('send_reaction', ({ roomId, emoji }) => { if (!isMember(roomId) || typeof emoji !== 'string' || emoji.length > 20) return; const left = Math.floor(Math.random() * 80) + 10; io.to(roomId).emit('reaction', { id: Date.now(), emoji, sender: myName, left }); });

    socket.on('play_card', async (roomId: string, cards: any[], version: number) => {
      const room = rooms.get(roomId); if (!room || room.phase !== 'playing') return;
      const playerIndex = playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1; if (playerIndex === -1) return;
      
      if (!Array.isArray(cards) || cards.length > 6 || cards.some(c=>!c || typeof c !== 'object') || frozenPlayers.get(roomId)?.has(playerIndex)) return;
      if (version !== room.stateVersion) { socket.emit('error','Ход устарел'); return; }
      const res = applyTurn(room,{type:'ATTACK',player:playerIndex as PlayerId,cards});
      if (!res.ok) { socket.emit('error',`Ошибка: ${res.error}`); return; }
      roomActivity.set(roomId,Date.now());
      await checkAndBroadcast(io,roomId,res.state);
    });
    socket.on('pass_or_beat', async (roomId: string, action: 'beat' | 'pass', cards: any[], version: number) => {
      const room = rooms.get(roomId); if(!room || room.phase !== 'playing') return;
      const playerIndex=playersInRoom.get(roomId)?.indexOf(socket.id) ?? -1;
      if(playerIndex<0 || frozenPlayers.get(roomId)?.has(playerIndex) || !['beat','pass'].includes(action) || !Array.isArray(cards) || cards.length>6 || cards.some(c=>!c || typeof c !== 'object')) return;
      if (version !== room.stateVersion) { socket.emit('error','Ход устарел'); return; }
      const res=applyTurn(room,{type:action==='beat'?'BEAT':'PASS',player:playerIndex as PlayerId,cards});
      if(!res.ok) {socket.emit('error',`Ошибка: ${res.error}`);return;}
      roomActivity.set(roomId,Date.now());
      await checkAndBroadcast(io,roomId,res.state);
    });

    socket.on('admin_get_rooms', async () => {
      if (!isAdmin) return;
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map(p => p.name), matchScore: state.matchScore }));
      socket.emit('admin_rooms_list', roomsList);
    });

    socket.on('admin_close_room', async (roomId: string) => {
      if (!isAdmin) return;
      const room = rooms.get(roomId); if (!room) return;
      if(room.phase==='finished' && !room.settled && !roomId.startsWith('DEV-')) { await settle(roomId,room); if(!room.settled) { socket.emit('error','Результат ещё не сохранён'); return; } }
      removeRoom(roomId,'Комната закрыта администратором');
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({ id, mode: state.mode, phase: state.phase, round: state.roundNumber, players: state.players.map(p => p.name), matchScore: state.matchScore }));
      socket.emit('admin_rooms_list', roomsList);
    });
  });

  async function settle(roomId: string, state: GameState) {
    if(state.settled || settling.has(roomId)) return;
    if(roomId.startsWith('DEV-')) { state.settled=true; return; }
    settling.add(roomId);
    try {
      const winningSide=state.matchScore.A>=24?'B':'A';
      await db.settleMatch(roomId,state.players.map(p=>({name:p.name,won:p.side===winningSide})));
      state.settled=true;
    } catch (err) { app.log.error({roomId,code:(err as any).code},'Statistics save failed; will retry'); }
    finally { settling.delete(roomId); }
  }
  async function checkAndBroadcast(io: Server, roomId: string, state: GameState) {
    let currentState = state;
    while (currentState.phase === 'playing' && currentState.trick && currentState.players[currentState.trick.respondent]?.hand.length === 0) {
      const res = applyTurn(currentState, { type:'PASS',player:currentState.trick.respondent,cards:[] });
      if(!res.ok) break; currentState=res.state;
    }
    const endOfRound=currentState.deck.length===0 && !currentState.trick && currentState.players.every(p=>p.hand.length===0);
    if(endOfRound && currentState.phase==='playing') {
      const res=applyEvent(currentState,{type:'SCORE_ROUND'}); if(res.ok) currentState=res.state;
    }
    rooms.set(roomId,currentState);
    // Preserve disconnected seat status when an in-flight transition completes.
    const seats=playersInRoom.get(roomId)||[];
    currentState.players.forEach((p,i)=>{p.connected=Boolean(seats[i]);});
    if(currentState.phase==='playing') startTurnTimer(io,roomId);
    else { clearTurnTimer(roomId); currentState.turnDeadline=null; }
    if(currentState.phase==='finished') await settle(roomId,currentState);
    if(rooms.get(roomId)===currentState) broadcastState(io,roomId,currentState);
  }

  function broadcastState(io: Server, roomId: string, state: GameState) {
    const players = playersInRoom.get(roomId) || [];
    players.forEach((sockId, index) => {
      if (sockId && sockId !== '__BOT__') {
        const legalMoves = getLegalMoves(state, index as PlayerId);
        const view = project(state, index as PlayerId, legalMoves);
        io.to(sockId).emit('game_state', { ...view, roomId });
      }
    });

  }
  await app.listen({port:PORT,host:'0.0.0.0'});
}

main().catch(err=>{console.error('Server startup failed:',err.message);process.exit(1);});