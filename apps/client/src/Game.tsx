import React, { useState, useEffect, useRef, memo } from 'react';
import { Socket } from 'socket.io-client';
import { motion, LayoutGroup } from 'framer-motion';

const SUIT_MAP: any = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
const getAvatar = (name: string) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${name || 'default'}`;

const translateError = (err: string) => {
  if (err.includes('WRONG_COUNT')) return 'Неверное количество карт: нужно выделить ровно столько же, сколько на столе.';
  if (err.includes('CANNOT_BEAT')) return 'Эти карты не бьют карты на столе. Выберите другие или нажмите «Бита».';
  if (err.includes('NOT_YOUR_TURN')) return 'Сейчас не ваш ход!';
  if (err.includes('WRONG_PHASE')) return 'Сейчас нельзя делать этот ход.';
  if (err.includes('CARD_NOT_IN_HAND')) return 'У вас нет такой карты в руке.';
  if (err.includes('DUPLICATE_CARDS')) return 'Вы выбрали одинаковые карты.';
  if (err.includes('ILLEGAL_SET')) return 'Нельзя смешивать разные масти в одном ходе.';
  if (err.includes('NO_TRICK')) return 'На столе нет карт, которые можно отбить. Сделайте ход.';
  if (err.includes('TRICK_EXISTS')) return 'На столе уже есть карты, сначала их нужно отбить.';
  return err;
};

let globalAudioCtx: AudioContext | null = null;

const playSound = (type: 'card' | 'deal' | 'chat' | 'trump' | 'win' | 'lose' | 'click' | 'pop' | 'dice' | 'rain' | 'dev_join' | 'secret' | 'gold' | 'reverse') => {
  try {
    if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    const ctx = globalAudioCtx;

    const playTone = (freq: number, type: OscillatorType, duration: number, volume: number, delay = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };

    const playNoise = (duration: number, volume: number, delay = 0) => {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime + delay);
    };

    if (type === 'click') { playTone(600, 'sine', 0.05, 0.05); playTone(900, 'sine', 0.03, 0.03, 0.02); } 
    else if (type === 'pop') { playTone(800, 'sine', 0.1, 0.15); playTone(1200, 'sine', 0.1, 0.1, 0.05); }
    else if (type === 'card') { playNoise(0.05, 0.1); playTone(150, 'triangle', 0.1, 0.2); } 
    else if (type === 'deal') { playNoise(0.1, 0.15); playTone(300, 'sine', 0.08, 0.1); playTone(400, 'sine', 0.08, 0.1, 0.05); } 
    else if (type === 'chat') { playTone(880, 'sine', 0.1, 0.1); playTone(1108, 'sine', 0.2, 0.1, 0.1); } 
    else if (type === 'dice') { playNoise(0.1, 0.2); playTone(200, 'square', 0.1, 0.1); }
    else if (type === 'rain') { playTone(523, 'triangle', 0.1, 0.15); playTone(659, 'triangle', 0.1, 0.15, 0.1); playTone(783, 'triangle', 0.2, 0.15, 0.2); }
    else if (type === 'dev_join') {
      playTone(523, 'triangle', 0.15, 0.18); playTone(659, 'triangle', 0.15, 0.18, 0.15); playTone(783, 'triangle', 0.15, 0.18, 0.30); playTone(1046, 'triangle', 0.4, 0.22, 0.45); playTone(1318, 'triangle', 0.6, 0.18, 0.75); playNoise(0.2, 0.1, 0);
    }
    else if (type === 'gold') {
      playTone(1200, 'triangle', 0.1, 0.15); playTone(1500, 'triangle', 0.15, 0.12, 0.05); playTone(1800, 'triangle', 0.2, 0.1, 0.1); playTone(1400, 'sine', 0.3, 0.1, 0.2); playTone(2000, 'sine', 0.4, 0.08, 0.35); playNoise(0.15, 0.05, 0);
    }
    else if (type === 'reverse') {
      playTone(800, 'sine', 0.3, 0.1); playTone(400, 'sine', 0.5, 0.08, 0.15); playTone(1200, 'sawtooth', 0.2, 0.06, 0.05); playNoise(0.1, 0.08, 0.2);
    }
    else if (type === 'secret') {
      playTone(130, 'sine', 1.2, 0.15); playTone(196, 'sine', 1.2, 0.12, 0.1); playTone(261, 'triangle', 1.0, 0.15, 0.3); playTone(392, 'triangle', 1.2, 0.12, 0.5); playTone(523, 'sine', 1.5, 0.1, 0.7); playNoise(0.4, 0.08, 0);
    }
    else if (type === 'trump') { playTone(440, 'square', 0.1, 0.1); playTone(554, 'square', 0.1, 0.1, 0.1); playTone(659, 'square', 0.1, 0.1, 0.2); playTone(880, 'square', 0.4, 0.15, 0.3); } 
    else if (type === 'win') { playTone(523, 'triangle', 0.15, 0.15); playTone(659, 'triangle', 0.15, 0.15, 0.15); playTone(783, 'triangle', 0.15, 0.15, 0.3); playTone(1046, 'triangle', 0.6, 0.15, 0.45); } 
    else if (type === 'lose') { playTone(392, 'sawtooth', 0.3, 0.1); playTone(370, 'sawtooth', 0.3, 0.1, 0.3); playTone(349, 'sawtooth', 0.3, 0.1, 0.6); playTone(330, 'sawtooth', 0.8, 0.1, 0.9); }
  } catch (e) { console.error('Audio error', e); }
};

let lastSpokenText = '';
let lastSpokenTime = 0;

const speakMessage = (text: string, sender: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    const now = Date.now();
    if (text === lastSpokenText && now - lastSpokenTime < 2000) return; 
    lastSpokenText = text; lastSpokenTime = now;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${sender} говорит: ${text}`);
    utterance.lang = 'ru-RU'; utterance.rate = 1.0; utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (e) { console.error('TTS error', e); }
};

