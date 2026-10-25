import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './temaMoked.css';

// Link público de follow-up (manutenção/administração): página própria, sem o app nem login.
const PaginaExterna = lazy(() => import('./followupLink/PaginaExterna'));
const fuToken = (() => { try { const t = new URLSearchParams(window.location.search).get('fu'); return t && /^[-\w]{43}$/.test(t) ? t : null; } catch { return null; } })();

if (fuToken) {
  document.title = 'Follow-up · Moked';
  const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.appendChild(meta);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {fuToken
      ? <Suspense fallback={<div style={{ padding: 24, fontFamily: 'sans-serif' }}>Carregando…</div>}><PaginaExterna token={fuToken} /></Suspense>
      : <App />}
  </React.StrictMode>
);
