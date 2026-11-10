import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

const DEV_NAME = 'Vladislav';

const COMMANDS = [
  { cmd: '/gold', desc: '💰 Золотой дождь (только тебе)' },
  { cmd: '/whoami', desc: '👤 Отладочная инфа о тебе' },
  { cmd: '/freeze [ник]', desc: '❄️ Заморозить таймер игрока' },
  { cmd: '/reverse', desc: '🔄 Перевернуть стол у всех' },
  { cmd: '/broadcast [текст]', desc: '📢 Анонс всем комнатам' },
  { cmd: '/listrooms', desc: '📋 Список всех активных комнат' },
  { cmd: '/spawnbot', desc: '🤖 Создать DEV-комнату с ботом' },
];

const consoleStyles = `
@keyframes dcFadeIn {
  0% { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
.dev-console-overlay {
  position: fixed; inset: 0; z-index: 10002;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.dev-console-window {
  background: #0a0a0a; border: 2px solid #00ff41;
  border-radius: 12px; width: 100%; max-width: 720px; max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 0 40px rgba(0,255,65,0.3), inset 0 0 30px rgba(0,255,65,0.05);
  animation: dcFadeIn 0.2s ease-out;
  font-family: 'Consolas', 'Courier New', monospace;
}
.dev-console-header {
  padding: 12px 18px; border-bottom: 1px solid #00ff41;
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(0,255,65,0.05);
}
.dev-console-title {
  color: #00ff41; font-weight: bold; font-size: 16px;
  text-shadow: 0 0 10px rgba(0,255,65,0.6);
}
.dev-console-log {
  flex: 1; overflow-y: auto; padding: 15px 18px;
  color: #00ff41; font-size: 13px; line-height: 1.6;
  min-height: 200px;
}
.dev-console-log::-webkit-scrollbar { width: 8px; }
.dev-console-log::-webkit-scrollbar-track { background: #111; }
.dev-console-log::-webkit-scrollbar-thumb { background: #00ff41; border-radius: 4px; }
.dc-line { margin-bottom: 4px; word-break: break-word; }
.dc-line-info { color: #00ff41; }
.dc-line-error { color: #ff3b3b; }
.dc-line-success { color: #00ffaa; }
.dc-line-input { color: #ffffff; opacity: 0.8; }
.dc-line-system { color: #888; font-style: italic; }
.dev-console-quick {
  padding: 10px 18px; border-top: 1px solid #1a1a1a;
  display: flex; flex-wrap: wrap; gap: 6px;
}
.dc-quick-btn {
  background: transparent; color: #00ff41; border: 1px solid #00ff41;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;
  font-family: inherit; transition: 0.15s;
}
.dc-quick-btn:hover { background: #00ff41; color: #000; }
.dev-console-input-wrap {
  padding: 12px 18px; border-top: 1px solid #00ff41;
  display: flex; align-items: center; gap: 8px;
}
.dc-prompt { color: #00ff41; font-weight: bold; }
.dev-console-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #00ff41; font-family: inherit; font-size: 14px; caret-color: #00ff41;
}
.dev-console-input::placeholder { color: rgba(0,255,65,0.4); }
.dc-hint {
  padding: 8px 18px; font-size: 11px; color: #666;
  border-top: 1px dashed #1a1a1a;
}
`;

export function DevConsole({ socket, username, onClose }: { socket: Socket, username: string, onClose: () => void }) {
  const [input, setInput] = useState('');
  const [log, setLog] = useState<{ text: string; type: 'info' | 'error' | 'success' | 'input' | 'system' }[]>([
    { text: `> Dev Console v1.0 — привет, ${username}`, type: 'system' },
    { text: `> Введи команду или кликни по быстрой кнопке ниже`, type: 'system' },
    { text: `> Закрыть: ESC или ✖`, type: 'system' },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onResult = (data: { command: string; text: string; type?: 'info' | 'error' | 'success' }) => {
      setLog(prev => [...prev, { text: data.text, type: data.type || 'info' }]);
    };

    const onDevRoomCreated = ({ roomId }: { roomId: string }) => {
      setLog(prev => [...prev, { text: `✅ Комната ${roomId} создана. Перехожу в игру...`, type: 'success' }]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    socket.on('dev_command_result', onResult);
    socket.on('dev_room_created', onDevRoomCreated);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      socket.off('dev_command_result', onResult);
      socket.off('dev_room_created', onDevRoomCreated);
    };
  }, [socket, onClose]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [log]);

  const execute = (rawCommand: string) => {
    const cmd = rawCommand.trim();
    if (!cmd) return;
    if (!cmd.startsWith('/')) {
      setLog(prev => [...prev, { text: `> ${cmd}`, type: 'input' }, { text: 'Команда должна начинаться с /', type: 'error' }]);
      setInput('');
      return;
    }
    setLog(prev => [...prev, { text: `> ${cmd}`, type: 'input' }]);
    socket.emit('dev_command', { username, command: cmd });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); execute(input); }
    if (e.key === 'ArrowUp') { e.preventDefault(); /* можно историю добавить позже */ }
  };

  return (
    <div className="dev-console-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{consoleStyles}</style>
      <div className="dev-console-window">
        <div className="dev-console-header">
          <span className="dev-console-title">🛠️ DEV CONSOLE</span>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #00ff41', color: '#00ff41', padding: '2px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>✖ ESC</button>
        </div>

        <div className="dev-console-log" ref={logRef}>
          {log.map((line, i) => (
            <div key={i} className={`dc-line dc-line-${line.type}`}>
              {line.type === 'input' ? line.text : `[${line.type.toUpperCase()}] ${line.text}`}
            </div>
          ))}
        </div>

        <div className="dev-console-quick">
          {COMMANDS.map(c => (
            <button
              key={c.cmd}
              className="dc-quick-btn"
              title={c.desc}
              onClick={() => { execute(c.cmd); inputRef.current?.focus(); }}
            >
              {c.cmd}
            </button>
          ))}
        </div>

        <div className="dev-console-input-wrap">
          <span className="dc-prompt">$</span>
          <input
            ref={inputRef}
            className="dev-console-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Введи команду... (например, /whoami)"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={() => execute(input)}
            style={{ background: '#00ff41', color: '#000', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}
          >⏎</button>
        </div>

        <div className="dc-hint">
          <b>Доступные:</b> {COMMANDS.map(c => c.cmd.split(' ')[0]).join(' · ')}
        </div>
      </div>
    </div>
  );
}