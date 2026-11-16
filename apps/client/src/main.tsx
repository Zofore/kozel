import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);

// Installable online app; the worker never caches player data or game requests.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('PWA:', error));
  });
}
