export type Rol = 'CLIENTE' | 'ADMIN';

export type EstadoPaquete =
  | 'RECIBIDO'
  | 'EN_BODEGA'
  | 'EN_TRANSITO'
  | 'EN_ADUANA'
  | 'ENTREGADO'
  | 'CANCELADO';

export type EstadoPrealerta = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export interface Casillero {
  codigo: string;
  direccion: string;
  ciudad: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  casillero: Casillero | null;
}

export interface Evento {
  estado: EstadoPaquete;
  nota: string | null;
  fecha: string;
}

export interface Paquete {
  id: string;
  guia: string;
  descripcion: string;
  estado: EstadoPaquete;
  pesoKg: number;
  pesoCobrable: number;
  precio: number;
  fotoUrl: string | null;
  createdAt: string;
  eventos: Evento[];
  cliente?: {
    nombre: string;
    casillero: string | null;
  };
  siguientesEstados?: EstadoPaquete[];
}

export interface PaquetePublico {
  guia: string;
  estado: EstadoPaquete;
  pesoCobrable: number;
  createdAt: string;
  actualizadoEn: string;
  eventos: Evento[];
}

export interface Prealerta {
  id: string;
  tienda: string;
  descripcion: string;
  trackingTienda: string | null;
  estado: EstadoPrealerta;
  createdAt: string;
  cliente?: {
    nombre: string;
    casillero: string | null;
  };
}

export interface Notificacion {
  id: string;
  mensaje: string;
  canal: 'WHATSAPP' | 'SISTEMA';
  estado: 'PENDIENTE' | 'ENVIADA' | 'FALLIDA';
  destino: string;
  createdAt: string;
}

export interface Tarifa {
  id: string;
  nombre: string;
  pesoHasta: number;
  precio: number;
  precioKgExcedente: number | null;
}

export interface ResumenAdmin {
  totalPaquetes: number;
  clientes: number;
  prealertasPendientes: number;
  ingresosEntregados: number;
  porEstado: Partial<Record<EstadoPaquete, number>>;
}

export interface Paginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ApiErrorPayload {
  codigo: string;
  mensaje: string;
  detalles?:
    | Array<{ campo: string; mensaje: string }>
    | Record<string, unknown>
    | string;
}
