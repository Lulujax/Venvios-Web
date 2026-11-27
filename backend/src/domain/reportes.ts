import {
  ESTADOS_ALERTA_ACTIVOS,
  ETIQUETAS_ESTADO,
  TIENDA_DEVUELTO,
  TIENDA_SIN_PREALERTA,
  type EstadoEnvio,
  type TipoEnvio,
} from './estados';
import { AppError } from '../utils/errors';

export const TIPOS_REPORTE = ['inventario', 'prealertas-pendientes', 'estado-de-cuenta'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const ETAPAS_PAQUETE = [
  'POR_LLEGAR',
  'EN_BODEGA',
  'SIN_DUENO',
  'ESPERANDO_PAGO',
  'LISTO_PARA_SALIR',
  'EN_RUTA',
  'ENTREGADO',
] as const;
export type EtapaPaquete = (typeof ETAPAS_PAQUETE)[number];

export const ETAPAS_INVENTARIO = ['EN_BODEGA', 'SIN_DUENO', 'ESPERANDO_PAGO', 'LISTO_PARA_SALIR'] as const;
export type EtapaInventario = (typeof ETAPAS_INVENTARIO)[number];

export const ETAPAS_CLIENTE = ['POR_LLEGAR', 'EN_BODEGA', 'ESPERANDO_PAGO', 'LISTO_PARA_SALIR', 'EN_RUTA', 'ENTREGADO'] as const;
export type EtapaCliente = (typeof ETAPAS_CLIENTE)[number];

export const ETIQUETAS_ETAPA: Record<EtapaPaquete, string> = {
  POR_LLEGAR: 'Por llegar',
  EN_BODEGA: 'En bodega',
  SIN_DUENO: 'Sin dueño',
  ESPERANDO_PAGO: 'Esperando pago',
  LISTO_PARA_SALIR: 'Listo para salir',
  EN_RUTA: 'En ruta',
  ENTREGADO: 'Entregado',
};

const MS_POR_DIA = 86_400_000;
const PATRON_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface EntradaEtapaPaquete {
  paqueteEstado: 'ESPERADO' | 'RECIBIDO';
  envioTipo: TipoEnvio;
  envioEstado: EstadoEnvio;
  sinDueno: boolean;
}

export function etapaDePaquete(entrada: EntradaEtapaPaquete): EtapaPaquete | null {
  if (entrada.envioEstado === 'CANCELADO' || entrada.envioEstado === 'ARCHIVADO') return null;
  if (entrada.envioTipo === 'ALERTA') {
    if (!ESTADOS_ALERTA_ACTIVOS.includes(entrada.envioEstado)) return null;
    if (entrada.paqueteEstado === 'ESPERADO') return 'POR_LLEGAR';
    return entrada.sinDueno ? 'SIN_DUENO' : 'EN_BODEGA';
  }
  if (entrada.envioEstado === 'POR_CONSOLIDAR' || entrada.envioEstado === 'POR_PAGAR' || entrada.envioEstado === 'POR_CONFIRMAR') {
    return 'ESPERANDO_PAGO';
  }
  if (entrada.envioEstado === 'PAGADO') return 'LISTO_PARA_SALIR';
  if (entrada.envioEstado === 'DESPACHADO') return 'EN_RUTA';
  if (entrada.envioEstado === 'CERRADO') return 'ENTREGADO';
  return null;
}

export interface PeriodoFiltro {
  desde?: string;
  hasta?: string;
}

export interface PeriodoNormalizado {
  desde: string | null;
  hasta: string | null;
  desdeMs: number | null;
  hastaMs: number | null;
}

function parsearFechaUtc(texto: string): { anio: number; mes: number; dia: number } {
  const coincidencia = PATRON_FECHA_ISO.exec(texto.trim());
  if (!coincidencia) throw AppError.badRequest('Escribe las fechas en formato AAAA-MM-DD.', 'PERIODO_INVALIDO');
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const prueba = new Date(Date.UTC(anio, mes - 1, dia));
  if (prueba.getUTCFullYear() !== anio || prueba.getUTCMonth() + 1 !== mes || prueba.getUTCDate() !== dia) {
    throw AppError.badRequest('Una de las fechas elegidas no es válida.', 'PERIODO_INVALIDO');
  }
  return { anio, mes, dia };
}

export function validarPeriodo(periodo: PeriodoFiltro = {}): PeriodoNormalizado {
  const desdeLimpio = periodo.desde?.trim() || null;
  const hastaLimpio = periodo.hasta?.trim() || null;
  const desdePartes = desdeLimpio ? parsearFechaUtc(desdeLimpio) : null;
  const hastaPartes = hastaLimpio ? parsearFechaUtc(hastaLimpio) : null;
  if (desdeLimpio && hastaLimpio && desdeLimpio > hastaLimpio) {
    throw AppError.badRequest('La fecha "Desde" no puede ser posterior a "Hasta".', 'PERIODO_INVALIDO');
  }
  return {
    desde: desdeLimpio,
    hasta: hastaLimpio,
    desdeMs: desdePartes ? Date.UTC(desdePartes.anio, desdePartes.mes - 1, desdePartes.dia, 0, 0, 0, 0) : null,
    hastaMs: hastaPartes ? Date.UTC(hastaPartes.anio, hastaPartes.mes - 1, hastaPartes.dia, 23, 59, 59, 999) : null,
  };
}

export function estaEnPeriodo(fecha: Date | string | null | undefined, periodo: PeriodoNormalizado): boolean {
  if (periodo.desdeMs === null && periodo.hastaMs === null) return true;
  if (!fecha) return false;
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  const ms = valor.getTime();
  if (!Number.isFinite(ms)) return false;
  if (periodo.desdeMs !== null && ms < periodo.desdeMs) return false;
  if (periodo.hastaMs !== null && ms > periodo.hastaMs) return false;
  return true;
}

export function diasDesde(fecha: Date | string | null | undefined, ahora: Date): number | null {
  if (!fecha) return null;
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  const ms = valor.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - ms) / MS_POR_DIA));
}

function aIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isFinite(valor.getTime()) ? valor.toISOString() : null;
}

function redondearKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

export interface ClienteReporte {
  id: string;
  nombre: string;
  codigo: string;
  sinDueno?: boolean;
}

export interface PrealertaOrigenVista {
  id: string;
  tienda: string;
  fecha: string;
}

export interface PaqueteFuente {
  paqueteId: string;
  tracking: string;
  paqueteEstado: 'ESPERADO' | 'RECIBIDO';
  pesoKg: number | null;
  recibidoEn: Date | string | null;
  avisado: boolean;
  tieneFoto: boolean;
  envioId: string;
  envioNumero: number;
  envioTipo: TipoEnvio;
  envioEstado: EstadoEnvio;
  envioTienda: string;
  envioTransportista: 'MRW' | 'ZOOM';
  envioPesoTotalKg?: number | null;
  envioCreadoEn: Date | string;
  envioActualizadoEn: Date | string;
  entregadoEn?: Date | string | null;
  prealertaOrigen: { id: string; tienda: string; fecha: Date | string } | null;
  cliente: ClienteReporte;
}

export type OrigenPaqueteEstado = 'PREALERTA' | 'SIN_PREALERTA' | 'SIN_REGISTRO';

function resolverOrigen(paquete: PaqueteFuente): { prealertaOrigen: PrealertaOrigenVista | null; origenEstado: OrigenPaqueteEstado } {
  if (paquete.prealertaOrigen) {
    const fecha = aIso(paquete.prealertaOrigen.fecha);
    if (fecha) {
      return {
        prealertaOrigen: { id: paquete.prealertaOrigen.id, tienda: paquete.prealertaOrigen.tienda, fecha },
        origenEstado: 'PREALERTA',
      };
    }
  }
  if (paquete.envioTipo === 'ALERTA' && paquete.envioTienda === TIENDA_SIN_PREALERTA) {
    return { prealertaOrigen: null, origenEstado: 'SIN_PREALERTA' };
  }
  return { prealertaOrigen: null, origenEstado: 'SIN_REGISTRO' };
}

