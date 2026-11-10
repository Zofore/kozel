import React, { useState } from 'react';

const REGEX_NICKNAME = /^[a-zA-Zа-яА-ЯёЁ\s]{1,21}$/;
const REGEX_PASSWORD = /^.{1,21}$/;
const REGEX_FULLNAME = /^[a-zA-Zа-яА-ЯёЁ\s-]{1,50}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Auth({ onAuth }: { onAuth: (token: string, user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) {
      if (!REGEX_NICKNAME.test(username)) return setError('Никнейм: только буквы и пробелы, до 21 символа');
      if (!REGEX_PASSWORD.test(password)) return setError('Пароль: до 21 символа');
      if (!REGEX_FULLNAME.test(fullname)) return setError('ФИО: только буквы, пробелы и дефисы');
      if (!REGEX_EMAIL.test(email)) return setError('Введите корректный Email');
    }

    setLoading(true);
    setError(null);

    const endpoint = isLogin ? '/api/login' : '/api/register';
    const body = isLogin ? { username, password } : { username, password, fullname, email };

    try {
      const res = await fetch(`http://localhost:3005${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');

      if (isLogin) {
        onAuth(data.token, data.user);
      } else {
        setIsLogin(true);
        setError('Регистрация успешна! Теперь войдите.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'radial-gradient(circle, #1a1a2e 0%, #0f3460 100%)' }}>
      <form onSubmit={handleSubmit} style={{ background: 'rgba(37, 37, 64, 0.9)', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '2px solid #f0c674', width: 340, textAlign: 'center' }}>
        <h1 style={{ color: '#f0c674', margin: '0 0 20px 0', fontSize: 28 }}>🃏 Козёл</h1>
        <h2 style={{ color: 'white', margin: '0 0 20px 0', fontSize: 18 }}>{isLogin ? 'Вход в аккаунт' : 'Регистрация'}</h2>
        
        {error && <div style={{ background: '#d32f2f', color: 'white', padding: 10, borderRadius: 8, marginBottom: 15, fontSize: 14 }}>{error}</div>}

        {!isLogin && (
          <>
            <input type="text" placeholder="ФИО (Иванов Иван)" value={fullname} onChange={e => setFullname(e.target.value)} maxLength={50} style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 8, border: '1px solid #555', background: '#1a1a2e', color: 'white', boxSizing: 'border-box' }} />
            <input type="email" placeholder="Email (для восстановления)" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 8, border: '1px solid #555', background: '#1a1a2e', color: 'white', boxSizing: 'border-box' }} />
          </>
        )}

        <input type="text" placeholder="Никнейм (для входа)" value={username} onChange={e => setUsername(e.target.value)} maxLength={21} style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 8, border: '1px solid #555', background: '#1a1a2e', color: 'white', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} maxLength={21} style={{ width: '100%', padding: 12, marginBottom: 20, borderRadius: 8, border: '1px solid #555', background: '#1a1a2e', color: 'white', boxSizing: 'border-box' }} />

        <button type="submit" disabled={loading} style={{ width: '100%', padding: 15, background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 15 }}>
          {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
        </button>

        <div style={{ color: '#aaa', fontSize: 14, cursor: 'pointer' }} onClick={() => { setIsLogin(!isLogin); setError(null); }}>
          {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </div>
      </form>
    </div>
  );
}