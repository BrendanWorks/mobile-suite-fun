import { useEffect, useState } from 'react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface InitialsEntryProps {
  score: number;
  onSubmit: (initials: string) => void;
  onSkip: () => void;
  submitting: boolean;
}

export default function InitialsEntry({ score, onSubmit, onSkip, submitting }: InitialsEntryProps) {
  const [letters, setLetters] = useState<[number, number, number]>([0, 0, 0]);
  const [slot, setSlot] = useState(0);

  const cycleAt = (idx: number, delta: number) => {
    setSlot(idx);
    setLetters((prev) => {
      const next = [...prev] as [number, number, number];
      next[idx] = (next[idx] + delta + ALPHABET.length) % ALPHABET.length;
      return next;
    });
  };

  const confirm = () => {
    if (submitting) return;
    if (slot < 2) {
      setSlot(slot + 1);
    } else {
      onSubmit(letters.map((i) => ALPHABET[i]).join(''));
    }
  };

  // Arrow keys for desktop; the per-slot on-screen arrows below cover touch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (submitting) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); cycleAt(slot, 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cycleAt(slot, -1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setSlot((s) => Math.max(0, s - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setSlot((s) => Math.min(2, s + 1)); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, letters, submitting]);

  return (
    <div className="screen initials-screen">
      <div className="starfield-bg" />
      <div className="initials-content">
        <p className="initials-heading">YOUR SCORE IS ONE OF THE TEN BEST</p>
        <p className="initials-score">{score.toLocaleString()}</p>
        <p className="initials-sub">ENTER YOUR INITIALS</p>

        <div className="initials-slots">
          {letters.map((li, i) => (
            <div key={i} className={`initials-slot${i === slot ? ' active' : ''}`}>
              <button className="initials-arrow" onClick={() => cycleAt(i, 1)} aria-label="Next letter" disabled={submitting}>&#9650;</button>
              <span className="initials-letter">{ALPHABET[li]}</span>
              <button className="initials-arrow" onClick={() => cycleAt(i, -1)} aria-label="Previous letter" disabled={submitting}>&#9660;</button>
            </div>
          ))}
        </div>

        <button className="debris-btn debris-btn-primary" onClick={confirm} disabled={submitting}>
          {submitting ? 'SUBMITTING…' : slot < 2 ? 'NEXT' : 'CONFIRM'}
        </button>
        <button className="debris-btn debris-btn-text" onClick={onSkip} disabled={submitting}>SKIP</button>

        <p className="initials-hint">tap the arrows to change a letter &middot; &uarr;&darr;&larr;&rarr; and ENTER also work</p>
      </div>
    </div>
  );
}
