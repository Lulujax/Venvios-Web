import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ErrorApi } from './api';
import type { Rol, Usuario } from './tipos';

interface EstadoAuth {
  usuario: Usuario | null;
  cargando: boolean;
  ingresar: (telefono: string, contrasena: string) => Promise<Usuario>;
  registrar: (datos: { nombre: string; cedula: string; telefono: string; contrasena: string }) => Promise<Usuario>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const ContextoAuth = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      const respuesta = await api.get<{ usuario: Usuario }>('/auth/yo');
      setUsuario(respuesta.usuario);
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.estado !== 401) console.warn('No se pudo comprobar la sesión');
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const valor = useMemo<EstadoAuth>(
    () => ({
      usuario,
      cargando,
      refrescar,
      ingresar: async (telefono, contrasena) => {
        const respuesta = await api.post<{ usuario: Usuario }>('/auth/login', { telefono, contrasena });
        setUsuario(respuesta.usuario);
        return respuesta.usuario;
      },
      registrar: async (datos) => {
        const respuesta = await api.post<{ usuario: Usuario }>('/auth/registro', datos);
        setUsuario(respuesta.usuario);
        return respuesta.usuario;
      },
      salir: async () => {
        await api.post('/auth/logout');
        setUsuario(null);
      },
    }),
    [usuario, cargando, refrescar],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): EstadoAuth {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}

export function esPersonal(rol: Rol | undefined): boolean {
  return rol === 'OPERADOR' || rol === 'ADMIN';
}

export function rutaInicial(usuario: Usuario): string {
  if (usuario.debeCambiarClave) return '/cambiar-clave';
  return esPersonal(usuario.rol) ? '/panel' : '/cuenta';
}
