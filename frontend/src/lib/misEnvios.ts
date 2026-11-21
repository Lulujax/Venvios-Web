import { nombreEnvio, numeroConsolidacion } from './formato';
import type { Envio, EstadoEnvio, HitoVista, PaqueteVista } from './tipos';

export type Pestana = 'PREALERTAS' | 'ACTIVOS' | 'ENTREGADOS';

export const PESTANAS: Array<{ valor: Pestana; texto: string }> = [
  { valor: 'PREALERTAS', texto: 'Pre-alertas' },
  { valor: 'ACTIVOS', texto: 'Activos' },
  { valor: 'ENTREGADOS', texto: 'Entregados' },
];

const ESTADOS_ALERTA_ACTIVOS: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];
const ESTADOS_FUERA: EstadoEnvio[] = ['CERRADO', 'CANCELADO', 'ARCHIVADO'];

export interface FilaEnvio {
  clave: string;
  guia: string;
  busqueda: string;
  estado: string;
  fecha: string;
  valorCentavos: number;
  totalCentavos: number | null;
  paqueteId: string | null;
  eliminable: boolean;
}

export function esPestana(valor: string | null): valor is Pestana {
  return valor === 'PREALERTAS' || valor === 'ACTIVOS' || valor === 'ENTREGADOS';
}

function filaDePaquete(envio: Envio, paquete: PaqueteVista): FilaEnvio {
  return {
    clave: `${envio.id}-${paquete.id}`,
    guia: paquete.tracking,
    busqueda: paquete.tracking,
    estado: paquete.recibido ? 'En oficina' : 'Prealertado',
    fecha: paquete.recibidoEn ?? envio.creadoEn,
    valorCentavos: paquete.valorDeclaradoCentavos,
    totalCentavos: null,
    paqueteId: paquete.id,
    eliminable: !paquete.recibido,
  };
}

function filaDeConsolidacion(envio: Envio): FilaEnvio {
  return {
    clave: envio.id,
    guia: nombreEnvio(envio),
    busqueda: numeroConsolidacion(envio.numero),
    estado: envio.etiquetaEstado,
    fecha: envio.creadoEn,
    valorCentavos: envio.valorDeclaradoCentavos,
    totalCentavos: envio.precio?.totalCentavos ?? null,
    paqueteId: null,
    eliminable: false,
  };
}

export function filasDePestana(envios: Envio[], pestana: Pestana): FilaEnvio[] {
  const filas: FilaEnvio[] = [];
  for (const envio of envios) {
    if (pestana === 'PREALERTAS') {
      if (envio.tipo !== 'ALERTA' || !ESTADOS_ALERTA_ACTIVOS.includes(envio.estado)) continue;
      for (const paquete of envio.paquetes) filas.push(filaDePaquete(envio, paquete));
      continue;
    }
    if (envio.tipo !== 'CONSOLIDADO') continue;
    if (pestana === 'ACTIVOS' && !ESTADOS_FUERA.includes(envio.estado)) filas.push(filaDeConsolidacion(envio));
    if (pestana === 'ENTREGADOS' && envio.estado === 'CERRADO') filas.push(filaDeConsolidacion(envio));
  }
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function normalizar(texto: string): string {
  return texto.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export interface ResultadoRastreo {
  envio: Envio;
  paquete: PaqueteVista | null;
}

export function rastrear(envios: Envio[], consulta: string): ResultadoRastreo | null {
  const buscado = normalizar(consulta.replace(/consolidaci[oó]n/gi, ''));
  if (!buscado) return null;
  const visibles = envios.filter((envio) => envio.estado !== 'CANCELADO');
  if (/^\d+$/.test(buscado)) {
    const numero = Number(buscado);
    const consolidado = visibles.find((envio) => envio.tipo === 'CONSOLIDADO' && envio.numero === numero);
    if (consolidado) return { envio: consolidado, paquete: null };
  }
  const exactos = visibles.flatMap((envio) => envio.paquetes.filter((p) => normalizar(p.tracking) === buscado).map((paquete) => ({ envio, paquete })));
  const enCurso = exactos.find((r) => r.envio.estado !== 'ARCHIVADO') ?? exactos[0];
  return enCurso ?? null;
}

export const DESCRIPCION_PASO: Record<string, string> = {
  PREALERTADO: 'Registraste la alerta de tu paquete.',
  EN_OFICINA: 'Recibimos tu paquete en nuestra oficina de Cúcuta.',
  CONSOLIDANDO: 'Tu paquete está en una consolidación que estamos preparando.',
  POR_PAGAR: 'Pesamos tu envío y ya tiene su total. Puedes pagarlo en Finanzas.',
  PAGO_EN_REVISION: 'Recibimos tu comprobante y lo estamos verificando.',
  ENVIANDO: 'Pago confirmado. Preparamos la salida a Venezuela.',
  EN_RUTA: 'Tu envío va en camino con la transportista.',
  ENTREGADO: 'Tu envío fue entregado.',
};

export function historialDe(resultado: ResultadoRastreo): HitoVista[] {
  if (resultado.paquete) return [...resultado.paquete.seguimiento].reverse();
  const masLargo = resultado.envio.paquetes.reduce<HitoVista[]>((mejor, p) => (p.seguimiento.length > mejor.length ? p.seguimiento : mejor), []);
  return [...masLargo].reverse();
}
