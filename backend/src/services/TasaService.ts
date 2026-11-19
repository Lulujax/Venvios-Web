import type { ConfigRepository, TasaGuardada } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export type ConsultaTasa = () => Promise<number>;

export interface TasaVigente extends TasaGuardada {
  desactualizada: boolean;
}

export const URL_TASA_BCV = 'https://ve.dolarapi.com/v1/dolares/oficial';

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

export class TasaService {
  constructor(
    private readonly repositorio: ConfigRepository,
    private readonly consultar: ConsultaTasa = consultarTasaDolarApi,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async vigente(): Promise<TasaVigente> {
    const hoy = fechaCaracas(this.reloj());
    const deHoy = await this.repositorio.tasaDeFecha(hoy);
    if (deHoy) return { ...deHoy, desactualizada: false };

    try {
      const promedio = await this.consultar();
      const tasa: TasaGuardada = { fecha: hoy, bolivaresPorUsd: promedio, fuente: 'API' };
      await this.repositorio.guardarTasa(tasa);
      logger.info('Tasa BCV actualizada desde la API', { fecha: hoy });
      return { ...tasa, desactualizada: false };
    } catch (error) {
      logger.warn('No se pudo consultar la tasa BCV', { motivo: error instanceof Error ? error.message : 'desconocido' });
      const ultima = await this.repositorio.ultimaTasa();
      if (!ultima) throw AppError.badRequest('No hay tasa BCV disponible. Pide al administrador que la cargue.', 'SIN_TASA');
      return { ...ultima, desactualizada: true };
    }
  }

  async cargarManual(bolivaresPorUsd: number, actorId: string): Promise<TasaVigente> {
    if (!Number.isFinite(bolivaresPorUsd) || bolivaresPorUsd <= 0) {
      throw AppError.badRequest('La tasa debe ser mayor que cero.');
    }
    const fecha = fechaCaracas(this.reloj());
    const tasa: TasaGuardada = { fecha, bolivaresPorUsd: Math.round(bolivaresPorUsd * 10000) / 10000, fuente: 'MANUAL' };
    await this.repositorio.guardarTasa(tasa);
    logger.info('Tasa BCV cargada a mano', { fecha, actor: actorId });
    return { ...tasa, desactualizada: false };
  }
}
