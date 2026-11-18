import React, { useEffect, useState } from 'react';

// --- МУЗЫКАЛЬНЫЙ СИНТЕЗАТОР ---
let musicCtx: AudioContext | null = null;
let musicInterval: any = null;

const startMusic = () => {
  if (!musicCtx) {
    musicCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (musicCtx.state === 'suspended') musicCtx.resume();
  if (musicInterval) return;

  const chords = [
    [261.63, 329.63, 392.00, 493.88],
    [220.00, 261.63, 329.63, 392.00],
    [174.61, 220.00, 261.63, 349.23],
    [196.00, 246.94, 293.66, 392.00]
  ];
  let chordIndex = 0;

  const playChord = () => {
    if (!musicCtx || musicCtx.state !== 'running') return;
    const now = musicCtx.currentTime;
    const currentChord = chords[chordIndex];
    chordIndex = (chordIndex + 1) % chords.length;

    currentChord.forEach((freq, i) => {
      const osc = musicCtx!.createOscillator();
      const gain = musicCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1); 
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.04, now + i * 0.1 + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
      osc.connect(gain);
      gain.connect(musicCtx!.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + 4);
    });
  };

  playChord();
  musicInterval = setInterval(playChord, 4000);
};

const stopMusic = () => {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
};

// --- КРУПЬЕ С СИГАРЕТОЙ (БЕЗ ИСКР) ---
const Croupier = ({ color, side }: { color: string, side: 'left' | 'right' }) => (
  <svg viewBox="0 0 200 400" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 20px rgba(240, 198, 116, 0.15))', transform: side === 'left' ? 'none' : 'scaleX(-1)' }}>
    <ellipse cx="100" cy="380" rx="70" ry="15" fill="rgba(0,0,0,0.5)" />
    <path d="M40,140 C40,140 50,380 60,380 L140,380 C150,380 160,140 160,140 Z" fill={color} stroke="#f0c674" strokeWidth="3"/>
    <path d="M70,140 L100,170 L130,140 L100,190 Z" fill="#ffffff" />
    <path d="M85,145 L100,155 L115,145 L100,165 Z" fill="#111" />
    <path d="M85,145 L95,150 L95,160 L85,155 Z" fill="#111" />
    <path d="M115,145 L105,150 L105,160 L115,155 Z" fill="#111" />
    <circle cx="100" cy="90" r="45" fill="#e0b086" />
    <path d="M 55 90 C 55 40, 145 40, 145 90 C 145 65, 130 50, 100 50 C 70 50, 55 65, 55 90 Z" fill="#22223b" />
    <circle cx="53" cy="95" r="8" fill="#e0b086" />
    <circle cx="147" cy="95" r="8" fill="#e0b086" />
    
    <g className="croupier-eye">
      <circle cx="80" cy="85" r="5" fill="#111" />
      <circle cx="120" cy="85" r="5" fill="#111" />
      <circle cx="82" cy="83" r="2" fill="#fff" />
      <circle cx="122" cy="83" r="2" fill="#fff" />
    </g>
    
    <g className="croupier-brow">
      <path d="M 70 75 Q 80 70 90 78" fill="none" stroke="#22223b" strokeWidth="3" strokeLinecap="round" />
      <path d="M 110 75 Q 120 70 130 75" fill="none" stroke="#22223b" strokeWidth="3" strokeLinecap="round" />
    </g>
    
    <path d="M 100 85 L 95 102 L 105 102" fill="none" stroke="#c08a63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* УХМЫЛКА */}
    <path className="croupier-mouth" d="M 85 115 Q 100 125 115 110" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />

    {/* СИГАРЕТА И ОГОНЕК (БЕЗ ИСКР) */}
    <g transform="rotate(-15, 110, 108)">
      {/* Бумага сигареты */}
      <rect x="110" y="108" width="20" height="5" rx="2" fill="#f4f4f4" stroke="#ccc" strokeWidth="1"/>
      {/* Фильтр */}
      <rect x="110" y="108" width="6" height="5" rx="2" fill="#d2b48c" stroke="#a0522d" strokeWidth="1"/>
      
      {/* Тлеющий огонек (ровный) */}
      <circle cx="130" cy="110.5" r="3" fill="#ff4500" filter="blur(0.5px)"/>
      <circle cx="130" cy="110.5" r="1.5" fill="#ffff00" />
    </g>

    {/* ДЫМ (вынесен из вращающейся группы) */}
    <g className="smoke-puff" style={{ transformOrigin: '130px 108px' }}>
      <path d="M130,108 Q140,90 120,70 T130,40" fill="none" stroke="rgba(200,200,200,0.4)" strokeWidth="4" strokeLinecap="round" filter="blur(2px)"/>
    </g>
    <g className="smoke-puff" style={{ transformOrigin: '130px 108px', animationDelay: '1.5s' }}>
      <path d="M130,108 Q115,85 135,60 T120,30" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="5" strokeLinecap="round" filter="blur(3px)"/>
    </g>

    <g transform={side === 'left' ? 'translate(135, 210)' : 'translate(65, 210)'}>
      <path d="M0,-10 C30,10 30,50 10,70" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"/>
      <path d="M-10,0 C-30,20 -30,60 -10,80" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"/>
      <circle cx="5" cy="45" r="15" fill="#e0b086" />
      <g transform="rotate(-15, 0, 45)">
        <rect x="-18" y="25" width="36" height="55" rx="4" fill="#800000" stroke="#f0c674" strokeWidth="2"/>
        <line x1="-10" y1="30" x2="10" y2="30" stroke="#f0c674" strokeWidth="1" opacity="0.5"/>
        <line x1="-10" y1="35" x2="10" y2="35" stroke="#f0c674" strokeWidth="1" opacity="0.5"/>
        <line x1="-10" y1="40" x2="10" y2="40" stroke="#f0c674" strokeWidth="1" opacity="0.5"/>
        <rect x="-6" y="45" width="12" height="15" fill="none" stroke="#f0c674" strokeWidth="1" opacity="0.7" rx="2"/>
      </g>
    </g>
  </svg>
);

