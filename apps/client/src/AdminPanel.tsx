import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export function AdminPanel({ socket, username, onClose }: { socket: Socket, username: string, onClose: () => void }) {
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    const onList = (list: any[]) => setRooms(list);
    socket.on('admin_rooms_list', onList);
    socket.emit('admin_get_rooms');
    return () => { socket.off('admin_rooms_list', onList); };
  }, [socket, username]);

  const refresh = () => socket.emit('admin_get_rooms');
  const closeRoom = (roomId: string) => {
    if (!window.confirm(`Закрыть комнату ${roomId}?`)) return;
    socket.emit('admin_close_room', roomId);
  };

  return (
    <div className="mobile-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, backdropFilter: 'blur(5px)'
    }}>
      <div className="mobile-admin-panel" style={{
        background: 'linear-gradient(180deg, #1a1a2e, #0f3460)',
        border: '2px solid #ffd700', borderRadius: 16, padding: 30,
        width: '90%', maxWidth: 700, maxHeight: '80vh', overflowY: 'auto',
        color: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#ffd700', margin: 0 }}>👑 Админ-панель</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={refresh} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>🔄 Обновить</button>
            <button onClick={onClose} style={{ background: 'transparent', color: '#f44336', border: '1px solid #f44336', padding: '8px 15px', borderRadius: 6, cursor: 'pointer' }}>✖ Закрыть</button>
          </div>
        </div>

        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 15 }}>Активных комнат: {rooms.length}</div>

        {rooms.length === 0 && <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>Нет активных комнат</div>}

        {rooms.map(r => (
          <div key={r.id} style={{
            background: 'rgba(0,0,0,0.4)', padding: 15, borderRadius: 10,
            marginBottom: 10, border: '1px solid #333'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: 18 }}>{r.id}</span>
                <span style={{ color: '#aaa', marginLeft: 10, fontSize: 14 }}>{r.mode} | Фаза: {r.phase} | Кон: {r.round}</span>
              </div>
              <button onClick={() => closeRoom(r.id)} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}>Закрыть</button>
            </div>
            <div style={{ fontSize: 14, color: '#ccc' }}>
              Игроки: {r.players.join(' vs ')}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Счёт: {r.matchScore?.A ?? 0} : {r.matchScore?.B ?? 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}