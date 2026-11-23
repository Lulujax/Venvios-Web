import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { ProveedorAvisos } from './components/ui';
import { ProveedorConfirmar } from './components/Confirmar';
import { ambitoDeRuta } from './lib/ambito';
import { AuthProvider } from './lib/auth';
import './index.css';

function AuthPorAmbito({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <AuthProvider key={ambitoDeRuta(pathname)}>{children}</AuthProvider>;
}

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el elemento raíz de la página.');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <AuthPorAmbito>
        <ProveedorAvisos>
          <ProveedorConfirmar>
            <App />
          </ProveedorConfirmar>
        </ProveedorAvisos>
      </AuthPorAmbito>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => console.warn('No se pudo registrar el service worker'));
  });
}