const floatingEmojiStyle = `
@keyframes floatUp {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  50% { transform: translateY(-200px) scale(1.5) rotate(15deg); opacity: 1; }
  100% { transform: translateY(-400px) scale(1) rotate(-15deg); opacity: 0; }
}
.floating-emoji {
  position: fixed; bottom: 100px; font-size: 60px; pointer-events: none; z-index: 9999;
  animation: floatUp 2.5s ease-out forwards; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
}
@keyframes rainFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
.rain-emoji {
  position: fixed; top: 0; font-size: 50px; pointer-events: none; z-index: 9999;
  animation: rainFall linear forwards; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
}
@keyframes fadeInScale {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes goldFall {
  0% { transform: translateY(-100vh) rotate(0deg) scale(0.5); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(100vh) rotate(360deg) scale(1.2); opacity: 0; }
}
.gold-emoji {
  position: fixed; top: 0; pointer-events: none; z-index: 9999;
  animation: goldFall linear forwards;
  filter: drop-shadow(0 0 20px rgba(255,215,0,0.9)) drop-shadow(0 0 40px rgba(255,215,0,0.5));
}

@keyframes goldenRotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.dev-avatar-frame {
  position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 3px; border-radius: 50%;
  background: linear-gradient(90deg, #ffd700, #fff8dc, #ffa500, #ffd700, #fff8dc, #ffa500, #ffd700);
  background-size: 300% 300%; animation: goldenRotate 3s linear infinite;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 215, 0, 0.35);
}
.dev-avatar-frame img { display: block; border-radius: 50%; }

@keyframes goldShine {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.dev-nick {
  background: linear-gradient(90deg, #ffd700, #fff, #ffd700, #fff, #ffd700);
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  animation: goldShine 3s linear infinite; font-weight: bold; text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

@keyframes devJoinPop {
  0% { transform: scale(0.7); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes devJoinGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.3); }
  50% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.9), 0 0 100px rgba(255, 215, 0, 0.5); }
}
.dev-join-alert { animation: devJoinPop 0.5s ease-out, devJoinGlow 1.5s ease-in-out infinite; }

@keyframes secretFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes secretCrownDrop {
  0% { transform: translateY(-200px) scale(0.3) rotate(-45deg); opacity: 0; }
  60% { transform: translateY(20px) scale(1.2) rotate(15deg); opacity: 1; }
  80% { transform: translateY(-10px) scale(0.95) rotate(-5deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
}
@keyframes secretGlowPulse {
  0%, 100% { text-shadow: 0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4); }
  50% { text-shadow: 0 0 60px rgba(255,215,0,1), 0 0 120px rgba(255,215,0,0.7); }
}
.secret-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: radial-gradient(circle at center, rgba(20,15,5,0.85) 0%, rgba(0,0,0,0.95) 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: secretFadeIn 0.4s ease-out; pointer-events: none;
}
.secret-crown { font-size: 200px; animation: secretCrownDrop 1s cubic-bezier(0.175, 0.885, 0.32, 1.275); filter: drop-shadow(0 0 40px rgba(255,215,0,0.8)); }
.secret-text { color: #ffd700; font-size: 42px; font-weight: bold; margin-top: 30px; animation: secretGlowPulse 1.5s ease-in-out infinite; text-align: center; padding: 0 20px; letter-spacing: 2px; }
.secret-subtext { color: #fff; font-size: 20px; margin-top: 20px; opacity: 0.8; }

@keyframes carpetShine {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes carpetGlow {
  0%, 100% { box-shadow: inset 0 0 15px rgba(0,0,0,0.9), inset 0 0 5px rgba(240,198,116,0.5), 0 4px 10px rgba(0,0,0,0.6), 0 0 10px rgba(240,198,116,0.2); }
  50% { box-shadow: inset 0 0 15px rgba(0,0,0,0.9), inset 0 0 10px rgba(240,198,116,0.8), 0 4px 10px rgba(0,0,0,0.6), 0 0 20px rgba(240,198,116,0.6); }
}
.carpet-card-back {
  background-color: #5c0a0a;
  background-image:
    repeating-linear-gradient(45deg, rgba(240,198,116,0.15) 0, rgba(240,198,116,0.15) 2px, transparent 2px, transparent 8px),
    repeating-linear-gradient(-45deg, rgba(240,198,116,0.15) 0, rgba(240,198,116,0.15) 2px, transparent 2px, transparent 8px),
    radial-gradient(circle at 50% 50%, #8b0000 20%, #4a0000 80%);
  border: 2px solid #f0c674;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  animation: carpetGlow 3s infinite ease-in-out;
}
.carpet-card-back::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(240,198,116,0.4);
  border-radius: 4px;
  pointer-events: none;
}
.carpet-card-back::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 60%, transparent 80%);
  background-size: 200% 100%;
  animation: carpetShine 4s infinite linear;
  pointer-events: none;
}
`;

