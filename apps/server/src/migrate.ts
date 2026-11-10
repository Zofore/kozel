import fs from 'fs';
import path from 'path';
import { db } from './db';

async function migrate() {
  // Используем текущую директорию (папка apps/server), откуда мы запускаем скрипт
  const filePath = path.join(process.cwd(), 'users.json'); 
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ Файл users.json не найден. Убедитесь, что он лежит в папке apps/server.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const users = JSON.parse(rawData);

  console.log(`📦 Найдено ${users.length} пользователей в users.json. Начинаю перенос в PostgreSQL...`);

  try {
    // Наша функция saveUsers умеет обновлять существующих и добавлять новых
    await db.saveUsers(users);
    console.log('✅ УСПЕХ! Все пользователи перенесены в базу данных.');
  } catch (error) {
    console.error('❌ Ошибка при переносе:', error);
  }
  
  process.exit(0);
}

migrate();