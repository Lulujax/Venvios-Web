import { verify } from '@node-rs/argon2';
import type { CifradoCedula } from '../domain/cifrado';
import { TRANSPORTISTAS_PERFIL, destinoCompleto, limpiarDestino } from '../domain/perfil';
import { limpiarTexto, validarCedula, validarContrasena, validarEmail, validarNombre, validarTelefono } from '../domain/validaciones';
import type { DestinoEntrega, EventoCuenta, EventoCuentaRepository, PerfilEntrega, Transportista, Usuario, UsuarioRepository } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { enmascararCedula } from '../utils/mask';
import type { AuthService, UsuarioPublico } from './AuthService';
import type { Actor } from './EnvioService';

export interface ReceptorVista {
  nombre: string;
  cedula: string;
  telefono: string;
}

export interface EntregaPerfilVista {
  receptor: ReceptorVista | null;
  receptorPorDefecto: ReceptorVista;
  destinos: Record<Transportista, DestinoEntrega | null>;
  completo: Record<Transportista, boolean>;
}

export interface PerfilVista {
  datos: UsuarioPublico;
  entrega: EntregaPerfilVista;
}

export interface CambiosDatos {
  nombre?: string;
  email?: string;
  telefono?: string;
  contrasenaActual?: string;
  contrasenaNueva?: string;
}

export interface EntradaEntrega {
  receptor?: { nombre?: string; cedula?: string; telefono?: string } | null;
  MRW?: { agencia?: string; ciudad?: string; estado?: string } | null;
  ZOOM?: { agencia?: string; ciudad?: string; estado?: string } | null;
}

export interface EventoCuentaVista {
  id: string;
  tipo: string;
  detalle: string;
  creadoEn: string;
}

const MIN_MOTIVO = 5;

