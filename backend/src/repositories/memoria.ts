import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors';
import type {
  ConfigRepository,
  EntregaGuardada,
  Envio,
  EnvioRepository,
  Evento,
  FiltroEnvios,
  NuevoEnvio,
  NuevoPaquete,
  NuevoUsuario,
  Pago,
  PagoRepository,
  Paquete,
  Repositorios,
  Rol,
  TasaGuardada,
  Usuario,
  UsuarioRepository,
} from './tipos';

const ENTREGA_VACIA: EntregaGuardada = {
  nombre: null,
  cedulaCifrada: null,
  telefono: null,
  agencia: null,
  ciudad: null,
  estado: null,
};

function copiar<T>(valor: T): T {
  return structuredClone(valor);
}

export class UsuarioMemoria implements UsuarioRepository {
  private readonly datos = new Map<string, Usuario>();

  async crear(nuevo: NuevoUsuario): Promise<Usuario> {
    const existente = [...this.datos.values()].find(
      (u) => u.cedulaHuella === nuevo.cedulaHuella || u.telefono === nuevo.telefono || u.email === nuevo.email || u.codigo === nuevo.codigo,
    );
    if (existente) throw AppError.conflict('Ya existe una cuenta con esa cédula, ese correo o ese teléfono.');
    const usuario: Usuario = { ...nuevo, id: randomUUID(), creadoEn: new Date() };
    this.datos.set(usuario.id, usuario);
    return copiar(usuario);
  }

  async porId(id: string): Promise<Usuario | null> {
    const usuario = this.datos.get(id);
    return usuario ? copiar(usuario) : null;
  }

  async porCedulaHuella(huella: string): Promise<Usuario | null> {
    const usuario = [...this.datos.values()].find((u) => u.cedulaHuella === huella);
    return usuario ? copiar(usuario) : null;
  }

  async porTelefono(telefono: string): Promise<Usuario | null> {
    const usuario = [...this.datos.values()].find((u) => u.telefono === telefono);
    return usuario ? copiar(usuario) : null;
  }

  async porEmail(email: string): Promise<Usuario | null> {
    const usuario = [...this.datos.values()].find((u) => u.email === email);
    return usuario ? copiar(usuario) : null;
  }

  async porCodigo(codigo: string): Promise<Usuario | null> {
    const usuario = [...this.datos.values()].find((u) => u.codigo === codigo);
    return usuario ? copiar(usuario) : null;
  }

  async listar(roles?: Rol[]): Promise<Usuario[]> {
    return [...this.datos.values()].filter((u) => !roles || roles.includes(u.rol)).map(copiar);
  }

  async actualizar(id: string, cambios: Partial<Omit<Usuario, 'id' | 'creadoEn'>>): Promise<Usuario> {
    const actual = this.datos.get(id);
    if (!actual) throw AppError.notFound('El usuario no existe.');
    const actualizado = { ...actual, ...cambios };
    this.datos.set(id, actualizado);
    return copiar(actualizado);
  }
}

export class EnvioMemoria implements EnvioRepository {
  private readonly envios = new Map<string, Envio>();
  private readonly eventos: Evento[] = [];

  private construirPaquete(envioId: string, nuevo: NuevoPaquete): Paquete {
    return {
      id: randomUUID(),
      envioId,
      trackingTexto: nuevo.trackingTexto,
      trackingNormalizado: nuevo.trackingNormalizado,
      estado: 'ESPERADO',
      pesoCentesimas: null,
      fotoPath: null,
      avisadoEn: null,
      avisadoPorId: null,
      recibidoPorId: null,
      recibidoEn: null,
    };
  }

  private verificarTrackingLibre(normalizados: string[]): void {
    for (const envio of this.envios.values()) {
      for (const paquete of envio.paquetes) {
        if (normalizados.includes(paquete.trackingNormalizado)) {
          throw AppError.conflict('Ese tracking ya está registrado.');
        }
      }
    }
  }

  async crear(datos: NuevoEnvio): Promise<Envio> {
    this.verificarTrackingLibre(datos.paquetes.map((p) => p.trackingNormalizado));
    const id = randomUUID();
    const ahora = new Date();
    const tipo = datos.tipo ?? 'ALERTA';
    const envio: Envio = {
      id,
      tipo,
      clienteId: datos.clienteId,
      modalidad: datos.modalidad,
      transportista: datos.transportista,
      tienda: datos.tienda,
      valorDeclaradoCentavos: datos.valorDeclaradoCentavos,
      estado: datos.estado ?? (tipo === 'CONSOLIDADO' ? 'POR_CONSOLIDAR' : 'PREALERTADO'),
      pesoTotalCentesimas: null,
      pesoCobrableCentesimas: null,
      fleteCentavos: null,
      seguroCentavos: null,
      totalCentavos: null,
      entrega: { ...ENTREGA_VACIA },
      guiaVenezolana: null,
      guiaFotoPath: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
      paquetes: datos.paquetes.map((p) => this.construirPaquete(id, p)),
    };
    this.envios.set(id, envio);
    return copiar(envio);
  }

  async porId(id: string): Promise<Envio | null> {
    const envio = this.envios.get(id);
    return envio ? copiar(envio) : null;
  }

  async listar(filtro: FiltroEnvios): Promise<Envio[]> {
    return [...this.envios.values()]
      .filter((e) => !filtro.clienteId || e.clienteId === filtro.clienteId)
      .filter((e) => !filtro.estados || filtro.estados.includes(e.estado))
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
      .map(copiar);
  }

