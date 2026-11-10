import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'users.json');

console.log("--> Загрузка JSON базы данных...");

// Если файла нет, создаем пустой массив
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

export const db = {
  getUsers: (): any[] => {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  },
  saveUsers: (users: any[]) => {
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
  }
};

console.log("--> База данных успешно загружена!");