export interface FiltroInventario {
  clienteId?: string;
  etapa?: EtapaInventario;
  minDias?: number;
  soloSinAvisar?: boolean;
  desde?: string;
  hasta?: string;
}

export interface ItemInventario {
  paqueteId: string;
  tracking: string;
  etapa: EtapaInventario;
  etiquetaEtapa: string;
  prealertaOrigen: PrealertaOrigenVista | null;
  origenEstado: OrigenPaqueteEstado;
  pesoKg: number | null;
  recibidoEn: string | null;
  diasEnBodega: number | null;
  avisado: boolean;
  tieneFoto: boolean;
  envioId: string;
}

export interface ClienteInventario {
  cliente: { id: string; nombre: string; codigo: string };
  totalPaquetes: number;
  pesoTotalKg: number;
  items: ItemInventario[];
}

export interface ResumenInventario {
  totalPaquetes: number;
  pesoTotalKg: number;
  sinAvisar: number;
  porEtapa: Record<EtapaInventario, number>;
}

export interface ReporteInventario {
  tipo: 'inventario';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  resumen: ResumenInventario;
  clientes: ClienteInventario[];
}

function esEtapaInventario(etapa: EtapaPaquete | null): etapa is EtapaInventario {
  return etapa !== null && (ETAPAS_INVENTARIO as readonly string[]).includes(etapa);
}

export function armarInventario(fuentes: PaqueteFuente[], filtro: FiltroInventario = {}, ahora: Date = new Date()): ReporteInventario {
  const periodo = validarPeriodo({ desde: filtro.desde, hasta: filtro.hasta });
  const porCliente = new Map<string, ClienteInventario>();
  const porEtapa: Record<EtapaInventario, number> = {
    EN_BODEGA: 0,
    SIN_DUENO: 0,
    ESPERANDO_PAGO: 0,
    LISTO_PARA_SALIR: 0,
  };
  let totalPaquetes = 0;
  let pesoTotalKg = 0;
  let sinAvisar = 0;

  for (const fuente of fuentes) {
    if (filtro.clienteId && fuente.cliente.id !== filtro.clienteId) continue;
    const etapa = etapaDePaquete({
      paqueteEstado: fuente.paqueteEstado,
      envioTipo: fuente.envioTipo,
      envioEstado: fuente.envioEstado,
      sinDueno: Boolean(fuente.cliente.sinDueno),
    });
    if (!esEtapaInventario(etapa)) continue;
    if (filtro.etapa && etapa !== filtro.etapa) continue;
    if (filtro.soloSinAvisar && (etapa !== 'EN_BODEGA' || fuente.avisado)) continue;
    if (!estaEnPeriodo(fuente.recibidoEn, periodo)) continue;
    const diasEnBodega = diasDesde(fuente.recibidoEn, ahora);
    if (filtro.minDias && (diasEnBodega === null || diasEnBodega < filtro.minDias)) continue;

    const { prealertaOrigen, origenEstado } = resolverOrigen(fuente);
    const clienteLimpio = {
      id: fuente.cliente.id,
      nombre: fuente.cliente.sinDueno ? 'Sin dueño' : fuente.cliente.nombre,
      codigo: fuente.cliente.sinDueno ? '' : fuente.cliente.codigo,
    };
    const item: ItemInventario = {
      paqueteId: fuente.paqueteId,
      tracking: fuente.tracking,
      etapa,
      etiquetaEtapa: ETIQUETAS_ETAPA[etapa],
      prealertaOrigen,
      origenEstado,
      pesoKg: fuente.pesoKg,
      recibidoEn: aIso(fuente.recibidoEn),
      diasEnBodega,
      avisado: Boolean(fuente.avisado),
      tieneFoto: Boolean(fuente.tieneFoto),
      envioId: fuente.envioId,
    };

    let grupo = porCliente.get(clienteLimpio.id);
    if (!grupo) {
      grupo = { cliente: clienteLimpio, totalPaquetes: 0, pesoTotalKg: 0, items: [] };
      porCliente.set(clienteLimpio.id, grupo);
    }
    grupo.items.push(item);
    grupo.totalPaquetes += 1;
    grupo.pesoTotalKg = redondearKg(grupo.pesoTotalKg + (item.pesoKg ?? 0));

    totalPaquetes += 1;
    pesoTotalKg = redondearKg(pesoTotalKg + (item.pesoKg ?? 0));
    porEtapa[etapa] += 1;
    if (etapa === 'EN_BODEGA' && !item.avisado) sinAvisar += 1;
  }

  const clientes = [...porCliente.values()]
    .map((grupo) => ({
      ...grupo,
      items: [...grupo.items].sort((a, b) => (a.recibidoEn ?? '').localeCompare(b.recibidoEn ?? '') || a.tracking.localeCompare(b.tracking)),
    }))
    .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre));

  return {
    tipo: 'inventario',
    generadoEn: ahora.toISOString(),
    periodo: { desde: periodo.desde, hasta: periodo.hasta },
    resumen: { totalPaquetes, pesoTotalKg, sinAvisar, porEtapa },
    clientes,
  };
}

