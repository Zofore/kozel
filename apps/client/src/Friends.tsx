import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

import { API_URL, apiFetch, checkedJson } from './api';
import { FriendChat } from './FriendChat';

export function Friends({ socket, user, onRoom, onBack, showToast }: { socket: Socket, user: any, onRoom: (id:string)=>void, onBack: () => void, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [chatFriend, setChatFriend] = useState<{ username: string; fullname: string } | null>(null);
  const [friendToDelete, setFriendToDelete] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/friends/list/${user.username}`)
      .then(async res => { if(!res.ok) throw new Error('Ошибка загрузки друзей'); return res.json(); })
      .then(data => {
        setFriends(data.friends || []);
        setRequests(data.requests || []);
      }).catch(err=>showToast(err.message,'error'));
  }, [user.username, refresh]);

  useEffect(() => {
    const handleNewRequest = () => setRefresh(prev => prev + 1);
    socket.on('friend_request_received', handleNewRequest);
    return () => { socket.off('friend_request_received', handleNewRequest); };
  }, [socket]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setHasSearched(true);
    setSearchResults([]); 
    try {
      const res = await apiFetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Ошибка поиска');
      const data = await res.json();
      setSearchResults((data.users || []).filter((u: any) => u.username !== user.username));
    } catch (err) {
      showToast('Ошибка при поиске игрока', 'error');
    }
  };

  const sendRequest = async (targetUsername: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, targetUsername })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Заявка отправлена игроку ${targetUsername}!`, 'success');
      setSearchResults([]);
      setSearchQuery('');
      setHasSearched(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const respondRequest = async (requesterUsername: string, action: 'accept' | 'decline') => {
    try { await checkedJson(`${API_URL}/api/friends/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, requesterUsername, action })
    });
    setRefresh(prev => prev + 1);
    if (action === 'accept') showToast(`Игрок ${requesterUsername} теперь у вас в друзьях!`, 'success');
    } catch(err:any) { showToast(err.message,'error'); }
  };

  const confirmDelete = async () => {
    if (!friendToDelete) return;
    try { await checkedJson(`${API_URL}/api/friends/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, friendUsername: friendToDelete })
    });
    setRefresh(prev => prev + 1);
    showToast('Игрок удален из друзей', 'info');
    setFriendToDelete(null);
    } catch(err:any) { showToast(err.message,'error'); }
  };

  const inviteFriend = (friendUsername: string) => {
    socket.timeout(5000).emit('create_room', '1v1', (err:any,res:any) => {
      if (err || !res?.roomId) { showToast(res?.error || 'Ошибка комнаты','error'); return; }
      socket.timeout(5000).emit('send_invite', { to: friendUsername, roomId: res.roomId }, (inviteErr:any,result:any) => {
        if(inviteErr || !result?.success) { socket.emit('leave_room',res.roomId); showToast(result?.error || 'Не удалось пригласить','error'); return; }
        showToast(`Приглашение отправлено игроку ${friendUsername}!`, 'info'); onRoom(res.roomId);
      });
    });
  };

  if (chatFriend) return (
    <div className="mobile-friends" style={{ padding: 20, maxWidth: 500, margin: '0 auto', color: 'white' }}>
      <FriendChat key={chatFriend.username} socket={socket} username={user.username} friend={chatFriend} onBack={() => setChatFriend(null)} />
    </div>
  );

  return (
    <div className="mobile-friends" style={{ padding: 20, maxWidth: 500, margin: '0 auto', background: 'transparent', minHeight: '100vh', color: 'white', position: 'relative' }}>
      
      {friendToDelete && (
        <div className="mobile-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div className="mobile-dialog" style={{ background: 'linear-gradient(180deg, #252540, #1a1a2e)', border: '2px solid #f44336', borderRadius: 16, padding: 30, textAlign: 'center', color: 'white', width: 320, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🤔</div>
            <h3 style={{ color: 'white', margin: '0 0 10px 0' }}>Удалить друга?</h3>
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 20 }}>Вы уверены, что хотите удалить <b>{friendToDelete}</b> из списка друзей?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '12px', background: '#f44336', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>Да, удалить</button>
              <button onClick={() => setFriendToDelete(null)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h2 style={{ color: '#f0c674', margin: 0 }}>Друзья</h2>
        <button onClick={onBack} style={{ background: 'rgba(37, 37, 64, 0.8)', border: '1px solid #f0c674', color: '#f0c674', padding: '5px 15px', borderRadius: 5, cursor: 'pointer', backdropFilter: 'blur(5px)' }}>Назад</button>
      </div>

      {requests.length > 0 && (
        <div style={{ marginBottom: 30, background: 'rgba(37, 37, 64, 0.8)', backdropFilter: 'blur(5px)', padding: 15, borderRadius: 12, border: '1px solid #f0c674' }}>
          <h3 style={{ color: '#f0c674', fontSize: 16, marginTop: 0 }}>🔔 Заявки в друзья ({requests.length}):</h3>
          {requests.map(r => (
            <div key={r.username} className="mobile-friend-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#333', overflow: 'hidden' }}>
                  {r.avatar ? <img src={r.avatar} style={{ width: '100%', height: '100%' }} /> : <div style={{ textAlign: 'center', lineHeight: '40px' }}>👤</div>}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: r.isAdmin ? '#ffd700' : 'white' }}>
                    {r.isAdmin && '👑 '}
                    {r.fullname}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>@{r.username}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => respondRequest(r.username, 'accept')} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}>✔</button>
                <button onClick={() => respondRequest(r.username, 'decline')} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}>✖</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', marginBottom: 20 }}>
        <input 
          value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setHasSearched(false); }} 
          placeholder="Поиск по никнейму..." 
          style={{ flex: 1, padding: 12, borderRadius: '8px 0 0 8px', border: '1px solid #555', borderRight: 'none', background: 'rgba(37, 37, 64, 0.9)', color: 'white', backdropFilter: 'blur(5px)' }} 
        />
        <button onClick={handleSearch} style={{ padding: '12px 20px', background: '#f0c674', border: 'none', borderRadius: '0 8px 8px 0', fontWeight: 'bold', cursor: 'pointer' }}>Найти</button>
      </div>

      {searchResults.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#aaa', fontSize: 16 }}>Результаты поиска:</h3>
          {searchResults.map(u => (
            <div key={u.username} className="mobile-friend-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(37, 37, 64, 0.9)', backdropFilter: 'blur(5px)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#333', overflow: 'hidden' }}>
                  {u.avatar ? <img src={u.avatar} style={{ width: '100%', height: '100%' }} /> : <div style={{ textAlign: 'center', lineHeight: '40px' }}>👤</div>}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: u.isAdmin ? '#ffd700' : 'white' }}>
                    {u.isAdmin && '👑 '}
                    {u.fullname}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>@{u.username}</div>
                </div>
              </div>
              <button onClick={() => sendRequest(u.username)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 5, cursor: 'pointer' }}>Добавить</button>
            </div>
          ))}
        </div>
      )}

      {hasSearched && searchResults.length === 0 && (
        <div style={{ textAlign: 'center', color: '#f44336', marginBottom: 30, background: 'rgba(244, 67, 54, 0.2)', backdropFilter: 'blur(5px)', padding: 10, borderRadius: 8 }}>
          Никого не найдено.
        </div>
      )}

      <h3 style={{ color: '#aaa', fontSize: 16 }}>Мои друзья ({friends.length}):</h3>
      {friends.length === 0 && <p style={{ color: '#aaa' }}>У тебя пока нет друзей. Найди кого-нибудь!</p>}
      
      {friends.map(f => (
        <div key={f.username} className="mobile-friend-row friend-card" style={{ display: 'flex', alignItems: 'center', background: 'rgba(37, 37, 64, 0.9)', backdropFilter: 'blur(5px)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ width: 45, height: 45, borderRadius: '50%', background: '#333', overflow: 'hidden', marginRight: 15, border: f.online ? '2px solid #4caf50' : '2px solid transparent' }}>
            {f.avatar ? <img src={f.avatar} style={{ width: '100%', height: '100%' }} /> : <div style={{ textAlign: 'center', lineHeight: '45px' }}>👤</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: f.isAdmin ? '#ffd700' : 'white', textShadow: f.isAdmin ? '0 0 8px rgba(255,215,0,0.5)' : 'none' }}>
                {f.fullname}
              </span>
              {f.isAdmin && <span title="Разработчик" style={{ fontSize: 16 }}>👑</span>}
              <span style={{ fontWeight: 'normal', color: '#aaa', fontSize: 12 }}>@{f.username}</span>
            </div>
            <div style={{ fontSize: 12, color: f.online ? '#4caf50' : '#f44336' }}>{f.online ? '● В сети' : '○ Не в сети'}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>🏆 {f.wins || 0} / 💀 {f.losses || 0}</div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setChatFriend(f)} style={{ background: '#394670', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 5, cursor: 'pointer' }}>Написать</button>
            {f.online && (
              <button onClick={() => inviteFriend(f.username)} style={{ background: '#f0c674', color: '#000', border: 'none', padding: '8px 12px', borderRadius: 5, fontWeight: 'bold', cursor: 'pointer' }}>Пригласить</button>
            )}
            <button onClick={() => setFriendToDelete(f.username)} style={{ background: '#f44336', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
          </div>
        </div>
      ))}
    </div>
  );
}