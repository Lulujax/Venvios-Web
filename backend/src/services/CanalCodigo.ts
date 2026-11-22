import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CanalCodigo {
  enviarCodigo(email: string): Promise<void>;
  verificarCodigo(email: string, codigo: string): Promise<boolean>;
}

export const CODIGO_DESARROLLO = '123456';
const ESPERA_MAXIMA_MS = 10_000;
const ESTADOS_CODIGO_RECHAZADO = [400, 401, 403, 422];

export class CanalCodigoMemoria implements CanalCodigo {
  private readonly pendientes = new Set<string>();

  async enviarCodigo(email: string): Promise<void> {
    if (!email) throw new Error('Falta el correo.');
    this.pendientes.add(email);
    logger.warn(`Sin Supabase: el código de recuperación en desarrollo es ${CODIGO_DESARROLLO}`);
  }

  async verificarCodigo(email: string, codigo: string): Promise<boolean> {
    const valido = this.pendientes.has(email) && codigo === CODIGO_DESARROLLO;
    if (valido) this.pendientes.delete(email);
    return valido;
  }
}

type Peticion = typeof fetch;

export class CanalCodigoSupabase implements CanalCodigo {
  private readonly base: string;

  constructor(
    urlSupabase: string,
    private readonly llaveServicio: string,
    private readonly peticion: Peticion = (...argumentos) => fetch(...argumentos),
  ) {
    if (!urlSupabase) throw new Error('Falta SUPABASE_URL para enviar códigos por correo.');
    this.base = `${urlSupabase.replace(/\/+$/, '')}/auth/v1`;
  }

  private async llamar(ruta: string, cuerpo: Record<string, unknown>): Promise<Response> {
    if (!this.llaveServicio) throw new Error('Falta SUPABASE_SERVICE_KEY para enviar códigos por correo.');
    return this.peticion(`${this.base}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.llaveServicio, Authorization: `Bearer ${this.llaveServicio}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
  }

  private async leerJson(respuesta: Response): Promise<Record<string, unknown>> {
    try {
      return (await respuesta.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async asegurarCuentaEnSupabase(email: string): Promise<void> {
    const respuesta = await this.llamar('/admin/users', { email, email_confirm: true });
    if (respuesta.ok) {
      logger.info('Cuenta de correo creada en Supabase Auth');
      return;
    }
    const cuerpo = await this.leerJson(respuesta);
    const yaExiste = respuesta.status === 422 && (cuerpo.error_code === 'email_exists' || /already|registered/i.test(String(cuerpo.msg ?? cuerpo.message ?? '')));
    if (!yaExiste) {
      logger.error('Supabase Auth no pudo registrar el correo', { estado: respuesta.status, codigo: String(cuerpo.error_code ?? 'desconocido') });
      throw new Error('Supabase Auth rechazó crear la cuenta del correo.');
    }
  }

  async enviarCodigo(email: string): Promise<void> {
    await this.asegurarCuentaEnSupabase(email);
    const respuesta = await this.llamar('/recover', { email });
    if (!respuesta.ok) {
      const cuerpo = await this.leerJson(respuesta);
      logger.error('Supabase Auth no pudo enviar el código', { estado: respuesta.status, codigo: String(cuerpo.error_code ?? 'desconocido') });
      throw new Error('Supabase Auth no pudo enviar el código.');
    }
    logger.info('Código de recuperación enviado por Supabase Auth');
  }

  async verificarCodigo(email: string, codigo: string): Promise<boolean> {
    const respuesta = await this.llamar('/verify', { type: 'recovery', email, token: codigo });
    if (respuesta.ok) return true;
    if (ESTADOS_CODIGO_RECHAZADO.includes(respuesta.status)) {
      logger.info('Supabase Auth rechazó el código', { estado: respuesta.status });
      return false;
    }
    logger.error('Supabase Auth falló al verificar el código', { estado: respuesta.status });
    throw AppError.tooMany('No pudimos verificar el código ahora. Espera un minuto e intenta de nuevo.');
  }
}