export interface PaqueteDeOrigen {
  paqueteId: string;
  tracking: string;
  paqueteEstado: 'ESPERADO' | 'RECIBIDO';
  envioTipo: TipoEnvio;
  envioEstado: EstadoEnvio;
  sinDueno: boolean;
}

export interface PrealertaFuente {
  envioId: string;
  tienda: string;
  fechaAviso: Date | string;
  cliente: ClienteReporte;
  paquetesDeOrigen: PaqueteDeOrigen[];
}

export interface PaqueteSinOrigenFuente {
  paqueteId: string;
  clienteId: string;
  fechaReferencia: Date | string | null;
  paqueteEstado: 'ESPERADO' | 'RECIBIDO';
  envioTipo: TipoEnvio;
  envioEstado: EstadoEnvio;
  envioTienda: string;
  sinDueno: boolean;
}

export interface FiltroPrealertasPendientes {
  clienteId?: string;
  desde?: string;
  hasta?: string;
}

export interface PrealertaPendienteVista {
  envioId: string;
  tienda: string;
  fechaAviso: string;
  diasDesdeAviso: number;
  llegaron: number;
  total: number;
  faltan: number;
  trackingsFaltantes: string[];
}

export interface ClientePrealertasPendientes {
  cliente: { id: string; nombre: string; codigo: string };
  totalPorLlegar: number;
  prealertas: PrealertaPendienteVista[];
}

export interface ResumenPrealertasPendientes {
  totalPrealertas: number;
  totalPaquetesPorLlegar: number;
  totalClientes: number;
  sinRegistroPrealerta: number;
}

export interface ReportePrealertasPendientes {
  tipo: 'prealertas-pendientes';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  resumen: ResumenPrealertasPendientes;
  clientes: ClientePrealertasPendientes[];
}

