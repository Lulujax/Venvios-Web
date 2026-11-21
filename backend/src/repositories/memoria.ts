import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { EstadoEnvio } from '../domain/estados';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { coincideBusqueda, partesBusqueda } from './busqueda';
import type {
  CambiosEnvio,
  CambiosPago,
  CambiosPaquete,
  CambiosUsuario,
  ConfigRepository,
  EntregaGuardada,
  Envio,
  EnvioRepository,
  EstadoPago,
  EstadoPaquete,
  Evento,
  EventoCuenta,
  EventoCuentaRepository,
  FiltroEnvios,
  IntentoGuardado,
  IntentoRepository,
  NuevoEnvio,
  NuevoPaquete,
  NuevoUsuario,
  Pago,
  PagoRepository,
  Paquete,
  Repositorios,
  Rol,
  TasaGuardada,
  Usuario,
  UsuarioRepository,
} from './tipos';

const ENTREGA_VACIA: EntregaGuardada = {
  nombreCifrado: null,
  cedulaCifrada: null,
  telefonoCifrado: null,
  agencia: null,
  ciudad: null,
  estado: null,
};

function copiar<T>(valor: T): T {
  return structuredClone(valor);
}

type Restaurar = () => void;

interface ConInstantanea {
  instantanea(): Restaurar;
}

function instantaneaDeMapa<K, V>(mapa: Map<K, V>): Restaurar {
  const copia = new Map([...mapa.entries()].map(([clave, valor]) => [clave, copiar(valor)] as const));
  return () => {
    mapa.clear();
    for (const [clave, valor] of copia) mapa.set(clave, valor);
  };
}

export class UsuarioMemoria implements UsuarioRepository, ConInstantanea {
  private readonly datos = new Map<string, Usuario>();

  instantanea(): Restaurar {
    return instantaneaDeMapa(this.datos);
  }

  async crear(nuevo: NuevoUsuario): Promise<Usuario> {
    const existente = [...this.datos.values()].find(
      (u) => u.cedulaHuella === nuevo.cedulaHuella || u.telefono === nuevo.telefono || u.email === nuevo.email || u.codigo === nuevo.codigo,
    );
    if (existente) throw AppError.conflict('Ya existe una cuenta con esa cédula, ese correo o ese teléfono.');
    const usuario: Usuario = { ...nuevo, perfilEntrega: nuevo.perfilEntrega ?? null, sesionVersion: 0, id: randomUUID(), creadoEn: new Date() };
    this.datos.set(usuario.id, usuario);
    return copiar(usuario);
  }

  leerSinCopiar(id: string): Usuario | undefined {
    return this.datos.get(id);
  }

  async porId(id: string): Promise<Usuario | null> {
    const usuario = this.datos.get(id);
    return usuario ? copiar(usuario) : null;
  }

  async porIds(ids: string[]): Promise<Usuario[]> {
    return [...new Set(ids)].map((id) => this.datos.get(id)).filter((u): u is Usuario => Boolean(u)).map(copiar);
  }

  private buscar(condicion: (u: Usuario) => boolean): Usuario | null {
    const usuario = [...this.datos.values()].find(condicion);
    return usuario ? copiar(usuario) : null;
  }

  async porCedulaHuella(huella: string): Promise<Usuario | null> {
    return this.buscar((u) => u.cedulaHuella === huella);
  }

  async porTelefono(telefono: string): Promise<Usuario | null> {
    return this.buscar((u) => u.telefono === telefono);
  }

  async porEmail(email: string): Promise<Usuario | null> {
    return this.buscar((u) => u.email === email);
  }

  async porCodigo(codigo: string): Promise<Usuario | null> {
    return this.buscar((u) => u.codigo === codigo);
  }

  async listar(roles?: Rol[]): Promise<Usuario[]> {
    return [...this.datos.values()].filter((u) => !roles || roles.includes(u.rol)).map(copiar);
  }

  async actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario> {
    const actual = this.datos.get(id);
    if (!actual) throw AppError.notFound('El usuario no existe.');
    const actualizado = { ...actual, ...cambios };
    this.datos.set(id, actualizado);
    return copiar(actualizado);
  }

  async renovarSesiones(id: string): Promise<Usuario> {
    const actual = this.datos.get(id);
    if (!actual) throw AppError.notFound('El usuario no existe.');
    const actualizado = { ...actual, sesionVersion: actual.sesionVersion + 1 };
    this.datos.set(id, actualizado);
    return copiar(actualizado);
  }
}