// --- ЛЮСТРА ---
const Chandelier = ({ scale = 1, y = 0 }: { scale?: number, y?: number }) => (
  <svg viewBox="0 0 200 300" style={{ width: `${200 * scale}px`, height: `${300 * scale}px`, transform: `translateY(${y}px)`, filter: 'drop-shadow(0 0 15px rgba(240, 198, 116, 0.2))' }}>
    <line x1="100" y1="0" x2="100" y2="80" stroke="#c7a252" strokeWidth="4" strokeDasharray="6,2"/>
    <path d="M 80 80 L 120 80 L 110 130 L 90 130 Z" fill="#b8860b" stroke="#f0c674" strokeWidth="2" />
    <g className="flickering-light" style={{ animationDelay: '0s' }}>
      <circle cx="100" cy="150" r="15" fill="#ffd700" filter="blur(3px)" />
      <circle cx="100" cy="150" r="8" fill="#fff" />
    </g>
    <path d="M 80 90 C 40 90, 30 130, 30 170" fill="none" stroke="#b8860b" strokeWidth="4" strokeLinecap="round" />
    <path d="M 120 90 C 160 90, 170 130, 170 170" fill="none" stroke="#b8860b" strokeWidth="4" strokeLinecap="round" />
    <path d="M 90 100 C 60 110, 60 140, 60 180" fill="none" stroke="#b8860b" strokeWidth="4" strokeLinecap="round" />
    <path d="M 110 100 C 140 110, 140 140, 140 180" fill="none" stroke="#b8860b" strokeWidth="4" strokeLinecap="round" />
    {[30, 60, 140, 170].map((x, i) => (
      <g key={i} className="flickering-light" style={{ animationDelay: `${i * 0.8}s` }}>
        <rect x={x - 5} y={i < 2 ? 160 : 170} width="10" height="20" fill="#fdf5e6" />
        <circle cx={x} cy={i < 2 ? 155 : 165} r="8" fill="#ffeb3b" filter="blur(3px)" />
        <circle cx={x} cy={i < 2 ? 155 : 165} r="4" fill="#fff" />
      </g>
    ))}
    {[40, 80, 120, 160].map((x, i) => (
      <polygon key={i} points={`${x},140 ${x+6},150 ${x},170 ${x-6},150`} fill="#e0f7fa" opacity="0.8" />
    ))}
  </svg>
);

