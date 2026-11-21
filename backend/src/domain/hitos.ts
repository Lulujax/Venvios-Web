import type { EstadoEnvio } from './estados';

export const TIPOS_HITO = ['PREALERTADO', 'EN_OFICINA', 'CONSOLIDANDO', 'POR_PAGAR', 'PAGO_EN_REVISION', 'ENVIANDO', 'EN_RUTA', 'ENTREGADO'] as const;

export type TipoHito = (typeof TIPOS_HITO)[number];

export const ETIQUETAS_HITO: Record<TipoHito, string> = {
  PREALERTADO: 'Prealertado',
  EN_OFICINA: 'En oficina',
  CONSOLIDANDO: 'Consolidando',
  POR_PAGAR: 'Por pagar',
  PAGO_EN_REVISION: 'Pago en revisión',
  ENVIANDO: 'Enviando a Venezuela',
  EN_RUTA: 'En ruta',
  ENTREGADO: 'Entregado',
};

const HITO_POR_ESTADO_CONSOLIDADO: Partial<Record<EstadoEnvio, TipoHito>> = {
  POR_CONSOLIDAR: 'CONSOLIDANDO',
  POR_PAGAR: 'POR_PAGAR',
  POR_CONFIRMAR: 'PAGO_EN_REVISION',
  PAGADO: 'ENVIANDO',
  DESPACHADO: 'EN_RUTA',
  CERRADO: 'ENTREGADO',
};

export function hitoDeEstadoConsolidado(estado: EstadoEnvio): TipoHito | null {
  return HITO_POR_ESTADO_CONSOLIDADO[estado] ?? null;
}

export function esTipoHito(valor: string): valor is TipoHito {
  return (TIPOS_HITO as readonly string[]).includes(valor);
}

export function recorridoVisible<T extends { tipo: TipoHito; creadoEn: Date }>(hitos: T[]): T[] {
  const ordenados = [...hitos].sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
  let ultimaOficina = -1;
  ordenados.forEach((hito, indice) => {
    if (hito.tipo === 'EN_OFICINA') ultimaOficina = indice;
  });
  if (ultimaOficina <= 0) return ordenados;
  const prealerta = ordenados.slice(0, ultimaOficina).find((hito) => hito.tipo === 'PREALERTADO');
  const desdeOficina = ordenados.slice(ultimaOficina);
  return prealerta ? [prealerta, ...desdeOficina] : desdeOficina;
}
