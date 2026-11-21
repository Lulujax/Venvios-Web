import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { CifradoCedula } from '../domain/cifrado';
import { dolaresABolivaresCentavos } from '../domain/dinero';
import {
  ESTADOS_ALERTA_ACTIVOS,
  ESTADOS_CONSOLIDADO_ABIERTOS,
  ESTADOS_ENVIO,
  ESTADOS_FUERA_DE_BODEGA,
  ETIQUETAS_ESTADO,
  estadoDeAlerta,
  validarDespacho,
  validarTransicion,
  type DatosEntrega,
  type EstadoEnvio,
  type TipoEnvio,
} from '../domain/estados';
import { ETIQUETAS_HITO, recorridoVisible } from '../domain/hitos';
import { entregaDesdePerfil } from '../domain/perfil';
import { calcularPrecio, kilosACentesimas, modalidadPropuesta, type Modalidad, type PrecioCalculado } from '../domain/tarifas';
import { codigoContieneTracking, coincidenTrackings, normalizarTracking } from '../domain/tracking';
import { limpiarTexto, validarCedula, validarPesoKg, validarTelefono, validarValorDeclarado } from '../domain/validaciones';
import type { Envio, Hito, Pago, Paquete, Repositorios, Rol, Transportista, Usuario } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { enmascararCedula } from '../utils/mask';
import { rutaArchivo, validarImagen, type Almacenamiento, type ArchivoEntrada } from './Almacenamiento';
import type { ConfigService } from './ConfigService';
import type { TasaService, TasaVigente } from './TasaService';

export interface Actor {
  id: string;
  rol: Rol;
}

export interface HitoVista {
  tipo: string;
  etiqueta: string;
  fecha: string;
}

export interface PaqueteVista {
  seguimiento: HitoVista[];
  valorDeclaradoCentavos: number;
  id: string;
  tracking: string;
  recibido: boolean;
  pesoKg: number | null;
  tieneFoto: boolean;
  fotoRuta: string | null;
  avisado: boolean;
  recibidoEn: string | null;
}

export interface PagoVista {
  id: string;
  estado: string;
  metodo: string;
  moneda: string;
  montoOriginalCentavos: number;
  montoUsdCentavos: number;
  referencia: string | null;
  tieneComprobante: boolean;
  comprobanteRuta: string | null;
  motivoRechazo: string | null;
  creadoEn: string;
}

export interface EnvioVista {
  id: string;
  tipo: TipoEnvio;
  estado: EstadoEnvio;
  etiquetaEstado: string;
  sinDueno: boolean;
  modalidad: Modalidad;
  modalidadSugerida: Modalidad | null;
  transportista: Transportista;
  tienda: string;
  valorDeclaradoCentavos: number;
  cliente: { id: string; nombre: string; telefono: string; codigo: string; cedulaEnmascarada: string };
  paquetes: PaqueteVista[];
  faltan: number;
  pesoTotalKg: number | null;
  precio: {
    pesoCobrableKg: number;
    precioPorKgCentavos: number;
    fleteCentavos: number;
    seguroCentavos: number;
    seguroManual: boolean;
    totalCentavos: number;
    totalBsCentavos: number | null;
  } | null;
  tasa: { bolivaresPorUsd: number; fecha: string; desactualizada: boolean } | null;
  entrega: { nombre: string | null; cedula: string | null; telefono: string | null; agencia: string | null; ciudad: string | null; estado: string | null };
  guia: { numero: string | null; tieneFoto: boolean; fotoRuta: string | null };
  pagos: PagoVista[];
  pagadoCentavos: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ItemBodega {
  paqueteId: string;
  tracking: string;
  pesoKg: number | null;
  tieneFoto: boolean;
  fotoRuta: string | null;
  recibidoEn: string | null;
  envioId: string;
  tipoEnvio: TipoEnvio;
  estadoEnvio: EstadoEnvio;
  sinDueno: boolean;
  cliente: { id: string; nombre: string; codigo: string };
}

export interface NuevaPrealerta {
  clienteId?: string;
  trackings: string[];
  tienda: string;
  valorDeclaradoUsd?: number;
  valoresUsd?: number[];
  modalidad?: Modalidad;
  transportista?: Transportista;
}

export interface NuevoConsolidado {
  clienteId?: string;
  paqueteIds: string[];
  modalidad: Modalidad;
  transportista: Transportista;
  valorDeclaradoUsd?: number;
  pesoKg?: number;
}

export type ResultadoEscaneo =
  | { resultado: 'RECIBIDO' | 'YA_REGISTRADO'; envioId: string; paqueteId: string; cliente: string; sinDueno: boolean; faltan: number; texto: string }
  | { resultado: 'SIN_PREALERTA'; texto: string };

const MAX_TRACKINGS = 20;
const MAX_PAQUETES_CONSOLIDADO = 50;
export const TELEFONO_SIN_ASIGNAR = '0000000000';
export const CODIGO_SIN_ASIGNAR = 'VENV-000000';
const TIENDA_SIN_PREALERTA = 'Sin prealerta';
const TIENDA_DEVUELTO = 'Devuelto a bodega';
const ESTADOS_CON_PAGO: EstadoEnvio[] = ['POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO'];
const ESTADOS_EN_BODEGA: EstadoEnvio[] = ESTADOS_ENVIO.filter((estado) => !ESTADOS_FUERA_DE_BODEGA.includes(estado));
export const LIMITE_LISTA_PERSONAL = 200;

export function esPersonal(actor: Actor): boolean {
  return actor.rol === 'OPERADOR' || actor.rol === 'ADMIN';
}

function exigirMotivo(motivo: unknown): string {
  const limpio = limpiarTexto(motivo, 200);
  if (limpio.length < 3) throw AppError.badRequest('Escribe el motivo (mínimo 3 letras).');
  return limpio;
}

function validarModalidad(modalidad: unknown): Modalidad {
  if (modalidad !== 'M1' && modalidad !== 'M2') throw AppError.badRequest('Elige una modalidad válida.');
  return modalidad;
}

function validarTransportista(transportista: unknown): Transportista {
  if (transportista !== 'MRW' && transportista !== 'ZOOM') throw AppError.badRequest('Elige MRW o Zoom.');
  return transportista;
}

export class EnvioService {
  constructor(
    private readonly repos: Repositorios,
    private readonly cifrado: CifradoCedula,
    private readonly config: ConfigService,
    private readonly tasas: TasaService,
    private readonly almacenamiento: Almacenamiento,
  ) {}

  private async evento(envioId: string, actor: Actor | null, tipo: string, detalle: string, datos?: Record<string, unknown>): Promise<void> {
    await this.repos.envios.agregarEvento({ envioId, actorId: actor?.id ?? null, tipo, detalle, datos: datos ?? null });
  }

  private async cargar(envioId: string): Promise<Envio> {
    const envio = await this.repos.envios.porId(envioId);
    if (!envio) throw AppError.notFound('El envío no existe.');
    return envio;
  }

  private exigirAcceso(actor: Actor, envio: Envio): void {
    if (esPersonal(actor)) return;
    if (envio.clienteId !== actor.id) throw AppError.notFound('El envío no existe.');
  }

  private exigirPersonal(actor: Actor): void {
    if (!esPersonal(actor)) throw AppError.forbidden();
  }

  private async tasaOpcional(): Promise<TasaVigente | null> {
    try {
      return await this.tasas.vigente();
    } catch {
      return null;
    }
  }

  async obtenerEnvio(actor: Actor, envioId: string): Promise<Envio> {
    const envio = await this.cargar(envioId);
    this.exigirAcceso(actor, envio);
    return envio;
  }