const CardView = memo(({ card, onClick, selected, small, faceDown, className, isDevCard, isLegal }: any) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const baseName = `${card.rank}_${SUIT_MAP[card.suit]}`;
  const [imgSrc, setImgSrc] = useState(`/cards/${baseName}.jpg`);
  const [showText, setShowText] = useState(false);
  const handleError = () => { if (imgSrc.endsWith('.jpg')) setImgSrc(`/cards/${baseName}.png`); else setShowText(true); };

  const devCardStyle = isDevCard ? {
    background: 'linear-gradient(135deg, #111, #333)',
    border: '2px solid #ffd700',
    boxShadow: '0 0 15px rgba(255,215,0,0.3)'
  } : {};

  const legalStyle = isLegal ? {
    boxShadow: '0 0 15px #4caf50, 0 0 0 2px #4caf50'
  } : {};

  const isCarpet = faceDown && !isDevCard;

  return (
    <div onClick={onClick} className={`card-3d ${className || ''} ${selected ? 'card-selected' : ''}`} style={{
      width: small ? '50px' : '70px', height: small ? '75px' : '105px', 
      background: isDevCard ? 'none' : (faceDown ? 'transparent' : '#fff'), 
      border: faceDown ? (isDevCard ? '2px solid #000' : 'none') : 'none',
      cursor: onClick ? 'pointer' : 'default', padding: 0, overflow: 'hidden', position: 'relative',
      transform: selected ? 'translateY(-15px)' : 'none', 
      boxShadow: selected ? '0 0 0 3px #f0c674, 0 15px 25px rgba(0,0,0,0.6)' : '0 2px 5px rgba(0,0,0,0.5)', transition: '0.1s',
      ...(faceDown && isDevCard ? devCardStyle : {}),
      ...(isLegal && !selected ? legalStyle : {})
    }}>
      {!faceDown && (
        <>
          {!showText && <img src={imgSrc} alt={card.rank} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} onError={handleError} />}
          {showText && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: small ? '18px' : '26px', fontWeight: '900', color: isRed ? '#d32f2f' : '#222' }}>
              <div>{card.rank}</div><div style={{ marginTop: '-5px' }}>{card.suit}</div>
            </div>
          )}
        </>
      )}
      {faceDown && isDevCard && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ffd700', fontSize: 24, fontWeight: 'bold' }}>DEV</div>}
      
      {isCarpet && (
        <div className="carpet-card-back" style={{ width: '100%', height: '100%' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: 'rgba(240,198,116,0.4)', fontSize: small ? '24px' : '36px', fontWeight: 'bold',
            textShadow: '0 0 10px rgba(240,198,116,0.8)'
          }}>
            ♠
          </div>
        </div>
      )}
    </div>
  );
});

const Dice = ({ value, rolling }: { value: number, rolling: boolean }) => {
  const [rotation, setRotation] = useState('rotateX(0) rotateY(0)');

  useEffect(() => {
    if (rolling) setRotation('rotateX(1080deg) rotateY(1080deg)');
    else {
      const final: Record<number, string> = { 1: 'rotateX(0) rotateY(0)', 2: 'rotateX(-90deg) rotateY(0)', 3: 'rotateX(0) rotateY(-90deg)', 4: 'rotateX(0) rotateY(90deg)', 5: 'rotateX(90deg) rotateY(0)', 6: 'rotateX(180deg) rotateY(0)' };
      setRotation(final[value] || 'rotateX(0) rotateY(0)');
    }
  }, [rolling, value]);

  const face = (t: string) => ({ position: 'absolute' as const, width: '100%', height: '100%', background: 'linear-gradient(135deg, #fff, #e0e0e0)', border: '2px solid #ccc', borderRadius: '15px', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.1)', transform: t, display: 'flex', justifyContent: 'center', alignItems: 'center', backfaceVisibility: 'hidden' as const });

  const Dots = ({ c }: { c: number }) => {
    const arr = Array(9).fill(0);
    const l: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const a = l[c] || [];
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', width: '100%', height: '100%', padding: '12px', boxSizing: 'border-box' }}>{arr.map((_, i) => <div key={i} style={{ background: a.includes(i) ? '#b71c1c' : 'transparent', borderRadius: '50%', width: '100%', height: '100%', boxShadow: a.includes(i) ? 'inset -2px -2px 5px rgba(0,0,0,0.5)' : 'none' }} />)}</div>;
  };

  return (
    <div style={{ perspective: '1000px', width: '80px', height: '80px', margin: '0 10px' }}>
      <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transform: rotation, transition: rolling ? 'transform 2s ease-in-out' : 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        <div style={face('translateZ(40px)')}><Dots c={1} /></div><div style={face('rotateY(180deg) translateZ(40px)')}><Dots c={6} /></div><div style={face('rotateY(90deg) translateZ(40px)')}><Dots c={3} /></div><div style={face('rotateY(-90deg) translateZ(40px)')}><Dots c={4} /></div><div style={face('rotateX(90deg) translateZ(40px)')}><Dots c={5} /></div><div style={face('rotateX(-90deg) translateZ(40px)')}><Dots c={2} /></div>
      </div>
    </div>
  );
};

const DiceRollScreen = ({ gameState }: { gameState: any }) => {
  const [rolling, setRolling] = useState(true);
  useEffect(() => { setRolling(true); playSound('dice'); const timer = setTimeout(() => setRolling(false), 1500); return () => clearTimeout(timer); }, [gameState.diceRolls]);
  if (!gameState.diceRolls) return <div style={{ color: 'white', fontSize: 24 }}>Подготовка к броску...</div>;
  const rolls = Object.values(gameState.diceRolls) as number[];
  const maxRoll = Math.max(...rolls);
  const winner = gameState.players.find((p: any) => gameState.diceRolls[p.id] === maxRoll);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at center, #1e3a2a 0%, #0d1b14 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <style>{floatingEmojiStyle}</style>
      <h1 style={{ color: '#f0c674', fontSize: 48, marginBottom: 40, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>{rolling ? 'Бросок костей...' : 'Кости брошены!'}</h1>
      <div style={{ display: 'flex', gap: 40, marginBottom: 50 }}>
        {gameState.players.map((p: any) => (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={p.isAdmin ? 'dev-avatar-frame' : ''} style={{ marginBottom: 10 }}><img src={getAvatar(p.name)} style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', border: p.isAdmin ? 'none' : '2px solid #f0c674' }} /></div>
            <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 5 }}>{p.isAdmin && <span>👑</span>}<span className={p.isAdmin ? 'dev-nick' : ''} style={{ color: p.isAdmin ? undefined : 'white', fontWeight: 'bold' }}>{p.name}</span></div>
            <Dice value={gameState.diceRolls[p.id]} rolling={rolling} />
            <div style={{ marginTop: 15, fontSize: 20, fontWeight: 'bold', color: gameState.diceRolls[p.id] === maxRoll ? '#4caf50' : '#aaa' }}>{gameState.diceRolls[p.id]}</div>
          </div>
        ))}
      </div>
      {!rolling && <div style={{ color: '#4caf50', fontSize: 28, fontWeight: 'bold', animation: 'fadeInScale 0.5s ease-out' }}>{winner ? `Первым ходит: ${winner.name}!` : 'Ничья! Перебрасываем...'}</div>}
    </div>
  );
};

