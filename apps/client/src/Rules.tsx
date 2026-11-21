import React, { useEffect, useRef } from 'react';

export default function Rules({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="rules-title" style={{
      width: 'min(580px, calc(100% - 32px))', maxHeight: 'calc(100dvh - 32px)',
      boxSizing: 'border-box', padding: 'clamp(18px, 5vw, 36px)',
      border: '2px solid #dfbd72', borderRadius: 16,
      background: 'repeating-linear-gradient(115deg, #ffffff04 0 1px, transparent 1px 3px), radial-gradient(ellipse at top, #176347, #082e25)',
      color: '#fff8e8', lineHeight: 1.55,
    }}>
      <h1 id="rules-title" style={{ color: '#f5d68b', marginTop: 0 }}>Правила игры «Козёл»</h1>
      <h2>Раздача</h2>
      <p>В колоде 36 карт. Играют один на один или двое на двое. Каждому раздают по 6 карт. Открытая карта определяет козырную масть. Когда эту карту добирают, следующая карта колоды определяет новый козырь.</p>
      <h2>Взятка</h2>
      <p>Можно зайти одной картой или несколькими картами одной масти. Чтобы перебить ход, выложите столько же карт. Каждую карту можно перебить старшей той же масти, а некозырную также можно перебить козырем.</p>
      <p>Пас завершает взятку. Её забирает игрок, чей ход остался старшим. Карты добирают по очереди до шести, пока есть колода, начиная с победителя взятки. Он же ходит следующим.</p>
      <h2>Очки за кон</h2>
      <p>Туз — 11, десятка — 10, король — 4, дама — 3, валет — 2. Остальные карты очков не дают.</p>
      <p>Если у обеих сторон по 60 очков, это «яйца». Штраф следующего результативного кона удваивается. Проигравшая сторона получает 6 штрафных очков за 0, 4 за 1–31 и 2 за 32–59 очков. Партия заканчивается, когда одна из сторон набирает 24 штрафных очка или больше.</p>
      <button onClick={() => dialog.current?.close()} style={{
        padding: '10px 18px', border: '1px solid #dfbd72', borderRadius: 8,
        background: '#f5d68b', color: '#082e25', font: 'inherit', fontWeight: 700, cursor: 'pointer',
      }}>В меню</button>
    </dialog>
  );
}
