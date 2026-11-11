import type {
  EstadoPaquete,
  EstadoPrealerta,
  NotificacionDTO,
  PaqueteAdminDTO,
  PaqueteClienteDTO,
  PaquetePublicoDTO,
  PrealertaAdminDTO,
  PrealertaDTO,
  ResultadoPaginado,
} from '../entities';
import {
  ETIQUETAS_ESTADO,
  TRANSICIONES,
  type EstadoPaqueteValue,
} from '../domain/estados';
import type { PaqueteRepository } from '../repositories/PaqueteRepository';
import type { PrealertaRepository } from '../repositories/PrealertaRepository';
import type { UserRepository } from '../repositories/UserRepository';
import type { NotificacionRepository } from '../repositories/NotificacionRepository';
import type { QuoteService } from './QuoteService';
import type { WhatsAppService } from './WhatsAppService';
import { AppError } from '../utils/errors';
import { generarNumeroGuia } from '../utils/codes';
import { logger } from '../utils/logger';

export interface RegistrarPaqueteInput {
  prealertaId?: string;
  casilleroCodigo?: string;
  descripcion: string;
  pesoKg: number;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  observaciones?: string | null;
}

export interface NuevaPrealertaInput {
  tienda: string;
  descripcion: string;
  trackingTienda?: string | null;
  valorDeclarado?: number | null;
}

export interface FiltrosAdmin {
  estado?: EstadoPaqueteValue;
  q?: string;
  pagina: number;
  porPagina: number;
}

type EventoLike = { estado: string; nota: string | null; createdAt: Date };

type PaqueteLike = {
  id: string;
  guia: string;
  descripcion: string;
  estado: string;
  pesoKg: number;
  pesoCobrable: number;
  precio: number;
  fotoUrl: string | null;
  createdAt: Date;
  eventos: EventoLike[];
};

type PaqueteAdminLike = PaqueteLike & {
  user: { nombre: string; casillero: { codigo: string } | null };
};

type PrealertaLike = {
  id: string;
  tienda: string;
  descripcion: string;
  trackingTienda: string | null;
  estado: string;
  createdAt: Date;
};

type PrealertaAdminLike = PrealertaLike & {
  user: { nombre: string; casillero: { codigo: string } | null };
};

const MAX_PREALERTAS_PENDIENTES = 15;

