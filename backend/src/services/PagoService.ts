import { dolaresABolivaresCentavos } from '../domain/dinero';
import { validarTransicion } from '../domain/estados';
import { limpiarTexto } from '../domain/validaciones';
import type { Envio, MetodoPago, MonedaPago, Pago, Repositorios } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { rutaArchivo, validarImagen, type Almacenamiento, type ArchivoEntrada } from './Almacenamiento';
import type { ConfigService } from './ConfigService';
import { esPersonal, type Actor, type EnvioService, type EnvioVista } from './EnvioService';
import type { TasaService } from './TasaService';

export interface NuevoPago {
  metodo: MetodoPago;
  moneda: MonedaPago;
  monto: number;
  referencia?: string;
  archivo?: ArchivoEntrada;
}

const TOLERANCIA_CENTAVOS = 5;
const METODOS: MetodoPago[] = ['BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'MANUAL'];

export class PagoService {
  constructor(
    private readonly repos: Repositorios,
    private readonly tasas: TasaService,
    private readonly config: ConfigService,
    private readonly almacenamiento: Almacenamiento,
    private readonly envios: EnvioService,
  ) {}

  async informacionParaPagar(actor: Actor, envioId: string) {
    const envio = await this.envios.obtenerEnvio(actor, envioId);
    if (envio.totalCentavos === null) throw AppError.badRequest('Aún no se calcula el total de este envío.', 'SIN_TOTAL');
    const tasa = await this.tasas.vigente();
    const pagos = await this.repos.pagos.deEnvio(envioId);
    const pagado = pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((s, p) => s + p.montoUsdCentavos, 0);
    const saldo = Math.max(envio.totalCentavos - pagado, 0);
    return {
      totalCentavos: envio.totalCentavos,
      pagadoCentavos: pagado,
      saldoCentavos: saldo,
      saldoBsCentavos: dolaresABolivaresCentavos(saldo, tasa.bolivaresPorUsd),
      tasa: { bolivaresPorUsd: tasa.bolivaresPorUsd, fecha: tasa.fecha, desactualizada: tasa.desactualizada },
      datosPago: await this.config.datosPago(),
      modalidad: envio.modalidad,
      transportista: envio.transportista,
    };
  }

  private async convertirAUsd(moneda: MonedaPago, monto: number): Promise<{ usd: number; original: number; tasa: number | null }> {
    if (!Number.isFinite(monto) || monto <= 0) throw AppError.badRequest('El monto debe ser mayor que cero.');
    const original = Math.round(monto * 100);
    if (moneda === 'USD') return { usd: original, original, tasa: null };
    const tasa = await this.tasas.vigente();
    return { usd: Math.round(original / tasa.bolivaresPorUsd), original, tasa: tasa.bolivaresPorUsd };
  }

  private validarEnvioCobrable(envio: Envio): void {
    if (envio.totalCentavos === null) throw AppError.badRequest('Aún no se calcula el total de este envío.', 'SIN_TOTAL');
    if (!['RECIBIDO_COMPLETO', 'POR_CONFIRMAR'].includes(envio.estado)) {
      throw AppError.badRequest('Este envío todavía no está listo para pagar o ya fue pagado.', 'ENVIO_NO_COBRABLE');
    }
  }

  async subirComprobante(actor: Actor, envioId: string, datos: NuevoPago): Promise<EnvioVista> {
    const envio = await this.envios.obtenerEnvio(actor, envioId);
    this.validarEnvioCobrable(envio);
    if (!METODOS.includes(datos.metodo) || datos.metodo === 'MANUAL') throw AppError.badRequest('Elige cómo pagaste.');
    const referencia = limpiarTexto(datos.referencia, 40);
    if (referencia.length < 4) throw AppError.badRequest('Escribe el número de referencia del pago.');
    const comprobante = validarImagen(datos.archivo);
    const { usd, original, tasa } = await this.convertirAUsd(datos.moneda, datos.monto);

    const ruta = rutaArchivo('comprobantes', envioId, comprobante.mime);
    await this.almacenamiento.subir(ruta, comprobante);
    await this.repos.pagos.crear({
      envioId,
      montoUsdCentavos: usd,
      moneda: datos.moneda,
      montoOriginalCentavos: original,
      metodo: datos.metodo,
      referencia,
      comprobantePath: ruta,
      estado: 'POR_CONFIRMAR',
      motivoRechazo: null,
      tasaBcv: tasa,
      registradoPorId: actor.id,
      confirmadoPorId: null,
    });
    if (envio.estado === 'RECIBIDO_COMPLETO') {
      validarTransicion(envio.estado, 'POR_CONFIRMAR');
      await this.repos.envios.actualizar(envioId, { estado: 'POR_CONFIRMAR' });
    }
    await this.repos.envios.agregarEvento({ envioId, actorId: actor.id, tipo: 'PAGO_SUBIDO', detalle: `Comprobante subido (${datos.metodo})`, datos: null });
    logger.info('Comprobante subido', { envio: envioId, metodo: datos.metodo });
    return this.envios.detalle(actor, envioId);
  }

  async registrarManual(actor: Actor, envioId: string, datos: Omit<NuevoPago, 'archivo'>): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const envio = await this.envios.obtenerEnvio(actor, envioId);
    this.validarEnvioCobrable(envio);
    if (!METODOS.includes(datos.metodo)) throw AppError.badRequest('Método de pago inválido.');
    const { usd, original, tasa } = await this.convertirAUsd(datos.moneda, datos.monto);
    const pago = await this.repos.pagos.crear({
      envioId,
      montoUsdCentavos: usd,
      moneda: datos.moneda,
      montoOriginalCentavos: original,
      metodo: datos.metodo,
      referencia: limpiarTexto(datos.referencia, 40) || null,
      comprobantePath: null,
      estado: 'POR_CONFIRMAR',
      motivoRechazo: null,
      tasaBcv: tasa,
      registradoPorId: actor.id,
      confirmadoPorId: null,
    });
    if (envio.estado === 'RECIBIDO_COMPLETO') {
      await this.repos.envios.actualizar(envioId, { estado: 'POR_CONFIRMAR' });
    }
    return this.confirmar(actor, pago.id);
  }

  async pendientes(actor: Actor): Promise<Array<{ pago: Pago; envioId: string }>> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const pagos = await this.repos.pagos.porEstado('POR_CONFIRMAR');
    return pagos.map((pago) => ({ pago, envioId: pago.envioId }));
  }

  async confirmar(actor: Actor, pagoId: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const pago = await this.repos.pagos.porId(pagoId);
    if (!pago) throw AppError.notFound('El pago no existe.');
    if (pago.estado !== 'POR_CONFIRMAR') throw AppError.badRequest('Ese pago ya fue revisado.');
    await this.repos.pagos.actualizar(pagoId, { estado: 'CONFIRMADO', confirmadoPorId: actor.id });

    const envio = await this.envios.obtenerEnvio(actor, pago.envioId);
    const pagos = await this.repos.pagos.deEnvio(envio.id);
    const confirmado = pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((s, p) => s + p.montoUsdCentavos, 0);
    const total = envio.totalCentavos ?? 0;
    const cubierto = confirmado + TOLERANCIA_CENTAVOS >= total;

    if (cubierto && envio.estado !== 'PAGADO') {
      validarTransicion(envio.estado, 'PAGADO');
      await this.repos.envios.actualizar(envio.id, { estado: 'PAGADO' });
      await this.repos.envios.agregarEvento({ envioId: envio.id, actorId: actor.id, tipo: 'PAGO_CONFIRMADO', detalle: 'Pago completo confirmado', datos: null });
    } else if (!cubierto) {
      const quedanPendientes = pagos.some((p) => p.estado === 'POR_CONFIRMAR' && p.id !== pagoId);
      if (envio.estado === 'POR_CONFIRMAR' && !quedanPendientes) {
        await this.repos.envios.actualizar(envio.id, { estado: 'RECIBIDO_COMPLETO' });
      }
      await this.repos.envios.agregarEvento({
        envioId: envio.id,
        actorId: actor.id,
        tipo: 'PAGO_PARCIAL',
        detalle: 'Pago parcial confirmado',
        datos: { faltanCentavos: total - confirmado },
      });
    }
    logger.info('Pago confirmado', { envio: envio.id, cubierto });
    return this.envios.detalle(actor, envio.id);
  }

  async rechazar(actor: Actor, pagoId: string, motivo: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const limpio = limpiarTexto(motivo, 200);
    if (limpio.length < 3) throw AppError.badRequest('Escribe el motivo del rechazo.');
    const pago = await this.repos.pagos.porId(pagoId);
    if (!pago) throw AppError.notFound('El pago no existe.');
    if (pago.estado !== 'POR_CONFIRMAR') throw AppError.badRequest('Ese pago ya fue revisado.');
    await this.repos.pagos.actualizar(pagoId, { estado: 'RECHAZADO', motivoRechazo: limpio, confirmadoPorId: actor.id });

    const envio = await this.envios.obtenerEnvio(actor, pago.envioId);
    const pagos = await this.repos.pagos.deEnvio(envio.id);
    const quedanPendientes = pagos.some((p) => p.estado === 'POR_CONFIRMAR');
    if (envio.estado === 'POR_CONFIRMAR' && !quedanPendientes) {
      await this.repos.envios.actualizar(envio.id, { estado: 'RECIBIDO_COMPLETO' });
    }
    await this.repos.envios.agregarEvento({ envioId: envio.id, actorId: actor.id, tipo: 'PAGO_RECHAZADO', detalle: limpio, datos: null });
    logger.info('Pago rechazado', { envio: envio.id });
    return this.envios.detalle(actor, envio.id);
  }
}