  async porTracking(trackingNormalizado: string): Promise<Envio | null> {
    const encontrado = [...this.envios.values()].find((e) =>
      e.paquetes.some((p) => p.trackingNormalizado === trackingNormalizado),
    );
    return encontrado ? copiar(encontrado) : null;
  }

  async actualizar(
    id: string,
    cambios: Partial<Omit<Envio, 'id' | 'creadoEn' | 'actualizadoEn' | 'paquetes' | 'entrega'>> & {
      entrega?: Partial<EntregaGuardada>;
    },
  ): Promise<Envio> {
    const actual = this.envios.get(id);
    if (!actual) throw AppError.notFound('El envío no existe.');
    const { entrega, ...resto } = cambios;
    const actualizado: Envio = {
      ...actual,
      ...resto,
      entrega: { ...actual.entrega, ...(entrega ?? {}) },
      actualizadoEn: new Date(),
    };
    this.envios.set(id, actualizado);
    return copiar(actualizado);
  }

  async actualizarPaquete(id: string, cambios: Partial<Omit<Paquete, 'id' | 'envioId'>>): Promise<Paquete> {
    for (const envio of this.envios.values()) {
      const indice = envio.paquetes.findIndex((p) => p.id === id);
      if (indice >= 0) {
        envio.paquetes[indice] = { ...envio.paquetes[indice]!, ...cambios };
        envio.actualizadoEn = new Date();
        return copiar(envio.paquetes[indice]!);
      }
    }
    throw AppError.notFound('El paquete no existe.');
  }

  async agregarPaquetes(envioId: string, nuevos: NuevoPaquete[]): Promise<Paquete[]> {
    const envio = this.envios.get(envioId);
    if (!envio) throw AppError.notFound('El envío no existe.');
    this.verificarTrackingLibre(nuevos.map((p) => p.trackingNormalizado));
    const creados = nuevos.map((p) => this.construirPaquete(envioId, p));
    envio.paquetes.push(...creados);
    return copiar(creados);
  }

  async moverPaquetes(paqueteIds: string[], nuevoEnvioId: string): Promise<void> {
    const destino = this.envios.get(nuevoEnvioId);
    if (!destino) throw AppError.notFound('El envío destino no existe.');
    for (const envio of this.envios.values()) {
      if (envio.id === nuevoEnvioId) continue;
      const quedan: Paquete[] = [];
      for (const paquete of envio.paquetes) {
        if (paqueteIds.includes(paquete.id)) {
          destino.paquetes.push({ ...paquete, envioId: nuevoEnvioId });
        } else quedan.push(paquete);
      }
      envio.paquetes = quedan;
    }
  }

  async agregarEvento(evento: Omit<Evento, 'id' | 'creadoEn'>): Promise<Evento> {
    const creado: Evento = { ...evento, id: randomUUID(), creadoEn: new Date() };
    this.eventos.push(creado);
    return copiar(creado);
  }

  async eventosDe(envioId: string): Promise<Evento[]> {
    return this.eventos
      .filter((e) => e.envioId === envioId)
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime())
      .map(copiar);
  }
}

export class PagoMemoria implements PagoRepository {
  private readonly datos = new Map<string, Pago>();

  async crear(nuevo: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    const pago: Pago = { ...nuevo, id: randomUUID(), creadoEn: new Date() };
    this.datos.set(pago.id, pago);
    return copiar(pago);
  }

  async porId(id: string): Promise<Pago | null> {
    const pago = this.datos.get(id);
    return pago ? copiar(pago) : null;
  }

  async deEnvio(envioId: string): Promise<Pago[]> {
    return [...this.datos.values()].filter((p) => p.envioId === envioId).map(copiar);
  }

  async porEstado(estado: Pago['estado']): Promise<Pago[]> {
    return [...this.datos.values()].filter((p) => p.estado === estado).map(copiar);
  }

  async actualizar(id: string, cambios: Partial<Omit<Pago, 'id' | 'envioId' | 'creadoEn'>>): Promise<Pago> {
    const actual = this.datos.get(id);
    if (!actual) throw AppError.notFound('El pago no existe.');
    const actualizado = { ...actual, ...cambios };
    this.datos.set(id, actualizado);
    return copiar(actualizado);
  }
}

export class ConfigMemoria implements ConfigRepository {
  private readonly valores = new Map<string, unknown>();
  private readonly tasas = new Map<string, TasaGuardada>();

  async obtener<T>(clave: string): Promise<T | null> {
    return this.valores.has(clave) ? copiar(this.valores.get(clave) as T) : null;
  }

  async guardar(clave: string, valor: unknown): Promise<void> {
    this.valores.set(clave, copiar(valor));
  }

  async tasaDeFecha(fecha: string): Promise<TasaGuardada | null> {
    const tasa = this.tasas.get(fecha);
    return tasa ? { ...tasa } : null;
  }

  async ultimaTasa(): Promise<TasaGuardada | null> {
    const fechas = [...this.tasas.keys()].sort();
    const ultima = fechas[fechas.length - 1];
    return ultima ? { ...this.tasas.get(ultima)! } : null;
  }

  async guardarTasa(tasa: TasaGuardada): Promise<void> {
    this.tasas.set(tasa.fecha, { ...tasa });
  }
}

export function crearRepositoriosMemoria(): Repositorios {
  return {
    usuarios: new UsuarioMemoria(),
    envios: new EnvioMemoria(),
    pagos: new PagoMemoria(),
    config: new ConfigMemoria(),
  };
}
