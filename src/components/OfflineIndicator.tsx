import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CircleCheck as CheckCircle } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export function OfflineIndicator() {
  const { isOnline, isSyncing, queueCount, justSynced } = useOffline();

  const showBanner = !isOnline || isSyncing || justSynced;

  let text = '';
  let icon = <WifiOff size={14} />;
  let colorClass = 'bg-gray-900/90 border-cyan-500/40 text-cyan-300';

  if (!isOnline) {
    icon = <WifiOff size={14} />;
    colorClass = 'bg-gray-900/90 border-cyan-500/40 text-cyan-300';
    text = queueCount > 0
      ? `Offline — ${queueCount} score${queueCount !== 1 ? 's' : ''} queued`
      : 'Offline — scores will sync when connected';
  } else if (isSyncing) {
    icon = <RefreshCw size={14} className="animate-spin" />;
    colorClass = 'bg-gray-900/90 border-cyan-400/60 text-cyan-200';
    text = `Syncing scores...`;
  } else if (justSynced) {
    icon = <CheckCircle size={14} />;
    colorClass = 'bg-gray-900/90 border-green-500/50 text-green-300';
    text = 'Scores synced';
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 border-b text-xs font-medium ${colorClass}`}
        >
          {icon}
          <span>{text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
