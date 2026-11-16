import React, { useState } from 'react';
import { Goat3D } from './Goat3D';

import { API_URL } from './api';

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
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? `${API_URL}/api/login` : `${API_URL}/api/register`;
      const body = isLogin ? { username, password } : { username, password, fullname, email };

      const res = await fetch(endpoint, {
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
      setError(err.message === 'Failed to fetch' ? 'Сервер недоступен. Подождите немного.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'radial-gradient(circle, #1a1a2e 0%, #0f3460 100%)', color: 'white' }}>
      <div style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(240,198,116,0.2)', border: '2px solid #f0c674', textAlign: 'center', width: 320 }}>
        
        {/* 🔽 3D КОЗЁЛ НА ЭКРАНЕ ВХОДА 🔽 */}
        <Goat3D />
        
        <h1 style={{ color: '#f0c674', margin: '0 0 20px 0', fontSize: 28, textShadow: '0 0 10px rgba(240,198,116,0.5)' }}>Козёл</h1>
        
        <h2 style={{ color: 'white', fontSize: 18, margin: '0 0 20px 0' }}>{isLogin ? 'Вход в аккаунт' : 'Регистрация'}</h2>

        {error && (
          <div style={{ background: error.includes('успешна') ? '#4caf50' : '#d32f2f', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <input type="text" placeholder="Никнейм" value={username} onChange={e => setUsername(e.target.value)} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none' }} />
          <input type="password" minLength={isLogin ? undefined : 8} placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none' }} />
          {!isLogin && (
            <>
              <input type="text" placeholder="ФИО" value={fullname} onChange={e => setFullname(e.target.value)} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none' }} />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none' }} />
            </>
          )}

          <button type="submit" disabled={loading} style={{ padding: '15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 10, boxShadow: '0 4px 0 #2e7d32', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Пробуждаем сервер...
              </>
            ) : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 14, color: '#aaa' }}>
          {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <span onClick={() => { setIsLogin(!isLogin); setError(null); }} style={{ color: '#f0c674', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </span>
        </div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}