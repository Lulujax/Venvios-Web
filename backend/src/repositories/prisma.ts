import { Prisma, PrismaClient } from '@prisma/client';
import type {
  ConfigRepository,
  EntregaGuardada,
  Envio,
  EnvioRepository,
  Evento,
  FiltroEnvios,
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

let cliente: PrismaClient | null = null;

export function obtenerPrisma(): PrismaClient {
  if (!cliente) cliente = new PrismaClient();
  return cliente;
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
      nombre: fila.entregaNombre,
      cedulaCifrada: fila.entregaCedulaCifrada,
      telefono: fila.entregaTelefono,
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
  if ('nombre' in entrega) columnas.entregaNombre = entrega.nombre;
  if ('cedulaCifrada' in entrega) columnas.entregaCedulaCifrada = entrega.cedulaCifrada;
  if ('telefono' in entrega) columnas.entregaTelefono = entrega.telefono;
  if ('agencia' in entrega) columnas.entregaAgencia = entrega.agencia;
  if ('ciudad' in entrega) columnas.entregaCiudad = entrega.ciudad;
  if ('estado' in entrega) columnas.entregaEstado = entrega.estado;
  return columnas;
}

export class UsuarioPrisma implements UsuarioRepository {
  constructor(private readonly db: PrismaClient) {}

  crear(datos: NuevoUsuario): Promise<Usuario> {
    return this.db.usuario.create({ data: datos });
  }

  porId(id: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({ where: { id } });
  }

  porCedulaHuella(huella: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({ where: { cedulaHuella: huella } });
  }

  porTelefono(telefono: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({ where: { telefono } });
  }

  porEmail(email: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({ where: { email } });
  }

  porCodigo(codigo: string): Promise<Usuario | null> {
    return this.db.usuario.findUnique({ where: { codigo } });
  }

  listar(roles?: Rol[]): Promise<Usuario[]> {
    return this.db.usuario.findMany({
      where: roles ? { rol: { in: roles } } : undefined,
      orderBy: { creadoEn: 'desc' },
      take: 1000,
    });
  }

  actualizar(id: string, cambios: Partial<Omit<Usuario, 'id' | 'creadoEn'>>): Promise<Usuario> {
    return this.db.usuario.update({ where: { id }, data: cambios });
  }
}

export class EnvioPrisma implements EnvioRepository {
  constructor(private readonly db: PrismaClient) {}

  async crear(datos: NuevoEnvio): Promise<Envio> {
    const fila = await this.db.envio.create({
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

  async porId(id: string): Promise<Envio | null> {
    const fila = await this.db.envio.findUnique({ where: { id }, include: { paquetes: true } });
    return fila ? aEnvio(fila) : null;
  }

  async listar(filtro: FiltroEnvios): Promise<Envio[]> {
    const filas = await this.db.envio.findMany({
      where: {
        clienteId: filtro.clienteId,
        estado: filtro.estados ? { in: filtro.estados } : undefined,
      },
      include: { paquetes: true },
      orderBy: { creadoEn: 'desc' },
      take: 1000,
    });
    return filas.map(aEnvio);
  }

  async porTracking(trackingNormalizado: string): Promise<Envio | null> {
    const fila = await this.db.envio.findFirst({
      where: { paquetes: { some: { trackingNormalizado } } },
      include: { paquetes: true },
    });
    return fila ? aEnvio(fila) : null;
  }

  async actualizar(
    id: string,
    cambios: Partial<Omit<Envio, 'id' | 'creadoEn' | 'actualizadoEn' | 'paquetes' | 'entrega'>> & {
      entrega?: Partial<EntregaGuardada>;
    },
  ): Promise<Envio> {
    const { entrega, ...resto } = cambios;
    const fila = await this.db.envio.update({
      where: { id },
      data: { ...resto, ...entregaAColumnas(entrega) },
      include: { paquetes: true },
    });
    return aEnvio(fila);
  }

  actualizarPaquete(id: string, cambios: Partial<Omit<Paquete, 'id' | 'envioId'>>): Promise<Paquete> {
    return this.db.paquete.update({ where: { id }, data: cambios });
  }

  async agregarPaquetes(envioId: string, paquetes: NuevoPaquete[]): Promise<Paquete[]> {
    return this.db.$transaction(paquetes.map((p) => this.db.paquete.create({ data: { ...p, envioId } })));
  }

  async moverPaquetes(paqueteIds: string[], nuevoEnvioId: string): Promise<void> {
    await this.db.paquete.updateMany({ where: { id: { in: paqueteIds } }, data: { envioId: nuevoEnvioId } });
  }

  async agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento> {
    const fila = await this.db.evento.create({
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
    const filas = await this.db.evento.findMany({ where: { envioId }, orderBy: { creadoEn: 'asc' } });
    return filas.map((fila) => ({ ...fila, datos: (fila.datos as Record<string, unknown> | null) ?? null }));
  }
}

export class PagoPrisma implements PagoRepository {
  constructor(private readonly db: PrismaClient) {}

  crear(datos: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    return this.db.pago.create({ data: datos });
  }

  porId(id: string): Promise<Pago | null> {
    return this.db.pago.findUnique({ where: { id } });
  }

  deEnvio(envioId: string): Promise<Pago[]> {
    return this.db.pago.findMany({ where: { envioId }, orderBy: { creadoEn: 'asc' } });
  }

  porEstado(estado: Pago['estado']): Promise<Pago[]> {
    return this.db.pago.findMany({ where: { estado }, orderBy: { creadoEn: 'asc' }, take: 500 });
  }

  actualizar(id: string, cambios: Partial<Omit<Pago, 'id' | 'envioId' | 'creadoEn'>>): Promise<Pago> {
    return this.db.pago.update({ where: { id }, data: cambios });
  }
}

export class ConfigPrisma implements ConfigRepository {
  constructor(private readonly db: PrismaClient) {}

  async obtener<T>(clave: string): Promise<T | null> {
    const fila = await this.db.configuracion.findUnique({ where: { clave } });
    return fila ? (fila.valor as T) : null;
  }

  async guardar(clave: string, valor: unknown): Promise<void> {
    const json = valor as Prisma.InputJsonValue;
    await this.db.configuracion.upsert({ where: { clave }, create: { clave, valor: json }, update: { valor: json } });
  }

  async tasaDeFecha(fecha: string): Promise<TasaGuardada | null> {
    const fila = await this.db.tasaBcv.findUnique({ where: { fecha } });
    return fila ? { fecha: fila.fecha, bolivaresPorUsd: fila.bolivaresPorUsd, fuente: fila.fuente } : null;
  }

  async ultimaTasa(): Promise<TasaGuardada | null> {
    const fila = await this.db.tasaBcv.findFirst({ orderBy: { fecha: 'desc' } });
    return fila ? { fecha: fila.fecha, bolivaresPorUsd: fila.bolivaresPorUsd, fuente: fila.fuente } : null;
  }

  async guardarTasa(tasa: TasaGuardada): Promise<void> {
    await this.db.tasaBcv.upsert({
      where: { fecha: tasa.fecha },
      create: tasa,
      update: { bolivaresPorUsd: tasa.bolivaresPorUsd, fuente: tasa.fuente },
    });
  }
}

export function crearRepositoriosPrisma(): Repositorios {
  const db = obtenerPrisma();
  return {
    usuarios: new UsuarioPrisma(db),
    envios: new EnvioPrisma(db),
    pagos: new PagoPrisma(db),
    config: new ConfigPrisma(db),
  };
}