export function Game({ socket, roomId, setRoomId, username, isAdmin = false, openDevConsole, onExit }: { socket: Socket, roomId: string, setRoomId: any, username: string, isAdmin?: boolean, openDevConsole?: () => void, onExit: (state?: any) => void }) {
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trumpAlert, setTrumpAlert] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const [rainEmojis, setRainEmojis] = useState<any[]>([]);
  const [devJoinAlert, setDevJoinAlert] = useState<string | null>(null);
  const [secretFx, setSecretFx] = useState(false);
  const [goldEmojis, setGoldEmojis] = useState<any[]>([]);
  const [matchConfetti, setMatchConfetti] = useState<any[]>([]);
  const [isReversed, setIsReversed] = useState(false);

  const prevState = useRef<any>(null);
  const lastProcessedMsgId = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameState || !gameState.turnDeadline) { setTimeLeft(0); return; }
    const updateTimer = () => { const remaining = Math.max(0, Math.floor((gameState.turnDeadline - Date.now()) / 1000)); setTimeLeft(remaining); };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState?.turnDeadline]);

  useEffect(() => {
    const onState = (state: any) => { 
      if (state.roomId !== roomId) return;
      if (prevState.current) {
        if (state.trumpChanged && !prevState.current.trumpChanged) {
          setTrumpAlert(state.trumpChangeEvent?.card || state.trumpCard); setTimeout(() => setTrumpAlert(null), 3000); playSound('trump');
        }
        const prevTrickLen = prevState.current.trick ? prevState.current.trick.cardsOnTable.length : 0;
        const newTrickLen = state.trick ? state.trick.cardsOnTable.length : 0;
        if (newTrickLen > prevTrickLen) playSound('card');
        if (state.deckCount < prevState.current.deckCount || state.roundNumber > prevState.current.roundNumber) playSound('deal');
        
        if (state.phase === 'finished' && prevState.current.phase !== 'finished') {
          const mySide = state.players[state.me]?.side;
          const amIWinner = (state.matchScore.A >= 24 && mySide === 'B') || (state.matchScore.B >= 24 && mySide === 'A');
          if (amIWinner) {
            playSound('win');
            const emojis = ['🎉', '🎊', '🏆', '🥇', '💰', '👑', '🌟'];
            setMatchConfetti(Array.from({ length: 100 }).map((_, i) => ({
              id: Date.now() + i,
              emoji: emojis[Math.floor(Math.random() * emojis.length)],
              left: Math.random() * 100,
              duration: 2 + Math.random() * 3,
            })));
          } else {
            playSound('lose');
          }
        }
      }
      prevState.current = state;
      setGameState(state); 
      setSelectedCards([]); 
    };

    const onError = (msg: string) => { setErrorMsg(translateError(msg)); setTimeout(() => setErrorMsg(null), 3000); };
    const onChatMessage = (msg: any) => {
      if (msg.id && lastProcessedMsgId.current === msg.id) return; 
      lastProcessedMsgId.current = msg.id || null;
      setMessages(prev => [...prev, msg]);
      if (msg.sender !== 'DEBUG') { playSound('chat'); speakMessage(msg.text, msg.sender); }
      setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    };
    const onReaction = (data: any) => { playSound('pop'); setFloatingEmojis(prev => [...prev, data]); setTimeout(() => { setFloatingEmojis(prev => prev.filter(e => e.id !== data.id)); }, 2500); };
    let kickedTimer: ReturnType<typeof setTimeout> | undefined;
    const onKicked = (msg: string) => { setErrorMsg(msg); if(kickedTimer) clearTimeout(kickedTimer); kickedTimer=setTimeout(() => setRoomId((current:string|null)=>current===roomId?null:current), 1500); };
    const onAdminRain = () => {
      playSound('rain'); const emojis = ['🎉', '🎊', '💰', '🍀', '👑', '🔥', '⭐', '💎', '🎁', '💵'];
      const newRain = Array.from({ length: 60 }).map((_, i) => ({ id: Date.now() + i, emoji: emojis[Math.floor(Math.random() * emojis.length)], left: Math.random() * 100, duration: 2 + Math.random() * 3 }));
      setRainEmojis(prev => [...prev, ...newRain]); setTimeout(() => { setRainEmojis(prev => prev.filter(e => !newRain.find(r => r.id === e.id))); }, 6000);
    };
    const onDevJoined = ({ name }: { name: string }) => { playSound('dev_join'); setDevJoinAlert(name); setTimeout(() => setDevJoinAlert(null), 4000); };
    const onAdminSecretFx = () => { playSound('secret'); setSecretFx(true); setTimeout(() => setSecretFx(false), 3500); };
    const onAdminGold = () => {
      playSound('gold'); const coins = ['💰', '🪙', '⭐', '💎', '✨', '👑', '🌟'];
      const newCoins = Array.from({ length: 80 }).map((_, i) => ({ id: Date.now() + i + Math.random(), emoji: coins[Math.floor(Math.random() * coins.length)], left: Math.random() * 100, duration: 2 + Math.random() * 2.5, size: 25 + Math.random() * 30 }));
      setGoldEmojis(prev => [...prev, ...newCoins]); setTimeout(() => { setGoldEmojis(prev => prev.filter(e => !newCoins.find(c => c.id === e.id))); }, 5500);
    };
    const onAdminReverse = () => { playSound('reverse'); setIsReversed(true); setTimeout(() => setIsReversed(false), 2000); };

    socket.on('game_state', onState); socket.on('error', onError); socket.on('chat_message', onChatMessage); socket.on('reaction', onReaction); socket.on('kicked', onKicked); socket.on('admin_rain', onAdminRain); socket.on('dev_joined', onDevJoined); socket.on('admin_secret_fx', onAdminSecretFx); socket.on('admin_gold', onAdminGold); socket.on('admin_reverse', onAdminReverse);
    const join = () => socket.emit('join_room',roomId);
    socket.on('connect',join);
    if(socket.connected) join();
    
    return () => { 
      if(kickedTimer) clearTimeout(kickedTimer);
      socket.off('connect',join);
      socket.off('game_state', onState); socket.off('error', onError); socket.off('chat_message', onChatMessage); socket.off('reaction', onReaction); socket.off('kicked', onKicked); socket.off('admin_rain', onAdminRain); socket.off('dev_joined', onDevJoined); socket.off('admin_secret_fx', onAdminSecretFx); socket.off('admin_gold', onAdminGold); socket.off('admin_reverse', onAdminReverse);
    };
  }, [socket, roomId, username]);

  const sendMessage = (e: React.FormEvent) => { e.preventDefault(); if (!chatInput.trim()) return; socket.emit('chat_message', { roomId, sender: username, text: chatInput.trim() }); setChatInput(''); };
  const sendEmoji = (emoji: string) => { socket.emit('send_reaction', { roomId, emoji, sender: username }); setEmojiPickerOpen(false); };
  const unlockAudio = () => { if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume(); };

  if (!gameState) return <div style={{ padding: 20, color: 'white', textAlign: 'center', fontSize: 24 }}>{errorMsg || 'Загрузка стола...'}<div><button onClick={()=>onExit()}>Выйти</button></div></div>;

  if (gameState.roundNumber === 0 && gameState.phase !== 'dice-roll') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, #1a1a2e 0%, #0f3460 100%)', color: 'white', padding: 20 }}>
        <style>{floatingEmojiStyle}</style>
        <div style={{ background: 'rgba(37, 37, 64, 0.9)', padding: 40, borderRadius: 20, border: '2px solid #f0c674', textAlign: 'center', maxWidth: 400, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>⏳</div><h2 style={{ color: '#f0c674', margin: '0 0 20px 0' }}>Ожидание игроков...</h2>
          <p style={{ color: '#ccc', marginBottom: 20 }}>Отправьте ID комнаты другу, чтобы он присоединился</p>
          <div style={{ background: '#1a1a2e', padding: 15, borderRadius: 8, fontSize: 16, fontWeight: 'bold', overflowWrap:'anywhere', letterSpacing: 1, color: '#f0c674', marginBottom: 20 }}>{roomId}</div>
          <button onClick={()=>navigator.clipboard?.writeText(roomId).catch(()=>{})} style={{marginBottom:12,padding:'8px 16px',background:'transparent',border:'1px solid #f0c674',color:'#f0c674',borderRadius:8}}>Копировать ID</button>
          <button onClick={() => { playSound('click'); onExit(gameState); }} style={{ padding: '12px 30px', background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: 8, fontSize: 16, cursor: 'pointer', width: '100%' }}>Отменить</button>
        </div>
      </div>
    );
  }

  const teamName = (side:string) => gameState.players.filter((p:any)=>p.side===side).map((p:any)=>p.name).join(' / ');
  if (gameState.phase === 'dice-roll') return <DiceRollScreen gameState={gameState} />;

  if (gameState.phase === 'round-scored' || gameState.phase === 'finished') {
    const isFinished = gameState.phase === 'finished';
    const ptsA = gameState.lastRoundPoints?.A ?? 0;
    const ptsB = gameState.lastRoundPoints?.B ?? 0;
    const scoreA = gameState.matchScore.A;
    const scoreB = gameState.matchScore.B;
    const colorA = scoreA < scoreB ? '#4caf50' : (scoreA > scoreB ? '#f44336' : 'white');
    const colorB = scoreB < scoreA ? '#4caf50' : (scoreB > scoreA ? '#f44336' : 'white');

    let matchTitle = isFinished ? 'Игра окончена!' : `Кон ${gameState.roundNumber || 1} завершен!`;
    let matchEmotion = '';
    let titleColor = '#f0c674';

    if (isFinished) {
      const mySide = gameState.players[gameState.me]?.side;
      const amIWinner = (gameState.matchScore.A >= 24 && mySide === 'B') || (gameState.matchScore.B >= 24 && mySide === 'A');
      
      const tauntsWin = ['🏆 АБСОЛЮТНЫЙ ЧЕМПИОН! 🏆', '👑 Ты разнес их в пух и прах!', '🔥 Король стола, не иначе!', '💰 Забирай всё, ты лучший!'];
      const tauntsLose = ['💀 СЛИВ ЗАЩИТАН, БРАТИШКА 💀', '🤡 Иди учись играть, козёл!', '📉 Твоя бабушка играет лучше', '🗑️ Мусорка с тобой не согласна'];

      matchTitle = amIWinner ? tauntsWin[Math.floor(Math.random() * tauntsWin.length)] : tauntsLose[Math.floor(Math.random() * tauntsLose.length)];
      titleColor = amIWinner ? '#ffd700' : '#f44336';
      matchEmotion = amIWinner ? 'Ты заслужил эту победу. Отдыхай!' : 'Не расстраивайся, в следующий раз повезёт. Или нет.';
    }

    return (
      <div onClick={unlockAudio} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: isFinished ? (titleColor === '#ffd700' ? 'radial-gradient(circle, #2a2a10 0%, #0a0a05 100%)' : 'radial-gradient(circle, #2a1010 0%, #0a0505 100%)') : '#1a1a2e', position: 'relative', overflow: 'hidden' }}>
        <style>{floatingEmojiStyle}</style>
        {floatingEmojis.map(e => <div key={e.id} className="floating-emoji" style={{ left: `${e.left}%` }}>{e.emoji}</div>)}
        {rainEmojis.map(e => <div key={e.id} className="rain-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s` }}>{e.emoji}</div>)}
        {matchConfetti.map(e => <div key={e.id} className="gold-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s`, fontSize: 40 }}>{e.emoji}</div>)}

        <div style={{ padding: 40, textAlign: 'center', color: 'white', maxWidth: 600, background: 'rgba(20, 20, 35, 0.95)', backdropFilter: 'blur(10px)', borderRadius: 16, boxShadow: isFinished ? `0 10px 30px rgba(0,0,0,0.8), 0 0 40px ${titleColor}40` : '0 10px 30px rgba(0,0,0,0.5)', border: `2px solid ${titleColor}`, zIndex: 10 }}>
          <h1 style={{ color: titleColor, fontSize: isFinished ? 42 : 32, textShadow: `0 0 20px ${titleColor}80`, marginBottom: 10 }}>{matchTitle}</h1>
          {isFinished && <p style={{ color: '#ccc', fontSize: 18, marginBottom: 30 }}>{matchEmotion}</p>}
          
          {gameState.lastRoundPoints && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 12, margin: '20px 0' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: 16 }}>Очки за кон (карты):</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 18 }}>
                <span>{teamName('A')}: <b style={{ color: 'white' }}>{ptsA}</b></span><span>{teamName('B')}: <b style={{ color: 'white' }}>{ptsB}</b></span>
              </div>
              {ptsA === 60 && ptsB === 60 && <div style={{ color: '#f0c674', marginTop: 10, fontWeight: 'bold' }}>ЯЙЦА! (60:60)</div>}
            </div>
          )}
          <div style={{ fontSize: 20, margin: '30px 0', lineHeight: '1.6', background: 'rgba(0,0,0,0.4)', padding: 20, borderRadius: 12, border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: 16 }}>Штрафные баллы (до 24):</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div style={{ color: colorA }}><div style={{ fontSize: 16, marginBottom: 5 }}>{teamName('A')}</div><div style={{ fontSize: 32, fontWeight: 'bold' }}>{scoreA}</div></div>
              <div style={{ color: '#555', fontSize: 24 }}>—</div>
              <div style={{ color: colorB }}><div style={{ fontSize: 16, marginBottom: 5 }}>{teamName('B')}</div><div style={{ fontSize: 32, fontWeight: 'bold' }}>{scoreB}</div></div>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 15 }}>Тот, у кого меньше баллов, играет лучше! (Зеленый)</div>
          </div>
          {isFinished ? <button onClick={() => { playSound('click'); onExit(gameState); }} style={{ padding: '15px 40px', background: titleColor, border: 'none', borderRadius: 8, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', color: titleColor === '#ffd700' ? '#000' : '#fff' }}>Выйти в лобби</button> : <button onClick={() => { playSound('click'); if(socket.connected) socket.emit('next_round', roomId, gameState.stateVersion); }} style={{ padding: '15px 40px', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: 20, fontWeight: 'bold', cursor: 'pointer' }}>Следующий кон</button>}
        </div>
      </div>
    );
  }

  const toggleCard = (card: any) => {
    playSound('click');
    const isSelected = selectedCards.some(c => c.suit === card.suit && c.rank === card.rank);
    if (isSelected) { setSelectedCards(selectedCards.filter(c => !(c.suit === card.suit && c.rank === card.rank))); } 
    else { setSelectedCards([...selectedCards, card]); }
  };

  const playCards = () => { if (selectedCards.length === 0) return; playSound('click'); if(socket.connected) socket.emit('play_card', roomId, selectedCards, gameState.stateVersion); };
  const beat = () => { if (selectedCards.length === 0) return; playSound('click'); if(socket.connected) socket.emit('pass_or_beat', roomId, 'beat', selectedCards, gameState.stateVersion); };
  const bita = () => { playSound('click'); if(socket.connected) socket.emit('pass_or_beat', roomId, 'pass', selectedCards, gameState.stateVersion); };

  const isMyTurn = gameState.currentPlayer === gameState.me;
  const isDev = isAdmin;
  const required = gameState.trick?.required || 1;
  const selectedIds = selectedCards.map(c=>`${c.rank}_${c.suit}`);
  const legalSelection = gameState.legalMoves?.some((move:string[]) => move.length===selectedIds.length && move.every(id=>selectedIds.includes(id)));
  const passCount = Math.min(required,gameState.hand.length);
  const legalPass = selectedCards.length===passCount || (gameState.trick?.attacker===gameState.me && selectedCards.length===0);

  return (
    <LayoutGroup>
      <div onClick={unlockAudio} style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: '#1a1a2e', position: 'relative', overflow: 'hidden',
        transform: isReversed ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.6s ease-in-out',
      }}>
        <style>{floatingEmojiStyle}</style>
        {floatingEmojis.map(e => <div key={e.id} className="floating-emoji" style={{ left: `${e.left}%` }}>{e.emoji}</div>)}
        {rainEmojis.map(e => <div key={e.id} className="rain-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s` }}>{e.emoji}</div>)}
        {goldEmojis.map(g => <div key={g.id} className="gold-emoji" style={{ left: `${g.left}%`, animationDuration: `${g.duration}s`, fontSize: g.size }}>{g.emoji}</div>)}

        {secretFx && <div className="secret-overlay"><div className="secret-crown">👑</div><div className="secret-text">Создатель наблюдает за вами...</div><div className="secret-subtext">Удачи, смертные! 🃏</div></div>}

        {devJoinAlert && (
          <div className="dev-join-alert" style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #1a1a2e, #2a2410)', border: '3px solid #ffd700', borderRadius: 20, padding: '30px 60px', zIndex: 9999, textAlign: 'center', color: 'white', pointerEvents: 'none' }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>👑</div><div style={{ fontSize: 28, fontWeight: 'bold', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.8)' }}>{devNameDisplay(devJoinAlert)} вошёл в игру!</div>
          </div>
        )}

        {trumpAlert && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <h1 style={{ color: '#f0c674', fontSize: 48, marginBottom: 40 }}>Козырь сменился!</h1>
            <div style={{ transform: 'scale(2)' }}><CardView card={trumpAlert} className="animate-fly-to-table" /></div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 100 }}>
          {chatOpen ? (
            <div style={{ width: 300, height: 400, background: '#252540', borderRadius: 12, border: '2px solid #f0c674', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
              <div style={{ padding: 10, background: '#1a1a2e', borderTopLeftRadius: 10, borderTopRightRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444' }}>
                <span style={{ fontWeight: 'bold', color: '#f0c674' }}>💬 Чат</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {isDev && openDevConsole && <button onClick={openDevConsole} title="Dev Console" style={{ background: 'transparent', border: 'none', color: '#ffd700', cursor: 'pointer', fontSize: 16 }}>🛠️</button>}
                  <button onClick={() => { playSound('click'); setChatOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>✖</button>
                </div>
              </div>
              {isDev && (
                <div style={{ padding: '6px 10px', background: 'rgba(255,215,0,0.1)', borderBottom: '1px solid #333', fontSize: 11, color: '#ffd700', lineHeight: 1.4 }}>
                  ⚙️ <b>Игровые:</b> /kick [ник] · /rain · /stats · /reset · /secret
                </div>
              )}
              <div style={{ flex: 1, padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ fontSize: 14 }}>
                    <span style={{ color: m.sender === 'СИСТЕМА' ? '#ff9800' : m.sender === 'DEBUG' ? '#4caf50' : (m.isAdmin ? undefined : (m.sender === username ? '#4caf50' : '#f0c674')), fontWeight: 'bold' }} className={m.isAdmin ? 'dev-nick' : ''}>{m.isAdmin && '👑 '}{m.sender}: </span>
                    <span style={{ color: m.sender === 'DEBUG' ? '#4caf50' : '#fff', fontSize: m.sender === 'DEBUG' ? 12 : 14 }}>{m.text}</span><span style={{ color: '#666', fontSize: 10, marginLeft: 5 }}>{m.time}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {emojiPickerOpen && (
                <div style={{ padding: 10, background: '#1a1a2e', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', borderTop: '1px solid #444' }}>
                  {['👍', '😂', '😡', '😭', '❤️', '🔥', '🤡', '🤔'].map(emoji => (
                    <button key={emoji} onClick={() => sendEmoji(emoji)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', padding: 5, transition: 'transform 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', borderTop: '1px solid #444', alignItems: 'center', paddingRight: 5 }}>
                <button type="button" onClick={() => { playSound('click'); setEmojiPickerOpen(!emojiPickerOpen); }} style={{ padding: '0 10px', background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: emojiPickerOpen ? '#f0c674' : '#aaa' }}>😀</button>
                <form onSubmit={(e) => { playSound('click'); sendMessage(e); }} style={{ display: 'flex', flex: 1, padding: 10 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={isDev ? "Команда или сообщение..." : "Сообщение..."} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #555', background: '#1a1a2e', color: 'white', outline: 'none' }} />
                  <button type="submit" style={{ marginLeft: 5, padding: '8px 12px', background: '#f0c674', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>▶</button>
                </form>
              </div>
            </div>
          ) : (
            <button onClick={() => { playSound('click'); setChatOpen(true); }} style={{ width: 60, height: 60, borderRadius: '50%', background: '#f0c674', border: 'none', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>💬</button>
          )}
        </div>

        <div style={{ background: '#252540', padding: '15px 30px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '2px solid #444' }}>
          <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 15 }}>
            <div title={roomId} onClick={()=>navigator.clipboard?.writeText(roomId).catch(()=>{})} style={{ color: '#f0c674', fontSize: '14px', fontWeight: 'bold', cursor:'pointer' }}>ID: {roomId.slice(0,8)}…</div>
            {isDev && openDevConsole && <button onClick={openDevConsole} title="Dev Console (` тильда)" style={{ background: 'transparent', border: '1px solid #ffd700', color: '#ffd700', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>🛠️ Dev</button>}
          </div>
          <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={gameState.players[0]?.isAdmin ? 'dev-avatar-frame' : ''}><img src={getAvatar(gameState.players[0]?.name)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', border: gameState.players[0]?.isAdmin ? 'none' : 'none' }} /></div>
              <span className={gameState.players[0]?.isAdmin ? 'dev-nick' : ''} style={{ color: gameState.players[0]?.isAdmin ? undefined : 'white', fontWeight: 'bold' }}>{gameState.players[0]?.isAdmin && '👑 '}{gameState.players[0]?.name}</span>
            </div>
            <span style={{ color: '#f0c674', fontWeight: 'bold' }}>VS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={gameState.players[1]?.isAdmin ? 'dev-nick' : ''} style={{ color: gameState.players[1]?.isAdmin ? undefined : 'white', fontWeight: 'bold' }}>{gameState.players[1]?.isAdmin && '👑 '}{gameState.players[1]?.name}</span>
              <div className={gameState.players[1]?.isAdmin ? 'dev-avatar-frame' : ''}><img src={getAvatar(gameState.players[1]?.name)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff' }} /></div>
            </div>
          </div>
          <div style={{ justifySelf: 'end', display: 'flex', gap: 20 }}>
            <div style={{ color: timeLeft <= 5 ? '#f44336' : 'white', fontSize: '18px', fontWeight: timeLeft <= 5 ? 'bold' : 'normal' }}>Кон: {gameState.roundNumber || 1} | ⏱ {timeLeft}с</div>
            <div style={{ color: '#f0c674', fontSize: '18px', fontWeight: 'bold' }}>Козырь: {gameState.trump}</div>
          </div>
        </div>

        {<div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:10,padding:8,background:'#252540',color:'white'}}>{gameState.players.map((p:any)=><span key={p.id} style={{color:p.id===gameState.currentPlayer?'#f0c674':'#ccc',border:'1px solid #555',borderRadius:8,padding:5}}>{p.side} · {p.name} · {p.handCount} карт{!p.connected?' · не в сети':''}{p.id===gameState.me?' · вы':''}</span>)}</div>}
        <div className="felt-table" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', padding: '20px 40px', alignItems: 'flex-start' }}>
            <div style={{ justifySelf: 'start', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', color: gameState.players[0]?.isAdmin ? undefined : '#ccc' }} className={gameState.players[0]?.isAdmin ? 'dev-nick' : ''}>
                <img src={getAvatar(gameState.players[0]?.name)} style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />{gameState.players[0]?.isAdmin && '👑 '}{gameState.players[0]?.name}
              </div>
              <div style={{ position: 'relative', width: '60px', height: '90px' }}>
                {Array.from({ length: gameState.bitaCount?.A || 0 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', top: Math.min(i * 1.5, 20), left: Math.min(i * 1.5, 20) }}>
                    <CardView card={{ suit: '♠', rank: '6' }} small faceDown={true} isDevCard={gameState.players[0]?.isAdmin} />
                  </div>
                ))}
                {(!gameState.bitaCount?.A || gameState.bitaCount.A === 0) && <div style={{ width: '50px', height: '75px', border: '2px dashed #666', borderRadius: '8px', position: 'absolute' }} />}
              </div>
            </div>
            <div style={{ justifySelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100px', height: '105px' }}>
                {gameState.deckCount > 0 && (
                  <div className="carpet-card-back" style={{ 
                    position: 'absolute', top: 0, left: 0, width: '70px', height: '105px', 
                    boxShadow: '0 10px 15px rgba(0,0,0,0.6)' 
                  }} />
                )}
                {gameState.trumpCard && (
                  <div style={{ position: 'absolute', top: 15, left: 30, transform: 'rotate(90deg) translateZ(0)', zIndex: 2, willChange: 'transform', pointerEvents: 'none' }}>
                    <CardView card={gameState.trumpCard} />
                  </div>
                )}
              </div>
              <div style={{ color: 'white', marginTop: '15px', background: 'rgba(0,0,0,0.6)', padding: '2px 10px', borderRadius: '10px' }}>В колоде: {gameState.deckCount}</div>
            </div>
            <div style={{ justifySelf: 'end', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', color: gameState.players[1]?.isAdmin ? undefined : '#ccc' }} className={gameState.players[1]?.isAdmin ? 'dev-nick' : ''}>
                <img src={getAvatar(gameState.players[1]?.name)} style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />{gameState.players[1]?.isAdmin && '👑 '}{gameState.players[1]?.name}
              </div>
              <div style={{ position: 'relative', width: '60px', height: '90px' }}>
                {Array.from({ length: gameState.bitaCount?.B || 0 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', top: Math.min(i * 1.5, 20), left: Math.min(i * 1.5, 20) }}>
                    <CardView card={{ suit: '♠', rank: '6' }} small faceDown={true} isDevCard={gameState.players[1]?.isAdmin} />
                  </div>
                ))}
                {(!gameState.bitaCount?.B || gameState.bitaCount.B === 0) && <div style={{ width: '50px', height: '75px', border: '2px dashed #666', borderRadius: '8px', position: 'absolute' }} />}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {gameState.trick ? (
              <>
                <div style={{ color: '#ccc', fontSize: '18px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '5px 15px', borderRadius: '20px' }}>
                  Ходил: <span className={gameState.players[gameState.trick.attacker]?.isAdmin ? 'dev-nick' : ''} style={{ color: gameState.players[gameState.trick.attacker]?.isAdmin ? undefined : '#f0c674', fontWeight: 'bold' }}>{gameState.players[gameState.trick.attacker]?.isAdmin && '👑 '}{gameState.players[gameState.trick.attacker]?.name}</span>
                  <div className={gameState.players[gameState.trick.attacker]?.isAdmin ? 'dev-avatar-frame' : ''}><img src={getAvatar(gameState.players[gameState.trick.attacker]?.name)} style={{ width: 25, height: 25, borderRadius: '50%', background: '#fff' }} /></div>
                </div>
                <div style={{ display: 'flex', paddingLeft: '20px' }}>
                  {gameState.trick.cardsOnTable.map((card: any, i: number) => (
                    <motion.div key={i} layoutId={`${card.rank}_${card.suit}`} style={{ marginLeft: '-20px', zIndex: i }}>
                      <CardView card={card} />
                    </motion.div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '24px', fontWeight: 'bold' }}>Ожидание хода...</div>}
          </div>
        </div>

        <div style={{ background: '#1a1a2e', padding: '15px', borderTop: '2px solid #444', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {errorMsg && <div style={{ background: '#d32f2f', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '15px', minHeight: '120px' }}>
            {gameState.hand.map((card: any, index: number) => {
              const isSelected = selectedCards.some(c => c.suit === card.suit && c.rank === card.rank);
              const cardStr = `${card.rank}_${card.suit}`;
              const isLegal = gameState.legalMoves?.some((move: string[]) => move.includes(cardStr));
              return (
                <motion.div 
                  key={card.rank + card.suit} 
                  layoutId={`${card.rank}_${card.suit}`}
                  initial={{ y: 100, opacity: 0, rotate: 10 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 100, delay: index * 0.05 }}
                >
                  <CardView card={card} selected={isSelected} onClick={() => toggleCard(card)} isLegal={isLegal} />
                </motion.div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '15px', height: '44px', alignItems: 'center', justifyContent: 'center' }}>
            {isMyTurn && !gameState.trick && legalSelection && (
              <button onClick={playCards} style={{ padding: '10px 30px', background: '#f0c674', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: '#000', boxShadow: '0 4px 0 #b08d40' }}>Сделать ход</button>
            )}
            
            {isMyTurn && gameState.trick && legalSelection && (
              <button onClick={beat} style={{ padding: '10px 30px', background: '#4caf50', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: '#fff', boxShadow: '0 4px 0 #2e7d32' }}>Перебить</button>
            )}

            {isMyTurn && gameState.trick && legalPass && (
              <button onClick={bita} style={{ padding: '10px 30px', background: '#f44336', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: '#fff', boxShadow: '0 4px 0 #c62828' }}>Бита (Ваше)</button>
            )}
            
            {!isMyTurn && <div style={{ color: '#555', alignSelf: 'center' }}>Ожидание соперника...</div>}
            {isMyTurn && gameState.trick && !legalPass && gameState.trick.attacker !== gameState.me && (
              <div style={{ color: '#aaa', alignSelf: 'center', fontSize: 14 }}>Выделите ровно {passCount} карт(ы) для отбоя или сброса</div>
            )}
            
            <button onClick={() => { playSound('click'); onExit(gameState); }} style={{ marginLeft: '20px', padding: '10px 20px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '8px', cursor: 'pointer' }}>Выйти</button>
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}

function devNameDisplay(name: string) {
  return '👑 ' + name;
}