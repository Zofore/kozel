import React, { useState, useEffect, useRef, memo } from 'react';
import { Socket } from 'socket.io-client';
import { motion, LayoutGroup } from 'framer-motion';
import { Goat3D } from './Goat3D';
import { VoiceChat } from './VoiceChat';

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

export function unlockGameAudio() {
  try {
    if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (globalAudioCtx?.state === 'suspended') void globalAudioCtx.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}

export const playSound = (type: 'card' | 'deal' | 'chat' | 'trump' | 'win' | 'lose' | 'click' | 'pop' | 'dice' | 'rain' | 'dev_join' | 'secret' | 'gold' | 'reverse') => {
  try {
    unlockGameAudio();
    const ctx = globalAudioCtx;
    if (!ctx || (type === 'chat' && ctx.state !== 'running')) return;

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

// Decorative royal portraits for the visible faces only. Card identity still comes from game state.
const CardFaceArt = memo(({ rank, suit, small }: { rank: string; suit: string; small?: boolean }) => {
  const isRed = suit === '♥' || suit === '♦';
  const ink = isRed ? '#bb222c' : '#202638';
  const royal = isRed ? '#a8202b' : '#243b67';
  const royalDark = isRed ? '#66131f' : '#152642';
  const isCourt = rank === 'J' || rank === 'Q' || rank === 'K';
  const mark = rank === 'J' ? 'В' : rank === 'Q' ? 'Д' : rank === 'K' ? 'К' : rank;
  const side = {
    position: 'absolute' as const, zIndex: 2, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center' as const, fontFamily: 'Georgia, serif', fontWeight: 900,
    fontSize: small ? 12 : 17, lineHeight: 0.85, color: ink, textShadow: '0 1px 0 #fff'
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden',
      background: 'linear-gradient(132deg, #ffffff 0%, #fffdf6 38%, #ede9df 100%)',
      boxShadow: 'inset 1px 1px 2px #fff, inset -2px -3px 5px rgba(85,67,45,0.17)',
      userSelect: 'none', pointerEvents: 'none'
    }}>
      <div style={{position:'absolute',inset:small?2:3,border:'1px solid rgba(147,123,91,0.22)',borderRadius:3}} />
      <div style={{...side,top:small?3:5,left:small?3:5}}><span>{mark}</span><span style={{fontSize:small?11:15,marginTop:3}}>{suit}</span></div>
      <div style={{...side,bottom:small?3:5,right:small?3:5,transform:'rotate(180deg)'}}><span>{mark}</span><span style={{fontSize:small?11:15,marginTop:3}}>{suit}</span></div>
      {isCourt ? (
        <svg viewBox="0 0 70 100" aria-hidden="true" style={{
          position:'absolute',width:'81%',height:'79%',top:'10%',left:'10%',
          filter:'drop-shadow(0 1px 1px rgba(45,30,15,.2))'
        }}>
          <rect x="10" y="5" width="50" height="90" rx="4" fill="#f9f1d8" stroke="#c69a51" strokeWidth="1" />
          <path d="M10 9L58 91M58 9L10 91" stroke="#bba06b" strokeWidth="0.8" opacity=".28" />
          <path d="M13 95 L13 68 Q19 50 35 49 Q52 50 57 68 L57 95Z" fill={royalDark} stroke="#b88832" strokeWidth="1.8" />
          <path d="M15 91 L21 64 L31 56 L35 89 L39 56 L49 64 L55 91Z" fill={royal} stroke="#c69a51" strokeWidth="1" />
          <path d="M24 61 L35 76 L46 61 M24 84 L35 74 L46 84" fill="none" stroke="#efc25d" strokeWidth="3" />
          <path d="M17 91 L25 72 M53 91L45 72" stroke="#f2d588" strokeWidth="2" strokeDasharray="2 3" />
          <path d="M24 53 Q20 41 24 29 Q27 18 35 17 Q43 18 46 29 Q50 42 45 53 Q38 62 35 63 Q32 62 24 53Z" fill="#503021" stroke="#321d16" strokeWidth="1" />
          {rank === 'Q' && <path d="M22 36 Q12 47 20 66 L26 59 Q22 50 27 37 M48 36Q58 47 50 66L44 59Q48 50 43 37" fill="#55301d" stroke="#2b170f" strokeWidth="1" />}
          <path d="M26 28 Q34 25 44 28 L44 49 Q41 57 35 58 Q29 57 26 49Z" fill="#f1c79c" stroke="#a66a47" strokeWidth="1.1" />
          <path d="M26 30 Q29 21 35 22 Q42 21 45 30 L40 26 L34 30L29 26Z" fill="#68422d" />
          <path d="M28 39 L33 39 M37 39 L42 39" stroke="#402719" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M34 39 L33 47 L37 47" stroke="#ba855e" strokeWidth="0.9" fill="none" />
          <path d="M31 51 Q35 53 39 51" stroke="#884a40" strokeWidth="1.1" fill="none" />
          {rank === 'K' && <>
            <path d="M27 50 Q28 64 35 66 Q42 64 43 50 L39 56 L35 53 L31 56Z" fill="#704126" stroke="#382115" strokeWidth=".8" />
            <path d="M29 49 Q32 47 35 49 Q38 47 41 49" stroke="#69351c" strokeWidth="2" fill="none" />
          </>}
          {rank !== 'J' ? <>
            <path d="M23 28 L21 13L28 18L35 10L42 18L49 13L47 28Z" fill="#d5a339" stroke="#8d561c" strokeWidth="1.3" />
            <path d="M23 22H47" stroke="#fff0a0" strokeWidth="2" />
            <circle cx="28" cy="19" r="2" fill="#ba2c3a" /><circle cx="35" cy="16" r="2" fill="#2b5791" /><circle cx="42" cy="19" r="2" fill="#ba2c3a" />
          </> : <>
            <path d="M19 28 Q20 14 35 13 Q48 15 51 29L44 27 L38 19 L30 26Z" fill="#d4a83f" stroke="#875623" strokeWidth="1.1" />
            <path d="M38 18 Q50 1 58 10 Q49 8 48 21" fill="#e8d7a2" stroke="#946d3a" strokeWidth="1" />
          </>}
          <path d="M28 60L35 67L42 60" stroke="#f5dc95" strokeWidth="3" fill="none" />
          <circle cx="35" cy="79" r="3.5" fill="#e7bd54" stroke="#8c581d" strokeWidth="1"/>
          <text x="35" y="92" textAnchor="middle" fontSize="12" fontFamily="Georgia,serif" fontWeight="bold" fill="#eed389">{suit}</text>
        </svg>
      ) : (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{color:ink,fontSize:small?27:43,fontFamily:'Georgia,serif',
            textShadow:'1px 2px 1px rgba(0,0,0,.10)'}}>{suit}</span>
        </div>
      )}
      <div style={{position:'absolute',top:0,left:0,right:0,height:'35%',background:'linear-gradient(155deg,rgba(255,255,255,.65),rgba(255,255,255,0))',opacity:.7}} />
    </div>
  );
});