function evaluarPrealerta(prealerta: PrealertaFuente, ahora: Date): PrealertaPendienteVista | null {
  const fechaAviso = aIso(prealerta.fechaAviso);
  if (!fechaAviso) return null;
  const activos = prealerta.paquetesDeOrigen
    .map((p) => ({
      tracking: p.tracking,
      etapa: etapaDePaquete({
        paqueteEstado: p.paqueteEstado,
        envioTipo: p.envioTipo,
        envioEstado: p.envioEstado,
        sinDueno: p.sinDueno,
      }),
    }))
    .filter((p): p is { tracking: string; etapa: EtapaPaquete } => p.etapa !== null);

  const faltantes = activos.filter((p) => p.etapa === 'POR_LLEGAR').map((p) => p.tracking);
  if (faltantes.length === 0) return null;

  const total = activos.length;
  const faltan = faltantes.length;
  return {
    envioId: prealerta.envioId,
    tienda: prealerta.tienda,
    fechaAviso,
    diasDesdeAviso: diasDesde(fechaAviso, ahora) ?? 0,
    llegaron: total - faltan,
    total,
    faltan,
    trackingsFaltantes: faltantes,
  };
}

function esPaqueteSinRegistro(fuente: PaqueteSinOrigenFuente): boolean {
  if (fuente.sinDueno || fuente.envioTienda === TIENDA_SIN_PREALERTA) return false;
  const etapa = etapaDePaquete({
    paqueteEstado: fuente.paqueteEstado,
    envioTipo: fuente.envioTipo,
    envioEstado: fuente.envioEstado,
    sinDueno: fuente.sinDueno,
  });
  if (etapa === null) return false;
  return fuente.envioTipo === 'CONSOLIDADO' || fuente.envioTienda === TIENDA_DEVUELTO;
}

export function armarPrealertasPendientes(
  prealertas: PrealertaFuente[],
  sinOrigen: PaqueteSinOrigenFuente[] = [],
  filtro: FiltroPrealertasPendientes = {},
  ahora: Date = new Date(),
): ReportePrealertasPendientes {
  const periodo = validarPeriodo({ desde: filtro.desde, hasta: filtro.hasta });
  const porCliente = new Map<string, ClientePrealertasPendientes>();
  let totalPrealertas = 0;
  let totalPaquetesPorLlegar = 0;

  for (const prealerta of prealertas) {
    if (filtro.clienteId && prealerta.cliente.id !== filtro.clienteId) continue;
    if (!estaEnPeriodo(prealerta.fechaAviso, periodo)) continue;
    const vista = evaluarPrealerta(prealerta, ahora);
    if (!vista) continue;

    const clienteLimpio = {
      id: prealerta.cliente.id,
      nombre: prealerta.cliente.nombre,
      codigo: prealerta.cliente.codigo,
    };
    let grupo = porCliente.get(clienteLimpio.id);
    if (!grupo) {
      grupo = { cliente: clienteLimpio, totalPorLlegar: 0, prealertas: [] };
      porCliente.set(clienteLimpio.id, grupo);
    }
    grupo.prealertas.push(vista);
    grupo.totalPorLlegar += vista.faltan;
    totalPrealertas += 1;
    totalPaquetesPorLlegar += vista.faltan;
  }

  const clientes = [...porCliente.values()]
    .map((grupo) => ({
      ...grupo,
      prealertas: [...grupo.prealertas].sort((a, b) => a.fechaAviso.localeCompare(b.fechaAviso)),
    }))
    .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre));

  const sinRegistroPrealerta = sinOrigen.filter((p) => {
    if (filtro.clienteId && p.clienteId !== filtro.clienteId) return false;
    if (!esPaqueteSinRegistro(p)) return false;
    return estaEnPeriodo(p.fechaReferencia, periodo);
  }).length;

  return {
    tipo: 'prealertas-pendientes',
    generadoEn: ahora.toISOString(),
    periodo: { desde: periodo.desde, hasta: periodo.hasta },
    resumen: {
      totalPrealertas,
      totalPaquetesPorLlegar,
      totalClientes: clientes.length,
      sinRegistroPrealerta,
    },
    clientes,
  };
}

export interface PaqueteEstadoCuenta {
  paqueteId: string;
  tracking: string;
  prealertaOrigen: PrealertaOrigenVista | null;
  origenEstado: OrigenPaqueteEstado;
  pesoKg: number | null;
  recibidoEn: string | null;
  diasEnBodega: number | null;
  avisado: boolean;
  tieneFoto: boolean;
}

