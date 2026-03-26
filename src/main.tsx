import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logClientError } from './lib/errorLogger';
import { OfflineProvider } from './context/OfflineContext.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

window.addEventListener('error', (event) => {
  const msg = event.message || event.error?.message || '';
  const isStaleChunk =
    msg.includes('MIME type') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    event.error?.name === 'ChunkLoadError';

  if (isStaleChunk) {
    window.location.reload();
    return;
  }

  logClientError(event.error ?? new Error(event.message), {
    source: 'window.onerror',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason?.message ?? reason ?? '');
  const isStaleChunk =
    msg.includes('MIME type') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    reason?.name === 'ChunkLoadError';

  if (isStaleChunk) {
    window.location.reload();
    return;
  }

  let err: Error;
  if (reason instanceof Error) {
    err = reason;
  } else if (reason && typeof reason === 'object') {
    const m = (reason as any).message || (reason as any).error || JSON.stringify(reason);
    err = new Error(m);
    err.stack = (reason as any).stack ?? undefined;
  } else {
    err = new Error(String(reason));
  }
  logClientError(err, { source: 'unhandledrejection' });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfflineProvider>
      <OfflineIndicator />
      <App />
    </OfflineProvider>
  </StrictMode>
);
