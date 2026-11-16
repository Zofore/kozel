import React, { useState } from 'react';



export function ProfileSettings({ user, onSave, onBack }: { user: any, onSave: (status: string, avatar: string) => void, onBack: () => void }) {
  const [status, setStatus] = useState(user.status || 'В сети');
  const [avatar, setAvatar] = useState(user.avatar || '');

  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'transparent', color: 'white' }}>
      <div style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '2px solid #f0c674', textAlign: 'center', width: 320 }}>
        
        <h2 style={{ color: '#f0c674', margin: '0 0 20px 0' }}>Настройки профиля</h2>

        <div style={{ width: 110, height: 110, borderRadius: '50%', background: '#e0e0e0', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #f0c674' }}>
          <img src={avatar || defaultAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ marginBottom: 15, textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 14, color: '#aaa', marginBottom: 5 }}>Ссылка на аватар (URL)</label>
          <input 
            type="text" 
            value={avatar} 
            onChange={e => setAvatar(e.target.value)} 
            placeholder="Оставьте пустым для стандартного"
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ marginBottom: 25, textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 14, color: '#aaa', marginBottom: 5 }}>Статус</label>
          <input 
            type="text" 
            value={status} 
            onChange={e => setStatus(e.target.value)} 
            placeholder="Ваш статус"
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none', boxSizing: 'border-box' }} 
          />
        </div>

        <button onClick={() => onSave(status, avatar)} style={{ padding: '15px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 0 #2e7d32' }}>Сохранить</button>
        <button onClick={onBack} style={{ padding: '15px', width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>Назад</button>
      </div>
    </div>
  );
}