import React, { useState } from 'react';



export function ProfileSettings({ user, onSave, onBack }: { user: any, onSave: (status: string, avatar: string) => void, onBack: () => void }) {
  const [status, setStatus] = useState(user.status || 'В сети');
  const [avatar, setAvatar] = useState(user.avatar || '');

  const [imageError, setImageError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiList = ['🙂','😊','😎','🔥','💪','🎮','🎉','❤️','🍀','🏆','👑','🤖','😴','☕','🎯'];
  const onAvatarFile = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setImageError('Выбери JPG, PNG или WebP размером до 8 МБ'); return;
    }
    setProcessing(true); setImageError('');
    let url = '';
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Не удалось обработать изображение');
      const crop = Math.min(img.naturalWidth,img.naturalHeight);
      ctx.drawImage(img,(img.naturalWidth-crop)/2,(img.naturalHeight-crop)/2,crop,crop,0,0,256,256);
      const encoded = canvas.toDataURL('image/jpeg',0.72);
      if (encoded.length > 180000) throw new Error('Фото слишком большое');
      setAvatar(encoded);
    } catch(e:any) { setImageError(e?.message || 'Ошибка загрузки фото'); }
    finally { if(url) URL.revokeObjectURL(url); setProcessing(false); }
  };
  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;

  return (
    <div className="mobile-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'transparent', color: 'white' }}>
      <div className="mobile-panel" style={{ background: 'rgba(37, 37, 64, 0.85)', backdropFilter: 'blur(10px)', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '2px solid #f0c674', textAlign: 'center', width: 320 }}>
        
        <h2 style={{ color: '#f0c674', margin: '0 0 20px 0' }}>Настройки профиля</h2>

        <div style={{ width: 110, height: 110, borderRadius: '50%', background: '#e0e0e0', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #f0c674' }}>
          <img src={avatar || defaultAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <label style={{ display:'block', marginBottom:12, padding:12, border:'1px solid #f0c674', borderRadius:8, color:'#f0c674', cursor:'pointer', fontWeight:700 }}>
          📷 {processing ? 'Обрабатываем фото…' : 'Выбрать аватар'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={e => { void onAvatarFile(e.target.files?.[0]); e.target.value=''; }} style={{ display:'none' }}/>
        </label>
        {imageError && <p role="alert" style={{ color:'#ff8b8b', fontSize:13 }}>{imageError}</p>}
        <div style={{ marginBottom: 25, textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 14, color: '#aaa', marginBottom: 5 }}>Статус</label>
          <input 
            type="text" 
            value={status} 
            onChange={e => setStatus(e.target.value)} 
            placeholder="Ваш статус"
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #555', background: 'rgba(26, 26, 46, 0.8)', color: 'white', outline: 'none', boxSizing: 'border-box' }} 
          />
          <button type="button" onClick={() => setShowEmoji(v => !v)} aria-expanded={showEmoji}
            style={{ marginTop:8, padding:'8px 12px', border:'1px solid #f0c674', borderRadius:8, background:'#252540', color:'#f0c674', cursor:'pointer' }}>😊 Добавить эмодзи</button>
          {showEmoji && <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
            {emojiList.map(e => <button key={e} type="button" onClick={() => {setStatus(v => (v + ' ' + e).slice(0,255));setShowEmoji(false);}} style={{border:'1px solid #555',borderRadius:6,background:'#303149',fontSize:21,padding:6,cursor:'pointer'}} aria-label={'Добавить '+e}>{e}</button>)}
          </div>}
        </div>

        <button disabled={processing} onClick={() => onSave(status, avatar)} style={{ padding: '15px', width: '100%', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 0 #2e7d32' }}>Сохранить</button>
        <button onClick={onBack} style={{ padding: '15px', width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>Назад</button>
      </div>
    </div>
  );
}