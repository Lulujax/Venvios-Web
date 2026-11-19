import { z } from 'zod';
import type { ConfiguracionTarifas } from '../domain/tarifas';
import type { ConfigRepository } from '../repositories/tipos';
import {
  CLAVES_CONFIG,
  VALORES_INICIALES,
  type ClaveConfig,
  type Contacto,
  type DatosPago,
  type Plantillas,
  type TransportistaConfig,
} from '../config/predeterminados';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const esquemaTarifas = z.object({
  m1Tramos: z
    .array(z.object({ desdeKg: z.number().nonnegative(), precioPorKgCentavos: z.number().int().positive() }))
    .min(1),
  m1SeguroPorcentaje: z.number().min(0).max(100),
  m1PesoMinimoKg: z.number().positive(),
  m2PrecioPorKgCentavos: z.number().int().positive(),
  m2SeguroPorcentaje: z.number().min(0).max(100),
  m2PesoMinimoKg: z.number().positive(),
});

const esquemaDatosPago = z.object({
  esPrueba: z.boolean(),
  pagoMovil: z.object({ banco: z.string().min(1), cedula: z.string().min(1), telefono: z.string().min(1) }),
  cuenta: z.object({
    banco: z.string().min(1),
    numero: z.string().min(1),
    titular: z.string().min(1),
    cedula: z.string().min(1),
  }),
  binance: z.object({ usuario: z.string(), correo: z.string(), nota: z.string() }),
  notaVerificacion: z.string(),
});

const esquemaPlantillas = z.object({
  llegada: z.string().min(10),
  pagoVerificado: z.string().min(10),
  pagoRechazado: z.string().min(10),
  despacho: z.string().min(10),
});

const esquemaTransportistas = z
  .array(
    z.object({
      codigo: z.enum(['MRW', 'ZOOM']),
      nombre: z.string().min(1),
      urlRastreo: z.string().url(),
      parametroGuia: z.string().nullable(),
    }),
  )
  .min(1);

const esquemaContacto = z.object({
  whatsapp: z.string().regex(/^\d{10,15}$/),
  direccion: z.string().min(3),
  instagram: z.string().url(),
  facebook: z.string().url(),
  tiktok: z.string().url(),
});

const ESQUEMAS: Record<ClaveConfig, z.ZodTypeAny> = {
  tarifas: esquemaTarifas,
  datosPago: esquemaDatosPago,
  plantillas: esquemaPlantillas,
  transportistas: esquemaTransportistas,
  contacto: esquemaContacto,
};

export class ConfigService {
  constructor(private readonly repositorio: ConfigRepository) {}

  esClaveValida(clave: string): clave is ClaveConfig {
    return (CLAVES_CONFIG as readonly string[]).includes(clave);
  }

  async obtener<T>(clave: ClaveConfig): Promise<T> {
    const guardado = await this.repositorio.obtener<T>(clave);
    return guardado ?? (structuredClone(VALORES_INICIALES[clave]) as T);
  }

  tarifas(): Promise<ConfiguracionTarifas> {
    return this.obtener<ConfiguracionTarifas>('tarifas');
  }

  datosPago(): Promise<DatosPago> {
    return this.obtener<DatosPago>('datosPago');
  }

  plantillas(): Promise<Plantillas> {
    return this.obtener<Plantillas>('plantillas');
  }

  transportistas(): Promise<TransportistaConfig[]> {
    return this.obtener<TransportistaConfig[]>('transportistas');
  }

  contacto(): Promise<Contacto> {
    return this.obtener<Contacto>('contacto');
  }

  async guardar(clave: string, valor: unknown, actorId: string): Promise<void> {
    if (!this.esClaveValida(clave)) throw AppError.notFound('Esa configuración no existe.');
    const resultado = ESQUEMAS[clave].safeParse(valor);
    if (!resultado.success) {
      throw AppError.badRequest(`Configuración inválida: ${resultado.error.issues[0]?.message ?? 'revisa los datos'}.`);
    }
    if (clave === 'tarifas') this.validarOrdenTramos(resultado.data as ConfiguracionTarifas);
    await this.repositorio.guardar(clave, resultado.data);
    logger.info('Configuración actualizada', { clave, actor: actorId });
  }

  private validarOrdenTramos(tarifas: ConfiguracionTarifas): void {
    const ordenados = tarifas.m1Tramos.every((t, i, lista) => i === 0 || lista[i - 1]!.desdeKg < t.desdeKg);
    if (!ordenados) throw AppError.badRequest('Los tramos deben estar ordenados de menor a mayor.');
  }
}
