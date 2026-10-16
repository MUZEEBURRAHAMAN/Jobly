import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from './OptionsApp';
import { applyTheme, getInitialTheme } from '../lib/theme';
import '../styles/fonts.css';
import '../styles/index.css';

applyTheme(getInitialTheme()); // before first paint: no light/dark flash

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
