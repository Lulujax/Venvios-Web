import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload, Rol, UsuarioAutenticado, UsuarioSesion } from '../entities';
import { env } from '../config/env';
import { JWT_AUDIENCE, JWT_ISSUER } from '../config/session';
import type { UserRepository } from '../repositories/UserRepository';
import type { CasilleroRepository } from '../repositories/CasilleroRepository';
import { AppError } from '../utils/errors';
import { generarCodigoCasillero } from '../utils/codes';
import { logger } from '../utils/logger';
import { maskEmail } from '../utils/mask';

export interface RegistroInput {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SesionCreada {
  usuario: UsuarioAutenticado;
  token: string;
}

type UsuarioConCasillero = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  casillero: { codigo: string; direccion: string; ciudad: string } | null;
};

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export class AuthService {
  constructor(
    private readonly usuarios: UserRepository,
    private readonly casilleros: CasilleroRepository,
  ) {}

  private toDTO(user: UsuarioConCasillero): UsuarioAutenticado {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      casillero: user.casillero
        ? {
            codigo: user.casillero.codigo,
            direccion: user.casillero.direccion,
            ciudad: user.casillero.ciudad,
          }
        : null,
    };
  }

  private firmar(user: { id: string; rol: Rol }): string {
    const payload: JwtPayload = { sub: user.id, rol: user.rol };
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async registrar(input: RegistroInput): Promise<SesionCreada> {
    const existe = await this.usuarios.existeEmail(input.email);
    if (existe) {
      throw AppError.conflict('Ya existe una cuenta con este correo.');
    }

    const passwordHash = await argon2.hash(input.password, ARGON_OPTIONS);

    let codigoCasillero = generarCodigoCasillero();
    for (let intento = 0; intento < 8; intento += 1) {
      const ocupado = await this.casilleros.existeCodigo(codigoCasillero);
      if (!ocupado) break;
      codigoCasillero = generarCodigoCasillero();
    }

    let user: UsuarioConCasillero;
    try {
      user = await this.usuarios.crearConCasillero(
        {
          nombre: input.nombre,
          email: input.email,
          telefono: input.telefono,
          passwordHash,
          rol: 'CLIENTE',
        },
        codigoCasillero,
      );
    } catch (error) {
      logger.error('Error creando usuario', { email: input.email, error: String(error) });
      throw AppError.conflict('No pudimos crear la cuenta. Verifica tus datos e intenta de nuevo.');
    }

    logger.info('Cliente registrado', { id: user.id, email: maskEmail(user.email) });

    return { usuario: this.toDTO(user), token: this.firmar(user) };
  }

  async iniciarSesion(input: LoginInput): Promise<SesionCreada> {
    const user = await this.usuarios.buscarPorEmail(input.email);

    if (!user || !user.activo) {
      // Verificación falsa para mantener un tiempo de respuesta similar.
      await argon2.hash(input.password, ARGON_OPTIONS);
      logger.warn('Intento de acceso fallido', { email: maskEmail(input.email) });
      throw AppError.unauthorized('Correo o contraseña incorrectos.');
    }

    const valida = await argon2.verify(user.passwordHash, input.password);
    if (!valida) {
      logger.warn('Intento de acceso fallido', { email: maskEmail(input.email) });
      throw AppError.unauthorized('Correo o contraseña incorrectos.');
    }

    logger.info('Sesión iniciada', { id: user.id, rol: user.rol });
    return { usuario: this.toDTO(user), token: this.firmar({ id: user.id, rol: user.rol }) };
  }

  async perfil(userId: string): Promise<UsuarioAutenticado> {
    const user = await this.usuarios.buscarPorId(userId);
    if (!user || !user.activo) {
      throw AppError.unauthorized('La sesión ya no es válida.');
    }
    return this.toDTO(user);
  }

  async obtenerSesion(userId: string): Promise<UsuarioSesion | null> {
    const user = await this.usuarios.buscarPorId(userId);
    if (!user || !user.activo) return null;
    return { id: user.id, rol: user.rol };
  }

  verificarToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (typeof decoded === 'string' || !decoded.sub) {
        throw new Error('payload inválido');
      }
      const rol = (decoded as jwt.JwtPayload).rol;
      if (rol !== 'CLIENTE' && rol !== 'ADMIN') {
        throw new Error('rol inválido');
      }
      return { sub: String(decoded.sub), rol };
    } catch {
      throw AppError.unauthorized('Tu sesión expiró. Inicia sesión de nuevo.');
    }
  }
}
