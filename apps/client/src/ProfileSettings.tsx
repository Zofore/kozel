import React, { useState } from 'react';

export function ProfileSettings({ user, onSave, onBack }: { user: any, onSave: (status: string, avatar: string) => void, onBack: () => void }) {
  const [status, setStatus] = useState(user.status || '');
  const [avatar, setAvatar] = useState(user.avatar || '');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) return alert('Файл слишком большой (макс 1МБ)');
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto', textAlign: 'center', background: 'transparent', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 40, borderRadius: 20, border: '2px solid #f0c674', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
        <h2 style={{ color: '#f0c674', marginBottom: 30 }}>Настройки профиля</h2>

        <div style={{ marginBottom: 20 }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#333', margin: '0 auto 15px', overflow: 'hidden', border: '3px solid #f0c674' }}>
            {avatar ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 40, lineHeight: '120px' }}>👤</div>}
          </div>
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ color: 'white' }} />
        </div>

        <input 
          value={status} onChange={e => setStatus(e.target.value)} 
          placeholder="Твой статус..." maxLength={50}
          style={{ width: '100%', padding: 15, borderRadius: 8, border: '1px solid #555', background: '#252540', color: 'white', marginBottom: 20, boxSizing: 'border-box' }} 
        />

        <button onClick={() => onSave(status, avatar)} style={{ padding: '15px 20px', width: '100%', background: '#4caf50', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', color: 'white', marginBottom: 10 }}>Сохранить</button>
        <button onClick={onBack} style={{ padding: '10px 20px', width: '100%', background: 'transparent', border: '1px solid #aaa', borderRadius: 8, cursor: 'pointer', color: '#aaa' }}>Назад</button>
      </div>
    </div>
  );
}