import React, { useEffect, useState } from 'react';
import { API_URL } from './api';

type Match = { matchId: string; won: boolean; opponents: string[]; finishedAt: string };
export function MatchHistory({ onClose }: { onClose: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('kozel_token') || '';
    fetch(`${API_URL}/api/matches/history`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error('Не удалось загрузить историю'); return res.json(); })
      .then(data => setMatches(Array.isArray(data.matches) ? data.matches : []))
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="История партий" style={{ position:'fixed', inset:0, zIndex:15000, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'min(460px,100%)', maxHeight:'min(80dvh,700px)', overflowY:'auto', background:'#252540', color:'#fff', border:'2px solid #f0c674', padding:20, borderRadius:16 }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16}}><h2 style={{margin:0,color:'#f0c674'}}>🎴 История партий</h2><button onClick={onClose} aria-label="Закрыть историю" style={{color:'white', background:'#383853', border:'1px solid #777', borderRadius:8, minHeight:44, minWidth:44, cursor:'pointer'}}>✕</button></div>
        {loading && <p>Загрузка...</p>}
        {error && <p role="alert" style={{ color:'#f88' }}>{error}</p>}
        {!loading && !error && !matches.length && <p style={{color:'#bbb'}}>Завершённых партий пока нет.</p>}
        {matches.map(m => <div key={m.matchId} style={{border:'1px solid #555', borderRadius:8, padding:12, marginBottom:9, background:'rgba(0,0,0,.2)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong style={{color:m.won?'#79d68c':'#f49b9b'}}>{m.won?'Победа':'Поражение'}</strong><small style={{color:'#aaa'}}>{new Date(m.finishedAt).toLocaleString('ru-RU')}</small></div>
          <div style={{fontSize:13,marginTop:6}}>Соперники: {m.opponents.join(', ') || '—'}</div>
        </div>)}
      </div>
    </div>
  );
}
