import React, { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_URL, checkedJson } from './api';

type Message = { id: number; sender: string; recipient: string; body: string; createdAt: string };
type Props = {
  socket: Socket;
  username: string;
  friend: { username: string; fullname: string };
  onBack: () => void;
};

export function FriendChat({ socket, username, friend, onBack }: Props) {
  const endpoint = `${API_URL}/api/friends/chat/${encodeURIComponent(friend.username)}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [olderAvailable, setOlderAvailable] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const timeline = useRef<HTMLDivElement>(null);
  const scrollToLatest = useRef(false);

  function addMessages(incoming: Message[], scroll = true) {
    scrollToLatest.current = scroll;
    setMessages(previous => {
      const merged = new Map(previous.map(message => [message.id, message]));
      for (const message of incoming) merged.set(message.id, message);
      return [...merged.values()].sort((a, b) => a.id - b.id);
    });
  }

  useEffect(() => {
    if (scrollToLatest.current && timeline.current) {
      timeline.current.scrollTop = timeline.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await checkedJson(endpoint, { signal: controller.signal });
        if (controller.signal.aborted) return;
        addMessages(data.messages);
        if (data.messages.length === 50) setOlderAvailable(true);
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    function receive(message: Message) {
      if ((message.sender === username && message.recipient === friend.username)
        || (message.sender === friend.username && message.recipient === username)) {
        addMessages([message]);
      }
    }
    socket.on('friend_message', receive);
    socket.on('connect', load);
    void load();
    return () => {
      controller.abort();
      socket.off('friend_message', receive);
      socket.off('connect', load);
    };
  }, [endpoint, friend.username, socket, username]);

  async function loadOlder() {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    setError('');
    try {
      const data = await checkedJson(`${endpoint}?before=${messages[0].id}`);
      addMessages(data.messages, false);
      setOlderAvailable(data.messages.length === 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const draft = text.trim();
    if (!draft || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await checkedJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft }),
      });
      addMessages([data.message]);
      setText(current => current.trim() === draft ? '' : current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Личная переписка" style={{ background: '#252540', padding: 16, borderRadius: 12 }}>
      <button type="button" onClick={onBack}>← К друзьям</button>
      <h2>{friend.fullname || friend.username}</h2>
      <div ref={timeline} role="log" aria-label="Сообщения" style={{ height: 'min(55dvh, 420px)', overflowY: 'auto', overflowWrap: 'anywhere' }}>
        {olderAvailable && <button type="button" disabled={loadingOlder} onClick={loadOlder}>Загрузить ранние сообщения</button>}
        {loading && <p>Загрузка переписки…</p>}
        {!loading && !messages.length && !error && <p>Сообщений пока нет.</p>}
        {messages.map(message => (
          <div key={message.id} style={{ margin: '8px 0', padding: 10, borderRadius: 8, background: message.sender === username ? '#394670' : '#30304e' }}>
            <strong>{message.sender === username ? 'Ты' : friend.fullname || friend.username}</strong>
            <time dateTime={message.createdAt} style={{ marginLeft: 8, color: '#ddd', fontSize: 12 }}>
              {new Date(message.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
            </time>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.body}</div>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={send} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input aria-label="Сообщение" placeholder="Написать сообщение" maxLength={1000} value={text}
          onChange={event => setText(event.target.value)} style={{ flex: 1, minWidth: 120, padding: 8 }} />
        <button type="submit" disabled={sending || !text.trim()}>Отправить</button>
      </form>
    </section>
  );
}