  private construirVista(envio: Envio, cliente: Usuario, pagos: Pago[], tasa: TasaVigente | null, hitos: Map<string, Hito[]>): EnvioVista {
    const pesoTotal = envio.pesoTotalCentesimas;
    const recibidos = envio.paquetes.filter((p) => p.estado === 'RECIBIDO');
    const pagadoCentavos = pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((suma, p) => suma + p.montoUsdCentavos, 0);

    return {
      id: envio.id,
      tipo: envio.tipo,
      estado: envio.estado,
      etiquetaEstado: ETIQUETAS_ESTADO[envio.estado],
      sinDueno: cliente.telefono === TELEFONO_SIN_ASIGNAR,
      modalidad: envio.modalidad,
      modalidadSugerida: pesoTotal ? modalidadPropuesta(pesoTotal) : null,
      transportista: envio.transportista,
      tienda: envio.tienda,
      valorDeclaradoCentavos: envio.valorDeclaradoCentavos,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        codigo: cliente.codigo,
        cedulaEnmascarada: enmascararCedula(this.cifrado.descifrar(cliente.cedulaCifrada)),
      },
      paquetes: envio.paquetes.map((p) => ({
        id: p.id,
        tracking: p.trackingTexto,
        recibido: p.estado === 'RECIBIDO',
        pesoKg: p.pesoCentesimas ? p.pesoCentesimas / 100 : null,
        valorDeclaradoCentavos: p.valorDeclaradoCentavos,
        seguimiento: recorridoVisible(hitos.get(p.id) ?? []).map((h) => ({ tipo: h.tipo, etiqueta: ETIQUETAS_HITO[h.tipo], fecha: h.creadoEn.toISOString() })),
        tieneFoto: Boolean(p.fotoPath),
        fotoRuta: p.fotoPath,
        avisado: Boolean(p.avisadoEn),
        recibidoEn: p.recibidoEn ? p.recibidoEn.toISOString() : null,
      })),
      faltan: envio.paquetes.length - recibidos.length,
      pesoTotalKg: pesoTotal ? pesoTotal / 100 : null,
      precio:
        envio.totalCentavos !== null && envio.pesoCobrableCentesimas !== null
          ? {
              pesoCobrableKg: envio.pesoCobrableCentesimas / 100,
              precioPorKgCentavos: Math.round(((envio.fleteCentavos ?? 0) * 100) / Math.max(envio.pesoCobrableCentesimas, 1)),
              fleteCentavos: envio.fleteCentavos ?? 0,
              seguroCentavos: envio.seguroCentavos ?? 0,
              seguroManual: envio.seguroManualCentavos !== null,
              totalCentavos: envio.totalCentavos,
              totalBsCentavos: tasa ? dolaresABolivaresCentavos(envio.totalCentavos, tasa.bolivaresPorUsd) : null,
            }
          : null,
      tasa: tasa ? { bolivaresPorUsd: tasa.bolivaresPorUsd, fecha: tasa.fecha, desactualizada: tasa.desactualizada } : null,
      entrega: {
        nombre: this.cifrado.descifrarOpcional(envio.entrega.nombreCifrado),
        cedula: this.cifrado.descifrarOpcional(envio.entrega.cedulaCifrada),
        telefono: this.cifrado.descifrarOpcional(envio.entrega.telefonoCifrado),
        agencia: envio.entrega.agencia,
        ciudad: envio.entrega.ciudad,
        estado: envio.entrega.estado,
      },
      guia: { numero: envio.guiaVenezolana, tieneFoto: Boolean(envio.guiaFotoPath), fotoRuta: envio.guiaFotoPath },
      pagos: pagos.map((p) => ({
        id: p.id,
        estado: p.estado,
        metodo: p.metodo,
        moneda: p.moneda,
        montoOriginalCentavos: p.montoOriginalCentavos,
        montoUsdCentavos: p.montoUsdCentavos,
        referencia: p.referencia,
        tieneComprobante: Boolean(p.comprobantePath),
        comprobanteRuta: p.comprobantePath,
        motivoRechazo: p.motivoRechazo,
        creadoEn: p.creadoEn.toISOString(),
      })),
      pagadoCentavos,
      creadoEn: envio.creadoEn.toISOString(),
      actualizadoEn: envio.actualizadoEn.toISOString(),
    };
  }

  async vistas(envios: Envio[]): Promise<EnvioVista[]> {
    if (envios.length === 0) return [];
    const [clientes, pagos, tasa, hitos] = await Promise.all([
      this.repos.usuarios.porIds(envios.map((e) => e.clienteId)),
      this.repos.pagos.deEnvios(envios.map((e) => e.id)),
      this.tasaOpcional(),
      this.repos.hitos.dePaquetes(envios.flatMap((e) => e.paquetes.map((p) => p.id))),
    ]);
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const pagosPorEnvio = new Map<string, Pago[]>();
    for (const pago of pagos) pagosPorEnvio.set(pago.envioId, [...(pagosPorEnvio.get(pago.envioId) ?? []), pago]);
    return envios.map((envio) => {
      const cliente = clientePorId.get(envio.clienteId);
      if (!cliente) throw new AppError('El envío no tiene cliente asociado.', 500, 'INTERNO');
      return this.construirVista(envio, cliente, pagosPorEnvio.get(envio.id) ?? [], tasa, hitos);
    });
  }

  async vista(envio: Envio): Promise<EnvioVista> {
    const [unica] = await this.vistas([envio]);
    if (!unica) throw new AppError('No se pudo armar la vista del envío.', 500, 'INTERNO');
    return unica;
  }

  async detalle(actor: Actor, envioId: string): Promise<EnvioVista> {
    return this.vista(await this.obtenerEnvio(actor, envioId));
  }

  async historial(actor: Actor, envioId: string) {
    this.exigirPersonal(actor);
    await this.cargar(envioId);
    const eventos = await this.repos.envios.eventosDe(envioId);
    return eventos.map((e) => ({ tipo: e.tipo, detalle: e.detalle, actorId: e.actorId, datos: e.datos, fecha: e.creadoEn.toISOString() }));
  }

  async listar(actor: Actor, filtro: { estado?: EstadoEnvio; q?: string } = {}): Promise<EnvioVista[]> {
    const personal = esPersonal(actor);
    const envios = await this.repos.envios.listar({
      clienteId: personal ? undefined : actor.id,
      estados: filtro.estado ? [filtro.estado] : undefined,
      excluirEstados: personal && !filtro.estado ? ['ARCHIVADO'] : undefined,
      texto: personal ? filtro.q : undefined,
      limite: personal ? LIMITE_LISTA_PERSONAL : undefined,
    });
    logger.debug('Envíos listados', { actor: actor.id, cantidad: envios.length, conBusqueda: Boolean(filtro.q) });
    return this.vistas(envios);
  }

  private async clienteSinAsignar(): Promise<Usuario> {
    const existente = await this.repos.usuarios.porTelefono(TELEFONO_SIN_ASIGNAR);
    if (existente) return existente;
    logger.info('Creando el dueño interno de paquetes sin dueño');
    return this.repos.usuarios.crear({
      nombre: 'Sin dueño',
      cedulaCifrada: this.cifrado.cifrar('00000'),
      cedulaHuella: 'sin-asignar',
      email: 'sin-asignar@venvios.invalid',
      codigo: CODIGO_SIN_ASIGNAR,
      telefono: TELEFONO_SIN_ASIGNAR,
      passwordHash: await hash(randomBytes(16).toString('hex')),
      rol: 'CLIENTE',
      activo: false,
      debeCambiarClave: false,
    });
  }

