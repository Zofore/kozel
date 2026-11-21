import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Auth } from './Auth';
import { Menu } from './Menu';
import { Lobby } from './Lobby';
import { Game } from './Game';
import { ProfileSettings } from './ProfileSettings';
import { Friends } from './Friends';
import { MenuBackground } from './MenuBackground';
import { RadioPlayer } from './RadioPlayer';
import { VoiceChat } from './VoiceChat';
import { DevConsole } from './DevConsole';

import { API_URL, apiFetch, checkedJson } from './api';
const socket: Socket = io(API_URL, { auth: { token: localStorage.getItem('kozel_token') }, autoConnect: false });

const toastStyles = `
@keyframes slideDownFade {
  0% { transform: translate(-50%, -20px); opacity: 0; }
  100% { transform: translate(-50%, 0); opacity: 1; }
}
@keyframes fadeOut {
  0% { opacity: 1; visibility: visible; }
  100% { opacity: 0; visibility: hidden; }
}
@keyframes fadeInScale {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes broadcastGlow {
  0%, 100% { box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(255,215,0,0.3); }
  50% { box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,0,0.8); }
}
.cloud-toast {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(37, 37, 64, 0.95), rgba(15, 52, 96, 0.95));
  backdrop-filter: blur(10px); border: 2px solid #f0c674; border-radius: 20px;
  padding: 15px 25px; color: white;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(240,198,116,0.3);
  z-index: 10000; display: flex; align-items: center; gap: 15px;
  animation: slideDownFade 0.4s ease-out forwards;
}
.cloud-toast.toast-success { border-color: #4caf50; box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(76,175,80,0.3); }
.cloud-toast.toast-error { border-color: #f44336; box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(244,67,54,0.3); }
.cloud-toast.toast-broadcast { 
  border-color: #ffd700; border-width: 3px;
  background: linear-gradient(135deg, rgba(50, 40, 10, 0.98), rgba(30, 20, 60, 0.98));
  animation: slideDownFade 0.4s ease-out forwards, broadcastGlow 1.5s ease-in-out infinite;
  top: 80px;
}
.cloud-toast.fade-out { animation: fadeOut 0.5s ease-in forwards; }

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center; z-index: 10001;
}
.modal-content {
  background: linear-gradient(180deg, #252540, #1a1a2e);
  border: 2px solid #f0c674; border-radius: 16px; padding: 30px;
  text-align: center; color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  animation: fadeInScale 0.3s ease-out forwards; width: 320px;
}

.dev-float-btn {
  position: fixed; right: 20px; width: 50px; height: 50px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 22px; cursor: pointer; z-index: 9998; backdrop-filter: blur(5px);
  transition: 0.2s; border: 2px solid #ffd700; background: rgba(37, 37, 64, 0.7);
  color: #ffd700;
}
.dev-float-btn:hover { transform: scale(1.15); background: #ffd700; color: #000; }
.dev-float-console { bottom: 20px; }
.dev-float-bot { bottom: 80px; }
`;

