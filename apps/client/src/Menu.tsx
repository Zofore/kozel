import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { AdminPanel } from './AdminPanel';
import { Goat3D } from './Goat3D';
import { MatchHistory } from './MatchHistory';
import { API_URL, apiFetch } from './api';


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
`;

export function Menu({ socket, user, onPlay, onProfile, onFriends, onLogout, onResume, canResume }: { socket: Socket, user: any, onPlay: () => void, onProfile: () => void, onFriends: () => void, onLogout: () => void, onResume: () => void, canResume: boolean }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [leadersOpen, setLeadersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [leadersError, setLeadersError] = useState('');

  useEffect(() => {
    if (!leadersOpen) return;
    let active = true;
    setLeadersError('');
    apiFetch(`${API_URL}/api/leaderboard`).then(async response => {
      if (!response.ok) throw new Error('Не удалось загрузить рейтинг');
      return response.json();
    }).then(data => { if (active) setLeaders(Array.isArray(data.players) ? data.players : []); })
      .catch(() => { if (active) setLeadersError('Рейтинг временно недоступен'); });
    return () => { active = false; };
  }, [leadersOpen]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 820);
  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
  const avatar = user.avatar || defaultAvatar;
  const isDev = user.isAdmin === true;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="mobile-screen kozel-main-menu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', background: 'transparent', color: 'white', position: 'relative', padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(28px, env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      
      <style>{devStyles + `
