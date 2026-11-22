import { TARIFAS_INICIALES, type ConfiguracionTarifas } from '../domain/tarifas';

export type TipoCuenta = 'CORRIENTE' | 'AHORRO';

export interface DatosPago {
  esPrueba: boolean;
  pagoMovil: { activo: boolean; banco: string; cedula: string; telefono: string };
  cuenta: { activo: boolean; tipo: TipoCuenta; banco: string; numero: string; titular: string; cedula: string };
  binance: { activo: boolean; usuario: string; correo: string; nota: string };
  notaVerificacion: string;
}

export interface Plantillas {
  llegada: string;
  cotizacion: string;
  pagoVerificado: string;
  pagoRechazado: string;
  despacho: string;
}

export interface TransportistaConfig {
  codigo: 'MRW' | 'ZOOM';
  nombre: string;
  urlRastreo: string;
  parametroGuia: string | null;
}

export interface Contacto {
  whatsapp: string;
  correo: string;
  direccion: string;
  horario: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export const CLAVES_CONFIG = ['tarifas', 'datosPago', 'plantillas', 'transportistas', 'contacto'] as const;
export type ClaveConfig = (typeof CLAVES_CONFIG)[number];

export const DATOS_PAGO_INICIALES: DatosPago = {
  esPrueba: true,
  pagoMovil: { activo: true, banco: '0000 - BANCO DE PRUEBA', cedula: '00000000', telefono: '04120000000' },
  cuenta: { activo: true, tipo: 'CORRIENTE', banco: 'BANCO DE PRUEBA', numero: '0000-0000-00-0000000000', titular: 'TITULAR DE PRUEBA', cedula: '00000000' },
  binance: { activo: false, usuario: 'DATOS DE PRUEBA', correo: 'prueba@example.com', nota: 'Datos de Binance pendientes.' },
  notaVerificacion: 'Pasar captura del pago para verificación respectiva.',
};

export const PLANTILLAS_INICIALES: Plantillas = {
  llegada: [
    'Hola {nombre}, te escribe Venvios Express.',
    'Llegó tu paquete {tracking} a nuestra oficina en Cúcuta.',
    '{resumen_paquetes}',
    'Cuando quieras enviarlo, entra a tu cuenta y elige qué paquetes van juntos: {enlace_consolidar}',
  ].join('\n'),
  cotizacion: [
    'Hola {nombre}, ya pesamos tu envío. 📦',
    '{resumen_paquetes}',
    '{linea_peso}',
    '{linea_total}',
    '{nota_modalidad}',
    'Paga desde tu cuenta: {enlace_cuenta}',
  ].join('\n'),
  pagoVerificado: [
    '🧾 *Tu pago fue verificado*',
    '',
    'Hola {nombre}, ya confirmamos tu pago. Tu envío sale hacia Venezuela. 📦',
    'Cuando tengamos la guía de la transportista te avisamos.',
    '{nota_modalidad}',
    'Mira el seguimiento en tu cuenta: {enlace_cuenta}',
  ].join('\n'),
  pagoRechazado: [
    'Hola {nombre}, no pudimos verificar tu pago del envío {tracking}.',
    'Motivo: {motivo}',
    'Puedes subir otro comprobante desde tu cuenta: {enlace_cuenta}',
  ].join('\n'),
  despacho: [
    'Hola {nombre}, tu envío salió hacia Venezuela. 📦',
    'Transportista: {transportista}',
    'Guía: {guia}',
    'Rastréalo aquí: {enlace_rastreo}',
    '{nota_modalidad}',
  ].join('\n'),
};

export const TRANSPORTISTAS_INICIALES: TransportistaConfig[] = [
  { codigo: 'MRW', nombre: 'MRW', urlRastreo: 'https://mrwve.com', parametroGuia: null },
  {
    codigo: 'ZOOM',
    nombre: 'Zoom',
    urlRastreo: 'https://zoom.red/tracking-de-envios-personas/',
    parametroGuia: null,
  },
];

export const CONTACTO_INICIAL: Contacto = {
  whatsapp: '573237968740',
  correo: 'contacto@venviosexpress.com',
  direccion: 'Av. 3 #8-03, piso 2, local 02, sector Centro, Barrio Latino, Cúcuta',
  horario: 'Lunes a sábado, 8:00 am a 5:00 pm (hora Colombia), horario continuo. Domingos y feriados no laboramos.',
  instagram: 'https://instagram.com/venviosexpress',
  facebook: 'https://facebook.com/venviosexpress',
  tiktok: 'https://tiktok.com/@venviosexpress',
};

export const VALORES_INICIALES: Record<ClaveConfig, unknown> = {
  tarifas: TARIFAS_INICIALES satisfies ConfiguracionTarifas,
  datosPago: DATOS_PAGO_INICIALES,
  plantillas: PLANTILLAS_INICIALES,
  transportistas: TRANSPORTISTAS_INICIALES,
  contacto: CONTACTO_INICIAL,
};
