import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import type { EstadoEnvio } from '../domain/estados';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { MIN_DIGITOS_TELEFONO, partesBusqueda } from './busqueda';
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
  PerfilEntrega,
  Repositorios,
  Rol,
  TasaGuardada,
  Usuario,
  UsuarioRepository,
} from './tipos';

type ClienteBd = PrismaClient | Prisma.TransactionClient;

const ESPERA_MAXIMA_TRANSACCION_MS = 10_000;
const DURACION_MAXIMA_TRANSACCION_MS = 20_000;

let cliente: PrismaClient | null = null;

export function obtenerPrisma(): PrismaClient {
  if (!cliente) cliente = new PrismaClient();
  return cliente;
}

class Conexion {
  private readonly transaccionActual = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly raiz: PrismaClient) {}

  get bd(): ClienteBd {
    return this.transaccionActual.getStore() ?? this.raiz;
  }

  async enTransaccion<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.transaccionActual.getStore()) return trabajo();
    return this.raiz.$transaction((tx) => this.transaccionActual.run(tx, trabajo), {
      maxWait: ESPERA_MAXIMA_TRANSACCION_MS,
      timeout: DURACION_MAXIMA_TRANSACCION_MS,
    });
  }
}

function esNoEncontrado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

async function conGuardia<T>(operacion: () => Promise<T>, conGuardiaActiva: boolean, entidad: string, id: string): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (conGuardiaActiva && esNoEncontrado(error)) {
      logger.warn('Cambio simultáneo detectado', { entidad, id });
      throw AppError.cambioSimultaneo();
    }
    throw error;
  }
}

type FilaEnvio = Prisma.EnvioGetPayload<{ include: { paquetes: true } }>;

function aEnvio(fila: FilaEnvio): Envio {
  return {
    id: fila.id,
    tipo: fila.tipo,
    clienteId: fila.clienteId,
    modalidad: fila.modalidad,
    transportista: fila.transportista,
    tienda: fila.tienda,
    valorDeclaradoCentavos: fila.valorDeclaradoCentavos,
    estado: fila.estado,
    pesoTotalCentesimas: fila.pesoTotalCentesimas,
    pesoCobrableCentesimas: fila.pesoCobrableCentesimas,
    fleteCentavos: fila.fleteCentavos,
    seguroCentavos: fila.seguroCentavos,
    totalCentavos: fila.totalCentavos,
    entrega: {
      nombreCifrado: fila.entregaNombreCifrado,
      cedulaCifrada: fila.entregaCedulaCifrada,
      telefonoCifrado: fila.entregaTelefonoCifrado,
      agencia: fila.entregaAgencia,
      ciudad: fila.entregaCiudad,
      estado: fila.entregaEstado,
    },
    guiaVenezolana: fila.guiaVenezolana,
    guiaFotoPath: fila.guiaFotoPath,
    creadoEn: fila.creadoEn,
    actualizadoEn: fila.actualizadoEn,
    paquetes: fila.paquetes.map((p) => ({ ...p })),
  };
}

function entregaAColumnas(entrega: Partial<EntregaGuardada> | undefined): Prisma.EnvioUncheckedUpdateInput {
  if (!entrega) return {};
  const columnas: Prisma.EnvioUncheckedUpdateInput = {};
  if ('nombreCifrado' in entrega) columnas.entregaNombreCifrado = entrega.nombreCifrado;
  if ('cedulaCifrada' in entrega) columnas.entregaCedulaCifrada = entrega.cedulaCifrada;
  if ('telefonoCifrado' in entrega) columnas.entregaTelefonoCifrado = entrega.telefonoCifrado;
  if ('agencia' in entrega) columnas.entregaAgencia = entrega.agencia;
  if ('ciudad' in entrega) columnas.entregaCiudad = entrega.ciudad;
  if ('estado' in entrega) columnas.entregaEstado = entrega.estado;
  return columnas;
}

function condicionDeBusqueda(texto: string | undefined): Prisma.EnvioWhereInput | undefined {
  const partes = partesBusqueda(texto);
  if (!partes) return undefined;
  const contiene = { contains: partes.texto, mode: 'insensitive' as const };
  const opciones: Prisma.EnvioWhereInput[] = [
    { cliente: { nombre: contiene } },
    { cliente: { codigo: contiene } },
    { paquetes: { some: { trackingTexto: contiene } } },
    { guiaVenezolana: contiene },
  ];
  if (partes.digitos.length >= MIN_DIGITOS_TELEFONO) opciones.push({ cliente: { telefono: { contains: partes.digitos } } });
  return { OR: opciones };
}

