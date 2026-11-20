export type Rol = 'CLIENTE' | 'OPERADOR' | 'ADMIN';
export type Modalidad = 'M1' | 'M2';
export type Transportista = 'MRW' | 'ZOOM';
export type EstadoEnvio =
  | 'PREALERTADO'
  | 'RECIBIDO_PARCIAL'
  | 'RECIBIDO_COMPLETO'
  | 'ARCHIVADO'
  | 'POR_CONSOLIDAR'
  | 'POR_PAGAR'
  | 'POR_CONFIRMAR'
  | 'PAGADO'
  | 'DESPACHADO'
  | 'CERRADO'
  | 'CANCELADO';
export type TipoEnvio = 'ALERTA' | 'CONSOLIDADO';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  codigo: string;
  telefono: string;
  cedulaEnmascarada: string;
  rol: Rol;
  activo: boolean;
  debeCambiarClave: boolean;
}

export interface PaqueteVista {
  id: string;
  tracking: string;
  recibido: boolean;
  pesoKg: number | null;
  tieneFoto: boolean;
  fotoRuta: string | null;
  avisado: boolean;
  recibidoEn: string | null;
}

export interface PagoVista {
  id: string;
  estado: 'POR_CONFIRMAR' | 'CONFIRMADO' | 'RECHAZADO';
  metodo: string;
  moneda: 'USD' | 'BS';
  montoOriginalCentavos: number;
  montoUsdCentavos: number;
  referencia: string | null;
  tieneComprobante: boolean;
  comprobanteRuta: string | null;
  motivoRechazo: string | null;
  creadoEn: string;
}

export interface TasaVista {
  bolivaresPorUsd: number;
  fecha: string;
  desactualizada: boolean;
}

export interface Entrega {
  nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  agencia: string | null;
  ciudad: string | null;
  estado: string | null;
}

export interface Envio {
  id: string;
  tipo: TipoEnvio;
  sinDueno: boolean;
  estado: EstadoEnvio;
  etiquetaEstado: string;
  modalidad: Modalidad;
  modalidadSugerida: Modalidad | null;
  transportista: Transportista;
  tienda: string;
  valorDeclaradoCentavos: number;
  cliente: { id: string; nombre: string; telefono: string; codigo: string; cedulaEnmascarada: string };
  paquetes: PaqueteVista[];
  faltan: number;
  pesoTotalKg: number | null;
  precio: {
    pesoCobrableKg: number;
    precioPorKgCentavos: number;
    fleteCentavos: number;
    seguroCentavos: number;
    totalCentavos: number;
    totalBsCentavos: number | null;
  } | null;
  tasa: TasaVista | null;
  entrega: Entrega;
  guia: { numero: string | null; tieneFoto: boolean; fotoRuta: string | null };
  pagos: PagoVista[];
  pagadoCentavos: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface MensajeWhatsApp {
  tipo: string;
  telefono: string;
  texto: string;
  movil: string;
  web: string;
  fotoPaqueteId: string | null;
  tieneFotoGuia: boolean;
}

export type ResultadoEscaneo =
  | { resultado: 'RECIBIDO' | 'YA_REGISTRADO'; envioId: string; paqueteId: string; cliente: string; sinDueno: boolean; faltan: number; texto: string }
  | { resultado: 'SIN_PREALERTA'; texto: string };

export interface Resumen {
  porRecibir: number;
  porAvisar: number;
  sinDueno: number;
  porConsolidar: number;
  porCobrar: number;
  pagosPorConfirmar: number;
  porDespachar: number;
  enBodega: number;
}

export interface ItemBodega {
  paqueteId: string;
  tracking: string;
  pesoKg: number | null;
  tieneFoto: boolean;
  fotoRuta: string | null;
  recibidoEn: string | null;
  envioId: string;
  tipoEnvio: TipoEnvio;
  estadoEnvio: EstadoEnvio;
  sinDueno: boolean;
  cliente: { id: string; nombre: string; codigo: string };
}

export interface TramoPrecio {
  desdeKg: number;
  precioPorKgCentavos: number;
}

export interface Tarifas {
  m1Tramos: TramoPrecio[];
  m1SeguroPorcentaje: number;
  m1PesoMinimoKg: number;
  m2PrecioPorKgCentavos: number;
  m2SeguroPorcentaje: number;
  m2PesoMinimoKg: number;
}

export interface TransportistaPublico {
  codigo: Transportista;
  nombre: string;
  urlRastreo: string;
  parametroGuia: string | null;
}

export interface Contacto {
  whatsapp: string;
  direccion: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface InfoPublica {
  tarifas: Tarifas;
  transportistas: TransportistaPublico[];
  contacto: Contacto;
  tasa: TasaVista | null;
}

export interface OpcionCotizacion {
  modalidad: Modalidad;
  pesoCobrableCentesimas: number;
  precioPorKgCentavos: number;
  fleteCentavos: number;
  seguroCentavos: number;
  totalCentavos: number;
  totalBsCentavos: number | null;
  cobroADestino: boolean;
}

export interface Cotizacion {
  pesoKg: number;
  modalidadSugerida: Modalidad;
  opciones: OpcionCotizacion[];
  tasa: TasaVista | null;
}

export interface DatosPago {
  esPrueba: boolean;
  pagoMovil: { banco: string; cedula: string; telefono: string };
  cuenta: { banco: string; numero: string; titular: string; cedula: string };
  binance: { usuario: string; correo: string; nota: string };
  notaVerificacion: string;
}

export interface InfoPago {
  totalCentavos: number;
  pagadoCentavos: number;
  saldoCentavos: number;
  saldoBsCentavos: number;
  tasa: TasaVista;
  datosPago: DatosPago;
  modalidad: Modalidad;
  transportista: Transportista;
}

export interface EventoHistorial {
  tipo: string;
  detalle: string;
  actorId: string | null;
  fecha: string;
}