const CardView = memo(({ card, onClick, selected, small, faceDown, className, isDevCard, isLegal }: any) => {
  const isRed = card.suit === '♥' || card.suit === '♦';

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
    <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? `${card.rank} ${card.suit}` : undefined} aria-pressed={onClick ? Boolean(selected) : undefined} onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined} className={`card-3d ${small ? "card-small" : "card-full"} ${className || ''} ${selected ? 'card-selected' : ''}`} style={{
      width: small ? '50px' : '70px', height: small ? '75px' : '105px', 
      background: isDevCard ? 'none' : (faceDown ? 'transparent' : '#f7f2e8'),
      border: faceDown ? (isDevCard ? '2px solid #000' : 'none') : '1px solid #dad2c0',
      borderRadius: 5,
      cursor: onClick ? 'pointer' : 'default', padding: 0, overflow: 'hidden', position: 'relative',
      transform: selected ? 'translateY(-15px)' : 'none', 
      boxShadow: selected ? '0 0 0 3px #f0c674, 0 15px 25px rgba(0,0,0,0.6)' : '0 2px 5px rgba(0,0,0,0.5)', transition: '0.1s',
      ...(faceDown && isDevCard ? devCardStyle : {}),
      ...(isLegal && !selected ? legalStyle : {})
    }}>
      {!faceDown && <CardFaceArt rank={String(card.rank)} suit={String(card.suit)} small={Boolean(small)} />}
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

// Each back represents one opponent card. Never use private hand data here.
const OpponentCardBacks = memo(({ count, compact }: { count: number; compact: boolean }) => {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const overlap = compact ? 12 : 15;
  const width = compact ? 25 : 31;
  const height = compact ? 36 : 45;
  return (
    <div aria-label={`У игрока ${total} закрытых карт`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: '100%' }}>
      <span style={{ color: '#c9c9c9', fontSize: compact ? 10 : 11 }}>{total} карт</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: height, maxWidth: '100%' }}>
        {Array.from({ length: total }, (_, index) => (
          <div key={index} className="carpet-card-back" aria-hidden="true" style={{
            flex: '0 0 auto', width, height,
            marginLeft: index === 0 ? 0 : -overlap,
            boxShadow: '0 1px 3px rgba(0,0,0,0.65)'
          }} />
        ))}
      </div>
    </div>
  );
});

