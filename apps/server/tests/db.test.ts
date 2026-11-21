import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Deliberately refuse to touch a production database.
const url = process.env.KOZEL_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Set KOZEL_TEST_DATABASE_URL to a dedicated database whose name ends in _test');
process.env.DATABASE_URL = url;
process.env.DB_TLS = 'disable';
process.env.NODE_ENV = 'test';

test('registration, profile, friends and idempotent match stats using PostgreSQL', async () => {
  const { db } = await import('../src/db');
  try {
    await db.init();
    const names = Array.from({length:4},()=>`test-${randomUUID()}`);
    await Promise.all(names.map(name=>db.register(name,'test-hash','Test user','test@example.invalid')));
    const duplicate = await Promise.allSettled([db.register(names[0].toUpperCase(),'test-hash','Test user','test@example.invalid'), db.register(names[0],'test-hash','Test user','test@example.invalid')]);
    assert(duplicate.every(x=>x.status==='rejected'));
    const accounts = await Promise.all(names.map(n=>db.getUser(n)));
    assert.equal(new Set(accounts.map(a=>a?.id)).size,4);
    assert(accounts.every(account => account?.rating === 0));
    assert.equal(await db.updateProfile(names[0],'ready',''),true);
    assert.equal((await db.getUser(names[0]))?.status,'ready');
    assert.equal(await db.friends(names[1],names[0],'accept'),'Заявка не найдена');
    assert.equal(await db.friends(names[0],names[1],'request'),null);
    assert((await db.getUser(names[1]))?.friendRequests.includes(names[0]));
    assert.equal(await db.friends(names[1],names[0],'accept'),null);
    assert((await db.getUser(names[0]))?.friends.includes(names[1]));
    assert((await db.getUser(names[1]))?.friends.includes(names[0]));
    const match=randomUUID(), result=names.map((name,i)=>({name,won:i%2===0}));
    await Promise.all([db.settleMatch(match,result),db.settleMatch(match,result)]);
    for(let i=0;i<4;i++) {const u=await db.getUser(names[i]);assert.equal(u?.wins,i%2===0?1:0);assert.equal(u?.losses,i%2===0?0:1);}
    for(let i=0;i<4;i++) {
      const u=await db.getUser(names[i]);
      assert.equal(u?.rating, i%2===0 ? 20 : 0);
      assert.equal(u?.xp, i%2===0 ? 100 : 35);
    }
    const legacy = `test-${randomUUID()}`;
    await db.register(legacy, 'test-hash', 'Test user', 'test@example.invalid');
    const legacyPool = new pg.Pool({ connectionString: url, ssl: false });
    try {
      await legacyPool.query('UPDATE users SET rating=1000 WHERE username=ANY($1::text[])', [[legacy, names[2]]]);
      await db.init();
      assert.equal((await db.getUser(legacy))?.rating, 0);
      assert.equal((await db.getUser(names[2]))?.rating, 1000);
      assert.equal((await db.getUser(names[0]))?.rating, 20);
    } finally {
      await legacyPool.end();
    }
    const board = await db.getLeaderboard(100);
    assert(board.every((player, index) => index === 0 || player.rating <= board[index - 1].rating));
    const history = await db.getMatchHistory(names[0]);
    const recorded = history.filter(h=>h.matchId===match);
    assert.equal(recorded.length,1, 'duplicate settle must not duplicate history');
    assert.equal(recorded[0].won,true);
    assert(recorded[0].opponents.includes(names[1]));
    const duel = (winner: string, penaltyPoints: number) => [
      { name: names[0], won: winner === names[0], penaltyPoints },
      { name: names[1], won: winner === names[1], penaltyPoints }
    ];
    await db.settleMatch(randomUUID(), duel(names[1], 4));
    for (let i = 0; i < 9; i++) await db.settleMatch(randomUUID(), duel(names[0], 4));
    assert.deepEqual((await db.getUser(names[0]))?.matchAchievements, []);
    const cleanWin = randomUUID();
    await Promise.all([
      db.settleMatch(cleanWin, duel(names[0], 0)),
      db.settleMatch(cleanWin, duel(names[0], 0))
    ]);
    await db.settleMatch(randomUUID(), duel(names[1], 4));
    assert.deepEqual((await db.getUser(names[0]))?.matchAchievements.sort(), ['no_penalty_win', 'ten_win_streak']);
    assert.deepEqual((await db.getUser(names[1]))?.matchAchievements, []);
    assert.equal(await db.friends(names[0],names[1],'remove'),null);
    assert(!(await db.getUser(names[0]))?.friends.includes(names[1]));
  } finally {await db.close();}
});
