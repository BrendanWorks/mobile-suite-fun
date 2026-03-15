import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logClientError } from './lib/errorLogger';

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
  logClientError(reason instanceof Error ? reason : new Error(String(reason)), {
    source: 'unhandledrejection',
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
