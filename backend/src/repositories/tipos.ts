import type { EstadoEnvio } from '../domain/estados';
import type { Modalidad } from '../domain/tarifas';

export type Rol = 'CLIENTE' | 'OPERADOR' | 'ADMIN';
export type Transportista = 'MRW' | 'ZOOM';
export type EstadoPaquete = 'ESPERADO' | 'RECIBIDO';
export type MetodoPago = 'BINANCE' | 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'MANUAL';
export type MonedaPago = 'USD' | 'BS';
export type EstadoPago = 'POR_CONFIRMAR' | 'CONFIRMADO' | 'RECHAZADO';

export interface Usuario {
  id: string;
  nombre: string;
  cedulaCifrada: string;
  cedulaHuella: string;
  telefono: string;
  passwordHash: string;
  rol: Rol;
  activo: boolean;
  debeCambiarClave: boolean;
  creadoEn: Date;
}

export interface Paquete {
  id: string;
  envioId: string;
  trackingTexto: string;
  trackingNormalizado: string;
  estado: EstadoPaquete;
  pesoCentesimas: number | null;
  fotoPath: string | null;
  avisadoEn: Date | null;
  avisadoPorId: string | null;
  recibidoPorId: string | null;
  recibidoEn: Date | null;
}

export interface EntregaGuardada {
  nombre: string | null;
  cedulaCifrada: string | null;
  telefono: string | null;
  agencia: string | null;
  ciudad: string | null;
  estado: string | null;
}

export interface Envio {
  id: string;
  clienteId: string;
  modalidad: Modalidad;
  transportista: Transportista;
  tienda: string;
  valorDeclaradoCentavos: number;
  estado: EstadoEnvio;
  pesoTotalCentesimas: number | null;
  pesoCobrableCentesimas: number | null;
  fleteCentavos: number | null;
  seguroCentavos: number | null;
  totalCentavos: number | null;
  entrega: EntregaGuardada;
  guiaVenezolana: string | null;
  guiaFotoPath: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  paquetes: Paquete[];
}

export interface Pago {
  id: string;
  envioId: string;
  montoUsdCentavos: number;
  moneda: MonedaPago;
  montoOriginalCentavos: number;
  metodo: MetodoPago;
  referencia: string | null;
  comprobantePath: string | null;
  estado: EstadoPago;
  motivoRechazo: string | null;
  tasaBcv: number | null;
  registradoPorId: string;
  confirmadoPorId: string | null;
  creadoEn: Date;
}

export interface Evento {
  id: string;
  envioId: string;
  actorId: string | null;
  tipo: string;
  detalle: string;
  datos: Record<string, unknown> | null;
  creadoEn: Date;
}

export interface TasaGuardada {
  fecha: string;
  bolivaresPorUsd: number;
  fuente: 'API' | 'MANUAL';
}

export type NuevoUsuario = Omit<Usuario, 'id' | 'creadoEn'>;

export interface NuevoPaquete {
  trackingTexto: string;
  trackingNormalizado: string;
}

export interface NuevoEnvio {
  clienteId: string;
  modalidad: Modalidad;
  transportista: Transportista;
  tienda: string;
  valorDeclaradoCentavos: number;
  paquetes: NuevoPaquete[];
}

export interface FiltroEnvios {
  clienteId?: string;
  estados?: EstadoEnvio[];
}

export interface UsuarioRepository {
  crear(datos: NuevoUsuario): Promise<Usuario>;
  porId(id: string): Promise<Usuario | null>;
  porCedulaHuella(huella: string): Promise<Usuario | null>;
  porTelefono(telefono: string): Promise<Usuario | null>;
  listar(roles?: Rol[]): Promise<Usuario[]>;
  actualizar(id: string, cambios: Partial<Omit<Usuario, 'id' | 'creadoEn'>>): Promise<Usuario>;
}

export interface EnvioRepository {
  crear(datos: NuevoEnvio): Promise<Envio>;
  porId(id: string): Promise<Envio | null>;
  listar(filtro: FiltroEnvios): Promise<Envio[]>;
  porTracking(trackingNormalizado: string): Promise<Envio | null>;
  actualizar(id: string, cambios: Partial<Omit<Envio, 'id' | 'creadoEn' | 'actualizadoEn' | 'paquetes' | 'entrega'>> & { entrega?: Partial<EntregaGuardada> }): Promise<Envio>;
  actualizarPaquete(id: string, cambios: Partial<Omit<Paquete, 'id' | 'envioId'>>): Promise<Paquete>;
  agregarPaquetes(envioId: string, paquetes: NuevoPaquete[]): Promise<Paquete[]>;
  moverPaquetes(paqueteIds: string[], nuevoEnvioId: string): Promise<void>;
  agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento>;
  eventosDe(envioId: string): Promise<Evento[]>;
}

export interface PagoRepository {
  crear(datos: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago>;
  porId(id: string): Promise<Pago | null>;
  deEnvio(envioId: string): Promise<Pago[]>;
  porEstado(estado: EstadoPago): Promise<Pago[]>;
  actualizar(id: string, cambios: Partial<Omit<Pago, 'id' | 'envioId' | 'creadoEn'>>): Promise<Pago>;
}

export interface ConfigRepository {
  obtener<T>(clave: string): Promise<T | null>;
  guardar(clave: string, valor: unknown): Promise<void>;
  tasaDeFecha(fecha: string): Promise<TasaGuardada | null>;
  ultimaTasa(): Promise<TasaGuardada | null>;
  guardarTasa(tasa: TasaGuardada): Promise<void>;
}

export interface Repositorios {
  usuarios: UsuarioRepository;
  envios: EnvioRepository;
  pagos: PagoRepository;
  config: ConfigRepository;
}
