import { hitoDeEstadoConsolidado, type TipoHito } from '../domain/hitos';
import type {
  CambiosEnvio,
  CambiosPaquete,
  Envio,
  EnvioRepository,
  EstadoPaquete,
  Evento,
  FiltroEnvios,
  HitoRepository,
  NuevoEnvio,
  NuevoPaquete,
  Paquete,
  PaqueteConEnvio,
} from './tipos';
import { esPrealertaReal, type EstadoEnvio } from '../domain/estados';
import { logger } from '../utils/logger';

export class EnvioConHitos implements EnvioRepository {
  constructor(
    private readonly interno: EnvioRepository,
    private readonly hitos: HitoRepository,
  ) {}

  private async registrar(paqueteIds: string[], tipo: TipoHito): Promise<void> {
    if (paqueteIds.length === 0) return;
    await this.hitos.agregar(paqueteIds, tipo);
    logger.debug('Hito de paquete registrado', { tipo, paquetes: paqueteIds.length });
  }

  async crear(datos: NuevoEnvio): Promise<Envio> {
    const envio = await this.interno.crear(datos);
    if (esPrealertaReal(envio) && envio.estado === 'PREALERTADO') {
      await this.registrar(envio.paquetes.map((p) => p.id), 'PREALERTADO');
    }
    return envio;
  }

  porId(id: string): Promise<Envio | null> {
    return this.interno.porId(id);
  }

  porIds(ids: string[]): Promise<Envio[]> {
    return this.interno.porIds(ids);
  }

  listar(filtro: FiltroEnvios): Promise<Envio[]> {
    return this.interno.listar(filtro);
  }

  porTracking(trackingNormalizado: string): Promise<Envio | null> {
    return this.interno.porTracking(trackingNormalizado);
  }

  porPaqueteId(paqueteId: string): Promise<Envio | null> {
    return this.interno.porPaqueteId(paqueteId);
  }

  porFotoPaquete(ruta: string): Promise<Envio | null> {
    return this.interno.porFotoPaquete(ruta);
  }

  paquetesPorOrigen(prealertaIds: string[]): Promise<PaqueteConEnvio[]> {
    return this.interno.paquetesPorOrigen(prealertaIds);
  }

  async actualizar(id: string, cambios: CambiosEnvio, estadoEsperado?: EstadoEnvio): Promise<Envio> {
    const antes = cambios.estado !== undefined ? await this.interno.porId(id) : null;
    const envio = await this.interno.actualizar(id, cambios, estadoEsperado);
    if (cambios.estado !== undefined && antes && antes.estado !== envio.estado && envio.tipo === 'CONSOLIDADO') {
      const tipo = hitoDeEstadoConsolidado(envio.estado);
      if (tipo) await this.registrar(envio.paquetes.map((p) => p.id), tipo);
    }
    return envio;
  }

  async actualizarPaquete(id: string, cambios: CambiosPaquete, estadoEsperado?: EstadoPaquete): Promise<Paquete> {
    const paquete = await this.interno.actualizarPaquete(id, cambios, estadoEsperado);
    if (cambios.estado === 'RECIBIDO') await this.registrar([paquete.id], 'EN_OFICINA');
    return paquete;
  }

  async agregarPaquetes(envioId: string, paquetes: NuevoPaquete[]): Promise<Paquete[]> {
    const creados = await this.interno.agregarPaquetes(envioId, paquetes);
    const envio = await this.interno.porId(envioId);
    if (envio && esPrealertaReal(envio)) await this.registrar(creados.map((p) => p.id), 'PREALERTADO');
    return creados;
  }

  async moverPaquetes(paqueteIds: string[], nuevoEnvioId: string, origenes?: string[]): Promise<void> {
    await this.interno.moverPaquetes(paqueteIds, nuevoEnvioId, origenes);
    const destino = await this.interno.porId(nuevoEnvioId);
    if (!destino) return;
    if (destino.tipo === 'CONSOLIDADO') {
      await this.registrar(paqueteIds, 'CONSOLIDANDO');
      return;
    }
    const recibidos = destino.paquetes.filter((p) => paqueteIds.includes(p.id) && p.estado === 'RECIBIDO').map((p) => p.id);
    await this.registrar(recibidos, 'EN_OFICINA');
  }

  agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento> {
    return this.interno.agregarEvento(evento);
  }

  eventosDe(envioId: string): Promise<Evento[]> {
    return this.interno.eventosDe(envioId);
  }
}
