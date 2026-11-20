import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { randomBytes, randomInt } from 'node:crypto';
import type { CifradoCedula } from '../domain/cifrado';
import {
  normalizarCodigoCasillero,
  validarCedula,
  validarContrasena,
  validarEmail,
  validarNombre,
  validarTelefono,
} from '../domain/validaciones';
import type { IntentoRepository, Rol, Usuario, UsuarioRepository } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { enmascararCedula } from '../utils/mask';

export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
  codigo: string;
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
  v: number;
}

export interface ActorAuth {
  id: string;
  rol: Rol;
}

const MAX_INTENTOS = 5;
const MAX_REINTENTOS_CODIGO = 50;
const BLOQUEO_MS = 10 * 60 * 1000;
const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 7;
const CODIGO_INTERNO_SIN_DUENO = 'VENV-000000';

export class LimitadorIntentos {
  constructor(
    private readonly repositorio: IntentoRepository,
    private readonly reloj: () => number = () => Date.now(),
  ) {}

  async verificar(clave: string): Promise<void> {
    const registro = await this.repositorio.obtener(clave);
    if (registro && registro.cuenta >= MAX_INTENTOS && registro.hasta.getTime() > this.reloj()) {
      logger.warn('Ingreso bloqueado por demasiados intentos');
      throw AppError.tooMany();
    }
  }

  async registrarFallo(clave: string): Promise<void> {
    const actual = await this.repositorio.obtener(clave);
    const vigente = actual && actual.hasta.getTime() > this.reloj() ? actual.cuenta : 0;
    await this.repositorio.guardar(clave, { cuenta: vigente + 1, hasta: new Date(this.reloj() + BLOQUEO_MS) });
  }

  async limpiar(clave: string): Promise<void> {
    await this.repositorio.borrar(clave);
  }
}

