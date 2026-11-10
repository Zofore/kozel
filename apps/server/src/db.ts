import pg from 'pg';

const { Pool } = pg;

const connectionString = 'postgresql://kaiki_c_514a2ba2ad0bacfc5179120b:Kk1!nI4jRycMWUGDUk-1HFzTJrgNY6CH@ep-20ca23b6c9a6.kaiki.ru:5432/kozel-game?sslmode=require&connection_limit=10';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } // Обязательно для облачных баз
});

// Создаем таблицу при запуске, если ее нет
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
`).catch(err => console.error('Ошибка создания таблицы:', err));

export const db = {
  getUsers: async (): Promise<any[]> => {
    try {
      const res = await pool.query('SELECT * FROM users ORDER BY id ASC');
      return res.rows;
    } catch (e) {
      console.error('DB Error getUsers:', e);
      return [];
    }
  },

  saveUsers: async (users: any[]): Promise<void> => {
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
          u.id, u.username, u.password, u.fullname, u.email, 
          u.avatar || '', u.status || 'В сети', 
          JSON.stringify(u.friends || []), JSON.stringify(u.friendRequests || []), 
          u.wins || 0, u.losses || 0
        ]);
      }
    } catch (e) {
      console.error('DB Error saveUsers:', e);
    }
  }
};