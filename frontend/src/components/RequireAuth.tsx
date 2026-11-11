import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Rol } from '../types';
import { BrandMark } from './ui/BrandMark';

export function FullScreenLoader({ mensaje = 'Cargando manifiesto…' }: { mensaje?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <BrandMark />
        <p className="mt-8 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{mensaje}</p>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-3/4 bg-ink/[0.07]" />
          <div className="h-2 w-full bg-ink/[0.07]" />
          <div className="h-2 w-1/2 bg-ink/[0.07]" />
        </div>
      </div>
    </div>
  );
}

interface RequireAuthProps {
  children: ReactNode;
  rol?: Rol;
}

export function RequireAuth({ children, rol }: RequireAuthProps) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <FullScreenLoader />;

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (rol && usuario.rol !== rol) {
    return <Navigate to={usuario.rol === 'ADMIN' ? '/admin' : '/app'} replace />;
  }

  return <>{children}</>;
}
