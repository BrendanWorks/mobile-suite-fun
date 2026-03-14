import React, { useEffect, useState } from 'react';
import { Coffee, X } from 'lucide-react';

interface TipPromptProps {
  onOpenTipJar: () => void;
  onDismiss: () => void;
}

export default function TipPrompt({ onOpenTipJar, onDismiss }: TipPromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 350);
  };

  const handleOpen = () => {
    setVisible(false);
    setTimeout(onOpenTipJar, 350);
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 z-40 pointer-events-none"
      style={{
        transform: 'translateX(-50%)',
        transition: 'none',
      }}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-500/40 bg-black/90 backdrop-blur-md shadow-xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          transition: 'opacity 350ms cubic-bezier(0.22,1,0.36,1), transform 350ms cubic-bezier(0.22,1,0.36,1)',
          boxShadow: '0 0 24px rgba(239,68,68,0.2), 0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex-shrink-0">
          <Coffee className="w-4 h-4 text-red-400" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-red-300 leading-tight whitespace-nowrap">
            Enjoying Rowdy?
          </span>
          <span className="text-xs text-red-400/60 leading-tight whitespace-nowrap">
            Buy us a coffee to keep it going
          </span>
        </div>

        <button
          onClick={handleOpen}
          className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 touch-manipulation"
          style={{ boxShadow: '0 0 12px rgba(239,68,68,0.35)' }}
        >
          Sure!
        </button>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-red-400/40 hover:text-red-400/70 transition-colors touch-manipulation -ml-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