export function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('kozel_user');
    try { return saved && localStorage.getItem('kozel_token') ? JSON.parse(saved) : null; } catch { return null; }
  });
  
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem('kozel_room'));
  const [resumeRoomId, setResumeRoomId] = useState<string | null>(() => localStorage.getItem('kozel_resume_room'));
  const [view, setView] = useState<'menu' | 'lobby' | 'profile' | 'friends'>('menu');
  
  const [friendRequestToast, setFriendRequestToast] = useState<string | null>(null);
  const [genericToast, setGenericToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [broadcastToast, setBroadcastToast] = useState<{ text: string, from: string } | null>(null);
  const [inviteModal, setInviteModal] = useState<{ from: string, roomId: string } | null>(null);
  
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  
  const friendToastTimer = useRef<NodeJS.Timeout | null>(null);
  const genericToastTimer = useRef<NodeJS.Timeout | null>(null);
  const broadcastToastTimer = useRef<NodeJS.Timeout | null>(null);

  const isDev = user?.isAdmin === true;

  // Refresh progress after leaving a match, without requiring a new login.
  useEffect(() => {
    if (!user?.username || roomId || view !== 'menu') return;
    let active = true;
    apiFetch(`${API_URL}/api/me`).then(async response => {
      if (!response.ok) return;
      const current = await response.json();
      if (active) setUser((previous: any) => previous ? { ...previous, ...current } : previous);
    }).catch(() => {});
    return () => { active = false; };
  }, [roomId, view, user?.username]);



  useEffect(() => { if (roomId) localStorage.setItem('kozel_room',roomId); else localStorage.removeItem('kozel_room'); }, [roomId]);
  useEffect(() => { if (resumeRoomId) localStorage.setItem('kozel_resume_room',resumeRoomId); else localStorage.removeItem('kozel_resume_room'); }, [resumeRoomId]);
  useEffect(() => {
    if (user) {
      localStorage.setItem('kozel_user', JSON.stringify(user));
      if (!socket.connected) socket.connect();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    apiFetch(`${API_URL}/api/me`).then(async res => {
      if (!active) return;
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) { const me = await res.json(); if(active) setUser((prev:any) => prev ? {...prev,...me} : prev); }
    }).catch(()=>{});
    const onConnectError = (err: Error) => { if (/токен|авторизац/i.test(err.message)) handleLogout(); };
    const onDisconnect = (reason:string) => { if(reason==='io server disconnect') handleLogout(); };
    socket.on('connect_error',onConnectError); socket.on('disconnect',onDisconnect);
    return () => { active=false; socket.off('connect_error',onConnectError); socket.off('disconnect',onDisconnect); };
  }, [user?.username]);
  useEffect(() => {
    const handleReceiveInvite = ({ from, roomId }: { from: string, roomId: string }) => {
      setInviteModal({ from, roomId });
    };

    const handleInviteAccepted = ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
    };

    const handleFriendRequestReceived = ({ fromUsername }: { fromUsername: string }) => {
      setFriendRequestToast(fromUsername);
      if (friendToastTimer.current) clearTimeout(friendToastTimer.current);
      friendToastTimer.current = setTimeout(() => setFriendRequestToast(null), 5000);
    };

    const handleDevRoomCreated = ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
    };

    const handleGlobalBroadcast = (data: { text: string, from: string }) => {
      setBroadcastToast(data);
      if (broadcastToastTimer.current) clearTimeout(broadcastToastTimer.current);
      broadcastToastTimer.current = setTimeout(() => setBroadcastToast(null), 7000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDev) return;
      if (e.key === '`' || e.key === 'ё' || e.key === 'Ё') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setDevConsoleOpen(prev => !prev);
      }
    };

    socket.on('receive_invite', handleReceiveInvite);
    socket.on('invite_accepted', handleInviteAccepted);
    socket.on('friend_request_received', handleFriendRequestReceived);
    socket.on('dev_room_created', handleDevRoomCreated);
    socket.on('global_broadcast', handleGlobalBroadcast);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('receive_invite', handleReceiveInvite);
      socket.off('invite_accepted', handleInviteAccepted);
      socket.off('friend_request_received', handleFriendRequestReceived);
      socket.off('dev_room_created', handleDevRoomCreated);
      socket.off('global_broadcast', handleGlobalBroadcast);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDev]);

  const acceptInvite = () => {
    if (!inviteModal) return;
    socket.timeout(5000).emit('accept_invite', { roomId: inviteModal.roomId }, (err: any,res:any) => {
      if(err || res?.error) showToast(res?.error || 'Сервер недоступен','error'); else setRoomId(res.roomId);
      setInviteModal(null);
    });
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setGenericToast({ msg, type });
    if (genericToastTimer.current) clearTimeout(genericToastTimer.current);
    genericToastTimer.current = setTimeout(() => setGenericToast(null), 3000);
  };

  const closeFriendToast = () => {
    setFriendRequestToast(null);
    if (friendToastTimer.current) clearTimeout(friendToastTimer.current);
  };

  const handleAuth = (token: string, userData: any) => {
    localStorage.setItem('kozel_token', token);
    socket.auth = { token }; 
    setRoomId(null);
    socket.connect();
    setUser(userData);
  };

  const handleLogout = () => {
    ['kozel_user','kozel_token','kozel_room','kozel_resume_room'].forEach(key=>localStorage.removeItem(key));
    socket.disconnect(); socket.auth={};
    setUser(null);
    setRoomId(null);
    setResumeRoomId(null);
    setView('menu');
    setDevConsoleOpen(false);
  };

  const updateProfile = async (status: string, avatar: string) => {
    try { await checkedJson(`${API_URL}/api/user/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, status, avatar })
    });
    setUser({ ...user, status, avatar });
    setView('menu');
    showToast('Профиль обновлен!', 'success');
    } catch(err:any) { showToast(err.message || 'Ошибка сохранения','error'); }
  };

  const handleSpawnBot = () => {
    if (roomId) {
      showToast('Сначала выйди из текущей комнаты', 'error');
      return;
    }
    socket.timeout(5000).emit('create_dev_room', (err: any,res: { roomId?: string; error?: string }) => {
      if(!err && res?.roomId) setRoomId(res.roomId); else showToast(res?.error || 'Ошибка комнаты','error');
    });
  };

  // Сохраняем возможность вернуться только в незавершённую игру.
  const handleExitToLobby = (finalState?: any) => {
    const resumable = roomId && !/^(DEV|BOT)-/.test(roomId) && finalState && !['waiting','finished'].includes(finalState.phase);
    setResumeRoomId(resumable ? roomId : null);
    if (roomId) socket.emit('leave_room',roomId);
    setRoomId(null);
    setView('menu');

    apiFetch(`${API_URL}/api/user/profile/${user.username}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setUser((prev: any) => {
            if (!prev || prev.username !== data.username) return prev;
            const updated = { ...prev, wins: data.wins, losses: data.losses };
            localStorage.setItem('kozel_user', JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch(() => console.log('Фоновое обновление статистики не удалось'));
  };

  const handleRematch = (opponent: string) => {
    if (!socket.connected) { showToast('Нет соединения с сервером', 'error'); return; }
    if (!opponent || opponent === user.username || opponent.includes('BOT')) { showToast('Реванш с этим игроком недоступен', 'error'); return; }
    socket.timeout(5000).emit('create_room', '1v1', (err: any, result: { roomId?: string; error?: string }) => {
      if (err || !result?.roomId) { showToast(result?.error || 'Не удалось создать комнату', 'error'); return; }
      const newRoomId = result.roomId;
      setResumeRoomId(null);
      setRoomId(newRoomId);
      socket.timeout(5000).emit('send_invite', { to: opponent, roomId: newRoomId }, (inviteErr: any, inviteResult: { error?: string }) => {
        if (inviteErr || inviteResult?.error) showToast(inviteResult?.error || 'Комната создана, но приглашение не доставлено', 'error');
        else showToast(`Приглашение отправлено: ${opponent}`, 'success');
      });
    });
  };

  const handleResume = () => {
    if (!resumeRoomId) return;
    if (!socket.connected) { showToast('Нет соединения с сервером', 'error'); return; }
    socket.timeout(5000).emit('join_room', resumeRoomId, (error: any, response: any) => {
      if (error || response?.error) {
        setResumeRoomId(null);
        showToast(response?.error || 'Партия больше недоступна', 'error');
        return;
      }
      setRoomId(resumeRoomId);
      setResumeRoomId(null);
    });
  };

  if (!user) return <Auth onAuth={handleAuth} />;

  let content;
  if (roomId) {
    content = <Game key={roomId} socket={socket} roomId={roomId} setRoomId={setRoomId} username={user.username} isAdmin={isDev} openDevConsole={() => setDevConsoleOpen(true)} onExit={handleExitToLobby} onRematch={handleRematch} />;
  }
  else if (view === 'profile') content = <ProfileSettings user={user} onSave={updateProfile} onBack={() => setView('menu')} />;
  else if (view === 'friends') content = <Friends socket={socket} user={user} onRoom={setRoomId} onBack={() => setView('menu')} showToast={showToast} />;
  else if (view === 'lobby') content = <Lobby socket={socket} setRoomId={setRoomId} username={user.username} onBack={() => setView('menu')} />;
  else content = <Menu socket={socket} user={user} onPlay={() => setView('lobby')} onProfile={() => setView('profile')} onFriends={() => setView('friends')} onLogout={handleLogout} onResume={handleResume} canResume={Boolean(resumeRoomId)} />;

  return (
    <>
      <style>{toastStyles}</style>
      
      <MenuBackground />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {inviteModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div style={{ fontSize: 50, marginBottom: 10 }}>⚔️</div>
              <h2 style={{ color: '#f0c674', margin: '0 0 10px 0' }}>Вызов на бой!</h2>
              <p style={{ fontSize: 16, marginBottom: 25 }}>
                Игрок <b>{inviteModal.from}</b> приглашает вас сыграть партию в «Козла».
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={acceptInvite} style={{ flex: 1, padding: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>Принять</button>
                <button onClick={() => setInviteModal(null)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {friendRequestToast && (
          <div className="cloud-toast" onClick={() => { setView('friends'); closeFriendToast(); }} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: 28 }}>☁️</div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#f0c674', fontSize: 16 }}>Новая заявка в друзья!</div>
              <div style={{ fontSize: 14, color: '#ddd', marginTop: 2 }}>Игрок <b>{friendRequestToast}</b> хочет добавить вас.</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Нажмите, чтобы перейти в «Друзья»</div>
            </div>
            <div style={{ fontSize: 20, color: '#f0c674', marginLeft: 'auto', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); closeFriendToast(); }}>✖</div>
          </div>
        )}

        {broadcastToast && (
          <div className="cloud-toast toast-broadcast">
            <div style={{ fontSize: 28 }}>📢</div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: 16 }}>Анонс от {broadcastToast.from}:</div>
              <div style={{ fontSize: 15, color: '#fff', marginTop: 4 }}>{broadcastToast.text}</div>
            </div>
            <div style={{ fontSize: 20, color: '#ffd700', marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setBroadcastToast(null)}>✖</div>
          </div>
        )}

        {genericToast && (
          <div className={`cloud-toast toast-${genericToast.type}`}>
            <div style={{ fontSize: 24 }}>{genericToast.type === 'success' ? '✅' : genericToast.type === 'error' ? '❌' : 'ℹ️'}</div>
            <div style={{ fontWeight: 'bold' }}>{genericToast.msg}</div>
            <div style={{ fontSize: 20, color: '#aaa', marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setGenericToast(null)}>✖</div>
          </div>
        )}

        {content}
      </div>

      {/* Only pre-game: unmounting stops audio before a match begins. */}
      {!roomId && (view === 'menu' || view === 'lobby') && <RadioPlayer />}
      {roomId && <VoiceChat key={roomId} socket={socket} roomId={roomId} />}

      {isDev && !roomId && (
        <>
          <button className="dev-float-btn dev-float-bot" onClick={handleSpawnBot} title="🤖 Игра с ботом">🤖</button>
          <button className="dev-float-btn dev-float-console" onClick={() => setDevConsoleOpen(true)} title="🛠️ Dev Console (` тильда)">🛠️</button>
        </>
      )}

      {isDev && devConsoleOpen && (
        <DevConsole socket={socket} username={user.username} onClose={() => setDevConsoleOpen(false)} />
      )}
    </>
  );
}