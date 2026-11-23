import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { z, ZodError } from 'zod';
import type { Contexto } from '../config/contexto';
import { ESTADOS_ENVIO } from '../domain/estados';
import type { Rol, Usuario } from '../repositories/tipos';
import { MAX_BYTES_IMAGEN, type ArchivoEntrada } from '../services/Almacenamiento';
import { esPersonal, type Actor, type FiltroBodega } from '../services/EnvioService';
import { TIPOS_MENSAJE, type TipoMensaje } from '../services/MensajeService';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const COOKIE = 'venvios_sesion';
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

interface PeticionAutenticada extends Request {
  usuario?: Usuario;
}

type Manejador = (req: PeticionAutenticada, res: Response) => Promise<unknown>;

function ruta(manejador: Manejador): RequestHandler {
  return (req, res, next) => {
    manejador(req as PeticionAutenticada, res).catch(next);
  };
}

function rutaEnTransaccion(contexto: Contexto, manejador: Manejador): RequestHandler {
  return (req, res, next) => {
    const enviarJson = res.json.bind(res);
    const pendiente: { enviar?: () => void } = {};
    res.json = ((cuerpo: unknown) => {
      pendiente.enviar = () => enviarJson(cuerpo);
      return res;
    }) as Response['json'];
    contexto.repos
      .enTransaccion(() => manejador(req as PeticionAutenticada, res))
      .then(() => {
        res.json = enviarJson;
        pendiente.enviar?.();
      })
      .catch((error: unknown) => {
        res.json = enviarJson;
        next(error);
      });
  };
}

function actorDe(req: PeticionAutenticada): Actor {
  if (!req.usuario) throw AppError.unauthorized();
  const vistaCliente = req.headers['x-vista'] === 'cliente';
  return { id: req.usuario.id, rol: vistaCliente ? 'CLIENTE' : req.usuario.rol };
}

function archivoDe(req: Request): ArchivoEntrada | undefined {
  const archivo = (req as Request & { file?: Express.Multer.File }).file;
  return archivo ? { buffer: archivo.buffer, mime: archivo.mimetype } : undefined;
}

function numero(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(',', '.'));
}

const esquemaRegistro = z.object({
  nombre: z.string(),
  cedula: z.string(),
  email: z.string(),
  telefono: z.string(),
  contrasena: z.string(),
});

const esquemaPrealerta = z.object({
  clienteId: z.string().optional(),
  trackings: z.array(z.string()).min(1),
  tienda: z.string().default(''),
  valorDeclaradoUsd: z.coerce.number().optional(),
  valoresUsd: z.array(z.coerce.number()).optional(),
  modalidad: z.enum(['M1', 'M2']).optional(),
  transportista: z.enum(['MRW', 'ZOOM']).optional(),
});

const esquemaConsolidado = z.object({
  clienteId: z.string().optional(),
  paqueteIds: z.array(z.string()).min(1),
  modalidad: z.enum(['M1', 'M2']),
  transportista: z.enum(['MRW', 'ZOOM']),
  valorDeclaradoUsd: z.coerce.number().optional(),
  pesoKg: z.coerce.number().optional(),
});

const esquemaEntrega = z.object({
  nombre: z.string(),
  cedula: z.string(),
  telefono: z.string(),
  agencia: z.string(),
  ciudad: z.string(),
  estado: z.string(),
});

