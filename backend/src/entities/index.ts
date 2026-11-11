export type Rol = 'CLIENTE' | 'ADMIN';

export type EstadoPaquete =
  | 'RECIBIDO'
  | 'EN_BODEGA'
  | 'EN_TRANSITO'
  | 'EN_ADUANA'
  | 'ENTREGADO'
  | 'CANCELADO';

export type EstadoPrealerta = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export interface CasilleroDTO {
  codigo: string;
  direccion: string;
  ciudad: string;
}

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  casillero: CasilleroDTO | null;
}

export interface UsuarioSesion {
  id: string;
  rol: Rol;
}

export interface EventoDTO {
  estado: EstadoPaquete;
  nota: string | null;
  fecha: string;
}

export interface PaqueteClienteDTO {
  id: string;
  guia: string;
  descripcion: string;
  estado: EstadoPaquete;
  pesoKg: number;
  pesoCobrable: number;
  precio: number;
  fotoUrl: string | null;
  createdAt: string;
  eventos: EventoDTO[];
}

export interface PaqueteAdminDTO extends PaqueteClienteDTO {
  cliente: {
    nombre: string;
    casillero: string | null;
  };
  siguientesEstados: EstadoPaquete[];
}

export interface PaquetePublicoDTO {
  guia: string;
  estado: EstadoPaquete;
  pesoCobrable: number;
  createdAt: string;
  actualizadoEn: string;
  eventos: EventoDTO[];
}

export interface PrealertaDTO {
  id: string;
  tienda: string;
  descripcion: string;
  trackingTienda: string | null;
  estado: EstadoPrealerta;
  createdAt: string;
}

export interface PrealertaAdminDTO extends PrealertaDTO {
  cliente: {
    nombre: string;
    casillero: string | null;
  };
}

export interface NotificacionDTO {
  id: string;
  mensaje: string;
  canal: 'WHATSAPP' | 'SISTEMA';
  estado: 'PENDIENTE' | 'ENVIADA' | 'FALLIDA';
  destino: string;
  createdAt: string;
}

export interface TarifaDTO {
  id: string;
  nombre: string;
  pesoHasta: number;
  precio: number;
  precioKgExcedente: number | null;
}

export interface Cotizacion {
  pesoRealKg: number;
  pesoVolumetricoKg: number;
  pesoCobrableKg: number;
  precio: number;
  tarifaAplicada: string;
  desglose: string;
}

export interface ResultadoPaginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface JwtPayload {
  sub: string;
  rol: Rol;
}
