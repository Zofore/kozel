import React, { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_URL, apiFetch } from './api';
import './voice.css';

type Mode = 'team' | 'all';
type Peer = { index: number; name: string };
type Signal = { type: 'offer' | 'answer' | 'candidate'; sdp?: string; candidate?: RTCIceCandidateInit };
type PeerConnection = { pc: RTCPeerConnection; stream: MediaStream; queued: RTCIceCandidateInit[] };

const defaultRtcConfig: RTCConfiguration = {
  iceServers: [{urls:'stun:stun.l.google.com:19302'}]
};

// WebRTC voice is opt-in. Audio tracks never pass through Socket.IO or PostgreSQL.
export function VoiceChat({ socket, roomId }: { socket: Socket; roomId: string }) {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [mode, setMode] = useState<Mode>('all');
  const [roomMode, setRoomMode] = useState('1v1');
  const [expanded, setExpanded] = useState(false);
  // Mobile: keep a small voice tab visible without covering game controls.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [mutedPeers, setMutedPeers] = useState<number[]>([]);
  const [error, setError] = useState('');
  const localStream = useRef<MediaStream | null>(null);
  const connections = useRef(new Map<number, PeerConnection>());
  const elements = useRef(new Map<number, HTMLAudioElement>());
  const selfIndex = useRef(-1);
  const enabled = useRef(false);
  const mounted = useRef(true);
  const rtcConfig = useRef<RTCConfiguration>(defaultRtcConfig);
  const currentMode = useRef<Mode>('all');
  const [volumes, setVolumes] = useState<Record<number,number>>({});

  const sendSignal = (toIndex: number, signal: Signal) => socket.emit('voice_signal', { roomId, toIndex, signal });

  function closePeer(index: number) {
    const item = connections.current.get(index);
    if (!item) return;
    item.pc.onicecandidate = null;
    item.pc.ontrack = null;
    item.pc.close();
    item.stream.getTracks().forEach(track => item.stream.removeTrack(track));
    const element = elements.current.get(index);
    if (element) element.srcObject = null;
    connections.current.delete(index);
  }

  function stopAll() {
    enabled.current = false;
    for (const index of [...connections.current.keys()]) closePeer(index);
    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;
    elements.current.clear();
    selfIndex.current = -1;
    setPeers([]);
  }

  async function start() {
    if (connecting || active) return;
    if (!socket.connected) { setError('Нет соединения с сервером'); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setError('Этот браузер не поддерживает голосовую связь или сайт открыт без HTTPS.'); return;
    }
    setConnecting(true);
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      // The backend issues time-limited credentials; never expose a TURN secret in Vite variables.
      try {
        const response = await apiFetch(`${API_URL}/api/voice/ice`);
        if (response.ok) {
          const config = await response.json();
          if (Array.isArray(config.iceServers) && config.iceServers.length <= 4) rtcConfig.current = {iceServers: config.iceServers};
        }
      } catch { /* STUN fallback; TURN may be needed on restrictive networks */ }
      if (!mounted.current || enabled.current) { stream.getTracks().forEach(track=>track.stop()); return; }
      stream.getAudioTracks().forEach(track=>track.enabled=false);
      localStream.current=stream;
      enabled.current=true;
      setMicOn(false);
      setExpanded(true);
      setMobileOpen(true);
      setActive(true);
    } catch {
      if(mounted.current) setError('Нет доступа к микрофону. Разреши его в настройках браузера.');
    } finally { if(mounted.current) setConnecting(false); }
  }

  function stop() {
    socket.emit('voice_leave');
    stopAll();
    setActive(false);
    setMicOn(false);
  }

  function toggleMic() {
    const next = !micOn;
    localStream.current?.getAudioTracks().forEach(track=>track.enabled=next);
    setMicOn(next);
  }

  useEffect(() => {
    if (!active || !localStream.current) return;
    let cancelled = false;
    // Switch channel by terminating all previous connections, including remote audio.
    currentMode.current=mode;
    for (const index of [...connections.current.keys()]) closePeer(index);
    setPeers([]);

    function makePeer(index: number): PeerConnection {
      const existing = connections.current.get(index);
      if (existing) return existing;
      const pc = new RTCPeerConnection(rtcConfig.current);
      const item: PeerConnection = {pc,stream:new MediaStream(),queued:[]};
      connections.current.set(index,item);
      for(const track of localStream.current?.getTracks() || []) pc.addTrack(track, localStream.current!);
      pc.ontrack = event => {
        const stream = item.stream;
        if (!stream.getTracks().some(track=>track.id===event.track.id)) stream.addTrack(event.track);
        const element=elements.current.get(index);
        if(element){element.srcObject=stream; void element.play().catch(()=>setError('Нажми на кнопку звука, чтобы разрешить воспроизведение.'));}
      };
      pc.onicecandidate = event => {
        if (event.candidate && !cancelled) sendSignal(index,{type:'candidate',candidate:event.candidate.toJSON()});
      };
      pc.onconnectionstatechange = () => {
        if(pc.connectionState==='failed') setError('Нет голосового соединения. Для некоторых мобильных сетей нужен TURN-сервер.');
      };
      return item;
    }

    async function onRoster(data: {selfIndex:number;mode:string;peers:Peer[]}) {
      if(cancelled || !enabled.current || !Number.isInteger(data?.selfIndex) || !Array.isArray(data.peers)) return;
      selfIndex.current=data.selfIndex;
      setRoomMode(data.mode);
      const next = data.peers.filter(p=>Number.isInteger(p.index) && typeof p.name==='string');
      const allowed=new Set(next.map(p=>p.index));
      for(const index of [...connections.current.keys()]) if(!allowed.has(index)) closePeer(index);
      setPeers(next);
      for(const peer of next) {
        if(connections.current.has(peer.index)) continue;
        const item=makePeer(peer.index);
        if(selfIndex.current < peer.index) {
          try {
            const offer=await item.pc.createOffer();
            if(cancelled || !connections.current.has(peer.index)) continue;
            await item.pc.setLocalDescription(offer);
            sendSignal(peer.index,{type:'offer',sdp:item.pc.localDescription?.sdp});
          } catch {setError('Не удалось согласовать голосовое соединение.');}
        }
      }
    }
    async function onSignal(data: {fromIndex:number;signal:Signal}) {
      if(cancelled || !enabled.current || !Number.isInteger(data?.fromIndex)) return;
      const signal=data.signal;
      if(!signal || !['offer','answer','candidate'].includes(signal.type)) return;
      try {
        const item=makePeer(data.fromIndex), pc=item.pc;
        if(signal.type==='candidate') {
          if (!signal.candidate) return;
          if(pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
          else item.queued.push(signal.candidate);
          return;
        }
        if(typeof signal.sdp !== 'string') return;
        await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
        for(const candidate of item.queued.splice(0)) await pc.addIceCandidate(candidate);
        if(signal.type==='offer') {
          const answer=await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(data.fromIndex,{type:'answer',sdp:pc.localDescription?.sdp});
        }
      } catch {setError('Ошибка соединения с другим игроком.');}
    }
    function onSocketDisconnect() {setError('Соединение с сервером прервано. Голос отключён.');stop();}
    socket.on('voice_roster',onRoster);
    socket.on('voice_signal',onSignal);
    socket.on('disconnect',onSocketDisconnect);
    socket.timeout(5000).emit('voice_join',{roomId,mode},(err:Error|null,result:any)=>{
      if(cancelled) return;
      if(err || result?.error) {setError(result?.error || 'Не удалось войти в голосовой чат');stop();}
    });
    return () => {
      cancelled=true;
      socket.off('voice_roster',onRoster);
      socket.off('voice_signal',onSignal);
      socket.off('disconnect',onSocketDisconnect);
      socket.emit('voice_leave');
      for(const index of [...connections.current.keys()]) closePeer(index);
    };
  },[active,mode,roomId,socket]);

  useEffect(() => {
    mounted.current=true;
    return () => {
      mounted.current=false;
      socket.emit('voice_leave');
      // Avoid setState from a component that is unmounting.
      enabled.current=false;
      for(const item of connections.current.values()) item.pc.close();
      connections.current.clear();
      localStream.current?.getTracks().forEach(track=>track.stop());
      localStream.current=null;
    };
  },[roomId,socket]);

  const setAudio = (index:number, element:HTMLAudioElement|null) => {
    if(!element){elements.current.delete(index);return;}
    elements.current.set(index,element);
    element.srcObject=connections.current.get(index)?.stream || null;
    element.muted=mutedPeers.includes(index);
    element.volume=(volumes[index]??100)/100;
    if (element.srcObject) void element.play().catch(()=>{});
  };

  return (
    <section className={`kozel-voice${mobileOpen ? ' kozel-voice--mobile-open' : ''}`} aria-label="Голосовой чат игроков">
      <button
        type="button"
        className="kozel-voice__mobile-toggle"
        onClick={() => {setMobileOpen(value => !value);setExpanded(true);}}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Свернуть голосовой чат' : 'Открыть голосовой чат'}
        title={mobileOpen ? 'Свернуть голосовой чат' : 'Голосовой чат'}
      >{mobileOpen ? '✕' : '🎤'}</button>
      <div className="kozel-voice__content">
      <div className="kozel-voice__bar">
        <span className="kozel-voice__title">🎙 Голос</span>
        {!active ? <button type="button" onClick={start} disabled={connecting}>{connecting?'Подключение…':'Подключиться'}</button> : <>
          <button type="button" onClick={toggleMic} aria-pressed={micOn} title={micOn?'Выключить микрофон':'Включить микрофон'}>{micOn?'🎙 В эфире':'🔇 Микрофон выкл.'}</button>
          <button type="button" onClick={stop} title="Отключить голосовой чат">Откл.</button>
        </>}
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-label="Настройки голосового чата">⚙</button>
      </div>
      {expanded && <div className="kozel-voice__settings">
        <div className="kozel-voice__hint">Голос работает только в комнате. Микрофон выключен до твоего разрешения.</div>
        {roomMode === '2v2' && <label>Канал
          <select value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="all">Все игроки</option><option value="team">Только команда</option></select>
        </label>}
        {active && <>
          <div className="kozel-voice__hint">Подключены: {peers.length ? peers.map(p=>p.name).join(', ') : 'пока никого'}</div>
          {peers.map(peer=><div className="kozel-voice__peer" key={peer.index}>
            <span>{peer.name}</span>
            <button type="button" aria-label={`Выключить звук ${peer.name}`} onClick={()=>setMutedPeers(old=>old.includes(peer.index)?old.filter(i=>i!==peer.index):[...old,peer.index])}>{mutedPeers.includes(peer.index)?'🔇':'🔊'}</button>
            <input aria-label={`Громкость ${peer.name}`} type="range" min="0" max="100" value={volumes[peer.index]??100} onChange={e=>setVolumes(old=>({...old,[peer.index]:Number(e.target.value)}))}/>
            <audio autoPlay playsInline ref={el=>setAudio(peer.index,el)} muted={mutedPeers.includes(peer.index)} />
          </div>)}
        </>}
        {error && <div className="kozel-voice__error" role="status">{error}</div>}
        <div className="kozel-voice__hint">Для устойчивой связи через некоторые мобильные сети нужен TURN. Голос не записывается сервером игры.</div>
      </div>}
      {!expanded && error && <div className="kozel-voice__error" role="status">{error}</div>}
      </div>
    </section>
  );
}
