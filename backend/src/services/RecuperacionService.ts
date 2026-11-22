import type { CifradoCedula } from '../domain/cifrado';
import { validarContrasena, validarEmail } from '../domain/validaciones';
import type { EventoCuentaRepository, UsuarioRepository } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { AuthService, LimitadorIntentos } from './AuthService';
import type { CanalCodigo } from './CanalCodigo';

const CODIGO_INTERNO_SIN_DUENO = 'VENV-000000';
const PATRON_CODIGO_CORREO = /^\d{6,10}$/;
const MENSAJE_CODIGO_INVALIDO = 'El código es incorrecto o ya venció. Pide uno nuevo.';

export function validarCodigoCorreo(codigo: unknown): string {
  const limpio = typeof codigo === 'string' ? codigo.replace(/\s+/g, '') : '';
  if (!PATRON_CODIGO_CORREO.test(limpio)) throw AppError.badRequest('Escribe el código de 6 números que te enviamos al correo.');
  return limpio;
}

export class RecuperacionService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly eventos: EventoCuentaRepository,
    private readonly auth: AuthService,
    private readonly canal: CanalCodigo,
    private readonly limitador: LimitadorIntentos,
    private readonly cifrado: CifradoCedula,
  ) {}

  private claveLimite(tipo: 'pedir' | 'restablecer', email: string): string {
    return this.cifrado.huella(`recuperar-${tipo}:${email}`);
  }

  async solicitarCodigo(correoEscrito: string): Promise<void> {
    logger.info('Entrando a pedir código de recuperación');
    const email = validarEmail(correoEscrito);
    const clave = this.claveLimite('pedir', email);
    await this.limitador.verificar(clave);
    await this.limitador.registrarFallo(clave);

    const usuario = await this.usuarios.porEmail(email);
    if (!usuario || !usuario.activo || usuario.codigo === CODIGO_INTERNO_SIN_DUENO) {
      logger.info('Código de recuperación pedido para un correo sin cuenta activa; no se envía nada');
      return;
    }
    try {
      await this.canal.enviarCodigo(email);
    } catch (falla) {
      logger.error('No se pudo enviar el código de recuperación', { id: usuario.id, motivo: falla instanceof Error ? falla.message : 'desconocido' });
      throw new AppError('No pudimos enviar el código. Escríbenos por WhatsApp y te ayudamos.', 503, 'CORREO_NO_ENVIADO');
    }
    logger.info('Código de recuperación enviado', { id: usuario.id });
  }

  async restablecer(correoEscrito: string, codigoEscrito: string, contrasenaNueva: string): Promise<void> {
    logger.info('Entrando a restablecer la contraseña con código');
    const email = validarEmail(correoEscrito);
    const codigo = validarCodigoCorreo(codigoEscrito);
    const nueva = validarContrasena(contrasenaNueva);
    const clave = this.claveLimite('restablecer', email);
    await this.limitador.verificar(clave);

    const usuario = await this.usuarios.porEmail(email);
    const cuentaActiva = Boolean(usuario && usuario.activo && usuario.codigo !== CODIGO_INTERNO_SIN_DUENO);
    const codigoCorrecto = cuentaActiva ? await this.canal.verificarCodigo(email, codigo) : false;
    if (!usuario || !cuentaActiva || !codigoCorrecto) {
      await this.limitador.registrarFallo(clave);
      logger.warn('Código de recuperación rechazado');
      throw AppError.badRequest(MENSAJE_CODIGO_INVALIDO, 'CODIGO_INVALIDO');
    }

    await this.auth.fijarContrasena(usuario.id, nueva);
    await this.eventos.agregar({ usuarioId: usuario.id, actorId: usuario.id, tipo: 'CLAVE_RESTABLECIDA', detalle: 'Contraseña restablecida con el código del correo', datos: null });
    await this.limitador.limpiar(clave);
    logger.info('Contraseña restablecida con código; otras sesiones cerradas', { id: usuario.id });
  }
}
