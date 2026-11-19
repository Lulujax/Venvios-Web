import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { CifradoCedula } from '../domain/cifrado';
import {
  validarCedula,
  validarContrasena,
  validarNombre,
  validarTelefono,
} from '../domain/validaciones';
import type { Rol, Usuario, UsuarioRepository } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { enmascararCedula } from '../utils/mask';

export interface UsuarioPublico {
  id: string;
  nombre: string;
  telefono: string;
  cedulaEnmascarada: string;
  rol: Rol;
  activo: boolean;
  debeCambiarClave: boolean;
}

export interface SesionEmitida {
  token: string;
  usuario: UsuarioPublico;
}

export interface PayloadSesion {
  sub: string;
  rol: Rol;
}

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;
const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 7;

export class LimitadorIntentos {
  private readonly fallos = new Map<string, { cuenta: number; hasta: number }>();

  constructor(private readonly reloj: () => number = () => Date.now()) {}

  verificar(clave: string): void {
    const registro = this.fallos.get(clave);
    if (registro && registro.cuenta >= MAX_INTENTOS && registro.hasta > this.reloj()) {
      throw AppError.tooMany();
    }
  }

  registrarFallo(clave: string): void {
    const actual = this.fallos.get(clave);
    const vigente = actual && actual.hasta > this.reloj() ? actual.cuenta : 0;
    this.fallos.set(clave, { cuenta: vigente + 1, hasta: this.reloj() + BLOQUEO_MS });
  }

  limpiar(clave: string): void {
    this.fallos.delete(clave);
  }
}

