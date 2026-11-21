import 'dotenv/config';
import pg, { type PoolClient } from 'pg';
const { Pool } = pg;
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error('DATABASE_URL is required');
const url = new URL(rawUrl);
// pg connection-string SSL flags can override explicit TLS settings.
for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','uselibpqcompat']) url.searchParams.delete(key);
const pool = new Pool({ connectionString: url.toString(), ssl: process.env.DB_TLS === 'disable' ? false : { rejectUnauthorized: true, ...(process.env.DB_CA ? { ca: process.env.DB_CA.replace(/\\n/g, '\n') } : {}) } });
if (process.env.NODE_ENV === 'production' && process.env.DB_TLS === 'disable') throw new Error('TLS required in production');
export interface User {
  id: number; username: string; password: string; fullname: string; email: string;
  avatar: string; status: string; friends: string[]; friendRequests: string[]; wins: number; losses: number; rating: number; xp: number; matchAchievements: string[];
}
const publicColumns = 'id, username, fullname, avatar, status, friends, friendrequests AS "friendRequests", wins, losses, rating, xp, match_achievements AS "matchAchievements"';
const columns = publicColumns + ', password, email';
async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
export const db = {
  close: () => pool.end(),
  async init() {
    await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(7142031)');
      await client.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        fullname VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, avatar TEXT, status VARCHAR(255),
        friends JSONB DEFAULT '[]', friendrequests JSONB DEFAULT '[]', wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0
      )`);
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username))');
      await client.query(`SELECT setval(pg_get_serial_sequence('users','id'), GREATEST(COALESCE((SELECT MAX(id) FROM users),0)+1, nextval(pg_get_serial_sequence('users','id'))), false)`);
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 0');
      await client.query('ALTER TABLE users ALTER COLUMN rating SET DEFAULT 0');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0');
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS match_achievements TEXT[] NOT NULL DEFAULT '{}'");
      await client.query('CREATE TABLE IF NOT EXISTS settled_matches (match_id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      await client.query(`CREATE TABLE IF NOT EXISTS match_history (match_id TEXT NOT NULL REFERENCES settled_matches(match_id), username TEXT NOT NULL, won BOOLEAN NOT NULL, opponents JSONB NOT NULL DEFAULT '[]'::jsonb, finished_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (match_id, username))`);
      await client.query('CREATE INDEX IF NOT EXISTS match_history_user_date_idx ON match_history(username, finished_at DESC)');
      await client.query(`UPDATE users SET rating=0 WHERE rating=1000 AND xp=0
        AND NOT EXISTS (SELECT 1 FROM match_history WHERE match_history.username=users.username)`);
    });
  },
  async getUsers(): Promise<Omit<User,'password'|'email'>[]> { return (await pool.query(`SELECT ${publicColumns} FROM users ORDER BY id`)).rows; },
  async getUser(username: string): Promise<User | undefined> { return (await pool.query(`SELECT ${columns} FROM users WHERE lower(username)=lower($1)`, [username])).rows[0]; },
  async register(username: string, password: string, fullname: string, email: string) {
    await pool.query('INSERT INTO users (username,password,fullname,email,avatar,status) VALUES ($1,$2,$3,$4,$5,$6)', [username,password,fullname,email,'','В сети']);
  },
  async updateProfile(username: string, status?: string, avatar?: string) {
    const result = await pool.query('UPDATE users SET status=COALESCE($2,status), avatar=COALESCE($3,avatar) WHERE username=$1', [username,status ?? null,avatar ?? null]);
    return result.rowCount === 1;
  },
  async friends(username: string, other: string, action: 'request'|'accept'|'decline'|'remove'): Promise<string | null> {
    if (username === other) return 'Нельзя добавить себя';
    return transaction(async client => {
      const users: Omit<User,'password'|'email'>[] = (await client.query(`SELECT ${publicColumns} FROM users WHERE username=ANY($1::text[]) ORDER BY id FOR UPDATE`, [[username,other]])).rows;
      const user = users.find(u => u.username === username), target = users.find(u => u.username === other);
      if (!user || !target) return 'Пользователь не найден';
      user.friends ||= []; target.friends ||= []; user.friendRequests ||= []; target.friendRequests ||= [];
      if (action === 'request') {
        if (user.friends.includes(other)) return 'Уже в друзьях';
        if (user.friendRequests.includes(other)) return 'У вас уже есть входящая заявка';
        if (!target.friendRequests.includes(username)) target.friendRequests.push(username);
        await client.query('UPDATE users SET friendrequests=$2 WHERE id=$1', [target.id,JSON.stringify(target.friendRequests)]);
        return null;
      }
      if (action === 'accept' || action === 'decline') {
        if (!user.friendRequests.includes(other)) return 'Заявка не найдена';
        user.friendRequests = user.friendRequests.filter(x => x !== other);
        if (action === 'accept') {
          user.friends = [...new Set([...user.friends,other])]; target.friends = [...new Set([...target.friends,username])];
          target.friendRequests = target.friendRequests.filter(x => x !== username);
        }
      } else {
        user.friends = user.friends.filter(x => x !== other); target.friends = target.friends.filter(x => x !== username);
      }
      for (const u of [user,target]) await client.query('UPDATE users SET friends=$2,friendrequests=$3 WHERE id=$1',[u.id,JSON.stringify(u.friends),JSON.stringify(u.friendRequests)]);
      return null;
    });
  },
  async getLeaderboard(limit = 50) {
    const rows = (await pool.query(`SELECT id, username, fullname, avatar, wins, losses, rating, xp FROM users ORDER BY rating DESC, wins DESC, id ASC LIMIT $1`, [Math.min(100, Math.max(1, Math.trunc(limit)))] )).rows;
    return rows.map((row, index) => ({ rank: index + 1, username: row.username, fullname: row.fullname, avatar: row.avatar || '', wins: row.wins, losses: row.losses, rating: row.rating, xp: row.xp }));
  },
  async getMatchHistory(username: string, limit = 20) {
    const capped = Math.min(50, Math.max(1, Math.trunc(limit)));
    const result = await pool.query(`SELECT match_id AS "matchId", won, opponents, finished_at AS "finishedAt" FROM match_history WHERE username=$1 ORDER BY finished_at DESC, match_id DESC LIMIT $2`, [username, capped]);
    return result.rows as {matchId:string;won:boolean;opponents:string[];finishedAt:string}[];
  },
  async settleMatch(matchId: string, players: { name: string; won: boolean; penaltyPoints?: number }[]) {
    await transaction(async client => {
      const inserted = await client.query('INSERT INTO settled_matches(match_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING match_id',[matchId]);
      if (!inserted.rowCount) return;
      await client.query('SELECT id FROM users WHERE username=ANY($1::text[]) ORDER BY id FOR UPDATE',[players.map(p=>p.name)]);
      for (const player of players) {
        const result = await client.query('UPDATE users SET wins=COALESCE(wins,0)+$2, losses=COALESCE(losses,0)+$3, rating=GREATEST(0,COALESCE(rating,0)+$4), xp=COALESCE(xp,0)+$5 WHERE username=$1',[player.name, player.won ? 1 : 0, player.won ? 0 : 1, player.won ? 20 : -15, player.won ? 100 : 35]);
        if (result.rowCount !== 1) throw new Error('Match player not found');
        if (player.won) {
          const previous = await client.query<{ won: boolean }>(
            'SELECT won FROM match_history WHERE username=$1 ORDER BY finished_at DESC, match_id DESC LIMIT 9',
            [player.name]
          );
          const awards: string[] = [];
          if (previous.rows.length === 9 && previous.rows.every(match => match.won)) awards.push('ten_win_streak');
          if (player.penaltyPoints === 0) awards.push('no_penalty_win');
          if (awards.length) {
            await client.query(
              'UPDATE users SET match_achievements=ARRAY(SELECT DISTINCT unnest(match_achievements || $2::text[])) WHERE username=$1',
              [player.name, awards]
            );
          }
        }
        await client.query('INSERT INTO match_history(match_id,username,won,opponents,finished_at) VALUES ($1,$2,$3,$4::jsonb,clock_timestamp())', [matchId, player.name, player.won, JSON.stringify(players.filter(p=>p.name!==player.name).map(p=>p.name))]);
      }
    });
  }
};
