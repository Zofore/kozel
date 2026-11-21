import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export function Lobby({ socket, setRoomId, username, onBack }: { socket: Socket, setRoomId: (id: string) => void, username: string, onBack: () => void }) {
  const [difficulty, setDifficulty] = useState('professional');
  const [creatingBotRoom, setCreatingBotRoom] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 820);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const createRoom = (mode: '1v1' | '2v2') => {
    socket.timeout(5000).emit('create_room', mode, (err:any,res: { roomId?: string; error?: string }) => {
      if (!err && res?.roomId) setRoomId(res.roomId); else alert(res?.error || 'Ошибка комнаты');
    });
  };

  const createBotRoom = () => {
    setCreatingBotRoom(true);
    socket.timeout(5000).emit('create_bot_room', difficulty, (err: Error | null, res?: { roomId?: string; error?: string }) => {
      setCreatingBotRoom(false);
      if (!err && res?.roomId) setRoomId(res.roomId);
      else alert(res?.error || 'Не удалось начать игру с ботом');
    });
  };

  const joinRoom = () => {
    if (!joinId.trim()) return alert('Введите ID комнаты!');
    socket.timeout(5000).emit('join_room',joinId.trim(),(err:any,res:any)=>{
      if(err || res?.error) alert(res?.error || 'Сервер недоступен'); else setRoomId(res.roomId);
    });
  };

  return (
    <div className="mobile-screen" style={{ padding: isMobile ? 'max(16px, env(safe-area-inset-top))' : 20, minHeight: isMobile ? '100dvh' : '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent', boxSizing: 'border-box' }}>

      {/* Обертка, которая центрирует и кнопку, и окно */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* КНОПКА НАЗАД */}
        <button
          onClick={onBack}
          style={{
            marginBottom: 20,
            background: 'rgba(37, 37, 64, 0.8)',
            border: '1px solid #f0c674',
            color: '#f0c674',
            padding: isMobile ? '12px 20px' : '10px 20px',
            borderRadius: '8px',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 'bold',
            cursor: 'pointer',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: '0.2s',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            minHeight: 48,
            width: isMobile ? '100%' : 'auto'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0c674'; e.currentTarget.style.color = '#000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(37, 37, 64, 0.8)'; e.currentTarget.style.color = '#f0c674'; }}
        >
          ← В меню
        </button>

        {/* Окно лобби */}
        <div className="mobile-panel" style={{ width: '100%', background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: isMobile ? 'clamp(20px, 5vw, 30px)' : 30, borderRadius: 20, border: '2px solid #f0c674', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', textAlign: 'center', boxSizing: 'border-box' }}>
          <h1 style={{ color: '#f0c674', fontSize: isMobile ? 28 : 36, marginBottom: 10, marginTop: 0 }}>Лобби</h1>
          <p style={{ color: 'white', marginBottom: isMobile ? 20 : 30, fontSize: isMobile ? 15 : undefined }}>Вы вошли как: <strong>{username}</strong></p>

          <div style={{ marginBottom: 16 }}>
            <button onClick={() => createRoom('1v1')} style={{ padding: isMobile ? '14px 20px' : '15px 20px', margin: isMobile ? '4px 0' : '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: isMobile ? 17 : 18, fontWeight: 'bold', cursor: 'pointer', color: '#000', minHeight: 48 }}>Создать 1 на 1</button>
            <button onClick={() => createRoom('2v2')} style={{ padding: isMobile ? '14px 20px' : '15px 20px', margin: isMobile ? '4px 0' : '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: isMobile ? 17 : 18, fontWeight: 'bold', cursor: 'pointer', color: '#000', minHeight: 48 }}>Создать 2 на 2</button>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
            <label htmlFor="bot-difficulty" style={{ color: '#f0c674' }}>Сложность бота</label>
            <select id="bot-difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value)} disabled={creatingBotRoom}
              style={{ minHeight: 44, width: '100%', padding: '8px 12px', background: '#252540', color: 'white', border: '1px solid #777', borderRadius: 8, fontSize: 16 }}>
              <option value="novice">Новичок</option>
              <option value="amateur">Любитель</option>
              <option value="professional">Профессионал</option>
              <option value="master">Мастер</option>
              <option value="legend">Легенда</option>
            </select>
            <button onClick={createBotRoom} disabled={creatingBotRoom}
              style={{ width: '100%', minHeight: 48, padding: '12px 16px', background: '#f0c674', color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 17, fontWeight: 'bold' }}>
              {creatingBotRoom ? 'Запуск игры…' : 'Играть с ботом'}
            </button>
          </div>

          <hr style={{ borderColor: '#444', marginBottom: 20 }} />

          <div>
            <h3 style={{ color: '#aaa', marginBottom: 15 }}>Или войти по ID</h3>
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="ID комнаты" style={{ padding: isMobile ? '14px' : '15px', width: '100%', borderRadius: 8, border: '1px solid #444', background: '#252540', color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 15, boxSizing: 'border-box' }} />
            <button onClick={joinRoom} style={{ padding: isMobile ? '14px 20px' : '15px 20px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', minHeight: 48 }}>Войти</button>
          </div>
        </div>

      </div>
    </div>
  );
}