export class AuthService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrado: CifradoCedula,
    private readonly secretoJwt: string,
    private readonly limitador: LimitadorIntentos = new LimitadorIntentos(),
  ) {
    if (!secretoJwt || secretoJwt.length < 16) throw new Error('JWT_SECRET debe tener al menos 16 caracteres.');
  }

  aPublico(usuario: Usuario): UsuarioPublico {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      cedulaEnmascarada: enmascararCedula(this.cifrado.descifrar(usuario.cedulaCifrada)),
      rol: usuario.rol,
      activo: usuario.activo,
      debeCambiarClave: usuario.debeCambiarClave,
    };
  }

  private emitir(usuario: Usuario): SesionEmitida {
    const payload: PayloadSesion = { sub: usuario.id, rol: usuario.rol };
    const token = jwt.sign(payload, this.secretoJwt, { expiresIn: DURACION_SESION_SEGUNDOS });
    return { token, usuario: this.aPublico(usuario) };
  }

  async registrarCliente(datos: { nombre: string; cedula: string; telefono: string; contrasena: string }): Promise<SesionEmitida> {
    logger.info('Registro de cliente iniciado');
    const nombre = validarNombre(datos.nombre);
    const cedula = validarCedula(datos.cedula);
    const telefono = validarTelefono(datos.telefono);
    const contrasena = validarContrasena(datos.contrasena);
    return this.crearYEmitir({ nombre, cedula, telefono, contrasena, rol: 'CLIENTE', debeCambiarClave: false });
  }

  async crearPersonal(
    datos: { nombre: string; cedula: string; telefono: string; contrasena: string; rol: 'OPERADOR' | 'ADMIN' },
    actorId: string,
  ): Promise<UsuarioPublico> {
    const sesion = await this.crearYEmitir({
      nombre: validarNombre(datos.nombre),
      cedula: validarCedula(datos.cedula),
      telefono: validarTelefono(datos.telefono),
      contrasena: validarContrasena(datos.contrasena),
      rol: datos.rol,
      debeCambiarClave: true,
    });
    logger.info('Personal creado', { id: sesion.usuario.id, rol: datos.rol, actor: actorId });
    return sesion.usuario;
  }

  private async crearYEmitir(datos: {
    nombre: string;
    cedula: string;
    telefono: string;
    contrasena: string;
    rol: Rol;
    debeCambiarClave: boolean;
  }): Promise<SesionEmitida> {
    const huella = this.cifrado.huella(datos.cedula);
    if ((await this.usuarios.porCedulaHuella(huella)) || (await this.usuarios.porTelefono(datos.telefono))) {
      throw AppError.conflict('Ya existe una cuenta con esos datos. Intenta iniciar sesión o pide ayuda en la oficina.');
    }
    const usuario = await this.usuarios.crear({
      nombre: datos.nombre,
      cedulaCifrada: this.cifrado.cifrar(datos.cedula),
      cedulaHuella: huella,
      telefono: datos.telefono,
      passwordHash: await hash(datos.contrasena),
      rol: datos.rol,
      activo: true,
      debeCambiarClave: datos.debeCambiarClave,
    });
    logger.info('Usuario creado', { id: usuario.id, rol: usuario.rol });
    return this.emitir(usuario);
  }

  async iniciarSesion(telefonoCrudo: string, contrasena: string): Promise<SesionEmitida> {
    const telefono = validarTelefono(telefonoCrudo);
    this.limitador.verificar(telefono);
    const usuario = await this.usuarios.porTelefono(telefono);
    const valida = usuario && usuario.activo ? await verify(usuario.passwordHash, contrasena) : false;
    if (!usuario || !valida) {
      this.limitador.registrarFallo(telefono);
      logger.warn('Inicio de sesión fallido');
      throw AppError.unauthorized('Teléfono o contraseña incorrectos.');
    }
    this.limitador.limpiar(telefono);
    logger.info('Inicio de sesión correcto', { id: usuario.id, rol: usuario.rol });
    return this.emitir(usuario);
  }

  async verificarToken(token: string): Promise<Usuario> {
    let payload: PayloadSesion;
    try {
      payload = jwt.verify(token, this.secretoJwt) as PayloadSesion;
    } catch {
      throw AppError.unauthorized('Tu sesión venció. Inicia sesión de nuevo.');
    }
    const usuario = await this.usuarios.porId(payload.sub);
    if (!usuario || !usuario.activo) throw AppError.unauthorized('Tu cuenta no está activa.');
    return usuario;
  }

  async cambiarContrasena(usuarioId: string, actual: string, nueva: string): Promise<void> {
    const usuario = await this.usuarios.porId(usuarioId);
    if (!usuario) throw AppError.notFound('El usuario no existe.');
    if (!(await verify(usuario.passwordHash, actual))) throw AppError.badRequest('La contraseña actual no es correcta.');
    const validada = validarContrasena(nueva);
    await this.usuarios.actualizar(usuarioId, { passwordHash: await hash(validada), debeCambiarClave: false });
    logger.info('Contraseña cambiada', { id: usuarioId });
  }

  async asignarTemporal(usuarioId: string, actorId: string): Promise<string> {
    const usuario = await this.usuarios.porId(usuarioId);
    if (!usuario) throw AppError.notFound('El usuario no existe.');
    const temporal = randomBytes(5).toString('hex');
    await this.usuarios.actualizar(usuarioId, { passwordHash: await hash(temporal), debeCambiarClave: true });
    logger.info('Contraseña temporal asignada', { id: usuarioId, actor: actorId });
    return temporal;
  }

  async cambiarEstadoActivo(usuarioId: string, activo: boolean, actorId: string): Promise<UsuarioPublico> {
    if (usuarioId === actorId && !activo) throw AppError.badRequest('No puedes desactivar tu propia cuenta.');
    const actualizado = await this.usuarios.actualizar(usuarioId, { activo });
    logger.info('Estado de usuario cambiado', { id: usuarioId, activo, actor: actorId });
    return this.aPublico(actualizado);
  }

  async listar(roles?: Rol[]): Promise<UsuarioPublico[]> {
    return (await this.usuarios.listar(roles)).map((u) => this.aPublico(u));
  }

  async buscarClientes(texto: string): Promise<UsuarioPublico[]> {
    const limpio = texto.trim().toLowerCase();
    if (limpio.length < 3) return [];
    const digitos = limpio.replace(/\D/g, '');
    const clientes = await this.usuarios.listar(['CLIENTE']);
    const coincidencias = clientes.filter((c) => {
      if (c.nombre.toLowerCase().includes(limpio)) return true;
      if (digitos.length >= 4 && c.telefono.includes(digitos)) return true;
      if (digitos.length >= 5 && this.cifrado.huella(digitos) === c.cedulaHuella) return true;
      return false;
    });
    return coincidencias.slice(0, 20).map((c) => this.aPublico(c));
  }
}
