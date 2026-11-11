import { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { RequireAuth } from './components/RequireAuth';
import { BrandMark } from './components/ui/BrandMark';
import { Icon } from './components/ui/Icon';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { TrackPage } from './pages/TrackPage';
import { ClientDashboard } from './pages/ClientDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-6">
      <div className="w-full max-w-md">
        <Link to="/" aria-label="Venvios Express, inicio">
          <BrandMark />
        </Link>
        <p className="eyebrow mt-10">Error 404 · Guía no encontrada</p>
        <h1 className="display-lg mt-3">Esta página no existe.</h1>
        <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-muted">
          La dirección que buscas no está en nuestro manifiesto. Vuelve al inicio o consulta el
          rastreo público con tu guía.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link to="/" className="btn btn-primary">
            <Icon name="chevronLeft" size={13} />
            Volver al inicio
          </Link>
          <Link to="/rastreo" className="btn btn-outline">
            <Icon name="search" size={13} />
            Rastrear paquete
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/rastreo" element={<TrackPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth rol="CLIENTE">
                <ClientDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth rol="ADMIN">
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