export interface ConsolidadoEstadoCuenta {
  envioId: string;
  numero: number;
  etapa: 'ESPERANDO_PAGO' | 'LISTO_PARA_SALIR' | 'EN_RUTA' | 'ENTREGADO';
  etiquetaEtapa: string;
  estado: EstadoEnvio;
  etiquetaEstado: string;
  transportista: 'MRW' | 'ZOOM';
  pesoTotalKg: number | null;
  creadoEn: string;
  entregadoEn: string | null;
  paquetes: PaqueteEstadoCuenta[];
}

export interface ResumenEstadoCuenta {
  totalPaquetes: number;
  porEtapa: Record<EtapaCliente, number>;
  incluyeEntregados: boolean;
  sinRegistroPrealerta: number;
}

export interface ReporteEstadoCuenta {
  tipo: 'estado-de-cuenta';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  cliente: { id: string; nombre: string; codigo: string };
  resumen: ResumenEstadoCuenta;
  prealertas: PrealertaPendienteVista[];
  enBodega: PaqueteEstadoCuenta[];
  consolidados: ConsolidadoEstadoCuenta[];
  entregados: ConsolidadoEstadoCuenta[];
}

function paqueteAEstadoCuenta(fuente: PaqueteFuente, ahora: Date): PaqueteEstadoCuenta {
  const { prealertaOrigen, origenEstado } = resolverOrigen(fuente);
  return {
    paqueteId: fuente.paqueteId,
    tracking: fuente.tracking,
    prealertaOrigen,
    origenEstado,
    pesoKg: fuente.pesoKg,
    recibidoEn: aIso(fuente.recibidoEn),
    diasEnBodega: diasDesde(fuente.recibidoEn, ahora),
    avisado: Boolean(fuente.avisado),
    tieneFoto: Boolean(fuente.tieneFoto),
  };
}

