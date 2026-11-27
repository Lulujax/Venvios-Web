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

export interface DestinoEntrega {
  agencia: string;
  ciudad: string;
  estado: string;
}

export interface ReceptorPerfil {
  nombre: string;
  cedula: string;
  telefono: string;
}

export interface PerfilVista {
  datos: Usuario;
  entrega: {
    receptor: ReceptorPerfil | null;
    receptorPorDefecto: ReceptorPerfil;
    destinos: Record<Transportista, DestinoEntrega | null>;
    completo: Record<Transportista, boolean>;
  };
}

export interface EventoCuentaVista {
  id: string;
  tipo: string;
  detalle: string;
  creadoEn: string;
}

export interface HitoVista {
  tipo: string;
  etiqueta: string;
  fecha: string;
}

export interface PaqueteVista {
  seguimiento: HitoVista[];
  id: string;
  tracking: string;
  recibido: boolean;
  pesoKg: number | null;
  valorDeclaradoCentavos: number;
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

export interface FilaPago {
  pagoId: string;
  envioId: string;
  numero: number;
  cliente: string;
  metodo: string;
  moneda: string;
  montoUsdCentavos: number;
  montoOriginalCentavos: number;
  referencia: string | null;
  tieneComprobante: boolean;
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
  numero: number;
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
    seguroManual: boolean;
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
  avisado: boolean;
  diasEnBodega: number | null;
  enCamino: boolean;
  cliente: { id: string; nombre: string; codigo: string };
}

export interface PaginaEnvios {
  envios: Envio[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
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
  correo: string;
  direccion: string;
  horario: string;
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

export type TipoCuenta = 'CORRIENTE' | 'AHORRO';

export interface DatosPago {
  esPrueba: boolean;
  pagoMovil: { activo: boolean; banco: string; cedula: string; telefono: string };
  cuenta: { activo: boolean; tipo: TipoCuenta; banco: string; numero: string; titular: string; cedula: string };
  binance: { activo: boolean; usuario: string; correo: string; nota: string };
  notaVerificacion: string;
}

export type MetodoVisible = 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE';

export interface InfoPago {
  metodosDisponibles: MetodoVisible[];
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

export type TipoReporte = 'inventario' | 'prealertas-pendientes' | 'estado-de-cuenta';
export type EtapaInventario = 'EN_BODEGA' | 'SIN_DUENO' | 'ESPERANDO_PAGO' | 'LISTO_PARA_SALIR';
export type EtapaCliente = 'POR_LLEGAR' | 'EN_BODEGA' | 'ESPERANDO_PAGO' | 'LISTO_PARA_SALIR' | 'EN_RUTA' | 'ENTREGADO';
export type OrigenPaqueteEstado = 'PREALERTA' | 'SIN_PREALERTA' | 'SIN_REGISTRO';

export interface PrealertaOrigenVista {
  id: string;
  tienda: string;
  fecha: string;
}

export interface ItemInventario {
  paqueteId: string;
  tracking: string;
  etapa: EtapaInventario;
  etiquetaEtapa: string;
  prealertaOrigen: PrealertaOrigenVista | null;
  origenEstado: OrigenPaqueteEstado;
  pesoKg: number | null;
  recibidoEn: string | null;
  diasEnBodega: number | null;
  avisado: boolean;
  tieneFoto: boolean;
  envioId: string;
}

export interface ClienteInventario {
  cliente: { id: string; nombre: string; codigo: string };
  totalPaquetes: number;
  pesoTotalKg: number;
  items: ItemInventario[];
}

export interface ReporteInventario {
  tipo: 'inventario';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  resumen: {
    totalPaquetes: number;
    pesoTotalKg: number;
    sinAvisar: number;
    porEtapa: Record<EtapaInventario, number>;
  };
  clientes: ClienteInventario[];
}

export interface PrealertaPendienteVista {
  envioId: string;
  tienda: string;
  fechaAviso: string;
  diasDesdeAviso: number;
  llegaron: number;
  total: number;
  faltan: number;
  trackingsFaltantes: string[];
}

export interface ReportePrealertasPendientes {
  tipo: 'prealertas-pendientes';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  resumen: {
    totalPrealertas: number;
    totalPaquetesPorLlegar: number;
    totalClientes: number;
    sinRegistroPrealerta: number;
  };
  clientes: Array<{
    cliente: { id: string; nombre: string; codigo: string };
    totalPorLlegar: number;
    prealertas: PrealertaPendienteVista[];
  }>;
}

export interface PaqueteEstadoCuenta {
  paqueteId: string;
  tracking: string;
  prealertaOrigen: PrealertaOrigenVista | null;
  origenEstado: OrigenPaqueteEstado;
  pesoKg: number | null;
  recibidoEn: string | null;
  diasEnBodega: number | null;
  avisado: boolean;
  tieneFoto: boolean;
}

export interface ConsolidadoEstadoCuenta {
  envioId: string;
  numero: number;
  etapa: 'ESPERANDO_PAGO' | 'LISTO_PARA_SALIR' | 'EN_RUTA' | 'ENTREGADO';
  etiquetaEtapa: string;
  estado: EstadoEnvio;
  etiquetaEstado: string;
  transportista: Transportista;
  pesoTotalKg: number | null;
  creadoEn: string;
  entregadoEn: string | null;
  paquetes: PaqueteEstadoCuenta[];
}

export interface ReporteEstadoCuenta {
  tipo: 'estado-de-cuenta';
  generadoEn: string;
  periodo: { desde: string | null; hasta: string | null };
  cliente: { id: string; nombre: string; codigo: string };
  resumen: {
    totalPaquetes: number;
    porEtapa: Record<EtapaCliente, number>;
    incluyeEntregados: boolean;
    sinRegistroPrealerta: number;
  };
  prealertas: PrealertaPendienteVista[];
  enBodega: PaqueteEstadoCuenta[];
  consolidados: ConsolidadoEstadoCuenta[];
  entregados: ConsolidadoEstadoCuenta[];
}

export type ReporteGenerado = ReporteInventario | ReportePrealertasPendientes | ReporteEstadoCuenta;

export interface ClienteFiltroVista {
  id: string;
  nombre: string;
  codigo: string;
}

export interface RespuestaReporte {
  reporte: ReporteGenerado;
  clienteFiltro: ClienteFiltroVista | null;
  filtrosTexto: string;
}