// --- ПРЕМИАЛЬНАЯ КАРТА ---
const PremiumCard = ({ rank, suit, color }: { rank: string, suit: string, color: string }) => (
  <div className="premium-card">
    <div className="card-inner-border" />
    <div className="card-corner top-left">
      <div className="corner-rank" style={{ color }}>{rank}</div>
      <div className="corner-suit" style={{ color }}>{suit}</div>
    </div>
    <div className="card-center-suit" style={{ color }}>{suit}</div>
    <div className="card-corner bottom-right">
      <div className="corner-rank" style={{ color }}>{rank}</div>
      <div className="corner-suit" style={{ color }}>{suit}</div>
    </div>
  </div>
);

export function MenuBackground() {
  const [musicOn, setMusicOn] = useState(true);

  useEffect(() => {
    if (musicOn) startMusic();
    return () => stopMusic();
  }, [musicOn]);

  const toggleMusic = () => {
    if (musicOn) {
      stopMusic();
      setMusicOn(false);
    } else {
      startMusic();
      setMusicOn(true);
    }
  };

  const [cards] = useState(() => {
    const suits = [
      { char: '♠', color: '#000' }, 
      { char: '♥', color: '#d32f2f' }, 
      { char: '♦', color: '#d32f2f' }, 
      { char: '♣', color: '#000' }
    ];
    const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    return Array.from({ length: 20 }).map((_, i) => {
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      
      return {
        id: i,
        rank,
        suit: suit.char,
        color: suit.color,
        delay: `${i * 0.6}s`,
        direction: i % 2 === 0 ? 'right' : 'left', 
        duration: `${4 + Math.random() * 2}s`
      };
    });
  });

  return (
    <>
      <style>
        {`
          .casino-stage {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
            background: radial-gradient(circle at 50% 0%, #1e3a2a 0%, #0d1b14 60%, #050a08 100%);
          }

          .croupier-left { position: absolute; left: 0px; bottom: 0px; width: 350px; height: 550px; z-index: 2; }
          .croupier-right { position: absolute; right: 0px; bottom: 0px; width: 350px; height: 550px; z-index: 2; }

          @media (max-width: 820px), (pointer: coarse) and (max-height: 600px) {
            .croupier-left { width: 200px; height: 320px; }
            .croupier-right { width: 200px; height: 320px; }
          }
          @media (max-width: 480px) {
            .croupier-left { width: 150px; height: 240px; }
            .croupier-right { width: 150px; height: 240px; }
          }
          @media (pointer: coarse) and (orientation: landscape) and (max-height: 600px) {
            .croupier-left { width: 120px; height: 190px; }
            .croupier-right { width: 120px; height: 190px; }
          }

          .chandelier-pos-1 { position: absolute; top: -50px; left: 50%; transform: translateX(-50%); opacity: 0.5; z-index: 1; }
          .chandelier-pos-2 { position: absolute; top: -20px; left: 10%; opacity: 0.7; z-index: 1; }
          .chandelier-pos-3 { position: absolute; top: -20px; right: 10%; opacity: 0.7; z-index: 1; }

          @media (max-width: 820px), (pointer: coarse) and (max-height: 600px) {
            .chandelier-pos-1 { opacity: 0.2; }
            .chandelier-pos-2 { opacity: 0.3; }
            .chandelier-pos-3 { opacity: 0.3; }
          }
          @media (pointer: coarse) and (orientation: landscape) and (max-height: 600px) {
            .chandelier-pos-1, .chandelier-pos-2, .chandelier-pos-3 { display: none; }
          }

          /* АНИМАЦИЯ МЕРЦАНИЯ СВЕТА */
          @keyframes lightFlicker {
            0% { opacity: 0.8; filter: brightness(0.9); }
            50% { opacity: 1; filter: brightness(1.2); }
            100% { opacity: 0.8; filter: brightness(0.9); }
          }
          .flickering-light { animation: lightFlicker 5s infinite ease-in-out; }

          /* АНИМАЦИЯ ДЫМА */
          @keyframes smokeRise {
            0% { transform: translateY(0) scale(0.8); opacity: 0; }
            20% { opacity: 0.6; }
            100% { transform: translateY(-60px) scale(2.5); opacity: 0; }
          }
          .smoke-puff { animation: smokeRise 4s infinite linear; }

          /* АНИМАЦИЯ ЛИЦА */
          @keyframes blinkAnim { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
          @keyframes browAnim { 0%, 90%, 100% { transform: translateY(0); } 93% { transform: translateY(-4px); } }
          @keyframes smirkAnim { 0%, 100% { transform: scaleX(1) translateY(0); } 50% { transform: scaleX(1.1) translateY(-1px); } }

          .croupier-eye { transform-origin: center; animation: blinkAnim 5s infinite; }
          .croupier-brow { transform-origin: center; animation: browAnim 6s infinite; }
          .croupier-mouth { transform-origin: center; animation: smirkAnim 7s infinite ease-in-out; }
          .croupier-right .croupier-eye { animation-delay: 2s; animation-duration: 4.5s; }
          .croupier-right .croupier-brow { animation-delay: 3s; animation-duration: 7s; }
          .croupier-right .croupier-mouth { animation-delay: 1.5s; animation-duration: 8s; }

          /* --- ЛЕТАЮЩИЕ КАРТЫ --- */
          .flying-card {
            position: absolute;
            width: 85px;
            height: 125px;
            bottom: 250px;
            opacity: 0;
            z-index: 10;
            will-change: transform, opacity;
            transform: translateZ(0);
          }

          @media (max-width: 820px), (pointer: coarse) and (max-height: 600px) {
            .flying-card {
              width: 50px;
              height: 75px;
              bottom: 180px;
            }
          }
          @media (max-width: 480px) {
            .flying-card {
              width: 38px;
              height: 56px;
              bottom: 140px;
            }
          }
          @media (pointer: coarse) and (orientation: landscape) and (max-height: 600px) {
            .flying-card {
              width: 35px;
              height: 52px;
              bottom: 120px;
              opacity: 0.3;
            }
          }

          .premium-card {
            width: 100%;
            height: 100%;
            background: #ffffff;
            border-radius: 8px;
            position: relative;
            box-shadow: 
              0 15px 35px rgba(0,0,0,0.8), 
              0 0 20px rgba(240, 198, 116, 0.4),
              0 0 0 2px #c7a252;
            overflow: hidden;
            display: flex;
            justify-content: space-between;
            flex-direction: column;
          }

          .card-inner-border {
            position: absolute;
            top: 5px; left: 5px; right: 5px; bottom: 5px;
            border: 1.5px solid #d4af37;
            border-radius: 6px;
            opacity: 0.8;
            pointer-events: none;
          }

          .card-corner {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1;
            font-family: Arial, sans-serif;
          }

          .top-left { top: 8px; left: 8px; }
          .bottom-right { bottom: 8px; right: 8px; transform: rotate(180deg); }

          .corner-rank { font-size: 24px; font-weight: 900; }
          .corner-suit { font-size: 20px; margin-top: 0px; }

          .card-center-suit {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 70px;
            opacity: 0.2;
            pointer-events: none;
          }

          @keyframes throwRight {
            0% { left: 130px; transform: translate(0, 0) rotate(-15deg) scale(0.8); opacity: 0; }
            10% { opacity: 1; }
            50% { left: 50vw; transform: translate(-50%, -150px) rotate(15deg) scale(1.1); opacity: 1; }
            90% { opacity: 1; }
            100% { left: calc(100vw - 130px); transform: translate(-100%, 0) rotate(30deg) scale(0.8); opacity: 0; }
          }
          @keyframes throwLeft {
            0% { right: 130px; transform: translate(0, 0) rotate(15deg) scale(0.8); opacity: 0; }
            10% { opacity: 1; }
            50% { right: 50vw; transform: translate(50%, -150px) rotate(-15deg) scale(1.1); opacity: 1; }
            90% { opacity: 1; }
            100% { right: calc(100vw - 130px); transform: translate(100%, 0) rotate(-30deg) scale(0.8); opacity: 0; }
          }

          @media (max-width: 820px), (pointer: coarse) and (max-height: 600px) {
            @keyframes throwRight {
              0% { left: 60px; transform: translate(0, 0) rotate(-10deg) scale(0.7); opacity: 0; }
              10% { opacity: 0.8; }
              50% { left: 50vw; transform: translate(-50%, -80px) rotate(10deg) scale(0.9); opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { left: calc(100vw - 60px); transform: translate(-100%, 0) rotate(20deg) scale(0.7); opacity: 0; }
            }
            @keyframes throwLeft {
              0% { right: 60px; transform: translate(0, 0) rotate(10deg) scale(0.7); opacity: 0; }
              10% { opacity: 0.8; }
              50% { right: 50vw; transform: translate(50%, -80px) rotate(-10deg) scale(0.9); opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { right: calc(100vw - 60px); transform: translate(100%, 0) rotate(-20deg) scale(0.7); opacity: 0; }
            }
          }
          @media (max-width: 480px) {
            @keyframes throwRight {
              0% { left: 40px; transform: translate(0, 0) rotate(-8deg) scale(0.6); opacity: 0; }
              10% { opacity: 0.6; }
              50% { left: 50vw; transform: translate(-50%, -50px) rotate(8deg) scale(0.8); opacity: 0.6; }
              90% { opacity: 0.6; }
              100% { left: calc(100vw - 40px); transform: translate(-100%, 0) rotate(15deg) scale(0.6); opacity: 0; }
            }
            @keyframes throwLeft {
              0% { right: 40px; transform: translate(0, 0) rotate(8deg) scale(0.6); opacity: 0; }
              10% { opacity: 0.6; }
              50% { right: 50vw; transform: translate(50%, -50px) rotate(-8deg) scale(0.8); opacity: 0.6; }
              90% { opacity: 0.6; }
              100% { right: calc(100vw - 40px); transform: translate(100%, 0) rotate(-15deg) scale(0.6); opacity: 0; }
            }
          }

          .fly-right { animation: throwRight linear infinite; }
          .fly-left { animation: throwLeft linear infinite; }

          .music-btn {
            position: fixed;
            bottom: 20px; left: 20px;
            background: rgba(37, 37, 64, 0.8);
            border: 2px solid #f0c674;
            color: #f0c674;
            width: 50px; height: 50px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; cursor: pointer; z-index: 9999;
            backdrop-filter: blur(5px); transition: 0.2s;
          }
          .music-btn:hover { transform: scale(1.1); background: #f0c674; color: #000; }

          .center-shadow {
            position: absolute; inset: 0;
            background: radial-gradient(circle at center, rgba(13,13,26,0.7) 0%, transparent 70%);
            pointer-events: none; z-index: 5; 
          }
        `}
      </style>

      <div className="casino-stage">
        <div className="chandelier-pos-1"><Chandelier scale={0.8} /></div>
        <div className="chandelier-pos-2"><Chandelier scale={1} /></div>
        <div className="chandelier-pos-3"><Chandelier scale={1} /></div>

        <div className="croupier-left"><Croupier color="#d32f2f" side="left" /></div>
        <div className="croupier-right"><Croupier color="#2e7d32" side="right" /></div>

        {cards.map(c => (
          <div 
            key={c.id} 
            className={`flying-card ${c.direction === 'right' ? 'fly-right' : 'fly-left'}`}
            style={{ animationDelay: c.delay, animationDuration: c.duration }}
          >
            <PremiumCard rank={c.rank} suit={c.suit} color={c.color} />
          </div>
        ))}

        <div className="center-shadow" />
      </div>

      <button className="music-btn" onClick={toggleMusic} title="Включить/Выключить музыку">
        {musicOn ? '🔊' : '🔇'}
      </button>
    </>
  );
}