import type { UsuarioSesion } from '../entities';

declare global {
  namespace Express {
    interface Request {
      user?: UsuarioSesion;
    }
  }
}

export {};