export class EventoCuentaMemoria implements EventoCuentaRepository, ConInstantanea {
  private readonly datos = new Map<string, EventoCuenta>();

  instantanea(): Restaurar {
    return instantaneaDeMapa(this.datos);
  }

  async agregar(evento: Omit<EventoCuenta, 'id' | 'creadoEn'>): Promise<EventoCuenta> {
    const creado: EventoCuenta = { ...copiar(evento), id: randomUUID(), creadoEn: new Date() };
    this.datos.set(creado.id, creado);
    return copiar(creado);
  }

  async deUsuario(usuarioId: string): Promise<EventoCuenta[]> {
    return [...this.datos.values()]
      .filter((e) => e.usuarioId === usuarioId)
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
      .map(copiar);
  }
}

export class EnvioMemoria implements EnvioRepository, ConInstantanea {
  private readonly envios = new Map<string, Envio>();
  private readonly eventos: Evento[] = [];

  constructor(private readonly usuarios: UsuarioMemoria) {}

  instantanea(): Restaurar {
    const restaurarEnvios = instantaneaDeMapa(this.envios);
    const cantidadEventos = this.eventos.length;
    return () => {
      restaurarEnvios();
      this.eventos.splice(cantidadEventos);
    };
  }

  private construirPaquete(envioId: string, nuevo: NuevoPaquete): Paquete {
    return {
      id: randomUUID(),
      envioId,
      trackingTexto: nuevo.trackingTexto,
      trackingNormalizado: nuevo.trackingNormalizado,
      estado: 'ESPERADO',
      pesoCentesimas: null,
      fotoPath: null,
      avisadoEn: null,
      avisadoPorId: null,
      recibidoPorId: null,
      recibidoEn: null,
    };
  }

  private verificarTrackingLibre(normalizados: string[]): void {
    for (const envio of this.envios.values()) {
      for (const paquete of envio.paquetes) {
        if (normalizados.includes(paquete.trackingNormalizado)) {
          throw AppError.conflict('Ese tracking ya está registrado.');
        }
      }
    }
  }

  private buscar(condicion: (e: Envio) => boolean): Envio | null {
    const encontrado = [...this.envios.values()].find(condicion);
    return encontrado ? copiar(encontrado) : null;
  }

  async crear(datos: NuevoEnvio): Promise<Envio> {
    this.verificarTrackingLibre(datos.paquetes.map((p) => p.trackingNormalizado));
    const id = randomUUID();
    const ahora = new Date();
    const tipo = datos.tipo ?? 'ALERTA';
    const envio: Envio = {
      id,
      tipo,
      clienteId: datos.clienteId,
      modalidad: datos.modalidad,
      transportista: datos.transportista,
      tienda: datos.tienda,
      valorDeclaradoCentavos: datos.valorDeclaradoCentavos,
      estado: datos.estado ?? (tipo === 'CONSOLIDADO' ? 'POR_CONSOLIDAR' : 'PREALERTADO'),
      pesoTotalCentesimas: null,
      pesoCobrableCentesimas: null,
      fleteCentavos: null,
      seguroCentavos: null,
      totalCentavos: null,
      entrega: { ...ENTREGA_VACIA },
      guiaVenezolana: null,
      guiaFotoPath: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
      paquetes: datos.paquetes.map((p) => this.construirPaquete(id, p)),
    };
    this.envios.set(id, envio);
    return copiar(envio);
  }

  async porId(id: string): Promise<Envio | null> {
    const envio = this.envios.get(id);
    return envio ? copiar(envio) : null;
  }

  private coincideTexto(envio: Envio, texto: string | undefined): boolean {
    const partes = partesBusqueda(texto);
    if (!partes) return true;
    const cliente = this.usuarios.leerSinCopiar(envio.clienteId);
    return coincideBusqueda(partes, {
      nombre: cliente?.nombre ?? '',
      codigo: cliente?.codigo ?? '',
      telefono: cliente?.telefono ?? '',
      trackings: envio.paquetes.map((p) => p.trackingTexto),
      guia: envio.guiaVenezolana,
    });
  }

  async listar(filtro: FiltroEnvios): Promise<Envio[]> {
    const lista = [...this.envios.values()]
      .filter((e) => !filtro.clienteId || e.clienteId === filtro.clienteId)
      .filter((e) => !filtro.estados || filtro.estados.includes(e.estado))
      .filter((e) => !filtro.excluirEstados || !filtro.excluirEstados.includes(e.estado))
      .filter((e) => this.coincideTexto(e, filtro.texto))
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
    return (filtro.limite === undefined ? lista : lista.slice(0, filtro.limite)).map(copiar);
  }