export function crearApp(contexto: Contexto): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES_IMAGEN, files: 1 } });
  const limiteAuth = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
  const limitePublico = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

  const exigirSesion: RequestHandler = (req, _res, next) => {
    const token = (req as Request).cookies?.[COOKIE] as string | undefined;
    if (!token) return next(AppError.unauthorized());
    contexto.auth
      .verificarToken(token)
      .then((usuario) => {
        (req as PeticionAutenticada).usuario = usuario;
        next();
      })
      .catch(next);
  };

  const exigirRol = (...roles: Rol[]): RequestHandler => (req, _res, next) => {
    const usuario = (req as PeticionAutenticada).usuario;
    if (!usuario || !roles.includes(usuario.rol)) return next(AppError.forbidden());
    next();
  };

  const personal = [exigirSesion, exigirRol('OPERADOR', 'ADMIN')];
  const admin = [exigirSesion, exigirRol('ADMIN')];

  const fijarCookie = (res: Response, token: string): void => {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: contexto.produccion,
      maxAge: SIETE_DIAS_MS,
      path: '/',
    });
  };

  const rutaTx = (manejador: Manejador): RequestHandler => rutaEnTransaccion(contexto, manejador);

  const api = express.Router();

  api.get('/salud', (_req, res) => {
    res.json({ ok: true });
  });

  api.get('/publico/info', limitePublico, ruta(async (_req, res) => res.json(await contexto.publico.informacion())));

  api.post(
    '/publico/calculadora',
    limitePublico,
    ruta(async (req, res) => {
      const cuerpo = z.object({ pesoKg: z.coerce.number(), valorDeclaradoUsd: z.coerce.number().default(0) }).parse(req.body);
      res.json(await contexto.publico.cotizar(cuerpo.pesoKg, cuerpo.valorDeclaradoUsd));
    }),
  );

  api.post(
    '/auth/registro',
    limiteAuth,
    ruta(async (req, res) => {
      const sesion = await contexto.auth.registrarCliente(esquemaRegistro.parse(req.body));
      fijarCookie(res, sesion.token);
      res.status(201).json({ usuario: sesion.usuario });
    }),
  );

  api.post(
    '/auth/login',
    limiteAuth,
    ruta(async (req, res) => {
      const { identificador, contrasena } = z.object({ identificador: z.string(), contrasena: z.string() }).parse(req.body);
      const sesion = await contexto.auth.iniciarSesion(identificador, contrasena);
      fijarCookie(res, sesion.token);
      res.json({ usuario: sesion.usuario });
    }),
  );

  api.post(
    '/auth/olvide-clave',
    limiteAuth,
    ruta(async (req, res) => {
      const { email } = z.object({ email: z.string() }).parse(req.body);
      await contexto.recuperacion.solicitarCodigo(email);
      res.json({ ok: true });
    }),
  );

  api.post(
    '/auth/restablecer-clave',
    limiteAuth,
    ruta(async (req, res) => {
      const { email, codigo, nueva } = z.object({ email: z.string(), codigo: z.string(), nueva: z.string() }).parse(req.body);
      await contexto.recuperacion.restablecer(email, codigo, nueva);
      res.json({ ok: true });
    }),
  );

  api.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  api.get('/auth/yo', exigirSesion, ruta(async (req, res) => res.json({ usuario: contexto.auth.aPublico(req.usuario!) })));

  api.post(
    '/auth/cambiar-clave',
    exigirSesion,
    limiteAuth,
    ruta(async (req, res) => {
      const { actual, nueva } = z.object({ actual: z.string(), nueva: z.string() }).parse(req.body);
      const sesion = await contexto.auth.cambiarContrasena(req.usuario!.id, actual, nueva);
      fijarCookie(res, sesion.token);
      res.json({ ok: true });
    }),
  );

  const soloCliente = [exigirSesion, exigirRol('CLIENTE', 'OPERADOR', 'ADMIN')];

  api.get('/perfil', ...soloCliente, ruta(async (req, res) => res.json(await contexto.perfil.obtener(req.usuario!.id))));

  api.put(
    '/perfil/datos',
    ...soloCliente,
    limiteAuth,
    rutaTx(async (req, res) => {
      const cambios = z
        .object({
          nombre: z.string().optional(),
          email: z.string().optional(),
          telefono: z.string().optional(),
          contrasenaActual: z.string().optional(),
          contrasenaNueva: z.string().optional(),
        })
        .parse(req.body);
      const resultado = await contexto.perfil.actualizarDatos(req.usuario!.id, cambios);
      if (resultado.token) fijarCookie(res, resultado.token);
      res.json(resultado.perfil);
    }),
  );

  api.put(
    '/perfil/entrega',
    ...soloCliente,
    rutaTx(async (req, res) => {
      const destino = z.object({ agencia: z.string().optional(), ciudad: z.string().optional(), estado: z.string().optional() }).nullable().optional();
      const entrada = z
        .object({
          receptor: z.object({ nombre: z.string().optional(), cedula: z.string().optional(), telefono: z.string().optional() }).nullable().optional(),
          MRW: destino,
          ZOOM: destino,
        })
        .parse(req.body);
      res.json(await contexto.perfil.guardarEntrega(req.usuario!.id, entrada));
    }),
  );

  api.post('/envios/:id/recibido', exigirSesion, rutaTx(async (req, res) => res.json({ envio: await contexto.envios.confirmarRecibido(actorDe(req), req.params.id!) })));
  api.post('/envios/:id/entrega/perfil', exigirSesion, rutaTx(async (req, res) => res.json({ envio: await contexto.envios.actualizarEntregaConPerfil(actorDe(req), req.params.id!) })));

  api.get(
    '/envios',
    exigirSesion,
    ruta(async (req, res) => {
      const estado = ESTADOS_ENVIO.find((e) => e === req.query.estado);
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      res.json({ envios: await contexto.envios.listar(actorDe(req), { estado, q }) });
    }),
  );

  api.post(
    '/envios',
    exigirSesion,
    rutaTx(async (req, res) => {
      const datos = esquemaPrealerta.parse(req.body);
      res.status(201).json({ envio: await contexto.envios.crearPrealerta(actorDe(req), datos) });
    }),
  );

  api.get('/envios/:id', exigirSesion, ruta(async (req, res) => res.json({ envio: await contexto.envios.detalle(actorDe(req), req.params.id!) })));

  api.patch(
    '/envios/:id',
    exigirSesion,
    rutaTx(async (req, res) => {
      const cambios = z
        .object({
          modalidad: z.enum(['M1', 'M2']).optional(),
          transportista: z.enum(['MRW', 'ZOOM']).optional(),
          valorDeclaradoUsd: z.coerce.number().optional(),
          tienda: z.string().optional(),
        })
        .parse(req.body);
      res.json({ envio: await contexto.envios.editarDatos(actorDe(req), req.params.id!, cambios) });
    }),
  );

  api.post('/envios/consolidar', exigirSesion, rutaTx(async (req, res) => res.status(201).json({ envio: await contexto.envios.crearConsolidado(actorDe(req), esquemaConsolidado.parse(req.body)) })));
  api.post('/envios/:id/deshacer', exigirSesion, rutaTx(async (req, res) => res.json({ envio: await contexto.envios.desarmar(actorDe(req), req.params.id!, z.object({ motivo: z.string().optional() }).parse(req.body ?? {}).motivo) })));
  api.post('/paquetes/:id/eliminar-alerta', exigirSesion, rutaTx(async (req, res) => res.json({ envio: await contexto.envios.eliminarAlertaPendiente(actorDe(req), req.params.id!) })));

  api.put(
    '/envios/:id/entrega',
    exigirSesion,
    rutaTx(async (req, res) => res.json({ envio: await contexto.envios.guardarEntrega(actorDe(req), req.params.id!, esquemaEntrega.parse(req.body)) })),
  );

  api.get('/envios/:id/pago', exigirSesion, ruta(async (req, res) => res.json(await contexto.pagos.informacionParaPagar(actorDe(req), req.params.id!))));

  api.post(
    '/envios/:id/pagos',
    exigirSesion,
    subida.single('archivo'),
    rutaTx(async (req, res) => {
      const cuerpo = z
        .object({ metodo: z.enum(['BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA']), moneda: z.enum(['USD', 'BS']), monto: z.string(), referencia: z.string() })
        .parse(req.body);
      const envio = await contexto.pagos.subirComprobante(actorDe(req), req.params.id!, {
        metodo: cuerpo.metodo,
        moneda: cuerpo.moneda,
        monto: numero(cuerpo.monto),
        referencia: cuerpo.referencia,
        archivo: archivoDe(req),
      });
      res.status(201).json({ envio });
    }),
  );

  api.get(
    '/archivos/:carpeta/:envioId/:nombre',
    exigirSesion,
    ruta(async (req, res) => {
      const rutaCompleta = `${req.params.carpeta}/${req.params.envioId}/${req.params.nombre}`;
      const acceso = await contexto.envios.verArchivo(actorDe(req), rutaCompleta);
      res.setHeader('Cache-Control', 'private, no-store');
      if (acceso.url) return res.redirect(302, acceso.url);
      res.setHeader('Content-Type', acceso.mime ?? 'application/octet-stream');
      return res.send(acceso.buffer);
    }),
  );

  const staff = express.Router();
  staff.use(personal);

  staff.get('/resumen', ruta(async (req, res) => res.json(await contexto.envios.resumen(actorDe(req)))));
  staff.post('/escaneo', rutaTx(async (req, res) => res.json(await contexto.envios.escanear(actorDe(req), z.object({ texto: z.string() }).parse(req.body).texto))));
  staff.post(
    '/sin-prealerta',
    rutaTx(async (req, res) => {
      const c = z.object({ texto: z.string(), clienteId: z.string().optional() }).parse(req.body);
      res.status(201).json({ envio: await contexto.envios.registrarSinPrealerta(actorDe(req), c.texto, c.clienteId) });
    }),
  );
  const esquemaLista = z.object({
    estado: z.enum([...ESTADOS_ENVIO, 'ACTIVOS', 'TODOS'] as const).optional(),
    q: z.string().max(120).optional(),
    orden: z.enum(['RECIENTE', 'ANTIGUO', 'MONTO']).optional(),
    pagina: z.coerce.number().int().min(1).optional(),
    porPagina: z.coerce.number().int().min(10).max(100).optional(),
  });
  const filtroBodegaDe = (req: Request): FiltroBodega => {
    const minDias = Number(req.query.minDias);
    return {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      sinDueno: req.query.sinDueno === '1',
      sinAvisar: req.query.sinAvisar === '1',
      minDias: Number.isFinite(minDias) && minDias > 0 ? Math.trunc(minDias) : undefined,
    };
  };
  const enviarCsv = (res: Response, nombre: string, contenido: string) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(contenido);
  };

  staff.get('/envios/lista', ruta(async (req, res) => res.json(await contexto.envios.listarPagina(actorDe(req), esquemaLista.parse(req.query)))));
  staff.get('/envios/exportar.csv', ruta(async (req, res) => enviarCsv(res, 'envios', await contexto.envios.exportarEnviosCsv(actorDe(req), esquemaLista.parse(req.query)))));
  staff.post('/envios/despachar-lote', rutaTx(async (req, res) => {
    const c = z.object({ items: z.array(z.object({ envioId: z.string(), guia: z.string().max(60) })).min(1).max(50) }).parse(req.body);
    res.json(await contexto.envios.despacharLote(actorDe(req), c.items));
  }));
  staff.post('/paquetes/avisados-lote', rutaTx(async (req, res) => res.json(await contexto.envios.marcarAvisadosLote(actorDe(req), z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body).ids))));
  staff.post('/paquetes/asignar-lote', rutaTx(async (req, res) => {
    const c = z.object({ ids: z.array(z.string()).min(1).max(100), clienteId: z.string().nullable(), motivo: z.string().optional() }).parse(req.body);
    res.json(await contexto.envios.asignarLote(actorDe(req), c.ids, c.clienteId, c.motivo));
  }));
  staff.get('/bodega/exportar.csv', ruta(async (req, res) => enviarCsv(res, 'bodega', await contexto.envios.exportarBodegaCsv(actorDe(req), filtroBodegaDe(req)))));
  staff.get(
    '/bodega',
    ruta(async (req, res) => {
      res.json({ paquetes: await contexto.envios.bodega(actorDe(req), filtroBodegaDe(req)) });
    }),
  );
  staff.post(
    '/paquetes/:id/asignar',
    rutaTx(async (req, res) => {
      const c = z.object({ clienteId: z.string().nullable(), motivo: z.string().optional() }).parse(req.body);
      res.json({ envio: await contexto.envios.asignarPaquete(actorDe(req), req.params.id!, c.clienteId, c.motivo) });
    }),
  );
  staff.post('/paquetes/:id/descartar', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.descartarPaquete(actorDe(req), req.params.id!, z.object({ motivo: z.string() }).parse(req.body).motivo) })));
  staff.post('/envios/:id/cotizar', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.cotizar(actorDe(req), req.params.id!, numero(req.body?.pesoKg)) })));
  staff.post('/envios/:id/paquetes', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.agregarAlConsolidado(actorDe(req), req.params.id!, z.object({ paqueteIds: z.array(z.string()).min(1) }).parse(req.body).paqueteIds) })));
  staff.patch('/paquetes/:id/valor', rutaTx(async (req, res) => {
    const { valorUsd, motivo } = z.object({ valorUsd: z.coerce.number(), motivo: z.string() }).parse(req.body);
    res.json({ envio: await contexto.envios.editarValorPaquete(actorDe(req), req.params.id!, valorUsd, motivo) });
  }));
  staff.patch('/envios/:id/seguro', rutaTx(async (req, res) => {
    const { seguroUsd, motivo } = z.object({ seguroUsd: z.coerce.number().nullable(), motivo: z.string().default('') }).parse(req.body);
    res.json({ envio: await contexto.envios.editarSeguro(actorDe(req), req.params.id!, req.body?.seguroUsd === null ? null : seguroUsd, motivo) });
  }));
  staff.post('/envios/:id/quitar-paquete', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.quitarDelConsolidado(actorDe(req), req.params.id!, z.object({ paqueteId: z.string() }).parse(req.body).paqueteId) })));
  staff.post('/paquetes/:id/peso', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.registrarPeso(actorDe(req), req.params.id!, numero(req.body?.pesoKg)) })));
  staff.post('/paquetes/:id/foto', subida.single('archivo'), rutaTx(async (req, res) => res.json({ envio: await contexto.envios.registrarFotoPaquete(actorDe(req), req.params.id!, archivoDe(req)) })));
  staff.post('/paquetes/:id/avisado', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.marcarAvisado(actorDe(req), req.params.id!) })));
  staff.get('/envios/:id/historial', ruta(async (req, res) => res.json({ eventos: await contexto.envios.historial(actorDe(req), req.params.id!) })));

  staff.get(
    '/envios/:id/mensaje/:tipo',
    ruta(async (req, res) => {
      const tipo = TIPOS_MENSAJE.find((t) => t === req.params.tipo) as TipoMensaje | undefined;
      if (!tipo) throw AppError.notFound('Ese mensaje no existe.');
      const paqueteId = typeof req.query.paqueteId === 'string' ? req.query.paqueteId : undefined;
      const motivo = typeof req.query.motivo === 'string' ? req.query.motivo : undefined;
      res.json(await contexto.mensajes.generar(actorDe(req), req.params.id!, tipo, { paqueteId, motivo }));
    }),
  );

  staff.post(
    '/envios/:id/pago-manual',
    rutaTx(async (req, res) => {
      const c = z.object({ metodo: z.enum(['BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'MANUAL']), moneda: z.enum(['USD', 'BS']), monto: z.coerce.number(), referencia: z.string().optional() }).parse(req.body);
      res.status(201).json({ envio: await contexto.pagos.registrarManual(actorDe(req), req.params.id!, c) });
    }),
  );
  staff.get('/pagos/pendientes', ruta(async (req, res) => res.json({ pagos: await contexto.pagos.listaDeRevision(actorDe(req)) })));
  staff.post('/pagos/confirmar-lote', rutaTx(async (req, res) => res.json(await contexto.pagos.confirmarLote(actorDe(req), z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body).ids))));
  staff.post('/pagos/:id/confirmar', rutaTx(async (req, res) => res.json({ envio: await contexto.pagos.confirmar(actorDe(req), req.params.id!) })));
  staff.post('/pagos/:id/rechazar', rutaTx(async (req, res) => res.json({ envio: await contexto.pagos.rechazar(actorDe(req), req.params.id!, z.object({ motivo: z.string() }).parse(req.body).motivo) })));

  staff.post(
    '/envios/:id/despachar',
    subida.single('archivo'),
    rutaTx(async (req, res) => {
      const { guia } = z.object({ guia: z.string().optional() }).parse(req.body);
      res.json({ envio: await contexto.envios.despachar(actorDe(req), req.params.id!, guia, archivoDe(req)) });
    }),
  );
  staff.post('/envios/:id/cerrar', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.cerrar(actorDe(req), req.params.id!) })));
  staff.post('/envios/:id/cancelar', rutaTx(async (req, res) => res.json({ envio: await contexto.envios.cancelar(actorDe(req), req.params.id!, z.object({ motivo: z.string() }).parse(req.body).motivo) })));

  staff.get('/clientes', ruta(async (req, res) => res.json({ clientes: await contexto.auth.buscarClientes(typeof req.query.q === 'string' ? req.query.q : '') })));
  api.use('/staff', staff);

  const administracion = express.Router();
  administracion.use(admin);

  administracion.get('/config/:clave', ruta(async (req, res) => {
    const clave = req.params.clave!;
    if (!contexto.config.esClaveValida(clave)) throw AppError.notFound('Esa configuración no existe.');
    res.json({ valor: await contexto.config.obtener(clave) });
  }));
  administracion.put('/config/:clave', rutaTx(async (req, res) => {
    await contexto.config.guardar(req.params.clave!, req.body?.valor, actorDe(req).id);
    res.json({ ok: true });
  }));
  administracion.put('/tasa', rutaTx(async (req, res) => res.json({ tasa: await contexto.tasas.cargarManual(numero(req.body?.bolivaresPorUsd), actorDe(req).id) })));
  administracion.get('/tasa', ruta(async (_req, res) => res.json({ tasa: await contexto.tasas.vigente() })));
  administracion.get('/usuarios', ruta(async (_req, res) => res.json({ usuarios: await contexto.auth.listar(['OPERADOR', 'ADMIN']) })));
  administracion.get('/estadisticas/usuarios', ruta(async (_req, res) => res.json(await contexto.auth.estadisticasUsuarios())));
  administracion.post('/usuarios', rutaTx(async (req, res) => {
    const c = esquemaRegistro.extend({ rol: z.enum(['OPERADOR', 'ADMIN']) }).parse(req.body);
    res.status(201).json({ usuario: await contexto.auth.crearPersonal(c, actorDe(req).id) });
  }));
  administracion.patch('/usuarios/:id', rutaTx(async (req, res) => {
    const c = z.object({ activo: z.boolean() }).parse(req.body);
    res.json({ usuario: await contexto.auth.cambiarEstadoActivo(req.params.id!, c.activo, actorDe(req).id) });
  }));
  administracion.put('/usuarios/:id/rol', rutaTx(async (req, res) => {
    const c = z.object({ rol: z.enum(['CLIENTE', 'OPERADOR']) }).parse(req.body);
    res.json({ usuario: await contexto.auth.cambiarRol(req.params.id!, c.rol, actorDe(req).id) });
  }));
  administracion.put('/clientes/:id/cedula', rutaTx(async (req, res) => {
    const { cedula, motivo } = z.object({ cedula: z.string(), motivo: z.string() }).parse(req.body);
    res.json({ cliente: await contexto.perfil.corregirCedula(actorDe(req), req.params.id!, cedula, motivo) });
  }));
  administracion.get('/clientes/:id/historial', ruta(async (req, res) => res.json({ eventos: await contexto.perfil.historial(actorDe(req), req.params.id!) })));
  administracion.post('/envios/:id/ajuste', rutaTx(async (req, res) => {
    const c = z.object({ pesoTotalKg: z.coerce.number().optional(), valorDeclaradoUsd: z.coerce.number().optional(), totalUsd: z.coerce.number().optional(), motivo: z.string() }).parse(req.body);
    res.json({ envio: await contexto.envios.ajusteAdmin(actorDe(req), req.params.id!, c) });
  }));

  api.use('/admin', administracion);

  app.use('/api', api);

  app.use((_req, _res, next) => next(AppError.notFound('Ruta no encontrada.')));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      return res.status(error.status).json({ error: { mensaje: error.message, codigo: error.code, datos: error.datos } });
    }
    if (error instanceof ZodError) {
      return res.status(400).json({ error: { mensaje: 'Revisa los datos enviados.', codigo: 'DATOS_INVALIDOS' } });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: { mensaje: 'La imagen es demasiado grande (máximo 3 MB).', codigo: 'ARCHIVO_INVALIDO' } });
    }
    logger.error('Error no controlado', { mensaje: error instanceof Error ? error.message : 'desconocido' });
    return res.status(500).json({ error: { mensaje: 'Algo salió mal. Intenta de nuevo.', codigo: 'ERROR_INTERNO' } });
  });

  return app;
}

export { esPersonal };
