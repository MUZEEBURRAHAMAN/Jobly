import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistence } from './lib/db';
import { flush, initStore } from './lib/store';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/resume.css';

window.addEventListener('pagehide', flush);
requestPersistence();
initStore();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
