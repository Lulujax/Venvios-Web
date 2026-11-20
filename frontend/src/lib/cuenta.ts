import type { EstadoEnvio, Envio } from './tipos';

const ESTADOS_PENDIENTES_PAGO: EstadoEnvio[] = ['RECIBIDO_COMPLETO', 'POR_CONFIRMAR'];
const ESTADOS_PAGADOS: EstadoEnvio[] = ['PAGADO', 'DESPACHADO', 'CERRADO'];

export type FiltroPedidos = 'TODOS' | 'PENDIENTES' | 'PAGADOS';
export type EstadoAlerta = 'PENDIENTE' | 'ATENDIDA';

export interface FilaAlerta {
  clave: string;
  envioId: string;
  fecha: string;
  tienda: string;
  tracking: string;
  estado: EstadoAlerta;
}

export function esPendienteDePago(envio: Envio): boolean {
  return ESTADOS_PENDIENTES_PAGO.includes(envio.estado);
}

export function esPagado(envio: Envio): boolean {
  return ESTADOS_PAGADOS.includes(envio.estado);
}

export function esCobrable(envio: Envio): boolean {
  return esPendienteDePago(envio) && envio.precio !== null;
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
    if (envio.estado === 'CANCELADO') continue;
    for (const paquete of envio.paquetes) {
      filas.push({
        clave: `${envio.id}-${paquete.id}`,
        envioId: envio.id,
        fecha: envio.creadoEn,
        tienda: envio.tienda,
        tracking: paquete.tracking,
        estado: paquete.recibido ? 'ATENDIDA' : 'PENDIENTE',
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

export interface ResumenCuenta {
  alertasPendientes: number;
  alertasAtendidas: number;
  porPagar: number;
  saldoPorPagarCentavos: number;
  pagados: number;
}

export function resumirCuenta(envios: Envio[]): ResumenCuenta {
  const alertas = construirAlertas(envios);
  const cobrables = envios.filter(esCobrable);
  return {
    alertasPendientes: alertas.filter((a) => a.estado === 'PENDIENTE').length,
    alertasAtendidas: alertas.filter((a) => a.estado === 'ATENDIDA').length,
    porPagar: cobrables.length,
    saldoPorPagarCentavos: cobrables.reduce((suma, envio) => suma + saldoPendienteCentavos(envio), 0),
    pagados: envios.filter(esPagado).length,
  };
}