/* Only main menu scrolls, while the game screen keeps its original layout. */
.mobile-screen.kozel-main-menu {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  max-height: 100dvh !important;
  overscroll-behavior-y: contain;
}
.mobile-screen.kozel-main-menu > .kozel-main-menu-panel {
  flex-shrink: 0;
  margin-top: auto;
  margin-bottom: auto;
}
`}</style>

      {historyOpen && <MatchHistory onClose={() => setHistoryOpen(false)} />}
      {leadersOpen && (
        <div role="dialog" aria-modal="true" aria-label="Таблица лидеров" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:10002, display:'flex', justifyContent:'center', alignItems:'center', padding:16 }}>
          <div className="mobile-panel" style={{ width:'100%', maxWidth:440, maxHeight:'85dvh', overflowY:'auto', background:'#252540', border:'2px solid #f0c674', borderRadius:16, padding:20, boxSizing:'border-box' }}>
            <h2 style={{ color:'#f0c674', textAlign:'center', marginTop:0 }}>🏆 Таблица лидеров</h2>
            {leadersError && <p role="alert">{leadersError}</p>}
            {!leadersError && leaders.length === 0 && <p style={{textAlign:'center'}}>Загрузка рейтинга…</p>}
            {leaders.map((player:any) => (
              <div key={player.username} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 3px', borderBottom:'1px solid #444' }}>
                <span style={{ color:'#f0c674', minWidth:32 }}>#{player.rank}</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.username}</span>
                <span style={{ color:'#aaa', fontSize:12 }}>{player.league}</span>
                <b style={{ color:'#f0c674' }}>{player.rating}</b>
              </div>
            ))}
            <button onClick={() => setLeadersOpen(false)} style={{ marginTop:16, padding:12, width:'100%', background:'#0f3460', color:'white', border:'1px solid #f0c674', borderRadius:8, minHeight:44, cursor:'pointer' }}>Закрыть</button>
          </div>
        </div>
      )}
      {adminOpen && <AdminPanel socket={socket} username={user.username} onClose={() => setAdminOpen(false)} />}

      <div className="mobile-panel kozel-main-menu-panel" style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: isMobile ? 'clamp(20px, 5vw, 30px)' : 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(240,198,116,0.2)', border: isDev ? '2px solid #ffd700' : '2px solid #f0c674', textAlign: 'center', width: '100%', maxWidth: isMobile ? 'calc(100vw - 32px)' : 320, boxSizing: 'border-box' }}>

        <div style={{ margin: isMobile ? '0 auto 10px' : '0 auto 15px', display: 'inline-block' }}>
          <div className={isDev ? 'dev-avatar-frame' : ''} style={{ display: 'inline-flex', padding: isDev ? undefined : 0 }}>
            <div style={{ width: isMobile ? 80 : 110, height: isMobile ? 80 : 110, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: isDev ? 'none' : '3px solid #f0c674', boxShadow: isDev ? 'none' : '0 0 15px rgba(240,198,116,0.5)' }}>
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </div>

        {/* 🔽 3D КОЗЁЛ 🔽 */}
        <h1 style={{ margin: isMobile ? '0 0 5px 0' : '0 0 5px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Goat3D />
          <span style={{ color: '#f0c674', fontSize: isMobile ? 24 : 32, fontWeight: 900, textShadow: '0 0 15px rgba(240,198,116,0.6)', letterSpacing: '1px', marginTop: '-10px' }}>
            Козёл
          </span>
        </h1>

        <h2 style={{ fontSize: isMobile ? 16 : 18, margin: isMobile ? '0 0 3px 0' : '0 0 5px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          {isDev && <span title="Разработчик" style={{ fontSize: 20 }}>{/* 👑 */}</span>}
          <span className={isDev ? 'dev-nick' : ''} style={{ color: isDev ? undefined : 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 180 : 250, display: 'inline-block' }}>
            {user.fullname}
          </span>
        </h2>
        <p style={{ color: '#aaa', fontSize: isMobile ? 13 : 14, marginBottom: isMobile ? 3 : 5 }}>@{user.username}</p>
        <p style={{ color: '#4caf50', fontSize: isMobile ? 13 : 14, fontWeight: 'bold', marginBottom: isMobile ? 10 : 15 }}>{user.status || 'В сети'}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 10 : 15, marginBottom: isMobile ? 15 : 20, background: 'rgba(0,0,0,0.3)', padding: isMobile ? 8 : 10, borderRadius: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 11 : 12, color: '#aaa' }}>Победы</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 'bold', color: '#4caf50' }}>{user.wins || 0}</div>
          </div>
          <div style={{ width: 1, background: '#444' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 11 : 12, color: '#aaa' }}>Поражения</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 'bold', color: '#f44336' }}>{user.losses || 0}</div>
          </div>
        </div>

        <div style={{ color:'#f0c674', fontSize:isMobile ? 13 : 14, marginBottom:10 }}>
          {user.league || 'Бронза'} · Рейтинг {user.rating ?? 1000} · Уровень {user.level ?? 1} · XP {user.xp ?? 0}
        </div>
        <div style={{fontSize:12, color:'#ccc', marginBottom:10}}>
          {(user.achievements || []).includes('first_win') && <span title="Первая победа" style={{marginRight:8}}>🥇 Первая победа</span>}
          {(user.achievements || []).includes('ten_wins') && <span title="10 побед" style={{marginRight:8}}>🏅 10 побед</span>}
          {(user.achievements || []).includes('hundred_wins') && <span title="100 побед" style={{marginRight:8}}>🏆 100 побед</span>}
          {(user.achievements || []).includes('ten_games') && <span title="10 партий">🎴 10 партий</span>}
        </div>
        <button onClick={() => setHistoryOpen(true)} style={{ padding:12, width:'100%', background:'#252540', color:'#f0c674', border:'1px solid #f0c674', borderRadius:8, fontWeight:'bold', marginBottom:10, cursor:'pointer', minHeight:44 }}>🎴 История партий</button>
        <button onClick={() => setLeadersOpen(true)} style={{ padding:12, width:'100%', background:'#252540', color:'#f0c674', border:'1px solid #f0c674', borderRadius:8, fontWeight:'bold', marginBottom:10, cursor:'pointer', minHeight:44 }}>🏆 Рейтинг игроков</button>
        {canResume && <button onClick={onResume} style={{ padding: 14, width: '100%', background: '#f0c674', color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 17, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, minHeight: 48 }}>↩ Вернуться в партию</button>}
        <button onClick={onPlay} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: isMobile ? 16 : 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 0 #2e7d32', minHeight: 48 }}>Играть</button>
        <button onClick={onFriends} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: '#0f3460', color: 'white', border: '1px solid #f0c674', borderRadius: 8, fontSize: isMobile ? 15 : 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, minHeight: 48 }}>👥 Друзья</button>
        <button onClick={onProfile} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: isMobile ? 15 : 16, cursor: 'pointer', marginBottom: isMobile ? 10 : 15, minHeight: 48 }}>⚙️ Настройки</button>
        <button onClick={onLogout} style={{ padding: isMobile ? '12px' : '10px', width: '100%', background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: 8, fontSize: isMobile ? 14 : 14, cursor: 'pointer', minHeight: 44 }}>Выйти</button>
      </div>

      {isDev && (
        <button
          onClick={() => setAdminOpen(true)}
          className="mobile-admin-button" title="Админ-панель"
          style={{
            position: 'fixed', bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : 20, right: isMobile ? 'calc(16px + env(safe-area-inset-right))' : 20,
            width: isMobile ? 40 : 45, height: isMobile ? 40 : 45, borderRadius: '50%',
            background: 'rgba(37, 37, 64, 0.7)',
            border: '1px solid #ffd700', color: '#ffd700',
            fontSize: isMobile ? 18 : 20, cursor: 'pointer', zIndex: 9999,
            backdropFilter: 'blur(5px)', opacity: 0.3,
            transition: 'opacity 0.2s, transform 0.2s',
            minWidth: isMobile ? 40 : 'auto', minHeight: isMobile ? 40 : 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
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