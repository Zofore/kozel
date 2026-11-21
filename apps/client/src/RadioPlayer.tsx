import React, { useEffect, useRef, useState } from 'react';
import './radio.css';

type Station = { id: string; name: string; url: string };

// Operators can override the default public streams at build time.
const configured: Station[] = [
  { id: 'kozel', name: 'Козёл FM', url: import.meta.env.VITE_KOZEL_FM_URL || '' },
  { id: 'russkoe', name: 'Русское Радио', url: import.meta.env.VITE_RADIO_RUSSKOE_URL ?? 'https://rusradio.hostingradio.ru/rusradio96.aacp' },
  { id: 'europa', name: 'Европа Плюс', url: import.meta.env.VITE_RADIO_EUROPA_URL ?? 'https://europaplus.hostingradio.ru:8030/ep128' },
  { id: 'avto', name: 'Авторадио', url: import.meta.env.VITE_RADIO_AVTO_URL ?? 'https://a2.radioheart.ru:8015/relay' },
  { id: 'retro', name: 'Ретро FM', url: import.meta.env.VITE_RADIO_RETRO_URL || '' },
  { id: 'energy', name: 'Радио ENERGY', url: import.meta.env.VITE_RADIO_ENERGY_URL || '' },
  { id: 'nashe', name: 'Наше Радио', url: import.meta.env.VITE_RADIO_NASHE_URL || '' },
  { id: 'dorozhnoe', name: 'Дорожное радио', url: import.meta.env.VITE_RADIO_DOROZHNOE_URL || '' },
];

// Only HTTPS radio streams are allowed in production, avoiding mixed-content and
// accidental unsafe links. A localhost HTTP stream is allowed for development.
function safeStream(value: string): string {
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return u.href;
  } catch { /* invalid stream */ }
  return '';
}

const stations = configured.map(station => ({ ...station, url: safeStream(station.url) }));
const storagePrefix = 'kozel_radio_';

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stationId, setStationId] = useState(() => {
    const saved = localStorage.getItem(storagePrefix + 'station');
    return stations.some(s => s.id === saved) ? saved! : 'kozel';
  });
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem(storagePrefix + 'volume'));
    return Number.isFinite(saved) && localStorage.getItem(storagePrefix + 'volume') !== null
      ? Math.max(0, Math.min(100, saved)) : 40;
  });
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const selected = stations.find(station => station.id === stationId) || stations[0];

  useEffect(() => {
    localStorage.setItem(storagePrefix + 'station', stationId);
    setError('');
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [stationId]);

  useEffect(() => {
    localStorage.setItem(storagePrefix + 'volume', String(volume));
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // React unmounts this component when the player enters a live match.
  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (!selected.url) {
      setError('Поток пока не подключён. Требуется разрешённый адрес трансляции.');
      setExpanded(true);
      return;
    }
    setError('');
    try {
      audio.src = selected.url;
      audio.volume = volume / 100;
      await audio.play(); // Called only after the player's explicit click.
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError('Не удалось воспроизвести эфир. Проверь адрес и формат трансляции.');
      setExpanded(true);
    }
  }

  return (
    <aside className="kozel-radio" aria-label="Радио до игры">
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); if (selected.url) setError('Поток недоступен или не поддерживается браузером.'); }}
      />
      <div className="kozel-radio__bar">
        <span className="kozel-radio__label">📻 {selected.name}</span>
        <button type="button" className="kozel-radio__button" onClick={togglePlayback} aria-label={playing ? 'Остановить радио' : 'Включить радио'}>
          {playing ? 'Ⅱ' : '▶'}
        </button>
        <button type="button" className="kozel-radio__button" onClick={() => setExpanded(current => !current)} aria-expanded={expanded} aria-label="Настройки радио">⚙</button>
      </div>
      {expanded && (
        <div className="kozel-radio__settings">
          <label htmlFor="kozel-radio-station">Радиостанция</label>
          <select id="kozel-radio-station" value={stationId} onChange={event => setStationId(event.target.value)}>
            {stations.map(station => <option key={station.id} value={station.id}>{station.name}{station.url ? '' : ' — не подключена'}</option>)}
          </select>
          <label htmlFor="kozel-radio-volume">Громкость: {volume}%</label>
          <input id="kozel-radio-volume" type="range" min="0" max="100" step="5" value={volume} onChange={event => setVolume(Number(event.target.value))}/>
          {error && <div className="kozel-radio__error" role="status">{error}</div>}
          <div className="kozel-radio__hint">Радио доступно только до начала партии. Во время игры оно отключается.</div>
        </div>
      )}
    </aside>
  );
}
