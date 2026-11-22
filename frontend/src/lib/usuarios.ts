import type { Usuario } from './tipos';

export type FiltroRol = 'TODOS' | 'OPERADOR' | 'ADMIN';
export type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS' | 'PENDIENTES';

export interface FiltrosUsuarios {
  texto: string;
  rol: FiltroRol;
  estado: FiltroEstado;
}

export interface ContadoresUsuarios {
  todos: number;
  activos: number;
  inactivos: number;
  pendientes: number;
  operadores: number;
  administradores: number;
}

export const FILTROS_INICIALES: FiltrosUsuarios = { texto: '', rol: 'TODOS', estado: 'TODOS' };

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filtrarUsuarios(usuarios: Usuario[], filtros: FiltrosUsuarios): Usuario[] {
  const buscado = normalizar(filtros.texto);
  return usuarios.filter((u) => {
    if (filtros.rol !== 'TODOS' && u.rol !== filtros.rol) return false;
    if (filtros.estado === 'ACTIVOS' && !u.activo) return false;
    if (filtros.estado === 'INACTIVOS' && u.activo) return false;
    if (filtros.estado === 'PENDIENTES' && !(u.activo && u.debeCambiarClave)) return false;
    if (!buscado) return true;
    return normalizar(u.nombre).includes(buscado) || normalizar(u.email).includes(buscado);
  });
}

export function contarUsuarios(usuarios: Usuario[]): ContadoresUsuarios {
  const activos = usuarios.filter((u) => u.activo);
  return {
    todos: usuarios.length,
    activos: activos.length,
    inactivos: usuarios.length - activos.length,
    pendientes: activos.filter((u) => u.debeCambiarClave).length,
    operadores: activos.filter((u) => u.rol === 'OPERADOR').length,
    administradores: activos.filter((u) => u.rol === 'ADMIN').length,
  };
}
