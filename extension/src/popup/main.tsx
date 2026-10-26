import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupApp } from './PopupApp';
import { TrackerProvider } from '../lib/trackerContext';
import { applyTheme, getInitialTheme } from '../lib/theme';
import '../styles/fonts.css';
import '../styles/index.css';

applyTheme(getInitialTheme()); // before first paint: no light/dark flash

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackerProvider>
      <PopupApp />
    </TrackerProvider>
  </React.StrictMode>
);