export class AuthService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly cifrado: CifradoCedula,
    private readonly secretoJwt: string,
    private readonly limitador: LimitadorIntentos,
    private readonly generarDigitos: () => string = () => String(randomInt(0, 1000000)).padStart(6, '0'),
  ) {
    if (!secretoJwt || secretoJwt.length < 16) throw new Error('JWT_SECRET debe tener al menos 16 caracteres.');
  }

  aPublico(usuario: Usuario): UsuarioPublico {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      codigo: usuario.codigo,
      telefono: usuario.telefono,
      cedulaEnmascarada: enmascararCedula(this.cifrado.descifrar(usuario.cedulaCifrada)),
      rol: usuario.rol,
      activo: usuario.activo,
      debeCambiarClave: usuario.debeCambiarClave,
    };
  }

  private emitir(usuario: Usuario): SesionEmitida {
    const payload: PayloadSesion = { sub: usuario.id, rol: usuario.rol, v: usuario.sesionVersion };
    const token = jwt.sign(payload, this.secretoJwt, { expiresIn: DURACION_SESION_SEGUNDOS });
    return { token, usuario: this.aPublico(usuario) };
  }

  async registrarCliente(datos: { nombre: string; cedula: string; email: string; telefono: string; contrasena: string }): Promise<SesionEmitida> {
    logger.info('Registro de cliente iniciado');
    const nombre = validarNombre(datos.nombre);
    const cedula = validarCedula(datos.cedula);
    const email = validarEmail(datos.email);
    const telefono = validarTelefono(datos.telefono);
    const contrasena = validarContrasena(datos.contrasena);
    return this.crearYEmitir({ nombre, cedula, email, telefono, contrasena, rol: 'CLIENTE', debeCambiarClave: false });
  }

  async crearPersonal(
    datos: { nombre: string; cedula: string; email: string; telefono: string; contrasena: string; rol: 'OPERADOR' | 'ADMIN' },
    actorId: string,
  ): Promise<UsuarioPublico> {
    const sesion = await this.crearYEmitir({
      nombre: validarNombre(datos.nombre),
      cedula: validarCedula(datos.cedula),
      email: validarEmail(datos.email),
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
    email: string;
    telefono: string;
    contrasena: string;
    rol: Rol;
    debeCambiarClave: boolean;
  }): Promise<SesionEmitida> {
    const huella = this.cifrado.huella(datos.cedula);
    if (
      (await this.usuarios.porCedulaHuella(huella)) ||
      (await this.usuarios.porTelefono(datos.telefono)) ||
      (await this.usuarios.porEmail(datos.email))
    ) {
      throw AppError.conflict('Ya existe una cuenta con esos datos. Intenta iniciar sesión o pide ayuda en la oficina.');
    }
    const usuario = await this.usuarios.crear({
      nombre: datos.nombre,
      cedulaCifrada: this.cifrado.cifrar(datos.cedula),
      cedulaHuella: huella,
      email: datos.email,
      codigo: await this.codigoLibre(),
      telefono: datos.telefono,
      passwordHash: await hash(datos.contrasena),
      rol: datos.rol,
      activo: true,
      debeCambiarClave: datos.debeCambiarClave,
    });
    logger.info('Usuario creado', { id: usuario.id, rol: usuario.rol });
    return this.emitir(usuario);
  }

  async codigoLibre(): Promise<string> {
    for (let intento = 1; intento <= MAX_REINTENTOS_CODIGO; intento += 1) {
      const candidato = `VENV-${this.generarDigitos()}`;
      if (candidato !== CODIGO_INTERNO_SIN_DUENO && !(await this.usuarios.porCodigo(candidato))) {
        logger.info('Número de casillero asignado', { intento });
        return candidato;
      }
      logger.warn('Número de casillero repetido, se genera otro', { intento });
    }
    throw new AppError('No se pudo generar un número de casillero. Intenta de nuevo.', 500);
  }

  private claveIntentos(identificador: string): string {
    return this.cifrado.huella(`acceso:${identificador}`);
  }

  private async buscarPorIdentificador(identificador: string): Promise<{ clave: string; usuario: Usuario | null }> {
    const texto = typeof identificador === 'string' ? identificador.trim() : '';
    if (texto.includes('@')) {
      const email = texto.toLowerCase().slice(0, 120);
      return { clave: this.claveIntentos(email), usuario: await this.usuarios.porEmail(email) };
    }
    const codigo = normalizarCodigoCasillero(texto);
    if (codigo) return { clave: this.claveIntentos(codigo), usuario: await this.usuarios.porCodigo(codigo) };
    return { clave: this.claveIntentos(`otro:${texto.toLowerCase().slice(0, 40)}`), usuario: null };
  }

  async iniciarSesion(identificador: string, contrasena: string): Promise<SesionEmitida> {
    const { clave, usuario } = await this.buscarPorIdentificador(identificador);
    await this.limitador.verificar(clave);
    const valida = usuario && usuario.activo ? await verify(usuario.passwordHash, contrasena) : false;
    if (!usuario || !valida) {
      await this.limitador.registrarFallo(clave);
      logger.warn('Inicio de sesión fallido');
      throw AppError.unauthorized('Correo, número de casillero o contraseña incorrectos.');
    }
    await this.limitador.limpiar(clave);
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
    if ((payload.v ?? 0) !== usuario.sesionVersion) {
      logger.info('Sesión rechazada: la clave o el estado de la cuenta cambió', { id: usuario.id });
      throw AppError.unauthorized('Tu sesión se cerró. Inicia sesión de nuevo.');
    }
    return usuario;
  }

  async cambiarContrasena(usuarioId: string, actual: string, nueva: string): Promise<SesionEmitida> {
    const usuario = await this.usuarios.porId(usuarioId);
    if (!usuario) throw AppError.notFound('El usuario no existe.');
    if (!(await verify(usuario.passwordHash, actual))) throw AppError.badRequest('La contraseña actual no es correcta.');
    const validada = validarContrasena(nueva);
    await this.usuarios.actualizar(usuarioId, { passwordHash: await hash(validada), debeCambiarClave: false });
    const renovado = await this.usuarios.renovarSesiones(usuarioId);
    logger.info('Contraseña cambiada; otras sesiones cerradas', { id: usuarioId });
    return this.emitir(renovado);
  }

  async asignarTemporal(usuarioId: string, actor: ActorAuth): Promise<string> {
    const usuario = await this.usuarios.porId(usuarioId);
    if (!usuario || usuario.codigo === CODIGO_INTERNO_SIN_DUENO) throw AppError.notFound('El usuario no existe.');
    if (usuario.rol !== 'CLIENTE' && actor.rol !== 'ADMIN') {
      logger.warn('Un operador intentó cambiar la clave de una cuenta del personal', { actor: actor.id, objetivo: usuarioId });
      throw AppError.forbidden('Solo el administrador puede cambiar la clave de una cuenta del personal.');
    }
    const temporal = randomBytes(5).toString('hex');
    await this.usuarios.actualizar(usuarioId, { passwordHash: await hash(temporal), debeCambiarClave: true });
    await this.usuarios.renovarSesiones(usuarioId);
    logger.info('Contraseña temporal asignada; sesiones cerradas', { id: usuarioId, actor: actor.id });
    return temporal;
  }

  async cambiarEstadoActivo(usuarioId: string, activo: boolean, actorId: string): Promise<UsuarioPublico> {
    if (usuarioId === actorId && !activo) throw AppError.badRequest('No puedes desactivar tu propia cuenta.');
    const cambiado = await this.usuarios.actualizar(usuarioId, { activo });
    const actualizado = activo ? cambiado : await this.usuarios.renovarSesiones(usuarioId);
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
    const clientes = (await this.usuarios.listar(['CLIENTE'])).filter((c) => c.codigo !== CODIGO_INTERNO_SIN_DUENO);
    const coincidencias = clientes.filter((c) => {
      if (c.nombre.toLowerCase().includes(limpio)) return true;
      if (c.codigo.toLowerCase().includes(limpio) || c.email.includes(limpio)) return true;
      if (digitos.length >= 4 && c.telefono.includes(digitos)) return true;
      if (digitos.length >= 5 && this.cifrado.huella(digitos) === c.cedulaHuella) return true;
      return false;
    });
    return coincidencias.slice(0, 20).map((c) => this.aPublico(c));
  }
}