  async porTracking(trackingNormalizado: string): Promise<Envio | null> {
    return this.buscar((e) => e.paquetes.some((p) => p.trackingNormalizado === trackingNormalizado));
  }

  async porPaqueteId(paqueteId: string): Promise<Envio | null> {
    return this.buscar((e) => e.paquetes.some((p) => p.id === paqueteId));
  }

  async porFotoPaquete(ruta: string): Promise<Envio | null> {
    return this.buscar((e) => e.paquetes.some((p) => p.fotoPath === ruta));
  }

  async actualizar(id: string, cambios: CambiosEnvio, estadoEsperado?: EstadoEnvio): Promise<Envio> {
    const actual = this.envios.get(id);
    if (!actual) throw AppError.notFound('El envío no existe.');
    if (estadoEsperado !== undefined && actual.estado !== estadoEsperado) {
      logger.warn('Cambio simultáneo detectado en un envío', { envio: id });
      throw AppError.cambioSimultaneo();
    }
    const { entrega, ...resto } = cambios;
    const actualizado: Envio = {
      ...actual,
      ...resto,
      entrega: { ...actual.entrega, ...(entrega ?? {}) },
      actualizadoEn: new Date(),
    };
    this.envios.set(id, actualizado);
    return copiar(actualizado);
  }

  async actualizarPaquete(id: string, cambios: CambiosPaquete, estadoEsperado?: EstadoPaquete): Promise<Paquete> {
    for (const envio of this.envios.values()) {
      const indice = envio.paquetes.findIndex((p) => p.id === id);
      if (indice < 0) continue;
      if (estadoEsperado !== undefined && envio.paquetes[indice]!.estado !== estadoEsperado) {
        logger.warn('Cambio simultáneo detectado en un paquete', { paquete: id });
        throw AppError.cambioSimultaneo();
      }
      envio.paquetes[indice] = { ...envio.paquetes[indice]!, ...cambios };
      envio.actualizadoEn = new Date();
      return copiar(envio.paquetes[indice]!);
    }
    throw AppError.notFound('El paquete no existe.');
  }

  async agregarPaquetes(envioId: string, nuevos: NuevoPaquete[]): Promise<Paquete[]> {
    const envio = this.envios.get(envioId);
    if (!envio) throw AppError.notFound('El envío no existe.');
    this.verificarTrackingLibre(nuevos.map((p) => p.trackingNormalizado));
    const creados = nuevos.map((p) => this.construirPaquete(envioId, p));
    envio.paquetes.push(...creados);
    return copiar(creados);
  }

  async moverPaquetes(paqueteIds: string[], nuevoEnvioId: string, origenes?: string[]): Promise<void> {
    const destino = this.envios.get(nuevoEnvioId);
    if (!destino) throw AppError.notFound('El envío destino no existe.');
    const movibles = [...this.envios.values()]
      .filter((e) => e.id !== nuevoEnvioId && (!origenes || origenes.includes(e.id)))
      .flatMap((e) => e.paquetes.filter((p) => paqueteIds.includes(p.id)));
    if (movibles.length !== new Set(paqueteIds).size) {
      logger.warn('Paquetes que ya no están donde se esperaba', { destino: nuevoEnvioId });
      throw AppError.cambioSimultaneo();
    }
    for (const envio of this.envios.values()) {
      if (envio.id === nuevoEnvioId) continue;
      const quedan: Paquete[] = [];
      for (const paquete of envio.paquetes) {
        if (paqueteIds.includes(paquete.id)) destino.paquetes.push({ ...paquete, envioId: nuevoEnvioId });
        else quedan.push(paquete);
      }
      envio.paquetes = quedan;
    }
  }

  async agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento> {
    const creado: Evento = { ...evento, id: randomUUID(), creadoEn: new Date() };
    this.eventos.push(creado);
    return copiar(creado);
  }

  async eventosDe(envioId: string): Promise<Evento[]> {
    return this.eventos
      .filter((e) => e.envioId === envioId)
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime())
      .map(copiar);
  }
}

export class PagoMemoria implements PagoRepository, ConInstantanea {
  private readonly datos = new Map<string, Pago>();

  instantanea(): Restaurar {
    return instantaneaDeMapa(this.datos);
  }