  private async clienteActivo(clienteId: string): Promise<Usuario> {
    const cliente = await this.repos.usuarios.porId(clienteId);
    if (!cliente || cliente.rol !== 'CLIENTE' || !cliente.activo || cliente.telefono === TELEFONO_SIN_ASIGNAR) {
      throw AppError.notFound('El cliente no existe o no está activo.');
    }
    return cliente;
  }

  private async esSinDueno(envio: Envio): Promise<boolean> {
    const cliente = await this.repos.usuarios.porId(envio.clienteId);
    return cliente?.telefono === TELEFONO_SIN_ASIGNAR;
  }

  private async refrescarAlerta(envioId: string): Promise<Envio> {
    const envio = await this.cargar(envioId);
    if (envio.tipo !== 'ALERTA' || !ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) return envio;
    const nuevo = estadoDeAlerta(envio.paquetes);
    if (nuevo === envio.estado) return envio;
    validarTransicion(envio.estado, nuevo);
    return this.repos.envios.actualizar(envio.id, { estado: nuevo }, envio.estado);
  }

  private async llevarABodega(clienteId: string, paqueteIds: string[], tienda: string, origenId: string): Promise<Envio> {
    const destino = await this.repos.envios.crear({
      tipo: 'ALERTA',
      clienteId,
      modalidad: 'M1',
      transportista: 'MRW',
      tienda,
      valorDeclaradoCentavos: 0,
      paquetes: [],
    });
    await this.repos.envios.moverPaquetes(paqueteIds, destino.id, [origenId]);
    return this.refrescarAlerta(destino.id);
  }

  private async apartarDescartados(envio: Envio, paqueteIds: string[]): Promise<Envio> {
    const apartado = await this.repos.envios.crear({
      tipo: envio.tipo,
      clienteId: envio.clienteId,
      modalidad: envio.modalidad,
      transportista: envio.transportista,
      tienda: envio.tienda,
      valorDeclaradoCentavos: 0,
      paquetes: [],
      estado: envio.tipo === 'CONSOLIDADO' ? 'POR_CONSOLIDAR' : 'PREALERTADO',
    });
    await this.repos.envios.moverPaquetes(paqueteIds, apartado.id, [envio.id]);
    return this.repos.envios.actualizar(apartado.id, { estado: 'CANCELADO' });
  }

  private async alCambiarConsolidado(envioId: string, actor: Actor): Promise<Envio> {
    const envio = await this.cargar(envioId);
    if (envio.tipo !== 'CONSOLIDADO' || !ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) return envio;
    if (envio.paquetes.length === 0) {
      await this.evento(envio.id, actor, 'CONSOLIDADO_VACIO', 'El consolidado quedó sin paquetes');
      return this.repos.envios.actualizar(envio.id, { estado: 'CANCELADO' }, envio.estado);
    }
    const limpio = {
      valorDeclaradoCentavos: this.sumaDeValores(envio.paquetes),
      pesoTotalCentesimas: null,
      pesoCobrableCentesimas: null,
      fleteCentavos: null,
      seguroCentavos: null,
      totalCentavos: null,
    };
    if (envio.estado === 'POR_PAGAR') {
      validarTransicion('POR_PAGAR', 'POR_CONSOLIDAR');
      await this.evento(envio.id, actor, 'RECOTIZAR', 'Cambiaron los paquetes; hay que pesar de nuevo');
      return this.repos.envios.actualizar(envio.id, { ...limpio, estado: 'POR_CONSOLIDAR' }, 'POR_PAGAR');
    }
    return this.repos.envios.actualizar(envio.id, limpio, envio.estado);
  }

  private async buscarPorPaqueteId(paqueteId: string): Promise<{ envio: Envio; paquete: Paquete }> {
    const envio = typeof paqueteId === 'string' && paqueteId ? await this.repos.envios.porPaqueteId(paqueteId) : null;
    const paquete = envio?.paquetes.find((p) => p.id === paqueteId);
    if (!envio || !paquete) throw AppError.notFound('El paquete no existe.');
    return { envio, paquete };
  }

  private valoresPorPaquete(datos: NuevaPrealerta, cantidad: number): number[] {
    if (datos.valoresUsd !== undefined) {
      if (!Array.isArray(datos.valoresUsd) || datos.valoresUsd.length !== cantidad) throw AppError.badRequest('Escribe el valor declarado de cada paquete.');
      return datos.valoresUsd.map((valor) => validarValorDeclarado(Number(valor)));
    }
    const total = validarValorDeclarado(Number(datos.valorDeclaradoUsd ?? 0));
    const base = Math.floor(total / cantidad);
    return Array.from({ length: cantidad }, (_, indice) => (indice === 0 ? total - base * (cantidad - 1) : base));
  }

  private sumaDeValores(paquetes: Paquete[]): number {
    return paquetes.reduce((suma, paquete) => suma + paquete.valorDeclaradoCentavos, 0);
  }

  async crearPrealerta(actor: Actor, datos: NuevaPrealerta): Promise<EnvioVista> {
    logger.info('Creando prealerta', { actor: actor.id, paquetes: datos.trackings?.length });
    const clienteId = esPersonal(actor) ? datos.clienteId : actor.id;
    if (!clienteId) throw AppError.badRequest('Indica el cliente de la prealerta.');
    await this.clienteActivo(clienteId);
    const modalidad = datos.modalidad === undefined ? 'M1' : validarModalidad(datos.modalidad);
    const transportista = datos.transportista === undefined ? 'MRW' : validarTransportista(datos.transportista);
    if (!Array.isArray(datos.trackings) || datos.trackings.length === 0) {
      throw AppError.badRequest('Agrega al menos un número de tracking.');
    }
    if (datos.trackings.length > MAX_TRACKINGS) throw AppError.badRequest(`Máximo ${MAX_TRACKINGS} paquetes por alerta.`);

    const valores = this.valoresPorPaquete(datos, datos.trackings.length);
    const vistos = new Set<string>();
    const paquetes = datos.trackings.map((texto, indice) => {
      const trackingTexto = limpiarTexto(texto, 80);
      const trackingNormalizado = normalizarTracking(trackingTexto);
      if (vistos.has(trackingNormalizado)) throw AppError.badRequest('Repetiste un tracking en la lista.');
      vistos.add(trackingNormalizado);
      return { trackingTexto, trackingNormalizado, valorDeclaradoCentavos: valores[indice]! };
    });

    const nuevos: typeof paquetes = [];
    const reclamados: Array<{ paqueteId: string; origenId: string; valorDeclaradoCentavos: number }> = [];
    for (const paquete of paquetes) {
      const existente = await this.repos.envios.porTracking(paquete.trackingNormalizado);
      if (!existente) {
        nuevos.push(paquete);
        continue;
      }
      const hallado = existente.paquetes.find((p) => p.trackingNormalizado === paquete.trackingNormalizado);
      const reclamable =
        hallado?.estado === 'RECIBIDO' && existente.tipo === 'ALERTA' && ESTADOS_ALERTA_ACTIVOS.includes(existente.estado) && (await this.esSinDueno(existente));
      if (reclamable && hallado) {
        reclamados.push({ paqueteId: hallado.id, origenId: existente.id, valorDeclaradoCentavos: paquete.valorDeclaradoCentavos ?? 0 });
        continue;
      }
      const puedeVer = esPersonal(actor) || existente.clienteId === actor.id;
      throw AppError.conflict(`El tracking ${paquete.trackingTexto} ya está registrado.`, puedeVer ? { envioId: existente.id } : undefined);
    }

    const envio = await this.repos.envios.crear({
      clienteId,
      modalidad,
      transportista,
      tienda: limpiarTexto(datos.tienda, 80) || 'Sin indicar',
      valorDeclaradoCentavos: valores.reduce((suma, valor) => suma + valor, 0),
      paquetes: nuevos,
    });
    await this.evento(envio.id, actor, 'PREALERTA', `Alerta con ${paquetes.length} paquete(s)`);
    if (reclamados.length > 0) {
      await this.repos.envios.moverPaquetes(reclamados.map((r) => r.paqueteId), envio.id, reclamados.map((r) => r.origenId));
      for (const reclamado of reclamados) await this.repos.envios.actualizarPaquete(reclamado.paqueteId, { valorDeclaradoCentavos: reclamado.valorDeclaradoCentavos });
      for (const origenId of new Set(reclamados.map((r) => r.origenId))) {
        await this.refrescarAlerta(origenId);
        await this.evento(origenId, actor, 'RECLAMO', 'Un cliente reclamó este paquete al registrar su alerta');
      }
      await this.evento(envio.id, actor, 'RECLAMO', `${reclamados.length} paquete(s) sin dueño unido(s) a esta alerta`);
      logger.info('Paquetes sin dueño reclamados', { envio: envio.id, cantidad: reclamados.length });
    }
    logger.info('Prealerta creada', { envio: envio.id, paquetes: paquetes.length });
    return this.vista(await this.refrescarAlerta(envio.id));
  }