export function armarEstadoDeCuenta(
  cliente: ClienteReporte,
  prealertasFuente: PrealertaFuente[],
  paquetesFuente: PaqueteFuente[],
  filtro: PeriodoFiltro = {},
  ahora: Date = new Date(),
): ReporteEstadoCuenta {
  const periodo = validarPeriodo(filtro);
  const incluyeEntregados = periodo.desdeMs !== null || periodo.hastaMs !== null;

  const porEtapa: Record<EtapaCliente, number> = {
    POR_LLEGAR: 0,
    EN_BODEGA: 0,
    ESPERANDO_PAGO: 0,
    LISTO_PARA_SALIR: 0,
    EN_RUTA: 0,
    ENTREGADO: 0,
  };

  const prealertas: PrealertaPendienteVista[] = [];
  for (const prealerta of prealertasFuente) {
    if (prealerta.cliente.id !== cliente.id) continue;
    if (!estaEnPeriodo(prealerta.fechaAviso, periodo)) continue;
    const vista = evaluarPrealerta(prealerta, ahora);
    if (!vista) continue;
    prealertas.push(vista);
    porEtapa.POR_LLEGAR += vista.faltan;
  }
  prealertas.sort((a, b) => a.fechaAviso.localeCompare(b.fechaAviso));

  const enBodega: PaqueteEstadoCuenta[] = [];
  const consolidadosMap = new Map<string, ConsolidadoEstadoCuenta>();
  const entregadosMap = new Map<string, ConsolidadoEstadoCuenta>();
  let sinRegistroPrealerta = 0;

  for (const fuente of paquetesFuente) {
    if (fuente.cliente.id !== cliente.id) continue;
    const etapa = etapaDePaquete({
      paqueteEstado: fuente.paqueteEstado,
      envioTipo: fuente.envioTipo,
      envioEstado: fuente.envioEstado,
      sinDueno: Boolean(fuente.cliente.sinDueno),
    });
    if (!etapa || etapa === 'POR_LLEGAR' || etapa === 'SIN_DUENO') continue;

    if (etapa === 'EN_BODEGA') {
      if (!estaEnPeriodo(fuente.recibidoEn, periodo)) continue;
      const item = paqueteAEstadoCuenta(fuente, ahora);
      enBodega.push(item);
      porEtapa.EN_BODEGA += 1;
      if (item.origenEstado === 'SIN_REGISTRO') sinRegistroPrealerta += 1;
      continue;
    }

    if (etapa === 'ENTREGADO') {
      if (!incluyeEntregados) continue;
      const fechaEntrega = fuente.entregadoEn ?? fuente.envioActualizadoEn;
      if (!estaEnPeriodo(fechaEntrega, periodo)) continue;
      const item = paqueteAEstadoCuenta(fuente, ahora);
      let grupo = entregadosMap.get(fuente.envioId);
      if (!grupo) {
        grupo = {
          envioId: fuente.envioId,
          numero: fuente.envioNumero,
          etapa: 'ENTREGADO',
          etiquetaEtapa: ETIQUETAS_ETAPA.ENTREGADO,
          estado: fuente.envioEstado,
          etiquetaEstado: ETIQUETAS_ESTADO[fuente.envioEstado],
          transportista: fuente.envioTransportista,
          pesoTotalKg: fuente.envioPesoTotalKg ?? null,
          creadoEn: aIso(fuente.envioCreadoEn) ?? '',
          entregadoEn: aIso(fechaEntrega),
          paquetes: [],
        };
        entregadosMap.set(fuente.envioId, grupo);
      }
      grupo.paquetes.push(item);
      porEtapa.ENTREGADO += 1;
      if (item.origenEstado === 'SIN_REGISTRO') sinRegistroPrealerta += 1;
      continue;
    }

    if (!estaEnPeriodo(fuente.recibidoEn, periodo)) continue;
    const item = paqueteAEstadoCuenta(fuente, ahora);
    let grupo = consolidadosMap.get(fuente.envioId);
    if (!grupo) {
      grupo = {
        envioId: fuente.envioId,
        numero: fuente.envioNumero,
        etapa,
        etiquetaEtapa: ETIQUETAS_ETAPA[etapa],
        estado: fuente.envioEstado,
        etiquetaEstado: ETIQUETAS_ESTADO[fuente.envioEstado],
        transportista: fuente.envioTransportista,
        pesoTotalKg: fuente.envioPesoTotalKg ?? null,
        creadoEn: aIso(fuente.envioCreadoEn) ?? '',
        entregadoEn: null,
        paquetes: [],
      };
      consolidadosMap.set(fuente.envioId, grupo);
    }
    grupo.paquetes.push(item);
    porEtapa[etapa] += 1;
    if (item.origenEstado === 'SIN_REGISTRO') sinRegistroPrealerta += 1;
  }

  enBodega.sort((a, b) => (a.recibidoEn ?? '').localeCompare(b.recibidoEn ?? '') || a.tracking.localeCompare(b.tracking));
  const consolidados = [...consolidadosMap.values()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const entregados = [...entregadosMap.values()].sort((a, b) => (b.entregadoEn ?? '').localeCompare(a.entregadoEn ?? ''));
  const totalPaquetes = Object.values(porEtapa).reduce((s, n) => s + n, 0);

  return {
    tipo: 'estado-de-cuenta',
    generadoEn: ahora.toISOString(),
    periodo: { desde: periodo.desde, hasta: periodo.hasta },
    cliente: { id: cliente.id, nombre: cliente.nombre, codigo: cliente.codigo },
    resumen: {
      totalPaquetes,
      porEtapa,
      incluyeEntregados,
      sinRegistroPrealerta,
    },
    prealertas,
    enBodega,
    consolidados,
    entregados,
  };
}

export type ReporteGenerado = ReporteInventario | ReportePrealertasPendientes | ReporteEstadoCuenta;
