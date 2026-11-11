import type { Cotizacion } from '../entities';
import { TarifaRepository } from '../repositories/TarifaRepository';
import { AppError } from '../utils/errors';

const DIVISOR_VOLUMETRICO = 5000;

/**
 * Única fuente de verdad para precios. No existen tarifas aéreas ni marítimas:
 * se cobra por peso cobrable (real vs. volumétrico) sobre una sola tabla.
 */
export class QuoteService {
  constructor(private readonly tarifas: TarifaRepository) {}

  private redondear(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  async calcular(
    pesoKg: number,
    largoCm?: number | null,
    anchoCm?: number | null,
    altoCm?: number | null,
  ): Promise<Cotizacion> {
    if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
      throw AppError.badRequest('El peso debe ser mayor que cero.');
    }
    if (pesoKg > 500) {
      throw AppError.badRequest('El peso supera el máximo operativo. Contacta a la sede.');
    }

    const tieneDimensiones = Boolean(largoCm && anchoCm && altoCm);
    if (tieneDimensiones && [largoCm, anchoCm, altoCm].some((v) => !Number.isFinite(v) || (v as number) <= 0)) {
      throw AppError.badRequest('Las dimensiones deben ser mayores que cero.');
    }

    const pesoVolumetrico = tieneDimensiones
      ? this.redondear(((largoCm as number) * (anchoCm as number) * (altoCm as number)) / DIVISOR_VOLUMETRICO)
      : 0;
    const pesoCobrable = Math.max(this.redondear(pesoKg), pesoVolumetrico);

    return this.buscarPrecio(pesoCobrable, this.redondear(pesoKg), pesoVolumetrico);
  }

  private async buscarPrecio(
    pesoCobrable: number,
    pesoReal: number,
    pesoVolumetrico: number,
  ): Promise<Cotizacion> {
    const tarifas = await this.tarifas.listarActivas();
    if (tarifas.length === 0) {
      throw AppError.internal('No hay tarifas activas configuradas.');
    }

    const tramo = tarifas.find((t) => pesoCobrable <= t.pesoHasta);
    if (tramo) {
      return {
        pesoRealKg: pesoReal,
        pesoVolumetricoKg: pesoVolumetrico,
        pesoCobrableKg: pesoCobrable,
        precio: tramo.precio,
        tarifaAplicada: tramo.nombre,
        desglose: `Hasta ${tramo.pesoHasta} kg · peso cobrable ${pesoCobrable.toFixed(2)} kg`,
      };
    }

    // Por encima del último tramo se cobra el excedente por kilo.
    const ultimo = tarifas[tarifas.length - 1];
    if (!ultimo || ultimo.precioKgExcedente == null) {
      throw AppError.badRequest('El peso requiere cotización manual. Consulta por WhatsApp.');
    }
    const excedente = Math.max(0, pesoCobrable - ultimo.pesoHasta);
    const precio = Math.round(ultimo.precio + excedente * ultimo.precioKgExcedente);

    return {
      pesoRealKg: pesoReal,
      pesoVolumetricoKg: pesoVolumetrico,
      pesoCobrableKg: pesoCobrable,
      precio,
      tarifaAplicada: `${ultimo.nombre} + excedente`,
      desglose: `${ultimo.precioKgExcedente} COP por kg adicional sobre ${ultimo.pesoHasta} kg`,
    };
  }

  /** Alias público del cálculo de cotización. */
  async cotizar(
    pesoKg: number,
    largoCm?: number | null,
    anchoCm?: number | null,
    altoCm?: number | null,
  ): Promise<Cotizacion> {
    return this.calcular(pesoKg, largoCm, anchoCm, altoCm);
  }
}
