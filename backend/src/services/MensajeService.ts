import { formatearBs, formatearUsd } from '../domain/dinero';
import { construirEnlacesWhatsApp, renderizarPlantilla, type EnlacesWhatsApp } from '../domain/whatsapp';
import { AppError } from '../utils/errors';
import type { ConfigService } from './ConfigService';
import { esPersonal, type Actor, type EnvioService, type EnvioVista } from './EnvioService';

export type TipoMensaje = 'llegada' | 'cotizacion' | 'pagoVerificado' | 'pagoRechazado' | 'despacho';

export interface OpcionesMensaje {
  paqueteId?: string;
  motivo?: string;
}

export interface MensajeGenerado extends EnlacesWhatsApp {
  tipo: TipoMensaje;
  telefono: string;
  fotoPaqueteId: string | null;
  tieneFotoGuia: boolean;
}

export const TIPOS_MENSAJE: TipoMensaje[] = ['llegada', 'cotizacion', 'pagoVerificado', 'pagoRechazado', 'despacho'];

export class MensajeService {
  constructor(
    private readonly envios: EnvioService,
    private readonly config: ConfigService,
    private readonly urlApp: string,
  ) {}

  private lineaPeso(envio: EnvioVista): string {
    return envio.pesoTotalKg ? `Peso total del envío: ${envio.pesoTotalKg.toFixed(2)} kg.` : '';
  }

  private lineaTotal(envio: EnvioVista): string {
    if (!envio.precio) return '';
    const bs = envio.precio.totalBsCentavos !== null ? ` (aprox. ${formatearBs(envio.precio.totalBsCentavos)} a tasa BCV ${envio.tasa?.bolivaresPorUsd.toFixed(2)})` : '';
    return `Total a pagar: ${formatearUsd(envio.precio.totalCentavos)}${bs}.`;
  }

  private notaModalidad(envio: EnvioVista, nombreTransportista: string): string {
    return envio.modalidad === 'M2'
      ? `Recuerda: el envío dentro de Venezuela lo pagas tú directamente a ${nombreTransportista} cuando lo recibas (cobro a destino).`
      : '';
  }

  async generar(actor: Actor, envioId: string, tipo: TipoMensaje, opciones: OpcionesMensaje = {}): Promise<MensajeGenerado> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    if (!TIPOS_MENSAJE.includes(tipo)) throw AppError.badRequest('Tipo de mensaje desconocido.');
    const envio = await this.envios.detalle(actor, envioId);
    const plantillas = await this.config.plantillas();
    const transportistas = await this.config.transportistas();
    const transportista = transportistas.find((t) => t.codigo === envio.transportista);
    const paquete = opciones.paqueteId ? envio.paquetes.find((p) => p.id === opciones.paqueteId) : envio.paquetes[0];
    if (opciones.paqueteId && !paquete) throw AppError.notFound('El paquete no pertenece a este envío.');
    if (tipo === 'despacho' && !envio.guia.numero && !envio.guia.tieneFoto) throw AppError.badRequest('Primero registra la guía del despacho.');
    if (tipo === 'pagoRechazado' && !(opciones.motivo ?? '').trim()) throw AppError.badRequest('Indica el motivo del rechazo.');
    if (envio.sinDueno) throw AppError.badRequest('Este paquete no tiene dueño. Asígnalo a un cliente antes de escribirle.', 'SIN_DUENO');
    if (tipo === 'cotizacion' && !envio.precio) throw AppError.badRequest('Primero registra el peso del envío consolidado.');

    const recibidos = envio.paquetes.filter((p) => p.recibido).length;
    const nombreTransportista = transportista?.nombre ?? envio.transportista;
    const enlaceRastreo =
      transportista?.parametroGuia && envio.guia.numero
        ? `${transportista.urlRastreo}${transportista.urlRastreo.includes('?') ? '&' : '?'}${transportista.parametroGuia}=${encodeURIComponent(envio.guia.numero)}`
        : (transportista?.urlRastreo ?? '');

    const texto = renderizarPlantilla(plantillas[tipo], {
      nombre: envio.cliente.nombre.split(' ')[0],
      tracking: paquete?.tracking ?? '',
      resumen_paquetes:
        envio.tipo === 'CONSOLIDADO'
          ? `Tu envío lleva ${envio.paquetes.length} paquete(s).`
          : `Han llegado ${recibidos} de ${envio.paquetes.length} paquete(s) de esta alerta.`,
      linea_peso: this.lineaPeso(envio),
      linea_total: this.lineaTotal(envio),
      nota_modalidad: this.notaModalidad(envio, nombreTransportista),
      enlace_cuenta: `${this.urlApp}/cuenta/envios/${envio.id}`,
      enlace_consolidar: `${this.urlApp}/cuenta/consolidar`,
      transportista: nombreTransportista,
      guia: envio.guia.numero ?? 'está en la foto que te enviamos',
      enlace_rastreo: enlaceRastreo,
      motivo: opciones.motivo ?? '',
    });

    return {
      tipo,
      telefono: envio.cliente.telefono,
      fotoPaqueteId: tipo === 'llegada' ? (paquete?.tieneFoto ? paquete.id : null) : null,
      tieneFotoGuia: tipo === 'despacho' && envio.guia.tieneFoto,
      ...construirEnlacesWhatsApp(envio.cliente.telefono, texto),
    };
  }
}