export class PerfilService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly eventos: EventoCuentaRepository,
    private readonly cifrado: CifradoCedula,
    private readonly auth: AuthService,
  ) {}

  private async cargar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarios.porId(usuarioId);
    if (!usuario) throw AppError.notFound('La cuenta no existe.');
    return usuario;
  }

  private vistaEntrega(usuario: Usuario): EntregaPerfilVista {
    const perfil = usuario.perfilEntrega;
    const receptor: ReceptorVista | null = perfil?.receptor
      ? {
          nombre: this.cifrado.descifrar(perfil.receptor.nombreCifrado),
          cedula: this.cifrado.descifrar(perfil.receptor.cedulaCifrada),
          telefono: this.cifrado.descifrar(perfil.receptor.telefonoCifrado),
        }
      : null;
    const destinos = { MRW: perfil?.destinos.MRW ?? null, ZOOM: perfil?.destinos.ZOOM ?? null };
    return {
      receptor,
      receptorPorDefecto: { nombre: usuario.nombre, cedula: this.cifrado.descifrar(usuario.cedulaCifrada), telefono: usuario.telefono },
      destinos,
      completo: { MRW: destinoCompleto(destinos.MRW), ZOOM: destinoCompleto(destinos.ZOOM) },
    };
  }

  async obtener(usuarioId: string): Promise<PerfilVista> {
    const usuario = await this.cargar(usuarioId);
    return { datos: this.auth.aPublico(usuario), entrega: this.vistaEntrega(usuario) };
  }

  async actualizarDatos(usuarioId: string, cambios: CambiosDatos): Promise<{ perfil: PerfilVista; token: string | null }> {
    logger.info('Actualizando datos del perfil', { id: usuarioId });
    const usuario = await this.cargar(usuarioId);
    const nuevos: Partial<Pick<Usuario, 'nombre' | 'email' | 'telefono'>> = {};
    const campos: string[] = [];

    if (cambios.nombre !== undefined) {
      const nombre = validarNombre(cambios.nombre);
      if (nombre !== usuario.nombre) {
        nuevos.nombre = nombre;
        campos.push('nombre');
      }
    }
    if (cambios.email !== undefined) {
      const email = validarEmail(cambios.email);
      if (email !== usuario.email) {
        const otro = await this.usuarios.porEmail(email);
        if (otro && otro.id !== usuarioId) throw AppError.conflict('Ese correo ya pertenece a otra cuenta.');
        nuevos.email = email;
        campos.push('correo');
      }
    }
    if (cambios.telefono !== undefined) {
      const telefono = validarTelefono(cambios.telefono);
      if (telefono !== usuario.telefono) {
        const otro = await this.usuarios.porTelefono(telefono);
        if (otro && otro.id !== usuarioId) throw AppError.conflict('Ese teléfono ya pertenece a otra cuenta.');
        nuevos.telefono = telefono;
        campos.push('teléfono');
      }
    }
    const nuevaContrasena = cambios.contrasenaNueva ? validarContrasena(cambios.contrasenaNueva) : null;
    if (nuevaContrasena) campos.push('contraseña');

    const pideContrasena = Boolean(nuevos.email || nuevos.telefono || nuevaContrasena);
    if (pideContrasena) {
      if (!cambios.contrasenaActual) throw AppError.badRequest('Escribe tu contraseña actual para cambiar el correo, el teléfono o la contraseña.', 'CONTRASENA_ACTUAL');
      if (!(await verify(usuario.passwordHash, cambios.contrasenaActual))) throw AppError.badRequest('La contraseña actual no es correcta.', 'CONTRASENA_ACTUAL');
    }

    if (Object.keys(nuevos).length > 0) await this.usuarios.actualizar(usuarioId, nuevos);
    const sesion = nuevaContrasena ? await this.auth.cambiarContrasena(usuarioId, cambios.contrasenaActual!, nuevaContrasena) : null;
    if (campos.length > 0) {
      await this.eventos.agregar({ usuarioId, actorId: usuarioId, tipo: 'PERFIL_DATOS', detalle: `El cliente cambió: ${campos.join(', ')}`, datos: null });
    }
    logger.info('Datos del perfil actualizados', { id: usuarioId, cambios: campos.length });
    return { perfil: await this.obtener(usuarioId), token: sesion ? sesion.token : null };
  }

  async guardarEntrega(usuarioId: string, entrada: EntradaEntrega): Promise<PerfilVista> {
    logger.info('Guardando datos de entrega del perfil', { id: usuarioId });
    const usuario = await this.cargar(usuarioId);
    const anterior: PerfilEntrega | null = usuario.perfilEntrega;

    let receptor = anterior?.receptor ?? null;
    if (entrada.receptor !== undefined) {
      const crudo = entrada.receptor;
      const hayAlgo = Boolean(crudo && (limpiarTexto(crudo.nombre, 120) || limpiarTexto(crudo.cedula, 20) || limpiarTexto(crudo.telefono, 25)));
      receptor = hayAlgo
        ? {
            nombreCifrado: this.cifrado.cifrar(validarNombre(crudo?.nombre ?? '')),
            cedulaCifrada: this.cifrado.cifrar(validarCedula(crudo?.cedula ?? '')),
            telefonoCifrado: this.cifrado.cifrar(validarTelefono(crudo?.telefono ?? '')),
          }
        : null;
    }

    const destinos: PerfilEntrega['destinos'] = { ...(anterior?.destinos ?? {}) };
    for (const transportista of TRANSPORTISTAS_PERFIL) {
      if (entrada[transportista] === undefined) continue;
      const destino = limpiarDestino(entrada[transportista], transportista);
      if (destino) destinos[transportista] = destino;
      else delete destinos[transportista];
    }

    const perfil: PerfilEntrega | null = receptor || Object.keys(destinos).length > 0 ? { receptor, destinos } : null;
    await this.usuarios.actualizar(usuarioId, { perfilEntrega: perfil });
    await this.eventos.agregar({ usuarioId, actorId: usuarioId, tipo: 'PERFIL_ENTREGA', detalle: 'El cliente actualizó sus datos de entrega', datos: null });
    return this.obtener(usuarioId);
  }

  async corregirCedula(actor: Actor, usuarioId: string, cedulaNueva: string, motivo: string): Promise<UsuarioPublico> {
    if (actor.rol !== 'ADMIN') throw AppError.forbidden('Solo el administrador puede corregir una cédula.');
    const razon = limpiarTexto(motivo, 200);
    if (razon.length < MIN_MOTIVO) throw AppError.badRequest(`Escribe el motivo de la corrección (mínimo ${MIN_MOTIVO} letras).`);
    const usuario = await this.cargar(usuarioId);
    if (usuario.rol !== 'CLIENTE') throw AppError.badRequest('Solo se corrige la cédula de clientes.');
    const cedula = validarCedula(cedulaNueva);
    const huella = this.cifrado.huella(cedula);
    const otro = await this.usuarios.porCedulaHuella(huella);
    if (otro && otro.id !== usuarioId) throw AppError.conflict('Esa cédula ya pertenece a otra cuenta. No se hizo el cambio.');
    const anterior = enmascararCedula(this.cifrado.descifrar(usuario.cedulaCifrada));
    const actualizado = await this.usuarios.actualizar(usuarioId, { cedulaCifrada: this.cifrado.cifrar(cedula), cedulaHuella: huella });
    await this.eventos.agregar({
      usuarioId,
      actorId: actor.id,
      tipo: 'CEDULA_CORREGIDA',
      detalle: `Cédula corregida por el administrador: ${razon}`,
      datos: { anterior, nueva: enmascararCedula(cedula) },
    });
    logger.info('Cédula corregida por el administrador', { id: usuarioId, actor: actor.id });
    return this.auth.aPublico(actualizado);
  }

  async historial(actor: Actor, usuarioId: string): Promise<EventoCuentaVista[]> {
    if (actor.rol !== 'ADMIN') throw AppError.forbidden();
    await this.cargar(usuarioId);
    const eventos: EventoCuenta[] = await this.eventos.deUsuario(usuarioId);
    return eventos.map((e) => ({ id: e.id, tipo: e.tipo, detalle: e.detalle, creadoEn: e.creadoEn.toISOString() }));
  }
}
