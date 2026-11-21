import type { EstadoEnvio, Envio } from './tipos';

const ESTADOS_ALERTA_ACTIVOS: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];
const ESTADOS_PENDIENTES_PAGO: EstadoEnvio[] = ['POR_CONSOLIDAR', 'POR_PAGAR', 'POR_CONFIRMAR'];
const ESTADOS_PAGADOS: EstadoEnvio[] = ['PAGADO', 'DESPACHADO', 'CERRADO'];
const ESTADOS_COBRABLES: EstadoEnvio[] = ['POR_PAGAR', 'POR_CONFIRMAR'];

export type FiltroPedidos = 'TODOS' | 'PENDIENTES' | 'PAGADOS';
export type EstadoAlerta = 'PENDIENTE' | 'ATENDIDA';

export interface FilaAlerta {
  clave: string;
  envioId: string;
  paqueteId: string;
  fecha: string;
  tienda: string;
  tracking: string;
  estado: EstadoAlerta;
  eliminable: boolean;
}

export interface PaqueteEnBodega {
  paqueteId: string;
  envioId: string;
  tracking: string;
  tienda: string;
  pesoKg: number | null;
  recibidoEn: string | null;
  valorDeclaradoCentavos: number;
}

export function esConsolidado(envio: Envio): boolean {
  return envio.tipo === 'CONSOLIDADO';
}

export function esPendienteDePago(envio: Envio): boolean {
  return esConsolidado(envio) && ESTADOS_PENDIENTES_PAGO.includes(envio.estado);
}

export function esPagado(envio: Envio): boolean {
  return esConsolidado(envio) && ESTADOS_PAGADOS.includes(envio.estado);
}

export function esCobrable(envio: Envio): boolean {
  return esConsolidado(envio) && ESTADOS_COBRABLES.includes(envio.estado) && envio.precio !== null;
}

export function saldoPendienteCentavos(envio: Envio): number {
  if (!envio.precio) return 0;
  return Math.max(envio.precio.totalCentavos - envio.pagadoCentavos, 0);
}

export function filtrarPedidos(envios: Envio[], filtro: FiltroPedidos): Envio[] {
  const base = envios.filter((envio) => esPendienteDePago(envio) || esPagado(envio));
  if (filtro === 'PENDIENTES') return base.filter(esPendienteDePago);
  if (filtro === 'PAGADOS') return base.filter(esPagado);
  return base;
}

export function construirAlertas(envios: Envio[]): FilaAlerta[] {
  const filas: FilaAlerta[] = [];
  for (const envio of envios) {
    if (envio.estado === 'CANCELADO' || envio.estado === 'ARCHIVADO') continue;
    for (const paquete of envio.paquetes) {
      filas.push({
        clave: `${envio.id}-${paquete.id}`,
        envioId: envio.id,
        paqueteId: paquete.id,
        fecha: paquete.recibidoEn ?? envio.creadoEn,
        tienda: envio.tienda,
        tracking: paquete.tracking,
        estado: paquete.recibido ? 'ATENDIDA' : 'PENDIENTE',
        eliminable: !paquete.recibido && envio.tipo === 'ALERTA',
      });
    }
  }
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function filtrarAlertas(filas: FilaAlerta[], texto: string, estado: EstadoAlerta | 'TODOS'): FilaAlerta[] {
  const buscado = texto.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return filas.filter((fila) => {
    if (estado !== 'TODOS' && fila.estado !== estado) return false;
    if (buscado && !fila.tracking.replace(/[^A-Za-z0-9]/g, '').toLowerCase().includes(buscado)) return false;
    return true;
  });
}

export function paquetesEnBodega(envios: Envio[]): PaqueteEnBodega[] {
  const lista: PaqueteEnBodega[] = [];
  for (const envio of envios) {
    if (envio.tipo !== 'ALERTA' || !ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) continue;
    for (const paquete of envio.paquetes) {
      if (!paquete.recibido) continue;
      lista.push({
        paqueteId: paquete.id,
        envioId: envio.id,
        tracking: paquete.tracking,
        tienda: envio.tienda,
        pesoKg: paquete.pesoKg,
        recibidoEn: paquete.recibidoEn,
        valorDeclaradoCentavos: paquete.valorDeclaradoCentavos,
      });
    }
  }
  return lista.sort((a, b) => (a.recibidoEn ?? '').localeCompare(b.recibidoEn ?? ''));
}

export function sumaValoresCentavos(elegidos: PaqueteEnBodega[]): number {
  return elegidos.reduce((suma, paquete) => suma + paquete.valorDeclaradoCentavos, 0);
}

export interface ResumenCuenta {
  alertasPendientes: number;
  enBodega: number;
  porPagar: number;
  saldoPorPagarCentavos: number;
  pagados: number;
}

export function resumirCuenta(envios: Envio[]): ResumenCuenta {
  const alertas = construirAlertas(envios);
  const cobrables = envios.filter(esCobrable);
  return {
    alertasPendientes: alertas.filter((a) => a.estado === 'PENDIENTE').length,
    enBodega: paquetesEnBodega(envios).length,
    porPagar: cobrables.length,
    saldoPorPagarCentavos: cobrables.reduce((suma, envio) => suma + saldoPendienteCentavos(envio), 0),
    pagados: envios.filter(esPagado).length,
  };
}

export function coincideTracking(tracking: string, busqueda: string): boolean {
  const buscado = busqueda.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (!buscado) return true;
  return tracking.replace(/[^A-Za-z0-9]/g, '').toLowerCase().includes(buscado);
}