type FilaUsuario = Omit<Usuario, 'perfilEntrega'> & { perfilEntrega: Prisma.JsonValue | null };

function aUsuario(fila: FilaUsuario): Usuario {
  return { ...fila, perfilEntrega: (fila.perfilEntrega ?? null) as PerfilEntrega | null };
}

function aDatosUsuario(cambios: CambiosUsuario): Prisma.UsuarioUncheckedUpdateInput {
  const { perfilEntrega, ...resto } = cambios;
  if (perfilEntrega === undefined) return resto;
  return { ...resto, perfilEntrega: perfilEntrega === null ? Prisma.JsonNull : (perfilEntrega as unknown as Prisma.InputJsonValue) };
}

export class UsuarioPrisma implements UsuarioRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  async crear(datos: NuevoUsuario): Promise<Usuario> {
    const { perfilEntrega, ...resto } = datos;
    const fila = await this.bd.usuario.create({
      data: { ...resto, perfilEntrega: perfilEntrega ? (perfilEntrega as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
    });
    return aUsuario(fila);
  }

  async porId(id: string): Promise<Usuario | null> {
    const fila = await this.bd.usuario.findUnique({ where: { id } });
    return fila ? aUsuario(fila) : null;
  }

  async porIds(ids: string[]): Promise<Usuario[]> {
    if (ids.length === 0) return [];
    return (await this.bd.usuario.findMany({ where: { id: { in: [...new Set(ids)] } } })).map(aUsuario);
  }

  async porCedulaHuella(huella: string): Promise<Usuario | null> {
    const fila = await this.bd.usuario.findUnique({ where: { cedulaHuella: huella } });
    return fila ? aUsuario(fila) : null;
  }

  async porTelefono(telefono: string): Promise<Usuario | null> {
    const fila = await this.bd.usuario.findUnique({ where: { telefono } });
    return fila ? aUsuario(fila) : null;
  }

  async porEmail(email: string): Promise<Usuario | null> {
    const fila = await this.bd.usuario.findUnique({ where: { email } });
    return fila ? aUsuario(fila) : null;
  }

  async porCodigo(codigo: string): Promise<Usuario | null> {
    const fila = await this.bd.usuario.findUnique({ where: { codigo } });
    return fila ? aUsuario(fila) : null;
  }

  async listar(roles?: Rol[]): Promise<Usuario[]> {
    const filas = await this.bd.usuario.findMany({
      where: roles ? { rol: { in: roles } } : undefined,
      orderBy: { creadoEn: 'desc' },
    });
    return filas.map(aUsuario);
  }

  async actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario> {
    return aUsuario(await this.bd.usuario.update({ where: { id }, data: aDatosUsuario(cambios) }));
  }

  async renovarSesiones(id: string): Promise<Usuario> {
    return aUsuario(await this.bd.usuario.update({ where: { id }, data: { sesionVersion: { increment: 1 } } }));
  }
}

export class EventoCuentaPrisma implements EventoCuentaRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  private aEvento(fila: { id: string; usuarioId: string; actorId: string | null; tipo: string; detalle: string; datos: Prisma.JsonValue | null; creadoEn: Date }): EventoCuenta {
    return { ...fila, datos: (fila.datos ?? null) as Record<string, unknown> | null };
  }

  async agregar(evento: Omit<EventoCuenta, 'id' | 'creadoEn'>): Promise<EventoCuenta> {
    const fila = await this.bd.eventoCuenta.create({
      data: { ...evento, datos: evento.datos ? (evento.datos as Prisma.InputJsonValue) : Prisma.JsonNull },
    });
    return this.aEvento(fila);
  }

  async deUsuario(usuarioId: string): Promise<EventoCuenta[]> {
    const filas = await this.bd.eventoCuenta.findMany({ where: { usuarioId }, orderBy: { creadoEn: 'desc' } });
    return filas.map((fila) => this.aEvento(fila));
  }
}

