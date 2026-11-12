import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeTelegramWebApp } from './telegram';
import './index.css';

// When launched from @celestiallobbybot, prepare Telegram's native Mini App viewport.
initializeTelegramWebApp();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
