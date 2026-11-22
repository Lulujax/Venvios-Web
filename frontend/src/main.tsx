import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProveedorAvisos } from './components/ui';
import { ProveedorConfirmar } from './components/Confirmar';
import { AuthProvider } from './lib/auth';
import './index.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el elemento raíz de la página.');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProveedorAvisos>
          <ProveedorConfirmar>
            <App />
          </ProveedorConfirmar>
        </ProveedorAvisos>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => console.warn('No se pudo registrar el service worker'));
  });
}