  private filtrar(condicion: (p: Pago) => boolean): Pago[] {
    return [...this.datos.values()]
      .filter(condicion)
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime())
      .map(copiar);
  }

  async crear(nuevo: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    const pago: Pago = { ...nuevo, id: randomUUID(), creadoEn: new Date() };
    this.datos.set(pago.id, pago);
    return copiar(pago);
  }

  async porId(id: string): Promise<Pago | null> {
    const pago = this.datos.get(id);
    return pago ? copiar(pago) : null;
  }

  async deEnvio(envioId: string): Promise<Pago[]> {
    return this.filtrar((p) => p.envioId === envioId);
  }

  async deEnvios(envioIds: string[]): Promise<Pago[]> {
    return this.filtrar((p) => envioIds.includes(p.envioId));
  }

  async porEstado(estado: EstadoPago): Promise<Pago[]> {
    return this.filtrar((p) => p.estado === estado);
  }

  async actualizar(id: string, cambios: CambiosPago, estadoEsperado?: EstadoPago): Promise<Pago> {
    const actual = this.datos.get(id);
    if (!actual) throw AppError.notFound('El pago no existe.');
    if (estadoEsperado !== undefined && actual.estado !== estadoEsperado) {
      logger.warn('Cambio simultáneo detectado en un pago', { pago: id });
      throw AppError.cambioSimultaneo();
    }
    const actualizado = { ...actual, ...cambios };
    this.datos.set(id, actualizado);
    return copiar(actualizado);
  }
}

export class ConfigMemoria implements ConfigRepository, ConInstantanea {
  private readonly valores = new Map<string, unknown>();
  private readonly tasas = new Map<string, TasaGuardada>();

  instantanea(): Restaurar {
    const restaurarValores = instantaneaDeMapa(this.valores);
    const restaurarTasas = instantaneaDeMapa(this.tasas);
    return () => {
      restaurarValores();
      restaurarTasas();
    };
  }

  async obtener<T>(clave: string): Promise<T | null> {
    return this.valores.has(clave) ? copiar(this.valores.get(clave) as T) : null;
  }

  async guardar(clave: string, valor: unknown): Promise<void> {
    this.valores.set(clave, copiar(valor));
  }

  async tasaDeFecha(fecha: string): Promise<TasaGuardada | null> {
    const tasa = this.tasas.get(fecha);
    return tasa ? { ...tasa } : null;
  }

  async ultimaTasa(): Promise<TasaGuardada | null> {
    const fechas = [...this.tasas.keys()].sort();
    const ultima = fechas[fechas.length - 1];
    return ultima ? { ...this.tasas.get(ultima)! } : null;
  }

  async guardarTasa(tasa: TasaGuardada): Promise<void> {
    this.tasas.set(tasa.fecha, { ...tasa });
  }
}

export class IntentoMemoria implements IntentoRepository {
  private readonly datos = new Map<string, IntentoGuardado>();

  async obtener(clave: string): Promise<IntentoGuardado | null> {
    const intento = this.datos.get(clave);
    return intento ? copiar(intento) : null;
  }

  async guardar(clave: string, intento: IntentoGuardado): Promise<void> {
    this.datos.set(clave, copiar(intento));
  }

  async borrar(clave: string): Promise<void> {
    this.datos.delete(clave);
  }
}

class TransaccionesMemoria {
  private readonly dentro = new AsyncLocalStorage<true>();
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private readonly participantes: ConInstantanea[]) {}

  ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.dentro.getStore()) return trabajo();
    const turno = this.cola.then(() => this.ejecutarEnTurno(trabajo));
    this.cola = turno.catch(() => undefined);
    return turno;
  }

  private async ejecutarEnTurno<T>(trabajo: () => Promise<T>): Promise<T> {
    const restauraciones = this.participantes.map((p) => p.instantanea());
    try {
      return await this.dentro.run(true, trabajo);
    } catch (error) {
      for (const restaurar of restauraciones) restaurar();
      logger.warn('Transacción en memoria revertida');
      throw error;
    }
  }
}

export function crearRepositoriosMemoria(): Repositorios {
  const usuarios = new UsuarioMemoria();
  const envios = new EnvioMemoria(usuarios);
  const pagos = new PagoMemoria();
  const config = new ConfigMemoria();
  const eventosCuenta = new EventoCuentaMemoria();
  const transacciones = new TransaccionesMemoria([usuarios, envios, pagos, config, eventosCuenta]);
  return {
    usuarios,
    eventosCuenta,
    envios,
    pagos,
    config,
    intentos: new IntentoMemoria(),
    enTransaccion: (trabajo) => transacciones.ejecutar(trabajo),
  };
}
