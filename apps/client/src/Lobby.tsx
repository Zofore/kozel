import React, { useState } from 'react';
import { Socket } from 'socket.io-client';

export function Lobby({ socket, setRoomId, username, onBack }: { socket: Socket, setRoomId: (id: string) => void, username: string, onBack: () => void }) {
  const [joinId, setJoinId] = useState('');

  const createRoom = (mode: '1v1' | '2v2') => {
    socket.timeout(5000).emit('create_room', mode, (err:any,res: { roomId?: string; error?: string }) => {
      if (!err && res?.roomId) setRoomId(res.roomId); else alert(res?.error || 'Ошибка комнаты');
    });
  };

  const joinRoom = () => {
    if (!joinId.trim()) return alert('Введите ID комнаты!');
    socket.timeout(5000).emit('join_room',joinId.trim(),(err:any,res:any)=>{
      if(err || res?.error) alert(res?.error || 'Сервер недоступен'); else setRoomId(res.roomId);
    });
  };

  return (
    <div className="mobile-screen" style={{ padding: 20, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent' }}>
      
      {/* Обертка, которая центрирует и кнопку, и окно */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* КНОПКА НАЗАД (теперь она привязана к окну лобби) */}
        <button 
          onClick={onBack} 
          style={{ 
            marginBottom: 20, // Отступ до окна лобби
            background: 'rgba(37, 37, 64, 0.8)', 
            border: '1px solid #f0c674', 
            color: '#f0c674', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            fontSize: '16px', 
            fontWeight: 'bold',
            cursor: 'pointer', 
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: '0.2s',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0c674'; e.currentTarget.style.color = '#000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(37, 37, 64, 0.8)'; e.currentTarget.style.color = '#f0c674'; }}
        >
          ← В меню
        </button>

        {/* Окно лобби */}
        <div className="mobile-panel" style={{ width: '100%', background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 30, borderRadius: 20, border: '2px solid #f0c674', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', textAlign: 'center' }}>
          <h1 style={{ color: '#f0c674', fontSize: 36, marginBottom: 10, marginTop: 0 }}>Лобби</h1>
          <p style={{ color: 'white', marginBottom: 30 }}>Вы вошли как: <strong>{username}</strong></p>
          
          <div style={{ marginBottom: 40 }}>
            <button onClick={() => createRoom('1v1')} style={{ padding: '15px 20px', margin: '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', color: '#000' }}>Создать 1 на 1</button>
            <button onClick={() => createRoom('2v2')} style={{ padding: '15px 20px', margin: '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', color: '#000' }}>Создать 2 на 2</button>
          </div>

          <hr style={{ borderColor: '#444', marginBottom: 20 }} />

          <div>
            <h3 style={{ color: '#aaa' }}>Или войти по ID</h3>
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="ID комнаты" style={{ padding: 15, width: '100%', borderRadius: 8, border: '1px solid #444', background: '#252540', color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 15, boxSizing: 'border-box' }} />
            <button onClick={joinRoom} style={{ padding: '15px 20px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer' }}>Войти</button>
          </div>
        </div>

      </div>
    </div>
  );
}