export class EnvioPrisma implements EnvioRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  async crear(datos: NuevoEnvio): Promise<Envio> {
    const fila = await this.bd.envio.create({
      data: {
        tipo: datos.tipo ?? 'ALERTA',
        estado: datos.estado ?? (datos.tipo === 'CONSOLIDADO' ? 'POR_CONSOLIDAR' : 'PREALERTADO'),
        clienteId: datos.clienteId,
        modalidad: datos.modalidad,
        transportista: datos.transportista,
        tienda: datos.tienda,
        valorDeclaradoCentavos: datos.valorDeclaradoCentavos,
        paquetes: { create: datos.paquetes },
      },
      include: { paquetes: true },
    });
    return aEnvio(fila);
  }

  private async buscarUno(where: Prisma.EnvioWhereInput): Promise<Envio | null> {
    const fila = await this.bd.envio.findFirst({ where, include: { paquetes: true } });
    return fila ? aEnvio(fila) : null;
  }

  async porId(id: string): Promise<Envio | null> {
    const fila = await this.bd.envio.findUnique({ where: { id }, include: { paquetes: true } });
    return fila ? aEnvio(fila) : null;
  }

  async listar(filtro: FiltroEnvios): Promise<Envio[]> {
    const condiciones: Prisma.EnvioWhereInput[] = [];
    if (filtro.clienteId) condiciones.push({ clienteId: filtro.clienteId });
    if (filtro.estados) condiciones.push({ estado: { in: filtro.estados } });
    if (filtro.excluirEstados) condiciones.push({ estado: { notIn: filtro.excluirEstados } });
    const busqueda = condicionDeBusqueda(filtro.texto);
    if (busqueda) condiciones.push(busqueda);
    const filas = await this.bd.envio.findMany({
      where: { AND: condiciones },
      include: { paquetes: true },
      orderBy: { creadoEn: 'desc' },
      take: filtro.limite,
    });
    return filas.map(aEnvio);
  }

  porTracking(trackingNormalizado: string): Promise<Envio | null> {
    return this.buscarUno({ paquetes: { some: { trackingNormalizado } } });
  }

  porPaqueteId(paqueteId: string): Promise<Envio | null> {
    return this.buscarUno({ paquetes: { some: { id: paqueteId } } });
  }

  porFotoPaquete(ruta: string): Promise<Envio | null> {
    return this.buscarUno({ paquetes: { some: { fotoPath: ruta } } });
  }

  async actualizar(id: string, cambios: CambiosEnvio, estadoEsperado?: EstadoEnvio): Promise<Envio> {
    const { entrega, ...resto } = cambios;
    const where: Prisma.EnvioWhereUniqueInput = estadoEsperado === undefined ? { id } : { id, estado: estadoEsperado };
    const fila = await conGuardia(
      () => this.bd.envio.update({ where, data: { ...resto, ...entregaAColumnas(entrega) }, include: { paquetes: true } }),
      estadoEsperado !== undefined,
      'envio',
      id,
    );
    return aEnvio(fila);
  }

  actualizarPaquete(id: string, cambios: CambiosPaquete, estadoEsperado?: EstadoPaquete): Promise<Paquete> {
    const where: Prisma.PaqueteWhereUniqueInput = estadoEsperado === undefined ? { id } : { id, estado: estadoEsperado };
    return conGuardia(() => this.bd.paquete.update({ where, data: cambios }), estadoEsperado !== undefined, 'paquete', id);
  }

  async agregarPaquetes(envioId: string, paquetes: NuevoPaquete[]): Promise<Paquete[]> {
    const creados: Paquete[] = [];
    for (const paquete of paquetes) creados.push(await this.bd.paquete.create({ data: { ...paquete, envioId } }));
    return creados;
  }

  async moverPaquetes(paqueteIds: string[], nuevoEnvioId: string, origenes?: string[]): Promise<void> {
    const unicos = [...new Set(paqueteIds)];
    const where: Prisma.PaqueteWhereInput = {
      id: { in: unicos },
      envioId: origenes ? { in: origenes } : { not: nuevoEnvioId },
    };
    const resultado = await this.bd.paquete.updateMany({ where, data: { envioId: nuevoEnvioId } });
    if (resultado.count !== unicos.length) {
      logger.warn('Paquetes que ya no están donde se esperaba', { destino: nuevoEnvioId, movidos: resultado.count, pedidos: unicos.length });
      throw AppError.cambioSimultaneo();
    }
  }

  async agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento> {
    const fila = await this.bd.evento.create({
      data: {
        envioId: evento.envioId,
        actorId: evento.actorId,
        tipo: evento.tipo,
        detalle: evento.detalle,
        datos: (evento.datos as Prisma.InputJsonValue | null) ?? undefined,
      },
    });
    return { ...fila, datos: (fila.datos as Record<string, unknown> | null) ?? null };
  }

  async eventosDe(envioId: string): Promise<Evento[]> {
    const filas = await this.bd.evento.findMany({ where: { envioId }, orderBy: { creadoEn: 'asc' } });
    return filas.map((fila) => ({ ...fila, datos: (fila.datos as Record<string, unknown> | null) ?? null }));
  }
}

