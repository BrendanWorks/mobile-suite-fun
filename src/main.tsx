import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logClientError } from './lib/errorLogger';
import { OfflineProvider } from './context/OfflineContext.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

window.addEventListener('error', (event) => {
  logClientError(event.error ?? new Error(event.message), {
    source: 'window.onerror',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  let err: Error;
  if (reason instanceof Error) {
    err = reason;
  } else if (reason && typeof reason === 'object') {
    const msg = (reason as any).message || (reason as any).error || JSON.stringify(reason);
    err = new Error(msg);
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
