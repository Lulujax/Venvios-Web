import { AppError } from '../utils/errors';

export type Modalidad = 'M1' | 'M2';

export interface TramoPrecio {
  desdeKg: number;
  precioPorKgCentavos: number;
}

export interface ConfiguracionTarifas {
  m1Tramos: TramoPrecio[];
  m1SeguroPorcentaje: number;
  m1PesoMinimoKg: number;
  m2PrecioPorKgCentavos: number;
  m2SeguroPorcentaje: number;
  m2PesoMinimoKg: number;
}

export interface PrecioCalculado {
  modalidad: Modalidad;
  pesoRealCentesimas: number;
  pesoCobrableCentesimas: number;
  precioPorKgCentavos: number;
  fleteCentavos: number;
  seguroCentavos: number;
  totalCentavos: number;
}

export const TARIFAS_INICIALES: ConfiguracionTarifas = {
  m1Tramos: [
    { desdeKg: 1, precioPorKgCentavos: 950 },
    { desdeKg: 10, precioPorKgCentavos: 850 },
    { desdeKg: 20, precioPorKgCentavos: 750 },
    { desdeKg: 50, precioPorKgCentavos: 650 },
  ],
  m1SeguroPorcentaje: 5,
  m1PesoMinimoKg: 2,
  m2PrecioPorKgCentavos: 600,
  m2SeguroPorcentaje: 3,
  m2PesoMinimoKg: 1,
};

export const UMBRAL_MODALIDAD_2_KG = 2;

export function kilosACentesimas(kilos: number): number {
  if (!Number.isFinite(kilos) || kilos <= 0) {
    throw AppError.badRequest('El peso debe ser mayor que cero.');
  }
  const centesimas = Math.round(kilos * 100);
  if (centesimas <= 0) throw AppError.badRequest('El peso es demasiado pequeño.');
  return centesimas;
}

export function sumarPesosCentesimas(pesosKg: number[]): number {
  if (pesosKg.length === 0) throw AppError.badRequest('No hay paquetes pesados para sumar.');
  return pesosKg.reduce((acumulado, kilos) => acumulado + kilosACentesimas(kilos), 0);
}

export function modalidadPropuesta(pesoTotalCentesimas: number): Modalidad {
  if (!Number.isInteger(pesoTotalCentesimas) || pesoTotalCentesimas <= 0) {
    throw AppError.badRequest('El peso total debe ser mayor que cero.');
  }
  return pesoTotalCentesimas < UMBRAL_MODALIDAD_2_KG * 100 ? 'M2' : 'M1';
}

function validarConfiguracion(config: ConfiguracionTarifas): void {
  if (config.m1Tramos.length === 0) throw AppError.badRequest('Faltan los tramos de la modalidad 1.');
  const ordenados = config.m1Tramos.every((t, i, lista) => i === 0 || lista[i - 1]!.desdeKg < t.desdeKg);
  if (!ordenados) throw AppError.badRequest('Los tramos deben estar ordenados de menor a mayor.');
  if (config.m1SeguroPorcentaje < 0 || config.m2SeguroPorcentaje < 0) {
    throw AppError.badRequest('El porcentaje de seguro no puede ser negativo.');
  }
  if (config.m2PrecioPorKgCentavos <= 0 || config.m1Tramos.some((t) => t.precioPorKgCentavos <= 0)) {
    throw AppError.badRequest('Los precios por kilo deben ser mayores que cero.');
  }
}

function tarifaDelTramo(config: ConfiguracionTarifas, pesoCobrableCentesimas: number): number {
  let elegido = config.m1Tramos[0]!;
  for (const tramo of config.m1Tramos) {
    if (pesoCobrableCentesimas >= tramo.desdeKg * 100) elegido = tramo;
  }
  return elegido.precioPorKgCentavos;
}

export function calcularPrecio(
  modalidad: Modalidad,
  pesoTotalCentesimas: number,
  valorDeclaradoCentavos: number,
  config: ConfiguracionTarifas,
): PrecioCalculado {
  if (!Number.isInteger(pesoTotalCentesimas) || pesoTotalCentesimas <= 0) {
    throw AppError.badRequest('El peso total debe ser mayor que cero.');
  }
  if (!Number.isInteger(valorDeclaradoCentavos) || valorDeclaradoCentavos < 0) {
    throw AppError.badRequest('El valor declarado no puede ser negativo.');
  }
  validarConfiguracion(config);

  const esM1 = modalidad === 'M1';
  const minimoCentesimas = (esM1 ? config.m1PesoMinimoKg : config.m2PesoMinimoKg) * 100;
  const pesoCobrable = Math.max(pesoTotalCentesimas, minimoCentesimas);
  const precioPorKg = esM1 ? tarifaDelTramo(config, pesoCobrable) : config.m2PrecioPorKgCentavos;
  const porcentaje = esM1 ? config.m1SeguroPorcentaje : config.m2SeguroPorcentaje;

  const flete = Math.round((pesoCobrable * precioPorKg) / 100);
  const seguro = Math.round((valorDeclaradoCentavos * porcentaje) / 100);
  const total = flete + seguro;

  if (total < flete || total < 0) throw new Error('Postcondición rota: el total no cuadra.');

  return {
    modalidad,
    pesoRealCentesimas: pesoTotalCentesimas,
    pesoCobrableCentesimas: pesoCobrable,
    precioPorKgCentavos: precioPorKg,
    fleteCentavos: flete,
    seguroCentavos: seguro,
    totalCentavos: total,
  };
}
