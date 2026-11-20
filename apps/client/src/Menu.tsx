import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuScale, setMenuScale] = useState(1);

  // Keep the entire menu visible without page or panel scrolling.
  useLayoutEffect(() => {
    const fitMenu = () => {
      const panel = menuPanelRef.current;
      if (!panel) return;
      // Measure at natural size; a scaled measurement would compound on resize.
      const currentZoom = panel.style.zoom;
      panel.style.zoom = '1';
      const naturalHeight = panel.getBoundingClientRect().height;
      panel.style.zoom = currentZoom;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const availableHeight = Math.max(1, viewportHeight - 16);
      const nextScale = naturalHeight > 0 ? Math.min(1, availableHeight / naturalHeight) : 1;
      setMenuScale(prev => Math.abs(prev - nextScale) < 0.002 ? prev : nextScale);
    };
    fitMenu();
    window.addEventListener('resize', fitMenu);
    window.visualViewport?.addEventListener('resize', fitMenu);
    return () => {
      window.removeEventListener('resize', fitMenu);
      window.visualViewport?.removeEventListener('resize', fitMenu);
    };
  }, [canResume, isMobile, user.username, user.status, user.wins, user.losses, user.rating, user.level, user.achievements?.length]);
  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
  const avatar = user.avatar || defaultAvatar;
  const isDev = user.isAdmin === true;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="mobile-screen kozel-main-menu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflow: 'hidden', background: 'transparent', color: 'white', position: 'relative', padding: '8px 12px', boxSizing: 'border-box' }}>
      
      <style>{devStyles + `
/* The entire menu fits within the viewport; scrolling is intentionally disabled. */
.mobile-screen.kozel-main-menu {
  height: 100dvh !important;
  overflow: hidden !important;
}
.mobile-screen.kozel-main-menu > .kozel-main-menu-panel {
  flex-shrink: 0;
  overflow: hidden;
}
/* Reduce unused space first; scale to the remaining available height in React. */
@media (max-height: 900px) {
  .kozel-main-menu-panel { padding: 12px 18px !important; }
  .kozel-main-menu-panel > button {
    min-height: 38px !important;
    padding: 7px 10px !important;
    margin-bottom: 6px !important;
    font-size: 14px !important;
  }
  .kozel-main-menu-panel > div:first-of-type { margin-bottom: 6px !important; }
  .kozel-main-menu-panel > p { margin-top: 3px !important; margin-bottom: 5px !important; }
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

      <div ref={menuPanelRef} className="mobile-panel kozel-main-menu-panel" style={{ zoom: menuScale, background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: isMobile ? 'clamp(20px, 5vw, 30px)' : 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(240,198,116,0.2)', border: isDev ? '2px solid #ffd700' : '2px solid #f0c674', textAlign: 'center', width: '100%', maxWidth: isMobile ? 'calc(100vw - 32px)' : 320, boxSizing: 'border-box' }}>

        <div style={{ margin: isMobile ? '0 auto 10px' : '0 auto 15px', display: 'inline-block' }}>
          <div className={isDev ? 'dev-avatar-frame' : ''} style={{ display: 'inline-flex', padding: isDev ? undefined : 0 }}>
            <div className="kozel-menu-avatar" style={{ width: isMobile ? 80 : 110, height: isMobile ? 80 : 110, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: isDev ? 'none' : '3px solid #f0c674', boxShadow: isDev ? 'none' : '0 0 15px rgba(240,198,116,0.5)' }}>
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </div>

        {/* 🔽 3D КОЗЁЛ 🔽 */}
        <h1 className="kozel-menu-goat" style={{ margin: isMobile ? '0 0 5px 0' : '0 0 5px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
        <button className="kozel-menu-action" onClick={() => setHistoryOpen(true)} style={{ padding:12, width:'100%', background:'#252540', color:'#f0c674', border:'1px solid #f0c674', borderRadius:8, fontWeight:'bold', marginBottom:10, cursor:'pointer', minHeight:44 }}>🎴 История партий</button>
        <button className="kozel-menu-action" onClick={() => setLeadersOpen(true)} style={{ padding:12, width:'100%', background:'#252540', color:'#f0c674', border:'1px solid #f0c674', borderRadius:8, fontWeight:'bold', marginBottom:10, cursor:'pointer', minHeight:44 }}>🏆 Рейтинг игроков</button>
        {canResume && <button className="kozel-menu-action" onClick={onResume} style={{ padding: 14, width: '100%', background: '#f0c674', color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 17, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, minHeight: 48 }}>↩ Вернуться в партию</button>}
        <button className="kozel-menu-action" onClick={onPlay} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: isMobile ? 16 : 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 0 #2e7d32', minHeight: 48 }}>Играть</button>
        <button className="kozel-menu-action" onClick={onFriends} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: '#0f3460', color: 'white', border: '1px solid #f0c674', borderRadius: 8, fontSize: isMobile ? 15 : 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, minHeight: 48 }}>👥 Друзья</button>
        <button className="kozel-menu-action" onClick={onProfile} style={{ padding: isMobile ? '14px' : '15px', width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: isMobile ? 15 : 16, cursor: 'pointer', marginBottom: isMobile ? 10 : 15, minHeight: 48 }}>⚙️ Настройки</button>
        <button className="kozel-menu-action" onClick={onLogout} style={{ padding: isMobile ? '12px' : '10px', width: '100%', background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: 8, fontSize: isMobile ? 14 : 14, cursor: 'pointer', minHeight: 44 }}>Выйти</button>
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