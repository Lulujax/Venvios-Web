import type { ConfigRepository, TasaGuardada } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export type ConsultaTasa = () => Promise<number>;

export interface TasaVigente extends TasaGuardada {
  desactualizada: boolean;
}

export const URL_TASA_BCV = 'https://ve.dolarapi.com/v1/dolares/oficial';
export const VIGENCIA_CACHE_MS = 5 * 60 * 1000;
export const ESPERA_TRAS_FALLO_MS = 10 * 60 * 1000;
const VIGENCIA_TRAS_FALLO_MS = 60 * 1000;

export async function consultarTasaDolarApi(): Promise<number> {
  const respuesta = await fetch(URL_TASA_BCV, { signal: AbortSignal.timeout(8000) });
  if (!respuesta.ok) throw new Error(`DolarApi respondió ${respuesta.status}`);
  const cuerpo = (await respuesta.json()) as { promedio?: unknown };
  const promedio = Number(cuerpo.promedio);
  if (!Number.isFinite(promedio) || promedio <= 0) throw new Error('DolarApi devolvió una tasa inválida');
  return promedio;
}

export function fechaCaracas(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(ahora);
}

interface EntradaCache {
  fecha: string;
  tasa: TasaVigente;
  expiraMs: number;
}

export class TasaService {
  private cache: EntradaCache | null = null;
  private enCurso: Promise<TasaVigente> | null = null;
  private ultimoFalloApiMs: number | null = null;

  constructor(
    private readonly repositorio: ConfigRepository,
    private readonly consultar: ConsultaTasa = consultarTasaDolarApi,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async vigente(): Promise<TasaVigente> {
    const ahora = this.reloj();
    const hoy = fechaCaracas(ahora);
    if (this.cache && this.cache.fecha === hoy && this.cache.expiraMs > ahora.getTime()) return { ...this.cache.tasa };
    if (!this.enCurso) {
      this.enCurso = this.resolver(hoy).finally(() => {
        this.enCurso = null;
      });
    }
    return { ...(await this.enCurso) };
  }

  private recordar(fecha: string, tasa: TasaVigente, vigenciaMs: number): TasaVigente {
    this.cache = { fecha, tasa, expiraMs: this.reloj().getTime() + vigenciaMs };
    return tasa;
  }

  private async ultimaGuardada(hoy: string): Promise<TasaVigente> {
    const ultima = await this.repositorio.ultimaTasa();
    if (!ultima) throw AppError.badRequest('No hay tasa BCV disponible. Pide al administrador que la cargue.', 'SIN_TASA');
    return this.recordar(hoy, { ...ultima, desactualizada: true }, VIGENCIA_TRAS_FALLO_MS);
  }

  private async resolver(hoy: string): Promise<TasaVigente> {
    const deHoy = await this.repositorio.tasaDeFecha(hoy);
    if (deHoy) return this.recordar(hoy, { ...deHoy, desactualizada: false }, VIGENCIA_CACHE_MS);

    const ahoraMs = this.reloj().getTime();
    if (this.ultimoFalloApiMs !== null && ahoraMs - this.ultimoFalloApiMs < ESPERA_TRAS_FALLO_MS) {
      logger.debug('La API de la tasa falló hace poco; se usa la última guardada sin reintentar');
      return this.ultimaGuardada(hoy);
    }

    try {
      const promedio = await this.consultar();
      const tasa: TasaGuardada = { fecha: hoy, bolivaresPorUsd: promedio, fuente: 'API' };
      await this.repositorio.guardarTasa(tasa);
      this.ultimoFalloApiMs = null;
      logger.info('Tasa BCV actualizada desde la API', { fecha: hoy });
      return this.recordar(hoy, { ...tasa, desactualizada: false }, VIGENCIA_CACHE_MS);
    } catch (error) {
      this.ultimoFalloApiMs = ahoraMs;
      logger.warn('No se pudo consultar la tasa BCV; se usa la última guardada', { motivo: error instanceof Error ? error.message : 'desconocido' });
      return this.ultimaGuardada(hoy);
    }
  }

  async cargarManual(bolivaresPorUsd: number, actorId: string): Promise<TasaVigente> {
    if (!Number.isFinite(bolivaresPorUsd) || bolivaresPorUsd <= 0) {
      throw AppError.badRequest('La tasa debe ser mayor que cero.');
    }
    const fecha = fechaCaracas(this.reloj());
    const tasa: TasaGuardada = { fecha, bolivaresPorUsd: Math.round(bolivaresPorUsd * 10000) / 10000, fuente: 'MANUAL' };
    await this.repositorio.guardarTasa(tasa);
    this.cache = null;
    logger.info('Tasa BCV cargada a mano', { fecha, actor: actorId });
    return { ...tasa, desactualizada: false };
  }
}