  async editarDatos(
    actor: Actor,
    envioId: string,
    cambios: { modalidad?: Modalidad; transportista?: Transportista; valorDeclaradoUsd?: number; tienda?: string },
  ): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    const abierto = envio.tipo === 'ALERTA' ? ESTADOS_ALERTA_ACTIVOS.includes(envio.estado) : ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado);
    if (!abierto) throw AppError.badRequest('Este envío ya no admite cambios. Pide ayuda en la oficina.', 'ENVIO_BLOQUEADO');
    if (!esPersonal(actor) && (cambios.valorDeclaradoUsd !== undefined || cambios.tienda !== undefined)) {
      const permitido = envio.estado === 'PREALERTADO' || envio.estado === 'POR_CONSOLIDAR';
      if (!permitido) throw AppError.forbidden('El valor declarado ya no se puede cambiar. Escríbenos por WhatsApp.');
    }
    const parcial: Parameters<typeof this.repos.envios.actualizar>[1] = {};
    if (cambios.modalidad !== undefined) parcial.modalidad = validarModalidad(cambios.modalidad);
    if (cambios.transportista !== undefined) parcial.transportista = validarTransportista(cambios.transportista);
    if (cambios.valorDeclaradoUsd !== undefined) parcial.valorDeclaradoCentavos = validarValorDeclarado(cambios.valorDeclaradoUsd);
    if (cambios.tienda !== undefined) parcial.tienda = limpiarTexto(cambios.tienda, 80) || 'Sin indicar';
    const actualizado = await this.repos.envios.actualizar(envioId, parcial);
    await this.evento(envioId, actor, 'EDICION', `Datos del envío editados: ${Object.keys(parcial).join(', ')}`);
    return this.vista(await this.recalcular(actualizado));
  }

  private async precioDe(envio: Envio, pesoCentesimas: number): Promise<PrecioCalculado> {
    const automatico = calcularPrecio(envio.modalidad, pesoCentesimas, envio.valorDeclaradoCentavos, await this.config.tarifas());
    if (envio.seguroManualCentavos === null) return automatico;
    return { ...automatico, seguroCentavos: envio.seguroManualCentavos, totalCentavos: automatico.fleteCentavos + envio.seguroManualCentavos };
  }

  private exigirEnvioEditable(envio: Envio, pagos: Pago[]): void {
    if (pagos.some((p) => p.estado !== 'RECHAZADO')) {
      throw AppError.forbidden('El envío ya tiene un pago registrado. Solo el administrador puede corregirlo, desde «Corrección del administrador».');
    }
    if (envio.tipo !== 'CONSOLIDADO' || !ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) {
      throw AppError.badRequest('Este envío ya no admite cambios de cotización.', 'ENVIO_BLOQUEADO');
    }
  }

  async editarValorPaquete(actor: Actor, paqueteId: string, valorUsd: number, motivo: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const razon = exigirMotivo(motivo);
    const nuevo = validarValorDeclarado(Number(valorUsd));
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    this.exigirEnvioEditable(envio, await this.repos.pagos.deEnvio(envio.id));
    await this.repos.envios.actualizarPaquete(paqueteId, { valorDeclaradoCentavos: nuevo });
    const refrescado = await this.cargar(envio.id);
    const actualizado = await this.recalcular(await this.repos.envios.actualizar(envio.id, { valorDeclaradoCentavos: this.sumaDeValores(refrescado.paquetes) }));
    await this.evento(envio.id, actor, 'VALOR_PAQUETE', `Valor del paquete ${paquete.trackingTexto} cambiado: ${razon}`, {
      anteriorCentavos: paquete.valorDeclaradoCentavos,
      nuevoCentavos: nuevo,
    });
    logger.info('Valor de un paquete editado', { envio: envio.id, actor: actor.id });
    return this.vista(actualizado);
  }

  async editarSeguro(actor: Actor, envioId: string, seguroUsd: number | null, motivo: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.cargar(envioId);
    this.exigirEnvioEditable(envio, await this.repos.pagos.deEnvio(envio.id));
    const automatico = seguroUsd === null;
    const razon = automatico ? limpiarTexto(motivo, 200) || 'Seguro vuelto a automático' : exigirMotivo(motivo);
    if (!automatico && (!Number.isFinite(seguroUsd) || seguroUsd < 0)) throw AppError.badRequest('El seguro no puede ser negativo.');
    const anteriorCentavos = envio.seguroCentavos;
    const cambiado = await this.repos.envios.actualizar(envioId, { seguroManualCentavos: automatico ? null : Math.round(seguroUsd * 100) });
    const actualizado = await this.recalcular(cambiado);
    await this.evento(envioId, actor, 'SEGURO', `${automatico ? 'Seguro vuelto a automático' : 'Seguro editado a mano'}: ${razon}`, {
      anteriorCentavos,
      nuevoCentavos: actualizado.seguroCentavos,
    });
    logger.info('Seguro editado', { envio: envioId, actor: actor.id, automatico });
    return this.vista(actualizado);
  }

  private async recalcular(envio: Envio): Promise<Envio> {
    if (envio.tipo !== 'CONSOLIDADO' || envio.pesoTotalCentesimas === null) return envio;
    if (!ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) return envio;
    const precio = await this.precioDe(envio, envio.pesoTotalCentesimas);
    return this.repos.envios.actualizar(envio.id, {
      pesoCobrableCentesimas: precio.pesoCobrableCentesimas,
      fleteCentavos: precio.fleteCentavos,
      seguroCentavos: precio.seguroCentavos,
      totalCentavos: precio.totalCentavos,
    });
  }

  private async buscarPaquete(texto: string): Promise<{ envio: Envio; paquete: Paquete } | null> {
    const normalizado = normalizarTracking(texto);
    const exacto = await this.repos.envios.porTracking(normalizado);
    if (exacto) {
      const paquete = exacto.paquetes.find((p) => p.trackingNormalizado === normalizado)!;
      return { envio: exacto, paquete };
    }
    const pendientes = await this.repos.envios.listar({ estados: ['PREALERTADO', 'RECIBIDO_PARCIAL'] });
    for (const envio of pendientes) {
      const paquete = envio.paquetes.find((p) => p.estado === 'ESPERADO' && coincidenTrackings(p.trackingNormalizado, normalizado));
      if (paquete) return { envio, paquete };
    }
    return this.buscarPorContenido(texto, pendientes);
  }

  private buscarPorContenido(texto: string, pendientes: Envio[]): { envio: Envio; paquete: Paquete } | null {
    const coincidencias: Array<{ envio: Envio; paquete: Paquete }> = [];
    for (const envio of pendientes) {
      for (const paquete of envio.paquetes) {
        if (paquete.estado === 'ESPERADO' && codigoContieneTracking(texto, paquete.trackingTexto)) coincidencias.push({ envio, paquete });
      }
    }
    if (coincidencias.length > 1) {
      logger.warn('El código coincide con varios paquetes esperados', { coincidencias: coincidencias.length });
      throw AppError.conflict('Ese código coincide con más de un paquete esperado. Escribe el número completo para elegir el correcto.');
    }
    if (coincidencias.length === 1) logger.info('Paquete encontrado porque el código contiene su tracking');
    return coincidencias[0] ?? null;
  }

  async escanear(actor: Actor, textoLeido: string): Promise<ResultadoEscaneo> {
    this.exigirPersonal(actor);
    const texto = limpiarTexto(textoLeido, 120);
    logger.info('Escaneo recibido', { actor: actor.id, largo: texto.length });
    const hallado = await this.buscarPaquete(texto);
    if (!hallado) return { resultado: 'SIN_PREALERTA', texto };

    const cliente = await this.repos.usuarios.porId(hallado.envio.clienteId);
    const sinDueno = cliente?.telefono === TELEFONO_SIN_ASIGNAR;
    const nombre = sinDueno ? 'Sin dueño' : (cliente?.nombre ?? 'Cliente');
    if (hallado.paquete.estado === 'RECIBIDO') {
      const faltan = hallado.envio.paquetes.filter((p) => p.estado === 'ESPERADO').length;
      return { resultado: 'YA_REGISTRADO', envioId: hallado.envio.id, paqueteId: hallado.paquete.id, cliente: nombre, sinDueno, faltan, texto };
    }

    await this.repos.envios.actualizarPaquete(hallado.paquete.id, { estado: 'RECIBIDO', recibidoPorId: actor.id, recibidoEn: new Date() }, 'ESPERADO');
    const refrescado = await this.refrescarAlerta(hallado.envio.id);
    await this.evento(refrescado.id, actor, 'RECEPCION', 'Paquete recibido en la oficina');
    const faltan = refrescado.paquetes.filter((p) => p.estado === 'ESPERADO').length;
    logger.info('Paquete recibido', { envio: refrescado.id, faltan });
    return { resultado: 'RECIBIDO', envioId: refrescado.id, paqueteId: hallado.paquete.id, cliente: nombre, sinDueno, faltan, texto };
  }

  async registrarSinPrealerta(actor: Actor, textoLeido: string, clienteId?: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const texto = limpiarTexto(textoLeido, 80);
    if (texto.length < 4) throw AppError.badRequest('El tracking es muy corto.');
    const normalizado = normalizarTracking(texto);
    if (await this.repos.envios.porTracking(normalizado)) throw AppError.conflict('Ese tracking ya está registrado.');
    const dueno = clienteId ? await this.clienteActivo(clienteId) : await this.clienteSinAsignar();
    const envio = await this.repos.envios.crear({
      clienteId: dueno.id,
      modalidad: 'M1',
      transportista: 'MRW',
      tienda: TIENDA_SIN_PREALERTA,
      valorDeclaradoCentavos: 0,
      paquetes: [{ trackingTexto: texto, trackingNormalizado: normalizado }],
    });
    await this.repos.envios.actualizarPaquete(envio.paquetes[0]!.id, { estado: 'RECIBIDO', recibidoPorId: actor.id, recibidoEn: new Date() });
    const ajustado = await this.refrescarAlerta(envio.id);
    await this.evento(
      envio.id,
      actor,
      'SIN_PREALERTA',
      clienteId ? 'Paquete recibido sin prealerta y asignado al cliente' : 'Paquete recibido sin prealerta; queda sin dueño',
    );
    logger.info('Paquete sin prealerta registrado', { envio: envio.id, conDueno: Boolean(clienteId) });
    return this.vista(ajustado);
  }

  async asignarPaquete(actor: Actor, paqueteId: string, clienteId: string | null, motivo?: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    if (envio.tipo !== 'ALERTA' || !ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) {
      throw AppError.badRequest('Este paquete está en un envío consolidado. Quítalo del consolidado antes de cambiar el dueño.', 'PAQUETE_EN_CONSOLIDADO');
    }
    if (paquete.estado !== 'RECIBIDO') throw AppError.badRequest('Solo se cambia el dueño de paquetes que ya están en bodega.');
    const destino = clienteId ? await this.clienteActivo(clienteId) : await this.clienteSinAsignar();
    if (destino.id === envio.clienteId) throw AppError.badRequest('El paquete ya pertenece a ese cliente.');
    const nota = limpiarTexto(motivo, 200);
    const tienda = envio.tienda;
    const nuevo = await this.llevarABodega(destino.id, [paqueteId], tienda, envio.id);
    await this.refrescarAlerta(envio.id);
    await this.evento(envio.id, actor, 'CAMBIO_DUENO', `Paquete ${paquete.trackingTexto} pasó a otro dueño${nota ? `: ${nota}` : ''}`, { destino: destino.id });
    await this.evento(nuevo.id, actor, 'ASIGNACION', clienteId ? `Paquete asignado${nota ? `: ${nota}` : ''}` : `Paquete devuelto a sin dueño${nota ? `: ${nota}` : ''}`, { origen: envio.id });
    logger.info('Dueño de paquete cambiado', { paquete: paqueteId, origen: envio.id, destino: nuevo.id });
    return this.vista(nuevo);
  }

  async descartarPaquete(actor: Actor, paqueteId: string, motivo: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const detalle = exigirMotivo(motivo);
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    if ([...ESTADOS_CON_PAGO, 'CANCELADO', 'ARCHIVADO'].includes(envio.estado)) {
      throw AppError.badRequest('Este paquete ya no se puede descartar.', 'ENVIO_BLOQUEADO');
    }
    const apartado = await this.apartarDescartados(envio, [paqueteId]);
    await this.evento(apartado.id, actor, 'DESCARTE', `Paquete ${paquete.trackingTexto} descartado: ${detalle}`);
    await this.evento(envio.id, actor, 'DESCARTE', `Paquete ${paquete.trackingTexto} descartado: ${detalle}`);
    if (envio.tipo === 'ALERTA') await this.refrescarAlerta(envio.id);
    else await this.alCambiarConsolidado(envio.id, actor);
    logger.info('Paquete descartado', { paquete: paqueteId, envio: envio.id });
    return this.vista(await this.cargar(envio.id));
  }

  async eliminarAlertaPendiente(actor: Actor, paqueteId: string): Promise<EnvioVista> {
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    this.exigirAcceso(actor, envio);
    if (envio.tipo !== 'ALERTA' || paquete.estado !== 'ESPERADO' || !ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) {
      throw AppError.badRequest('Solo se eliminan alertas de paquetes que aún no llegan.');
    }
    const apartado = await this.apartarDescartados(envio, [paqueteId]);
    await this.evento(apartado.id, actor, 'ALERTA_ELIMINADA', `Alerta del tracking ${paquete.trackingTexto} eliminada`);
    await this.evento(envio.id, actor, 'ALERTA_ELIMINADA', `Alerta del tracking ${paquete.trackingTexto} eliminada`);
    logger.info('Alerta pendiente eliminada', { envio: envio.id });
    return this.vista(await this.refrescarAlerta(envio.id));
  }

  private async paquetesParaConsolidar(clienteId: string, paqueteIds: unknown): Promise<Array<{ envio: Envio; paquete: Paquete }>> {
    if (!Array.isArray(paqueteIds) || paqueteIds.length === 0) throw AppError.badRequest('Elige al menos un paquete.');
    if (paqueteIds.length > MAX_PAQUETES_CONSOLIDADO) throw AppError.badRequest(`Máximo ${MAX_PAQUETES_CONSOLIDADO} paquetes por envío.`);
    const unicos = [...new Set(paqueteIds.map(String))];
    const elegidos: Array<{ envio: Envio; paquete: Paquete }> = [];
    for (const id of unicos) {
      const hallado = await this.buscarPorPaqueteId(id);
      const enBodega =
        hallado.envio.clienteId === clienteId &&
        hallado.envio.tipo === 'ALERTA' &&
        ESTADOS_ALERTA_ACTIVOS.includes(hallado.envio.estado) &&
        hallado.paquete.estado === 'RECIBIDO';
      if (!enBodega) throw AppError.badRequest(`El paquete ${hallado.paquete.trackingTexto} no está disponible en la bodega de este cliente.`, 'PAQUETE_NO_DISPONIBLE');
      elegidos.push(hallado);
    }
    return elegidos;
  }

  async crearConsolidado(actor: Actor, datos: NuevoConsolidado): Promise<EnvioVista> {
    const clienteId = esPersonal(actor) ? datos.clienteId : actor.id;
    if (!clienteId) throw AppError.badRequest('Indica el cliente del envío.');
    const dueno = await this.clienteActivo(clienteId);
    const modalidad = validarModalidad(datos.modalidad);
    const transportista = validarTransportista(datos.transportista);
    const entregaDelPerfil = entregaDesdePerfil(dueno, transportista, this.cifrado);
    if (!entregaDelPerfil && !esPersonal(actor)) {
      throw AppError.badRequest('Completa tus datos de entrega de esta transportista en tu perfil antes de pedir el envío.', 'PERFIL_INCOMPLETO');
    }
    const elegidos = await this.paquetesParaConsolidar(clienteId, datos.paqueteIds);
    const valor = this.sumaDeValores(elegidos.map((e) => e.paquete));
    const tiendas = [...new Set(elegidos.map((e) => e.envio.tienda).filter((t) => t !== TIENDA_SIN_PREALERTA && t !== TIENDA_DEVUELTO && t !== 'Sin indicar'))];
    const consolidado = await this.repos.envios.crear({
      tipo: 'CONSOLIDADO',
      clienteId,
      modalidad,
      transportista,
      tienda: limpiarTexto(tiendas.join(', '), 80) || 'Envío consolidado',
      valorDeclaradoCentavos: valor,
      paquetes: [],
    });
    if (entregaDelPerfil) await this.repos.envios.actualizar(consolidado.id, { entrega: entregaDelPerfil });
    await this.repos.envios.moverPaquetes(elegidos.map((e) => e.paquete.id), consolidado.id, elegidos.map((e) => e.envio.id));
    for (const origenId of new Set(elegidos.map((e) => e.envio.id))) await this.refrescarAlerta(origenId);
    await this.evento(consolidado.id, actor, 'CONSOLIDACION', `Consolidado con ${elegidos.length} paquete(s)${esPersonal(actor) ? ' por el personal' : ' por el cliente'}`);
    logger.info('Consolidado creado', { envio: consolidado.id, paquetes: elegidos.length, porPersonal: esPersonal(actor) });
    if (esPersonal(actor) && datos.pesoKg !== undefined && datos.pesoKg !== null) return this.cotizar(actor, consolidado.id, Number(datos.pesoKg));
    return this.vista(await this.cargar(consolidado.id));
  }

  private async consolidadoAbierto(envioId: string): Promise<Envio> {
    const envio = await this.cargar(envioId);
    if (envio.tipo !== 'CONSOLIDADO' || !ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) {
      throw AppError.badRequest('Este envío ya no admite cambios de paquetes o de peso.', 'ENVIO_BLOQUEADO');
    }
    return envio;
  }

  async agregarAlConsolidado(actor: Actor, envioId: string, paqueteIds: unknown): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.consolidadoAbierto(envioId);
    const elegidos = await this.paquetesParaConsolidar(envio.clienteId, paqueteIds);
    await this.repos.envios.moverPaquetes(elegidos.map((e) => e.paquete.id), envio.id, elegidos.map((e) => e.envio.id));
    for (const origenId of new Set(elegidos.map((e) => e.envio.id))) await this.refrescarAlerta(origenId);
    await this.evento(envio.id, actor, 'AGREGAR_PAQUETES', `${elegidos.length} paquete(s) agregado(s) al consolidado`);
    return this.vista(await this.alCambiarConsolidado(envio.id, actor));
  }

  async quitarDelConsolidado(actor: Actor, envioId: string, paqueteId: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.consolidadoAbierto(envioId);
    const paquete = envio.paquetes.find((p) => p.id === paqueteId);
    if (!paquete) throw AppError.notFound('El paquete no pertenece a este envío.');
    await this.llevarABodega(envio.clienteId, [paqueteId], TIENDA_DEVUELTO, envio.id);
    await this.evento(envio.id, actor, 'QUITAR_PAQUETE', `Paquete ${paquete.trackingTexto} devuelto a la bodega del cliente`);
    return this.vista(await this.alCambiarConsolidado(envio.id, actor));
  }

  async cotizar(actor: Actor, envioId: string, pesoKg: number): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.consolidadoAbierto(envioId);
    if (envio.paquetes.length === 0) throw AppError.badRequest('El envío no tiene paquetes.');
    const peso = kilosACentesimas(validarPesoKg(pesoKg));
    const precio = await this.precioDe(envio, peso);
    if (envio.estado === 'POR_CONSOLIDAR') validarTransicion('POR_CONSOLIDAR', 'POR_PAGAR');
    const actualizado = await this.repos.envios.actualizar(
      envio.id,
      {
        estado: 'POR_PAGAR',
        pesoTotalCentesimas: peso,
        pesoCobrableCentesimas: precio.pesoCobrableCentesimas,
        fleteCentavos: precio.fleteCentavos,
        seguroCentavos: precio.seguroCentavos,
        totalCentavos: precio.totalCentavos,
      },
      envio.estado,
    );
    await this.evento(envio.id, actor, 'COTIZACION', `Peso del consolidado: ${(peso / 100).toFixed(2)} kg; total ${(precio.totalCentavos / 100).toFixed(2)} $`);
    logger.info('Consolidado cotizado', { envio: envio.id });
    return this.vista(actualizado);
  }

  async desarmar(actor: Actor, envioId: string, motivo?: string): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    if (envio.tipo !== 'CONSOLIDADO' || !ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) {
      throw AppError.badRequest('Este envío ya no se puede deshacer.', 'ENVIO_BLOQUEADO');
    }
    const pagos = await this.repos.pagos.deEnvio(envio.id);
    if (pagos.some((p) => p.estado !== 'RECHAZADO')) throw AppError.badRequest('Este envío ya tiene pagos; escríbenos por WhatsApp.', 'ENVIO_CON_PAGOS');
    const nota = limpiarTexto(motivo, 200);
    if (envio.paquetes.length > 0) await this.llevarABodega(envio.clienteId, envio.paquetes.map((p) => p.id), TIENDA_DEVUELTO, envio.id);
    validarTransicion(envio.estado, 'CANCELADO');
    const actualizado = await this.repos.envios.actualizar(envio.id, { estado: 'CANCELADO' }, envio.estado);
    await this.evento(envio.id, actor, 'DESHACER', `Consolidado deshecho; los paquetes volvieron a la bodega${nota ? `: ${nota}` : ''}`);
    logger.info('Consolidado deshecho', { envio: envio.id });
    return this.vista(actualizado);
  }

  async registrarPeso(actor: Actor, paqueteId: string, pesoKg: number): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    if (paquete.estado !== 'RECIBIDO') throw AppError.badRequest('Primero escanea y recibe el paquete.');
    const editable = (envio.tipo === 'ALERTA' && ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) || envio.estado === 'POR_CONSOLIDAR';
    if (!editable) throw AppError.badRequest('Este envío ya fue pesado o cobrado; no se puede cambiar el peso del paquete.', 'ENVIO_BLOQUEADO');
    const peso = validarPesoKg(pesoKg);
    await this.repos.envios.actualizarPaquete(paqueteId, { pesoCentesimas: kilosACentesimas(peso) });
    await this.evento(envio.id, actor, 'PESO', `Peso del paquete: ${peso.toFixed(2)} kg`);
    return this.vista(await this.cargar(envio.id));
  }

  async registrarFotoPaquete(actor: Actor, paqueteId: string, archivo: ArchivoEntrada | undefined): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const valido = validarImagen(archivo);
    const { envio } = await this.buscarPorPaqueteId(paqueteId);
    const ruta = rutaArchivo('paquetes', envio.id, valido.mime);
    await this.almacenamiento.subir(ruta, valido);
    await this.repos.envios.actualizarPaquete(paqueteId, { fotoPath: ruta });
    await this.evento(envio.id, actor, 'FOTO', 'Foto del paquete guardada');
    return this.vista(await this.cargar(envio.id));
  }

  async marcarAvisado(actor: Actor, paqueteId: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const { envio } = await this.buscarPorPaqueteId(paqueteId);
    await this.repos.envios.actualizarPaquete(paqueteId, { avisadoEn: new Date(), avisadoPorId: actor.id });
    await this.evento(envio.id, actor, 'AVISO', 'Aviso de llegada enviado por WhatsApp');
    return this.vista(await this.cargar(envio.id));
  }

  async actualizarEntregaConPerfil(actor: Actor, envioId: string): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    if (envio.tipo !== 'CONSOLIDADO') throw AppError.badRequest('Los datos de entrega se cargan en el envío consolidado.');
    if (['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)) {
      throw AppError.badRequest('El envío ya salió; los datos de entrega no se pueden cambiar.', 'ENVIO_BLOQUEADO');
    }
    const dueno = await this.clienteActivo(envio.clienteId);
    const entrega = entregaDesdePerfil(dueno, envio.transportista, this.cifrado);
    if (!entrega) throw AppError.badRequest('El perfil no tiene los datos de entrega de esta transportista.', 'PERFIL_INCOMPLETO');
    const actualizado = await this.repos.envios.actualizar(envioId, { entrega });
    await this.evento(envioId, actor, 'ENTREGA', 'Datos de entrega actualizados con el perfil');
    return this.vista(actualizado);
  }

  async guardarEntrega(actor: Actor, envioId: string, datos: DatosEntrega): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.obtenerEnvio(actor, envioId);
    if (envio.tipo !== 'CONSOLIDADO') throw AppError.badRequest('Los datos de entrega se cargan en el envío consolidado.');
    if (['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)) {
      throw AppError.badRequest('El envío ya salió; los datos de entrega no se pueden cambiar.', 'ENVIO_BLOQUEADO');
    }
    const campo = (valor: unknown, nombre: string): string => {
      const limpio = limpiarTexto(valor, 120);
      if (!limpio) throw AppError.badRequest(`Falta ${nombre}.`);
      return limpio;
    };
    const actualizado = await this.repos.envios.actualizar(envioId, {
      entrega: {
        nombreCifrado: this.cifrado.cifrar(campo(datos.nombre, 'el nombre de quien recibe')),
        cedulaCifrada: this.cifrado.cifrar(validarCedula(String(datos.cedula ?? ''))),
        telefonoCifrado: this.cifrado.cifrar(validarTelefono(String(datos.telefono ?? ''))),
        agencia: campo(datos.agencia, 'la agencia de retiro'),
        ciudad: campo(datos.ciudad, 'la ciudad'),
        estado: campo(datos.estado, 'el estado'),
      },
    });
    await this.evento(envioId, actor, 'ENTREGA', 'Datos de entrega guardados');
    return this.vista(actualizado);
  }

  async despachar(actor: Actor, envioId: string, guia: string | undefined, foto?: ArchivoEntrada): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.cargar(envioId);
    const entrega: DatosEntrega = {
      nombre: envio.entrega.nombreCifrado ? '*' : null,
      cedula: envio.entrega.cedulaCifrada ? '*' : null,
      telefono: envio.entrega.telefonoCifrado ? '*' : null,
      agencia: envio.entrega.agencia,
      ciudad: envio.entrega.ciudad,
      estado: envio.entrega.estado,
    };
    validarDespacho({ estado: envio.estado, pagoConfirmado: envio.estado === 'PAGADO', entrega });
    const numeroEscrito = limpiarTexto(guia ?? '', 40);
    if (numeroEscrito.length > 0 && numeroEscrito.length < 3) throw AppError.badRequest('El número de guía es muy corto. Revísalo o sube solo la foto.');
    if (numeroEscrito.length === 0 && !foto) throw AppError.badRequest('Sube la foto de la guía o escribe su número.');
    const numeroGuia = numeroEscrito.length > 0 ? numeroEscrito : null;
    let guiaFotoPath: string | null = null;
    if (foto) {
      const valida = validarImagen(foto);
      guiaFotoPath = rutaArchivo('guias', envioId, valida.mime);
      await this.almacenamiento.subir(guiaFotoPath, valida);
    }
    validarTransicion(envio.estado, 'DESPACHADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'DESPACHADO', guiaVenezolana: numeroGuia, guiaFotoPath }, envio.estado);
    await this.evento(envioId, actor, 'DESPACHO', `Despachado con ${envio.transportista}`);
    logger.info('Envío despachado', { envio: envioId, transportista: envio.transportista });
    return this.vista(actualizado);
  }

  async confirmarRecibido(actor: Actor, envioId: string): Promise<EnvioVista> {
    if (esPersonal(actor)) throw AppError.forbidden('Esta confirmación la hace el cliente. El personal usa «Marcar entregado».');
    const envio = await this.obtenerEnvio(actor, envioId);
    if (envio.tipo !== 'CONSOLIDADO' || envio.estado !== 'DESPACHADO') {
      throw AppError.badRequest('Solo puedes confirmar un envío que va en ruta.', 'ENVIO_NO_EN_RUTA');
    }
    validarTransicion(envio.estado, 'CERRADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'CERRADO' }, envio.estado);
    await this.evento(envioId, actor, 'ENTREGADO', 'El cliente confirmó que recibió el envío');
    logger.info('Envío confirmado como recibido por el cliente', { envio: envioId });
    return this.vista(actualizado);
  }

  async cerrar(actor: Actor, envioId: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const envio = await this.cargar(envioId);
    validarTransicion(envio.estado, 'CERRADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'CERRADO' }, envio.estado);
    await this.evento(envioId, actor, 'ENTREGADO', 'El personal marcó el envío como entregado');
    return this.vista(actualizado);
  }

  async cancelar(actor: Actor, envioId: string, motivo: string): Promise<EnvioVista> {
    this.exigirPersonal(actor);
    const detalle = exigirMotivo(motivo);
    const envio = await this.cargar(envioId);
    if (envio.tipo === 'CONSOLIDADO' && ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado)) return this.desarmar(actor, envioId, detalle);
    validarTransicion(envio.estado, 'CANCELADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'CANCELADO' }, envio.estado);
    await this.evento(envioId, actor, 'DESCARTE', `Envío descartado: ${detalle}`);
    logger.info('Envío descartado', { envio: envioId });
    return this.vista(actualizado);
  }

  async ajusteAdmin(
    actor: Actor,
    envioId: string,
    cambios: { pesoTotalKg?: number; valorDeclaradoUsd?: number; totalUsd?: number; motivo: string },
  ): Promise<EnvioVista> {
    if (actor.rol !== 'ADMIN') throw AppError.forbidden('Solo el administrador puede corregir precios.');
    const motivo = limpiarTexto(cambios.motivo, 200);
    if (motivo.length < 5) throw AppError.badRequest('Escribe el motivo del ajuste (mínimo 5 letras).');
    const envio = await this.cargar(envioId);
    if (envio.tipo !== 'CONSOLIDADO') throw AppError.badRequest('Los ajustes se hacen sobre el envío consolidado.');
    if (['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)) {
      throw AppError.badRequest('El envío ya salió; no se puede ajustar.', 'ENVIO_BLOQUEADO');
    }
    const anterior = { pesoTotalCentesimas: envio.pesoTotalCentesimas, valorDeclaradoCentavos: envio.valorDeclaradoCentavos, totalCentavos: envio.totalCentavos };
    let trabajo = envio;
    if (cambios.valorDeclaradoUsd !== undefined) {
      trabajo = await this.repos.envios.actualizar(envioId, { valorDeclaradoCentavos: validarValorDeclarado(cambios.valorDeclaradoUsd) });
    }
    if (cambios.pesoTotalKg !== undefined) {
      const centesimas = kilosACentesimas(validarPesoKg(cambios.pesoTotalKg));
      const precio = await this.precioDe(trabajo, centesimas);
      trabajo = await this.repos.envios.actualizar(envioId, {
        pesoTotalCentesimas: centesimas,
        pesoCobrableCentesimas: precio.pesoCobrableCentesimas,
        fleteCentavos: precio.fleteCentavos,
        seguroCentavos: precio.seguroCentavos,
        totalCentavos: precio.totalCentavos,
      });
    } else if (cambios.valorDeclaradoUsd !== undefined) {
      trabajo = await this.recalcular(trabajo);
    }
    if (cambios.totalUsd !== undefined) {
      if (!Number.isFinite(cambios.totalUsd) || cambios.totalUsd < 0) throw AppError.badRequest('El total no puede ser negativo.');
      trabajo = await this.repos.envios.actualizar(envioId, { totalCentavos: Math.round(cambios.totalUsd * 100) });
    }
    await this.evento(envioId, actor, 'AJUSTE', motivo, { anterior, nuevo: { ...cambios, motivo: undefined } });
    logger.info('Ajuste manual aplicado', { envio: envioId, actor: actor.id });
    return this.vista(trabajo);
  }

  async bodega(actor: Actor, filtro: { q?: string; sinDueno?: boolean } = {}): Promise<ItemBodega[]> {
    this.exigirPersonal(actor);
    const envios = await this.repos.envios.listar({ estados: ESTADOS_EN_BODEGA });
    const clientes = new Map((await this.repos.usuarios.porIds(envios.map((e) => e.clienteId))).map((c) => [c.id, c]));
    const items: ItemBodega[] = [];
    for (const envio of envios) {
      const cliente = clientes.get(envio.clienteId);
      if (!cliente) continue;
      const sinDueno = cliente.telefono === TELEFONO_SIN_ASIGNAR;
      for (const paquete of envio.paquetes) {
        if (paquete.estado !== 'RECIBIDO') continue;
        items.push({
          paqueteId: paquete.id,
          tracking: paquete.trackingTexto,
          pesoKg: paquete.pesoCentesimas ? paquete.pesoCentesimas / 100 : null,
          tieneFoto: Boolean(paquete.fotoPath),
          fotoRuta: paquete.fotoPath,
          recibidoEn: paquete.recibidoEn ? paquete.recibidoEn.toISOString() : null,
          envioId: envio.id,
          tipoEnvio: envio.tipo,
          estadoEnvio: envio.estado,
          sinDueno,
          cliente: { id: cliente.id, nombre: sinDueno ? 'Sin dueño' : cliente.nombre, codigo: sinDueno ? '' : cliente.codigo },
        });
      }
    }
    const q = filtro.q?.trim().toLowerCase() ?? '';
    const qNormalizado = q.replace(/[^a-z0-9]/g, '');
    return items
      .filter((item) => !filtro.sinDueno || item.sinDueno)
      .filter(
        (item) =>
          !q ||
          item.cliente.nombre.toLowerCase().includes(q) ||
          item.cliente.codigo.toLowerCase().includes(q) ||
          (qNormalizado.length > 0 && item.tracking.toLowerCase().replace(/[^a-z0-9]/g, '').includes(qNormalizado)),
      )
      .sort((a, b) => (a.recibidoEn ?? '').localeCompare(b.recibidoEn ?? ''));
  }

  async resumen(actor: Actor) {
    this.exigirPersonal(actor);
    const envios = await this.repos.envios.listar({ estados: ESTADOS_EN_BODEGA });
    const pagosPorConfirmar = await this.repos.pagos.porEstado('POR_CONFIRMAR');
    const sinDueno = await this.repos.usuarios.porTelefono(TELEFONO_SIN_ASIGNAR);
    const alertas = envios.filter((e) => e.tipo === 'ALERTA' && ESTADOS_ALERTA_ACTIVOS.includes(e.estado));
    const deClientes = alertas.filter((e) => e.clienteId !== sinDueno?.id);
    const sinDuenoAlertas = alertas.filter((e) => e.clienteId === sinDueno?.id);
    const contarRecibidos = (lista: Envio[]) => lista.reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'RECIBIDO').length, 0);
    return {
      porRecibir: deClientes.reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'ESPERADO').length, 0),
      porAvisar: deClientes.reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'RECIBIDO' && !p.avisadoEn).length, 0),
      sinDueno: contarRecibidos(sinDuenoAlertas),
      porConsolidar: envios.filter((e) => e.estado === 'POR_CONSOLIDAR').length,
      porCobrar: envios.filter((e) => e.estado === 'POR_PAGAR').length,
      pagosPorConfirmar: pagosPorConfirmar.length,
      porDespachar: envios.filter((e) => e.estado === 'PAGADO').length,
      enBodega: envios.reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'RECIBIDO').length, 0),
    };
  }

  private async envioConFoto(ruta: string): Promise<Envio> {
    const dueno = await this.repos.envios.porFotoPaquete(ruta);
    if (!dueno) throw AppError.notFound('El archivo no existe.');
    return dueno;
  }

  async verArchivo(actor: Actor, ruta: string) {
    const partes = ruta.split('/');
    if (partes.length !== 3 || partes.some((p) => !p || p === '..')) throw AppError.notFound('El archivo no existe.');
    const envio = partes[0] === 'paquetes' ? await this.envioConFoto(ruta) : await this.cargar(partes[1]!);
    this.exigirAcceso(actor, envio);
    return this.almacenamiento.acceso(ruta);
  }
}