export class PackageService {
  constructor(
    private readonly paquetes: PaqueteRepository,
    private readonly prealertas: PrealertaRepository,
    private readonly usuarios: UserRepository,
    private readonly notificaciones: NotificacionRepository,
    private readonly cotizador: QuoteService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ---------- Mapeadores de salida (sin PII) ----------

  private mapEventos(eventos: EventoLike[]) {
    return [...eventos]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((evento) => ({
        estado: evento.estado as EstadoPaquete,
        nota: evento.nota,
        fecha: evento.createdAt.toISOString(),
      }));
  }

  private mapCliente(paquete: PaqueteLike): PaqueteClienteDTO {
    return {
      id: paquete.id,
      guia: paquete.guia,
      descripcion: paquete.descripcion,
      estado: paquete.estado as EstadoPaquete,
      pesoKg: paquete.pesoKg,
      pesoCobrable: paquete.pesoCobrable,
      precio: paquete.precio,
      fotoUrl: paquete.fotoUrl,
      createdAt: paquete.createdAt.toISOString(),
      eventos: this.mapEventos(paquete.eventos),
    };
  }

  private mapAdmin(paquete: PaqueteAdminLike): PaqueteAdminDTO {
    const estado = paquete.estado as EstadoPaqueteValue;
    return {
      ...this.mapCliente(paquete),
      cliente: {
        nombre: paquete.user.nombre,
        casillero: paquete.user.casillero?.codigo ?? null,
      },
      siguientesEstados: [...TRANSICIONES[estado]],
    };
  }

  private mapPrealerta(prealerta: PrealertaLike): PrealertaDTO {
    return {
      id: prealerta.id,
      tienda: prealerta.tienda,
      descripcion: prealerta.descripcion,
      trackingTienda: prealerta.trackingTienda,
      estado: prealerta.estado as EstadoPrealerta,
      createdAt: prealerta.createdAt.toISOString(),
    };
  }

  private mapPrealertaAdmin(prealerta: PrealertaAdminLike): PrealertaAdminDTO {
    return {
      ...this.mapPrealerta(prealerta),
      cliente: {
        nombre: prealerta.user.nombre,
        casillero: prealerta.user.casillero?.codigo ?? null,
      },
    };
  }

  // ---------- Operaciones de paquete ----------

  async registrarIngreso(input: RegistrarPaqueteInput, actorId: string): Promise<PaqueteAdminDTO> {
    let clienteId: string;
    let prealertaId: string | null = null;

    if (input.prealertaId) {
      const prealerta = await this.prealertas.buscarPorId(input.prealertaId);
      if (!prealerta) throw AppError.notFound('La prealerta no existe.');
      if (prealerta.estado !== 'PENDIENTE' || prealerta.paquete) {
        throw AppError.conflict('Esta prealerta ya fue procesada.');
      }
      clienteId = prealerta.userId;
      prealertaId = prealerta.id;
    } else if (input.casilleroCodigo) {
      const cliente = await this.usuarios.buscarClientePorCasillero(input.casilleroCodigo.toUpperCase());
      if (!cliente) {
        throw AppError.notFound('No encontramos un cliente activo con ese casillero.');
      }
      clienteId = cliente.id;
    } else {
      throw AppError.badRequest('Indica una prealerta o el código de casillero del cliente.');
    }

    const cliente = await this.usuarios.buscarPorId(clienteId);
    if (!cliente || !cliente.activo || cliente.rol !== 'CLIENTE') {
      throw AppError.notFound('El cliente no está activo.');
    }

    const cotizacion = await this.cotizador.calcular(
      input.pesoKg,
      input.largoCm,
      input.anchoCm,
      input.altoCm,
    );

    let guia = generarNumeroGuia();
    for (let intento = 0; intento < 10; intento += 1) {
      const existe = await this.paquetes.existeGuia(guia);
      if (!existe) break;
      guia = generarNumeroGuia();
    }

    const creado = await this.paquetes.crear({
      guia,
      descripcion: input.descripcion,
      pesoKg: input.pesoKg,
      largoCm: input.largoCm,
      anchoCm: input.anchoCm,
      altoCm: input.altoCm,
      pesoVolumetrico: cotizacion.pesoVolumetricoKg || null,
      pesoCobrable: cotizacion.pesoCobrableKg,
      precio: cotizacion.precio,
      observaciones: input.observaciones,
      userId: cliente.id,
      prealertaId,
    });

    if (prealertaId) {
      await this.prealertas.marcarRecibida(prealertaId);
    }

    await this.whatsapp.notificarRecepcion({
      userId: cliente.id,
      telefono: cliente.telefono,
      nombre: cliente.nombre,
      guia: creado.guia,
      pesoCobrable: cotizacion.pesoCobrableKg,
      precio: cotizacion.precio,
      paqueteId: creado.id,
    });

    logger.info('Paquete registrado', {
      guia: creado.guia,
      actor: actorId,
      pesoCobrable: cotizacion.pesoCobrableKg,
    });

    const completo = await this.paquetes.buscarPorId(creado.id);
    if (!completo) throw AppError.internal('No pudimos recuperar el paquete recién creado.');
    return this.mapAdmin(completo as PaqueteAdminLike);
  }

  async listarCliente(userId: string): Promise<PaqueteClienteDTO[]> {
    const items = await this.paquetes.listarPorUsuario(userId);
    return items.map((item) => this.mapCliente(item as PaqueteLike));
  }

  async listarAdmin(filtros: FiltrosAdmin): Promise<ResultadoPaginado<PaqueteAdminDTO>> {
    const { items, total } = await this.paquetes.listarAdmin({
      estado: filtros.estado,
      q: filtros.q,
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
    });
    return {
      items: items.map((item) => this.mapAdmin(item as PaqueteAdminLike)),
      total,
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
    };
  }

  async buscarAdminPorGuia(guia: string): Promise<PaqueteAdminDTO> {
    const paquete = await this.paquetes.buscarPorGuia(guia.toUpperCase());
    if (!paquete) throw AppError.notFound('No existe un paquete con esa guía.');
    return this.mapAdmin(paquete as PaqueteAdminLike);
  }

  async cambiarEstado(
    paqueteId: string,
    nuevoEstado: EstadoPaqueteValue,
    nota: string | undefined,
    actorId: string,
  ): Promise<PaqueteAdminDTO> {
    const paquete = await this.paquetes.buscarPorId(paqueteId);
    if (!paquete) throw AppError.notFound('El paquete no existe.');

    const actual = paquete.estado as EstadoPaqueteValue;
    const permitidos = TRANSICIONES[actual];
    if (!permitidos.includes(nuevoEstado)) {
      throw AppError.badRequest(
        `No se puede pasar de "${ETIQUETAS_ESTADO[actual]}" a "${ETIQUETAS_ESTADO[nuevoEstado]}".`,
        { permitidos },
      );
    }

    const actualizado = await this.paquetes.actualizarEstado(
      paqueteId,
      nuevoEstado,
      nota?.trim() || `Actualizado a ${ETIQUETAS_ESTADO[nuevoEstado]}.`,
    );
    if (!actualizado) throw AppError.internal('No pudimos actualizar el paquete.');

    const cliente = await this.usuarios.buscarPorId(paquete.userId);
    if (cliente) {
      await this.whatsapp.notificarCambioEstado({
        userId: cliente.id,
        telefono: cliente.telefono,
        nombre: cliente.nombre,
        guia: paquete.guia,
        estado: nuevoEstado,
        paqueteId: paquete.id,
      });
    }

    logger.info('Estado de paquete actualizado', {
      guia: paquete.guia,
      estado: nuevoEstado,
      actor: actorId,
    });

    return this.mapAdmin(actualizado as PaqueteAdminLike);
  }

  async registrarFoto(paqueteId: string, fotoUrl: string) {
    const paquete = await this.paquetes.buscarPorId(paqueteId);
    if (!paquete) throw AppError.notFound('El paquete no existe.');
    return this.paquetes.actualizarFoto(paqueteId, fotoUrl);
  }

  async rastrear(guia: string): Promise<PaquetePublicoDTO> {
    const paquete = await this.paquetes.buscarPublicoPorGuia(guia.toUpperCase());
    if (!paquete) throw AppError.notFound('No encontramos un paquete con esa guía.');
    return {
      guia: paquete.guia,
      estado: paquete.estado as EstadoPaquete,
      pesoCobrable: paquete.pesoCobrable,
      createdAt: paquete.createdAt.toISOString(),
      actualizadoEn: paquete.updatedAt.toISOString(),
      eventos: this.mapEventos(paquete.eventos),
    };
  }

  // ---------- Prealertas ----------

  async crearPrealerta(userId: string, input: NuevaPrealertaInput): Promise<PrealertaDTO> {
    const pendientes = await this.prealertas.contarPendientesPorUsuario(userId);
    if (pendientes >= MAX_PREALERTAS_PENDIENTES) {
      throw AppError.badRequest(
        'Tienes demasiadas prealertas pendientes. Espera a que la sede reciba alguna.',
      );
    }
    const prealerta = await this.prealertas.crear({
      tienda: input.tienda,
      descripcion: input.descripcion,
      trackingTienda: input.trackingTienda,
      valorDeclarado: input.valorDeclarado,
      userId,
    });
    logger.info('Prealerta creada', { id: prealerta.id, userId });
    return this.mapPrealerta(prealerta as PrealertaLike);
  }

  async listarPrealertasCliente(userId: string): Promise<PrealertaDTO[]> {
    const items = await this.prealertas.listarPorUsuario(userId);
    return items.map((item) => this.mapPrealerta(item as PrealertaLike));
  }

  async listarPrealertasAdmin(estado?: EstadoPrealerta): Promise<PrealertaAdminDTO[]> {
    const items = await this.prealertas.listarTodas(estado);
    return items.map((item) => this.mapPrealertaAdmin(item as PrealertaAdminLike));
  }

  async buscarClientePorCasillero(codigo: string) {
    const cliente = await this.usuarios.buscarClientePorCasillero(codigo.toUpperCase());
    if (!cliente) throw AppError.notFound('No encontramos un cliente con ese casillero.');
    return {
      id: cliente.id,
      nombre: cliente.nombre,
      casillero: cliente.casillero?.codigo ?? null,
    };
  }

  async listarNotificaciones(userId: string): Promise<NotificacionDTO[]> {
    const items = await this.notificaciones.listarPorUsuario(userId);
    return items.map((item) => ({
      id: item.id,
      mensaje: item.mensaje,
      canal: item.canal,
      estado: item.estado,
      destino: item.destinoEnmascarado,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  // ---------- Resumen operativo ----------

  async resumenAdmin() {
    const [totalPaquetes, porEstado, prealertasPendientes, clientes, ingresosEntregados] =
      await Promise.all([
        this.paquetes.contarTodos(),
        this.paquetes.contarPorEstado(),
        this.prealertas.contarPendientes(),
        this.usuarios.contarClientes(),
        this.paquetes.sumarPreciosEntregados(),
      ]);

    const conteo = Object.fromEntries(
      porEstado.map((row) => [row.estado as EstadoPaqueteValue, row._count._all]),
    ) as Partial<Record<EstadoPaqueteValue, number>>;

    return {
      totalPaquetes,
      clientes,
      prealertasPendientes,
      ingresosEntregados,
      porEstado: conteo,
    };
  }
}
