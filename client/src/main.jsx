import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Rewrite relative API requests to the backend in production
const BACKEND = import.meta.env.VITE_API_BASE_URL;
if (typeof window !== 'undefined' && BACKEND) {
  const originalFetch = window.fetch;
  window.fetch = (input, init) => {
    const isString = typeof input === 'string';
    const url = isString ? input : (input && input.url) || '';

    // Handle relative API paths and localhost fallbacks
    const trimmedBackend = BACKEND.replace(/\/$/, '');
    const needsRewrite = url.startsWith('/api') || url.startsWith('api/');
    const isLocalhost = url.startsWith('http://localhost:5000') || url.startsWith('http://127.0.0.1:5000');

    if (needsRewrite) {
      const normalizedPath = url.startsWith('api/') ? `/${url}` : url;
      const rewritten = `${trimmedBackend}${normalizedPath}`;
      if (isString) return originalFetch(rewritten, init);
      const req = new Request(rewritten, input);
      return originalFetch(req, init);
    }

    if (isLocalhost) {
      let rewritten = url.replace('http://localhost:5000', trimmedBackend);
      rewritten = rewritten.replace('http://127.0.0.1:5000', trimmedBackend);
      if (isString) return originalFetch(rewritten, init);
      const req = new Request(rewritten, input);
      return originalFetch(req, init);
    }

    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
