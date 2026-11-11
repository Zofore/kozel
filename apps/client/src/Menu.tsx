import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { AdminPanel } from './AdminPanel';

const DEV_NAME = 'Vladislav';

const devStyles = `
@keyframes goldenRotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.dev-avatar-frame {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  background: linear-gradient(90deg, #ffd700, #fff8dc, #ffa500, #ffd700, #fff8dc, #ffa500, #ffd700);
  background-size: 300% 300%;
  animation: goldenRotate 3s linear infinite;
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.7), 0 0 50px rgba(255, 215, 0, 0.35);
}
.dev-avatar-frame img { display: block; border-radius: 50%; }

@keyframes goldShine {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.dev-nick {
  background: linear-gradient(90deg, #ffd700, #fff, #ffd700, #fff, #ffd700);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: goldShine 3s linear infinite;
  font-weight: bold;
}

/* 🐐 АНИМАЦИИ ДЛЯ КОЗЛА */
@keyframes floatGoat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes eyeGlow {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 5px #ff0000); }
  50% { opacity: 0.6; filter: drop-shadow(0 0 12px #ff0000); }
}
.goat-icon {
  animation: floatGoat 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
}
.goat-eye {
  animation: eyeGlow 2s ease-in-out infinite;
}
`;

export function Menu({ socket, user, onPlay, onProfile, onFriends, onLogout }: { socket: Socket, user: any, onPlay: () => void, onProfile: () => void, onFriends: () => void, onLogout: () => void }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
  const avatar = user.avatar || defaultAvatar;
  const isDev = user.username === DEV_NAME;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'transparent', color: 'white', position: 'relative' }}>
      
      <style>{devStyles}</style>

      {adminOpen && <AdminPanel socket={socket} username={user.username} onClose={() => setAdminOpen(false)} />}

      <div style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(240,198,116,0.2)', border: isDev ? '2px solid #ffd700' : '2px solid #f0c674', textAlign: 'center', width: 320 }}>
        
        <div style={{ margin: '0 auto 15px', display: 'inline-block' }}>
          <div className={isDev ? 'dev-avatar-frame' : ''} style={{ display: 'inline-flex', padding: isDev ? undefined : 0 }}>
            <div style={{ width: 110, height: 110, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: isDev ? 'none' : '3px solid #f0c674', boxShadow: isDev ? 'none' : '0 0 15px rgba(240,198,116,0.5)' }}>
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </div>

        {/* 🔽 ШЕДЕВРАЛЬНАЯ ИКОНКА КОЗЛА 🔽 */}
        <h1 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <svg className="goat-icon" width="56" height="56" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff8dc" />
                <stop offset="40%" stopColor="#ffd700" />
                <stop offset="60%" stopColor="#b8860b" />
                <stop offset="100%" stopColor="#f0c674" />
              </linearGradient>
              <linearGradient id="darkMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#333" />
                <stop offset="50%" stopColor="#111" />
                <stop offset="100%" stopColor="#222" />
              </linearGradient>
            </defs>
            
            {/* Рога */}
            <path d="M 30 40 C 10 30, 5 10, 20 5 C 30 0, 40 20, 45 30 Z" fill="url(#goldGrad)" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 70 40 C 90 30, 95 10, 80 5 C 70 0, 60 20, 55 30 Z" fill="url(#goldGrad)" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
            
            {/* Уши */}
            <path d="M 25 50 C 10 50, 5 60, 15 70 Z" fill="url(#darkMetal)" stroke="#f0c674" strokeWidth="1.5" />
            <path d="M 75 50 C 90 50, 95 60, 85 70 Z" fill="url(#darkMetal)" stroke="#f0c674" strokeWidth="1.5" />

            {/* Морда (скелет/маска) */}
            <path d="M 30 40 L 50 35 L 70 40 L 65 80 L 50 95 L 35 80 Z" fill="url(#darkMetal)" stroke="url(#goldGrad)" strokeWidth="3" strokeLinejoin="round" />
            
            {/* Нос и пасть */}
            <path d="M 45 65 L 55 65 L 50 75 Z" fill="#111" stroke="url(#goldGrad)" strokeWidth="1.5" />
            <path d="M 40 82 L 60 82" stroke="url(#goldGrad)" strokeWidth="2" strokeLinecap="round" />

            {/* Глаза (злые, светящиеся) */}
            <path className="goat-eye" d="M 35 55 L 45 50 L 47 55 L 37 60 Z" fill="#ff0000" />
            <path className="goat-eye" d="M 65 55 L 55 50 L 53 55 L 63 60 Z" fill="#ff0000" />

            {/* Борода */}
            <path d="M 45 95 L 50 115 L 55 95 Z" fill="url(#goldGrad)" opacity="0.8" />
          </svg>

          <span style={{ color: '#f0c674', fontSize: 32, fontWeight: 900, textShadow: '0 0 15px rgba(240,198,116,0.6)', letterSpacing: '1px' }}>
            Козёл
          </span>
        </h1>

        <h2 style={{ fontSize: 18, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          {isDev && <span title="Разработчик" style={{ fontSize: 22 }}>👑</span>}
          <span className={isDev ? 'dev-nick' : ''} style={{ color: isDev ? undefined : 'white' }}>
            {user.fullname}
          </span>
        </h2>
        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 5 }}>@{user.username}</p>
        <p style={{ color: '#4caf50', fontSize: 14, fontWeight: 'bold', marginBottom: 15 }}>{user.status || 'В сети'}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 15, marginBottom: 20, background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#aaa' }}>Победы</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#4caf50' }}>{user.wins || 0}</div>
          </div>
          <div style={{ width: 1, background: '#444' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#aaa' }}>Поражения</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#f44336' }}>{user.losses || 0}</div>
          </div>
        </div>

        <button onClick={onPlay} style={{ padding: '15px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 0 #2e7d32' }}>Играть</button>
        <button onClick={onFriends} style={{ padding: '15px', width: '100%', background: '#0f3460', color: 'white', border: '1px solid #f0c674', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10 }}>👥 Друзья</button>
        <button onClick={onProfile} style={{ padding: '15px', width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: 16, cursor: 'pointer', marginBottom: 15 }}>⚙️ Настройки профиля</button>
        <button onClick={onLogout} style={{ padding: '10px', width: '100%', background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>Выйти</button>
      </div>

      {isDev && (
        <button
          onClick={() => setAdminOpen(true)}
          title="Админ-панель"
          style={{
            position: 'fixed', bottom: 20, right: 20,
            width: 45, height: 45, borderRadius: '50%',
            background: 'rgba(37, 37, 64, 0.7)',
            border: '1px solid #ffd700', color: '#ffd700',
            fontSize: 20, cursor: 'pointer', zIndex: 9999,
            backdropFilter: 'blur(5px)', opacity: 0.3,
            transition: 'opacity 0.2s, transform 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.3'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ⚙️
        </button>
      )}
    </div>
  );
}