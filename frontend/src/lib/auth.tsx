import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Usuario } from '../types';
import { api, ApiError } from './api';

export interface RegistroPayload {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
}

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<Usuario>;
  registrar: (payload: RegistroPayload) => Promise<Usuario>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      const data = await api.get<{ usuario: Usuario }>('/auth/me');
      setUsuario(data.usuario);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUsuario(null);
      }
    }
  }, []);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const data = await api.get<{ usuario: Usuario }>('/auth/me');
        if (activo) setUsuario(data.usuario);
      } catch {
        if (activo) setUsuario(null);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ usuario: Usuario }>('/auth/login', { email, password });
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const registrar = useCallback(async (payload: RegistroPayload) => {
    const data = await api.post<{ usuario: Usuario }>('/auth/registro', payload);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const salir = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUsuario(null);
    }
  }, []);

  const value = useMemo(
    () => ({ usuario, cargando, iniciarSesion, registrar, salir, refrescar }),
    [usuario, cargando, iniciarSesion, registrar, salir, refrescar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
