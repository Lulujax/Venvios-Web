import twilio, { type Twilio } from 'twilio';
import { env } from '../config/env';
import type { NotificacionRepository } from '../repositories/NotificacionRepository';
import type { EstadoPaqueteValue } from '../domain/estados';
import { ETIQUETAS_ESTADO } from '../domain/estados';
import { formatCOP, formatPeso } from '../utils/format';
import { logger } from '../utils/logger';
import { maskPhone } from '../utils/mask';

interface EnvioInput {
  userId: string;
  telefono: string;
  mensaje: string;
  paqueteId?: string | null;
}

interface RecepcionInput {
  userId: string;
  telefono: string;
  nombre: string;
  guia: string;
  pesoCobrable: number;
  precio: number;
  paqueteId: string;
}

interface EstadoInput {
  userId: string;
  telefono: string;
  nombre: string;
  guia: string;
  estado: EstadoPaqueteValue;
  paqueteId: string;
}

/**
 * Único punto del sistema que conoce el teléfono del cliente.
 * El operador recibe solo el resultado enmascarado de la notificación.
 */
export class WhatsAppService {
  private readonly client: Twilio | null;

  constructor(private readonly notificaciones: NotificacionRepository) {
    this.client =
      env.twilioEnabled && env.TWILIO_SID && env.TWILIO_TOKEN
        ? twilio(env.TWILIO_SID, env.TWILIO_TOKEN)
        : null;
  }

  private normalizarDestino(telefono: string): string {
    const digits = telefono.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
    if (digits.length === 12 && digits.startsWith('57')) return `+${digits}`;
    if (digits.length < 8 || digits.length > 15) {
      throw new Error('Número de WhatsApp inválido');
    }
    return `+${digits}`;
  }

  private async enviar(input: EnvioInput): Promise<void> {
    const destinoEnmascarado = maskPhone(input.telefono);
    const notificacion = await this.notificaciones.crear({
      userId: input.userId,
      paqueteId: input.paqueteId ?? null,
      destinoEnmascarado,
      mensaje: input.mensaje,
      estado: 'PENDIENTE',
    });

    if (!this.client) {
      await this.notificaciones.actualizarEstado(notificacion.id, {
        estado: 'ENVIADA',
        proveedorId: 'simulacion-local',
      });
      logger.info('WhatsApp simulado (sin credenciales Twilio)', {
        destino: destinoEnmascarado,
        guia: input.paqueteId ? 'ver-paquete' : undefined,
      });
      return;
    }

    try {
      const destino = this.normalizarDestino(input.telefono);
      const message = await this.client.messages.create({
        from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${destino}`,
        body: input.mensaje,
      });
      await this.notificaciones.actualizarEstado(notificacion.id, {
        estado: 'ENVIADA',
        proveedorId: message.sid,
      });
      logger.info('WhatsApp enviado', { destino: destinoEnmascarado, sid: message.sid });
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'Error desconocido de Twilio';
      await this.notificaciones.actualizarEstado(notificacion.id, {
        estado: 'FALLIDA',
        error: detalle.slice(0, 300),
      });
      logger.error('Falló el envío de WhatsApp', { destino: destinoEnmascarado, detalle });
    }
  }

  async notificarRecepcion(input: RecepcionInput): Promise<void> {
    const mensaje = [
      'Venvios Express · Tu mejor opción',
      '',
      `Hola ${input.nombre.split(' ')[0]}, recibimos tu paquete en Cúcuta.`,
      `Guía: ${input.guia}`,
      `Peso cobrable: ${formatPeso(input.pesoCobrable)}`,
      `Costo de envío: ${formatCOP(input.precio)}`,
      '',
      'Responde a este WhatsApp para coordinar el pago. Una vez confirmado, despachamos hacia Venezuela puerta a puerta.',
      '',
      'Barrio Latino, Centro, Cúcuta.',
    ].join('\n');

    await this.enviar({
      userId: input.userId,
      telefono: input.telefono,
      mensaje,
      paqueteId: input.paqueteId,
    });
  }

  async notificarCambioEstado(input: EstadoInput): Promise<void> {
    const etiqueta = ETIQUETAS_ESTADO[input.estado];
    const mensaje = [
      'Venvios Express · Tu mejor opción',
      '',
      `Hola ${input.nombre.split(' ')[0]}, tu paquete cambió de estado.`,
      `Guía: ${input.guia}`,
      `Estado: ${etiqueta}`,
      '',
      'Puedes seguir el detalle en venviosexpress.com/rastreo.',
    ].join('\n');

    await this.enviar({
      userId: input.userId,
      telefono: input.telefono,
      mensaje,
      paqueteId: input.paqueteId,
    });
  }
}