const DICE_ROLL_MS = 1500;
const diceFaces = [
  { value: 1, x: 0, y: 0 },
  { value: 2, x: -90, y: 0 },
  { value: 3, x: 0, y: 90 },
  { value: 4, x: 0, y: -90 },
  { value: 5, x: 90, y: 0 },
  { value: 6, x: 0, y: 180 },
];
const diceRotation = (x: number, y: number) => `rotateX(${x}deg) rotateY(${y}deg)`;

const Dice = ({ value, rolling }: { value: number, rolling: boolean }) => {
  const { x, y } = diceFaces[value - 1] ?? diceFaces[0];

  const face = (t: string) => ({ position: 'absolute' as const, width: '100%', height: '100%', background: 'linear-gradient(135deg, #fff, #e0e0e0)', border: '2px solid #ccc', borderRadius: '15px', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.1)', transform: t, display: 'flex', justifyContent: 'center', alignItems: 'center', backfaceVisibility: 'hidden' as const });

  const Dots = ({ c }: { c: number }) => {
    const arr = Array(9).fill(0);
    const l: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const a = l[c] || [];
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', width: '100%', height: '100%', padding: '12px', boxSizing: 'border-box' }}>{arr.map((_, i) => <div key={i} style={{ background: a.includes(i) ? '#b71c1c' : 'transparent', borderRadius: '50%', width: '100%', height: '100%', boxShadow: a.includes(i) ? 'inset -2px -2px 5px rgba(0,0,0,0.5)' : 'none' }} />)}</div>;
  };

  return (
    <div style={{ perspective: '1000px', width: '80px', height: '80px', margin: '0 10px' }}>
      <div style={{
        width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d',
        transform: diceRotation(-x, -y),
        '--dice-roll-end': diceRotation(1080 - x, 1080 - y),
        animation: rolling ? `dice-roll-to-face ${DICE_ROLL_MS}ms ease-out both` : undefined,
      } as React.CSSProperties}>
        {diceFaces.map(({ value: dots, x, y }) => (
          <div key={dots} style={face(`${diceRotation(x, y)} translateZ(40px)`)}><Dots c={dots} /></div>
        ))}
      </div>
    </div>
  );
};

const DiceRollScreen = ({ gameState }: { gameState: any }) => {
  const [rolling, setRolling] = useState(true);
  useEffect(() => { setRolling(true); playSound('dice'); const timer = setTimeout(() => setRolling(false), DICE_ROLL_MS); return () => clearTimeout(timer); }, [gameState.diceRolls]);
  if (!gameState.diceRolls) return <div style={{ color: 'white', fontSize: 24 }}>Подготовка к броску...</div>;
  const rolls = Object.values(gameState.diceRolls) as number[];
  const maxRoll = Math.max(...rolls);
  const winner = gameState.players.find((p: any) => gameState.diceRolls[p.id] === maxRoll);

  return (
    <div className="mobile-dice-screen" style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at center, #1e3a2a 0%, #0d1b14 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <style>{`${floatingEmojiStyle}
        @keyframes dice-roll-to-face {
          from { transform: rotateX(0deg) rotateY(0deg); }
          to { transform: var(--dice-roll-end); }
        }`
      }</style>
      <h1 style={{ color: '#f0c674', fontSize: 48, marginBottom: 40, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>{rolling ? 'Бросок костей...' : 'Кости брошены!'}</h1>
      <div className="mobile-dice-grid" style={{ display: 'flex', gap: 40, marginBottom: 50 }}>
        {gameState.players.map((p: any) => (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={p.isAdmin ? 'dev-avatar-frame' : ''} style={{ marginBottom: 10 }}><img src={getAvatar(p.name)} style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', border: p.isAdmin ? 'none' : '2px solid #f0c674' }} /></div>
            <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 5 }}>{p.isAdmin && <span>👑</span>}<span className={p.isAdmin ? 'dev-nick' : ''} style={{ color: p.isAdmin ? undefined : 'white', fontWeight: 'bold' }}>{p.name}</span></div>
            <Dice value={gameState.diceRolls[p.id]} rolling={rolling} />
            <div style={{ marginTop: 15, fontSize: 20, fontWeight: 'bold', color: gameState.diceRolls[p.id] === maxRoll ? '#4caf50' : '#aaa' }}>{rolling ? '…' : gameState.diceRolls[p.id]}</div>
          </div>
        ))}
      </div>
      {!rolling && <div style={{ color: '#4caf50', fontSize: 28, fontWeight: 'bold', animation: 'fadeInScale 0.5s ease-out' }}>{winner ? `Первым ходит: ${winner.name}!` : 'Ничья! Перебрасываем...'}</div>}
    </div>
  );
};

export function Game({ socket, roomId, onInterruption, username, isAdmin = false, openDevConsole, onExit, onRematch, onWaitingRoom }: { socket: Socket, roomId: string, onInterruption: () => void, onWaitingRoom: (roomId: string | null) => void, username: string, isAdmin?: boolean, openDevConsole?: () => void, onExit: () => void, onRematch?: (opponent: string) => void }) {
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
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 820);
  const [confirmExit, setConfirmExit] = useState(false);
  const [premiumSettingsOpen, setPremiumSettingsOpen] = useState(false);

  const prevState = useRef<any>(null);
  const lastProcessedMsgId = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
            const count = isMobile ? 40 : 100;
            setMatchConfetti(Array.from({ length: count }).map((_, i) => ({
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
      onWaitingRoom(state.roundNumber === 0 && state.phase !== 'dice-roll' ? roomId : null);
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
    const onKicked = (msg: string) => { setErrorMsg(msg); if(kickedTimer) clearTimeout(kickedTimer); kickedTimer=setTimeout(onInterruption, 1500); };
    const onAdminRain = () => {
      playSound('rain'); const emojis = ['🎉', '🎊', '💰', '🍀', '👑', '🔥', '⭐', '💎', '🎁', '💵'];
      const count = isMobile ? 25 : 60;
      const newRain = Array.from({ length: count }).map((_, i) => ({ id: Date.now() + i, emoji: emojis[Math.floor(Math.random() * emojis.length)], left: Math.random() * 100, duration: 2 + Math.random() * 3 }));
      setRainEmojis(prev => [...prev, ...newRain]); setTimeout(() => { setRainEmojis(prev => prev.filter(e => !newRain.find(r => r.id === e.id))); }, 6000);
    };
    const onDevJoined = ({ name }: { name: string }) => { playSound('dev_join'); setDevJoinAlert(name); setTimeout(() => setDevJoinAlert(null), 4000); };
    const onAdminSecretFx = () => { playSound('secret'); setSecretFx(true); setTimeout(() => setSecretFx(false), 3500); };
    const onAdminGold = () => {
      playSound('gold'); const coins = ['💰', '🪙', '⭐', '💎', '✨', '👑', '🌟'];
      const count = isMobile ? 30 : 80;
      const newCoins = Array.from({ length: count }).map((_, i) => ({ id: Date.now() + i + Math.random(), emoji: coins[Math.floor(Math.random() * coins.length)], left: Math.random() * 100, duration: 2 + Math.random() * 2.5, size: 25 + Math.random() * 30 }));
      setGoldEmojis(prev => [...prev, ...newCoins]); setTimeout(() => { setGoldEmojis(prev => prev.filter(e => !newCoins.find(c => c.id === e.id))); }, 5500);
    };
    const onAdminReverse = () => { playSound('reverse'); setIsReversed(true); setTimeout(() => setIsReversed(false), 2000); };

    socket.on('game_state', onState); socket.on('error', onError); socket.on('chat_message', onChatMessage); socket.on('reaction', onReaction); socket.on('kicked', onKicked); socket.on('admin_rain', onAdminRain); socket.on('dev_joined', onDevJoined); socket.on('admin_secret_fx', onAdminSecretFx); socket.on('admin_gold', onAdminGold); socket.on('admin_reverse', onAdminReverse);
    const join = () => socket.emit('join_room',roomId);
    const onDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') onInterruption();
    };
    socket.on('disconnect', onDisconnect);
    socket.on('connect',join);
    if(socket.connected) join();
    
    return () => { 
      if(kickedTimer) clearTimeout(kickedTimer);
      socket.off('connect',join);
      socket.off('disconnect', onDisconnect);
      socket.off('game_state', onState); socket.off('error', onError); socket.off('chat_message', onChatMessage); socket.off('reaction', onReaction); socket.off('kicked', onKicked); socket.off('admin_rain', onAdminRain); socket.off('dev_joined', onDevJoined); socket.off('admin_secret_fx', onAdminSecretFx); socket.off('admin_gold', onAdminGold); socket.off('admin_reverse', onAdminReverse);
    };
  }, [socket, roomId, username, onInterruption, onWaitingRoom]);

  const sendMessage = (e: React.FormEvent) => { e.preventDefault(); if (!chatInput.trim()) return; socket.emit('chat_message', { roomId, sender: username, text: chatInput.trim() }); setChatInput(''); };
  const sendEmoji = (emoji: string) => { socket.emit('send_reaction', { roomId, emoji, sender: username }); setEmojiPickerOpen(false); };

  if (!gameState) return <div style={{ padding: 20, color: 'white', textAlign: 'center', fontSize: 24 }}>{errorMsg || 'Загрузка стола...'}<div><button onClick={onInterruption}>Выйти</button></div></div>;

  if (gameState.roundNumber === 0 && gameState.phase !== 'dice-roll') {
    return (
      <div className="mobile-screen" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, #1a1a2e 0%, #0f3460 100%)', color: 'white', padding: 20 }}>
        <style>{floatingEmojiStyle}</style>
        <div className="mobile-panel" style={{ background: 'rgba(37, 37, 64, 0.9)', padding: 40, borderRadius: 20, border: '2px solid #f0c674', textAlign: 'center', maxWidth: 400, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>⏳</div><h2 style={{ color: '#f0c674', margin: '0 0 20px 0' }}>Ожидание игроков...</h2>
          <p style={{ color: '#ccc', marginBottom: 20 }}>Отправьте ID комнаты другу, чтобы он присоединился</p>
          <div style={{ background: '#1a1a2e', padding: 15, borderRadius: 8, fontSize: 16, fontWeight: 'bold', overflowWrap:'anywhere', letterSpacing: 1, color: '#f0c674', marginBottom: 20 }}>{roomId}</div>
          <button onClick={()=>navigator.clipboard?.writeText(roomId).catch(()=>{})} style={{marginBottom:12,padding:'8px 16px',background:'transparent',border:'1px solid #f0c674',color:'#f0c674',borderRadius:8}}>Копировать ID</button>
          <button onClick={() => { playSound('click'); onExit(); }} style={{ padding: '12px 30px', background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: 8, fontSize: 16, cursor: 'pointer', width: '100%' }}>Отменить</button>
        </div>
      </div>
    );
  }

  const teamName = (side:string) => gameState.players.filter((p:any)=>p.side===side).map((p:any)=>p.name).join(' / ');
  if (gameState.phase === 'dice-roll') return <DiceRollScreen gameState={gameState} />;

  const voiceChat = <VoiceChat socket={socket} roomId={roomId} />;

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

    const mySide = gameState.players[gameState.me]?.side;
    const amIWinner = isFinished && ((scoreA >= 24 && mySide === 'B') || (scoreB >= 24 && mySide === 'A'));

    if (isFinished) {
      
      const tauntsWin = ['🏆 АБСОЛЮТНЫЙ ЧЕМПИОН! 🏆', '👑 Ты разнес их в пух и прах!', '🔥 Король стола, не иначе!', '💰 Забирай всё, ты лучший!'];
      const tauntsLose = ['💀 СЛИВ ЗАЩИТАН, БРАТИШКА 💀', '🤡 Иди учись играть, козёл!', '📉 Твоя бабушка играет лучше', '🗑️ Мусорка с тобой не согласна'];

      matchTitle = amIWinner ? tauntsWin[Math.floor(Math.random() * tauntsWin.length)] : tauntsLose[Math.floor(Math.random() * tauntsLose.length)];
      titleColor = amIWinner ? '#ffd700' : '#f44336';
      matchEmotion = amIWinner ? 'Ты заслужил эту победу. Отдыхай!' : 'Не расстраивайся, в следующий раз повезёт. Или нет.';
    }

    return (
      <LayoutGroup>
        {voiceChat}
        <div className="mobile-screen mobile-result" onClick={unlockGameAudio} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: isFinished ? (titleColor === '#ffd700' ? 'radial-gradient(circle, #2a2a10 0%, #0a0a05 100%)' : 'radial-gradient(circle, #2a1010 0%, #0a0505 100%)') : '#1a1a2e', position: 'relative', overflow: 'hidden' }}>
          <style>{floatingEmojiStyle}</style>
          {floatingEmojis.map(e => <div key={e.id} className="floating-emoji" style={{ left: `${e.left}%` }}>{e.emoji}</div>)}
          {rainEmojis.map(e => <div key={e.id} className="rain-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s` }}>{e.emoji}</div>)}
          {matchConfetti.map(e => <div key={e.id} className="gold-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s`, fontSize: 40 }}>{e.emoji}</div>)}

          <div className="mobile-panel" style={{ padding: 40, textAlign: 'center', color: 'white', maxWidth: 600, background: 'rgba(20, 20, 35, 0.95)', backdropFilter: 'blur(10px)', borderRadius: 16, boxShadow: isFinished ? `0 10px 30px rgba(0,0,0,0.8), 0 0 40px ${titleColor}40` : '0 10px 30px rgba(0,0,0,0.5)', border: `2px solid ${titleColor}`, zIndex: 10 }}>
            {amIWinner && <Goat3D celebrate />}
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
            {isFinished && gameState.mode === '1v1' && onRematch && gameState.players.some((p: any) => p.name !== username && p.name !== 'Ожидание...' && !p.name.includes('BOT')) && (
              <button onClick={() => { playSound('click'); const opponent = gameState.players.find((p: any) => p.name !== username)?.name; if (opponent) onRematch(opponent); }} style={{display:'block', width:'100%', marginBottom:12, padding:'14px 18px', background:'#4caf50', color:'white', fontWeight:'bold', border:0, borderRadius:8, cursor:'pointer', minHeight:48}}>🔄 Реванш — пригласить соперника</button>
            )}
            {isFinished ? <button onClick={() => { playSound('click'); onExit(); }} style={{ padding: '15px 40px', background: titleColor, border: 'none', borderRadius: 8, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', color: titleColor === '#ffd700' ? '#000' : '#fff' }}>Выйти в лобби</button> : <button onClick={() => { playSound('click'); if(socket.connected) socket.emit('next_round', roomId, gameState.stateVersion); }} style={{ padding: '15px 40px', background: '#f0c674', border: 'none', borderRadius: 8, fontSize: 20, fontWeight: 'bold', cursor: 'pointer' }}>Следующий кон</button>}
          </div>
        </div>
      </LayoutGroup>
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
  const passCount = gameState.mode === '1v1' && gameState.trick?.attacker === gameState.me
    ? 0 : Math.min(required, gameState.hand.length);
  const legalPass = selectedCards.length===passCount || (gameState.trick?.attacker===gameState.me && selectedCards.length===0);

  return (
    <LayoutGroup>
      <div className="mobile-game premium-game" onClick={unlockGameAudio} style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: '#101b32', position: 'relative', overflow: 'hidden',
        transform: isReversed ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.6s ease-in-out',
      }}>
        <div className="premium-voice-slot">{voiceChat}</div>
        <style>{floatingEmojiStyle}</style>
        {floatingEmojis.map(e => <div key={e.id} className="floating-emoji" style={{ left: `${e.left}%`, fontSize: isMobile ? 40 : 60 }}>{e.emoji}</div>)}
        {rainEmojis.map(e => <div key={e.id} className="rain-emoji" style={{ left: `${e.left}%`, animationDuration: `${e.duration}s`, fontSize: isMobile ? 30 : 50 }}>{e.emoji}</div>)}
        {goldEmojis.map(g => <div key={g.id} className="gold-emoji" style={{ left: `${g.left}%`, animationDuration: `${g.duration}s`, fontSize: isMobile ? Math.max(16, g.size * 0.6) : g.size }}>{g.emoji}</div>)}

        {secretFx && <div className="secret-overlay"><div className="secret-crown">👑</div><div className="secret-text">Создатель наблюдает за вами...</div><div className="secret-subtext">Удачи, смертные! 🃏</div></div>}

        {devJoinAlert && (
          <div className="dev-join-alert" style={{ position: 'fixed', top: isMobile ? '30%' : '40%', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #1a1a2e, #2a2410)', border: '3px solid #ffd700', borderRadius: 20, padding: isMobile ? '20px 30px' : '30px 60px', zIndex: 9999, textAlign: 'center', color: 'white', pointerEvents: 'none', maxWidth: '90vw' }}>
            <div style={{ fontSize: isMobile ? 40 : 60, marginBottom: 10 }}>👑</div><div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 'bold', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.8)' }}>{devNameDisplay(devJoinAlert)} вошёл в игру!</div>
          </div>
        )}

        {trumpAlert && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <h1 style={{ color: '#f0c674', fontSize: isMobile ? 28 : 48, marginBottom: isMobile ? 20 : 40, padding: '0 20px' }}>{isMobile ? 'Козырь сменился!' : 'Козырь сменился!'}</h1>
            <div style={{ transform: isMobile ? 'scale(1.4)' : 'scale(2)' }}><CardView card={trumpAlert} className="animate-fly-to-table" /></div>
          </div>
        )}

        <div className={`mobile-chat ${chatOpen ? "mobile-chat-open" : ""}`} style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 100 }}>
          {chatOpen ? (
            <div className="mobile-chat-panel" style={{ width: isMobile ? '100vw' : 300, height: isMobile ? '55dvh' : 400, maxWidth: isMobile ? '100vw' : 300, background: '#252540', borderRadius: isMobile ? '20px 20px 0 0' : 12, border: '2px solid #f0c674', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', position: isMobile ? 'fixed' : 'relative', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : 'auto', right: isMobile ? 0 : 'auto', maxHeight: isMobile ? '65dvh' : 'none' }}>
              <div style={{ padding: isMobile ? '12px 10px 8px' : '10px', background: '#1a1a2e', borderTopLeftRadius: isMobile ? 0 : 10, borderTopRightRadius: isMobile ? 0 : 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444' }}>
                {isMobile && <div style={{ width: 40, height: 4, background: '#555', borderRadius: 2, margin: '0 auto 8px' }} />}
                <span style={{ fontWeight: 'bold', color: '#f0c674' }}>💬 Чат</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {isDev && openDevConsole && <button onClick={openDevConsole} title="Dev Console" style={{ background: 'transparent', border: 'none', color: '#ffd700', cursor: 'pointer', fontSize: 16, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🛠️</button>}
                  <button onClick={() => { playSound('click'); setChatOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 22, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>✖</button>
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

        <div className="premium-frame">
          <header className="premium-topbar">
            <div className="premium-mode-badge">{gameState.mode === '1v1' ? '1 × 1' : '2 × 2'}</div>
            <div className="premium-topbar-center">
              <span>Кон {gameState.roundNumber || 1}</span>
              <span className={timeLeft <= 5 ? 'premium-timer premium-timer--warning' : 'premium-timer'}>⏱ {timeLeft} с</span>
            </div>
            <div className="premium-topbar-actions">
              {isDev && openDevConsole && <button type="button" className="premium-icon-button" onClick={openDevConsole} title="Dev Console">🛠</button>}
              <button type="button" className="premium-icon-button" onClick={() => setPremiumSettingsOpen(v => !v)} title="Настройки стола" aria-label="Настройки стола" aria-expanded={premiumSettingsOpen}>⚙</button>
            </div>
          </header>
          {premiumSettingsOpen && (
            <div className="premium-settings-panel">
              <div>Комната: <span>{roomId.slice(0,8)}…</span></div>
              <button type="button" onClick={() => navigator.clipboard?.writeText(roomId).catch(()=>{})}>Копировать ID</button>
              <button type="button" onClick={() => {setPremiumSettingsOpen(false);setConfirmExit(true);}}>Выйти из партии</button>
              <button type="button" onClick={() => setPremiumSettingsOpen(false)}>Закрыть</button>
            </div>
          )}
          <main className="premium-felt">
            <div className={'premium-other-players premium-other-players--' + gameState.mode}>
              {gameState.players.filter((p: any) => p.id !== gameState.me).map((p: any) => (
                <div className={'premium-seat' + (p.side === gameState.players[gameState.me]?.side ? ' premium-seat--teammate' : '')} key={p.id}>
                  <div className={'premium-seat-name' + (p.id === gameState.currentPlayer ? ' premium-seat-name--turn' : '')}>
                    <img src={getAvatar(p.name)} alt="" />
                    <span className="premium-status-dot" aria-label={p.connected ? 'В сети' : 'Не в сети'} style={{background:p.connected ? '#22d45b' : '#777'}} />
                    <span className="premium-seat-username">{p.name}{p.isAdmin ? ' 👑' : ''}</span>
                    {gameState.mode === '2v2' && <span className="premium-seat-team">{p.side === gameState.players[gameState.me]?.side ? 'Союзник' : 'Соперник'}</span>}
                  </div>
                  <OpponentCardBacks count={p.handCount} compact={isMobile || gameState.mode === '2v2'} />
                </div>
              ))}
            </div>
            <div className="premium-trump-label">Козырь: <strong>{gameState.trump || '—'}</strong></div>
            <div className="premium-table-zone">
              <div className="premium-trick-playarea">
                {gameState.trick ? (
                  <>
                    <div className="premium-last-player">Ходил: {gameState.players[gameState.trick.attacker]?.name}</div>
                    <div className="premium-trick-cards">
                      {gameState.trick.cardsOnTable.map((card: any, i: number) => (
                        <motion.div key={i} layoutId={card.rank + '_' + card.suit} style={{zIndex:i,marginLeft:i ? (isMobile ? -12 : -16) : 0}}>
                          <CardView card={card} />
                        </motion.div>
                      ))}
                    </div>
                  </>
                ) : <span className="premium-waiting">Ожидание хода…</span>}
              </div>
              <div className="premium-deck-zone">
                <div className="premium-deck-stack">
                  {gameState.deckCount > 0 && <div className="carpet-card-back premium-deck-card" />}
                  {gameState.trumpCard && <div className="premium-deck-trump"><CardView card={gameState.trumpCard} small /></div>}
                </div>
                <span className="premium-count-badge">{gameState.deckCount}</span>
                <span className="premium-deck-text">Колода</span>
              </div>
            </div>
            <div className="premium-team-scores">
              <span>Бита А: {gameState.bitaCount?.A || 0}</span>
              <span>Бита Б: {gameState.bitaCount?.B || 0}</span>
            </div>
            <div className="premium-hand-zone">
              <div className="premium-hand" aria-label="Ваши карты">
                {gameState.hand.map((card: any, index: number) => {
                  const selected = selectedCards.some(c => c.suit === card.suit && c.rank === card.rank);
                  const cardStr = card.rank + '_' + card.suit;
                  const isLegal = gameState.legalMoves?.some((move: string[]) => move.includes(cardStr));
                  const center = (gameState.hand.length - 1) / 2;
                  return (
                    <motion.div key={card.rank + card.suit} layoutId={cardStr}
                      className="premium-hand-item"
                      style={{zIndex:index+1,marginLeft:index === 0 ? 0 : (isMobile ? -13 : -11)}}
                      initial={{y:70,opacity:0,rotate:0}}
                      animate={{y:selected ? -17 : Math.abs(index-center)*2,opacity:1,rotate:(index-center)*3}}
                      transition={{type:'spring',stiffness:140,damping:20}}>
                      <CardView card={card} selected={selected} onClick={() => toggleCard(card)} isLegal={isLegal} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </main>
          <footer className="premium-footer">
            <div className="premium-self">
              <img src={getAvatar(username)} alt="" />
              <div><span className="premium-status-dot" /> Вы</div>
            </div>
            <div className="premium-actions">
              {isMyTurn && !gameState.trick && (
                <button type="button" className="premium-action premium-action--gold" onClick={playCards} disabled={!legalSelection}>Ход</button>
              )}
              {isMyTurn && gameState.trick && (
                <button type="button" className="premium-action premium-action--gold" onClick={beat} disabled={!legalSelection}>Бить</button>
              )}
              {isMyTurn && gameState.trick && (
                <button type="button" className="premium-action premium-action--dark" onClick={bita} disabled={!legalPass}>Пас</button>
              )}
              {!isMyTurn && <span className="premium-wait-turn">⏳ Ход соперника</span>}
              {isMyTurn && gameState.trick && !legalPass && gameState.trick.attacker !== gameState.me &&
                <span className="premium-selection-help">Выдели {passCount} карт</span>}
              <button type="button" className="premium-exit-button" onClick={() => setConfirmExit(true)}>Выйти</button>
            </div>
          </footer>
          {errorMsg && <div className="premium-error" role="alert">{errorMsg}</div>}
        </div>
      </div>
      {confirmExit && (
        <div role="presentation" style={{ position:'fixed', inset:0, zIndex:10010, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="exit-title" style={{ background:'#22243e', border:'2px solid #f0c674', borderRadius:16, maxWidth:400, width:'100%', padding:24, textAlign:'center', color:'white' }}>
            <h2 id="exit-title" style={{ color:'#f0c674', marginTop:0 }}>Ты чё, сливаешься?</h2>
            <p>Ты лох и хочешь покинуть игру или ты норм пацан и продолжаем игру?</p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginTop:22 }}>
              <button onClick={() => { setConfirmExit(false); onExit(); }} style={{ padding:'14px 18px', borderRadius:9, border:'1px solid #aaa', background:'#404052', color:'white', cursor:'pointer', minHeight:48 }}>😅 Да, выхожу</button>
              <button autoFocus onClick={() => setConfirmExit(false)} style={{ padding:'14px 18px', borderRadius:9, border:'none', background:'#277447', color:'white', fontWeight:700, cursor:'pointer', minHeight:48 }}>😎 Я в игре!</button>
            </div>
          </div>
        </div>
      )}
    </LayoutGroup>
  );
}

function devNameDisplay(name: string) {
  return '👑 ' + name;
}