export class PagoPrisma implements PagoRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  crear(datos: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    return this.bd.pago.create({ data: datos });
  }

  porId(id: string): Promise<Pago | null> {
    return this.bd.pago.findUnique({ where: { id } });
  }

  deEnvio(envioId: string): Promise<Pago[]> {
    return this.bd.pago.findMany({ where: { envioId }, orderBy: { creadoEn: 'asc' } });
  }

  deEnvios(envioIds: string[]): Promise<Pago[]> {
    if (envioIds.length === 0) return Promise.resolve([]);
    return this.bd.pago.findMany({ where: { envioId: { in: envioIds } }, orderBy: { creadoEn: 'asc' } });
  }

  porEstado(estado: EstadoPago): Promise<Pago[]> {
    return this.bd.pago.findMany({ where: { estado }, orderBy: { creadoEn: 'asc' } });
  }

  actualizar(id: string, cambios: CambiosPago, estadoEsperado?: EstadoPago): Promise<Pago> {
    const where: Prisma.PagoWhereUniqueInput = estadoEsperado === undefined ? { id } : { id, estado: estadoEsperado };
    return conGuardia(() => this.bd.pago.update({ where, data: cambios }), estadoEsperado !== undefined, 'pago', id);
  }
}

export class ConfigPrisma implements ConfigRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  async obtener<T>(clave: string): Promise<T | null> {
    const fila = await this.bd.configuracion.findUnique({ where: { clave } });
    return fila ? (fila.valor as T) : null;
  }

  async guardar(clave: string, valor: unknown): Promise<void> {
    const json = valor as Prisma.InputJsonValue;
    await this.bd.configuracion.upsert({ where: { clave }, create: { clave, valor: json }, update: { valor: json } });
  }

  async tasaDeFecha(fecha: string): Promise<TasaGuardada | null> {
    const fila = await this.bd.tasaBcv.findUnique({ where: { fecha } });
    return fila ? { fecha: fila.fecha, bolivaresPorUsd: fila.bolivaresPorUsd, fuente: fila.fuente } : null;
  }

  async ultimaTasa(): Promise<TasaGuardada | null> {
    const fila = await this.bd.tasaBcv.findFirst({ orderBy: { fecha: 'desc' } });
    return fila ? { fecha: fila.fecha, bolivaresPorUsd: fila.bolivaresPorUsd, fuente: fila.fuente } : null;
  }

  async guardarTasa(tasa: TasaGuardada): Promise<void> {
    await this.bd.tasaBcv.upsert({
      where: { fecha: tasa.fecha },
      create: tasa,
      update: { bolivaresPorUsd: tasa.bolivaresPorUsd, fuente: tasa.fuente },
    });
  }
}

export class IntentoPrisma implements IntentoRepository {
  constructor(private readonly conexion: Conexion) {}

  private get bd(): ClienteBd {
    return this.conexion.bd;
  }

  async obtener(clave: string): Promise<IntentoGuardado | null> {
    const fila = await this.bd.intentoAcceso.findUnique({ where: { clave } });
    return fila ? { cuenta: fila.cuenta, hasta: fila.hasta } : null;
  }

  async guardar(clave: string, intento: IntentoGuardado): Promise<void> {
    await this.bd.intentoAcceso.upsert({ where: { clave }, create: { clave, ...intento }, update: intento });
  }

  async borrar(clave: string): Promise<void> {
    await this.bd.intentoAcceso.deleteMany({ where: { clave } });
  }
}

export function crearRepositoriosPrisma(): Repositorios {
  const conexion = new Conexion(obtenerPrisma());
  return {
    usuarios: new UsuarioPrisma(conexion),
    eventosCuenta: new EventoCuentaPrisma(conexion),
    envios: new EnvioPrisma(conexion),
    pagos: new PagoPrisma(conexion),
    config: new ConfigPrisma(conexion),
    intentos: new IntentoPrisma(conexion),
    enTransaccion: (trabajo) => conexion.enTransaccion(trabajo),
  };
}
