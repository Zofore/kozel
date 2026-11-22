import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export function Lobby({ socket, setRoomId, username, onBack }: { socket: Socket, setRoomId: (id: string) => void, username: string, onBack: () => void }) {
  const [difficulty, setDifficulty] = useState('professional');
  const [creatingBotRoom, setCreatingBotRoom] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [quickMode, setQuickMode] = useState<'1v1' | '2v2' | null>(null);
  const [quickUntil, setQuickUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [quickOffer, setQuickOffer] = useState<'1v1' | '2v2' | 'bot' | null>(null);
  const [quickError, setQuickError] = useState('');
  const activeQuick = useRef(false);
  const quickNextOffer = useRef<'1v1' | '2v2' | 'bot'>('2v2');
  const quickRequestId = useRef(0);
  const currentQuickMode = useRef<'1v1' | '2v2' | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 820);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const matched = (result: {roomId?: string}) => {
      if (!result?.roomId) return;
      activeQuick.current = false;
      currentQuickMode.current = null;
      quickRequestId.current += 1;
      setQuickMode(null);
      setQuickOffer(null);
      setQuickError('');
      setRoomId(result.roomId);
    };
    const timedOut = (result: {mode?: string}) => {
      if (!activeQuick.current || result?.mode !== currentQuickMode.current) return;
      setQuickOffer(prev => prev || quickNextOffer.current);
    };
    const disconnected = () => {
      activeQuick.current = false;
      currentQuickMode.current = null;
      quickRequestId.current += 1;
      setQuickMode(null);
      setQuickOffer(null);
      setQuickError('Соединение потеряно. Попробуйте начать поиск заново.');
    };
    socket.on('quick_matched', matched);
    socket.on('quick_timeout', timedOut);
    socket.on('disconnect', disconnected);
    return () => {
      socket.off('quick_matched', matched);
      socket.off('quick_timeout', timedOut);
      socket.off('disconnect', disconnected);
      socket.emit('quick_cancel');
      activeQuick.current = false;
      currentQuickMode.current = null;
      quickRequestId.current += 1;
    };
  }, [socket, setRoomId]);

  const cancelQuick = () => {
    activeQuick.current = false;
    currentQuickMode.current = null;
    quickRequestId.current += 1;
    socket.emit('quick_cancel');
    setQuickMode(null);
    setQuickOffer(null);
    setQuickError('');
    setQuickUntil(0);
  };

  const startQuick = (mode: '1v1' | '2v2', fallback: '1v1' | '2v2' | 'bot') => {
    if (!socket.connected) { setQuickError('Нет соединения с сервером'); return; }
    setQuickError('');
    setQuickOffer(null);
    activeQuick.current = true;
    currentQuickMode.current = mode;
    quickNextOffer.current = fallback;
    const requestId = ++quickRequestId.current;
    setQuickMode(mode);
    setQuickUntil(Date.now() + 90000);
    socket.timeout(5000).emit('quick_join', mode, (err: Error | null, result?: {ok?: boolean;error?: string;deadline?: number}) => {
      if (!activeQuick.current || requestId !== quickRequestId.current) return;
      if (err || result?.error || !result?.ok) {
        cancelQuick();
        setQuickError(result?.error || 'Сервер не ответил на запрос поиска');
        return;
      }
      if (result.deadline) setQuickUntil(result.deadline);
    });
  };

  const switchQuickTo2v2 = () => startQuick('2v2', 'bot');
  const switchQuickTo1v1 = () => startQuick('1v1', 'bot');

  const startBotAfterQuick = () => {
    cancelQuick();
    createBotRoom();
  };

  const leaveLobby = () => { cancelQuick(); onBack(); };

  const createRoom = (mode: '1v1' | '2v2') => {
    cancelQuick();
    socket.timeout(5000).emit('create_room', mode, (err:any,res: { roomId?: string; error?: string }) => {
      if (!err && res?.roomId) setRoomId(res.roomId); else alert(res?.error || 'Ошибка комнаты');
    });
  };

  const createBotRoom = () => {
    cancelQuick();
    setCreatingBotRoom(true);
    socket.timeout(5000).emit('create_bot_room', difficulty, (err: Error | null, res?: { roomId?: string; error?: string }) => {
      setCreatingBotRoom(false);
      if (!err && res?.roomId) setRoomId(res.roomId);
      else alert(res?.error || 'Не удалось начать игру с ботом');
    });
  };

  const joinRoom = () => {
    cancelQuick();
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
          onClick={leaveLobby}
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


          <div style={{border:'1px solid #f0c674',borderRadius:12,padding:16,marginBottom:18,background:'rgba(0,0,0,0.35)'}}>
            <h2 style={{color:'#f0c674',fontSize:22,margin:'0 0 10px'}}>Быстрая игра</h2>
            {!quickMode ? (
              <div style={{display:'grid',gap:10}}>
                <button onClick={() => startQuick('1v1', '2v2')} style={{width:'100%',minHeight:48,background:'#4caf50',color:'#fff',border:0,borderRadius:8,fontSize:18,fontWeight:'bold',cursor:'pointer'}}>Найти соперника 1×1</button>
                <button onClick={() => startQuick('2v2', '1v1')} style={{width:'100%',minHeight:48,background:'#4caf50',color:'#fff',border:0,borderRadius:8,fontSize:18,fontWeight:'bold',cursor:'pointer'}}>Найти игроков 2×2</button>
              </div>
            ) : (
              <>
                <p style={{color:'white',margin:'6px 0'}}>Ищем игроков {quickMode === '1v1' ? '1×1' : '2×2'}…</p>
                <div role="timer" style={{fontSize:28,color:'#f0c674',fontWeight:'bold',margin:'6px 0'}}>{Math.max(0,Math.ceil((quickUntil-now)/1000))} сек.</div>
                {quickOffer === '1v1' && (
                  <div style={{margin:'12px 0',color:'white'}}>
                    <p>Пока не удалось собрать команду 2×2. Попробуем найти соперника 1×1?</p>
                    <button onClick={switchQuickTo1v1} style={{minHeight:48,width:'100%',marginBottom:8,border:0,borderRadius:8,background:'#f0c674',color:'#161626',fontWeight:'bold'}}>Да, искать 1×1</button>
                    <button onClick={()=>setQuickOffer(null)} style={{minHeight:44,width:'100%',background:'#303048',color:'white',border:'1px solid #777',borderRadius:8}}>Нет, продолжить поиск 2×2</button>
                  </div>
                )}
                {quickOffer === '2v2' && (
                  <div style={{margin:'12px 0',color:'white'}}>
                    <p>Соперник 1×1 пока не найден. Попробуем 2×2?</p>
                    <button onClick={switchQuickTo2v2} style={{minHeight:48,width:'100%',marginBottom:8,border:0,borderRadius:8,background:'#f0c674',color:'#161626',fontWeight:'bold'}}>Да, искать 2×2</button>
                    <button onClick={()=>setQuickOffer(null)} style={{minHeight:44,width:'100%',background:'#303048',color:'white',border:'1px solid #777',borderRadius:8}}>Нет, продолжить поиск 1×1</button>
                  </div>
                )}
                {quickOffer === 'bot' && (
                  <div style={{margin:'12px 0',color:'white'}}>
                    <p>Реальные игроки пока не найдены. Сыграть с ботом 1×1?</p>
                    <button onClick={startBotAfterQuick} style={{minHeight:48,width:'100%',marginBottom:8,border:0,borderRadius:8,background:'#f0c674',color:'#161626',fontWeight:'bold'}}>Да, играть с ботом</button>
                    <button onClick={()=>setQuickOffer(null)} style={{minHeight:44,width:'100%',background:'#303048',color:'white',border:'1px solid #777',borderRadius:8}}>Нет, продолжить поиск {quickMode === '1v1' ? '1×1' : '2×2'}</button>
                  </div>
                )}
                <button onClick={cancelQuick} style={{minHeight:44,width:'100%',marginTop:8,background:'#512525',border:'1px solid #d99',color:'white',borderRadius:8}}>Отменить поиск</button>
              </>
            )}
            {quickError && <p role="alert" style={{color:'#ff9999'}}>{quickError}</p>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button onClick={() => createRoom('1v1')} style={{ padding: isMobile ? '14px 20px' : '15px 20px', margin: isMobile ? '4px 0' : '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: isMobile ? 17 : 18, fontWeight: 'bold', cursor: 'pointer', color: '#000', minHeight: 48 }}>Создать 1 на 1</button>
            <button onClick={() => createRoom('2v2')} style={{ padding: isMobile ? '14px 20px' : '15px 20px', margin: isMobile ? '4px 0' : '5px 0', width: '100%', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: isMobile ? 17 : 18, fontWeight: 'bold', cursor: 'pointer', color: '#000', minHeight: 48 }}>Создать 2 на 2</button>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
            <div className="kozel-bot-picker" role="group" aria-label="Сложность бота">
              <span className="kozel-bot-picker-title">🤖 Выбери соперника</span>
              <div className="kozel-bot-levels">
                {[
                  {id:'novice',label:'Новичок',icon:'🌱'},
                  {id:'amateur',label:'Любитель',icon:'🎲'},
                  {id:'professional',label:'Профессионал',icon:'♠'},
                  {id:'master',label:'Мастер',icon:'👑'},
                  {id:'legend',label:'Легенда',icon:'🏆'}
                ].map(level=><button key={level.id} type="button" disabled={creatingBotRoom}
                  aria-pressed={difficulty===level.id}
                  className={'kozel-bot-level'+(difficulty===level.id?' kozel-bot-level--active':'')}
                  onClick={()=>setDifficulty(level.id)}>{level.icon} {level.label}</button>)}
              </div>
            </div>
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