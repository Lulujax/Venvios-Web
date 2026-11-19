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
import { esPersonal, type Actor } from '../services/EnvioService';
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

function actorDe(req: PeticionAutenticada): Actor {
  if (!req.usuario) throw AppError.unauthorized();
  return { id: req.usuario.id, rol: req.usuario.rol };
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
  telefono: z.string(),
  contrasena: z.string(),
});

const esquemaPrealerta = z.object({
  clienteId: z.string().optional(),
  trackings: z.array(z.string()).min(1),
  tienda: z.string().default(''),
  valorDeclaradoUsd: z.coerce.number(),
  modalidad: z.enum(['M1', 'M2']),
  transportista: z.enum(['MRW', 'ZOOM']),
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
      const { telefono, contrasena } = z.object({ telefono: z.string(), contrasena: z.string() }).parse(req.body);
      const sesion = await contexto.auth.iniciarSesion(telefono, contrasena);
      fijarCookie(res, sesion.token);
      res.json({ usuario: sesion.usuario });
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
      await contexto.auth.cambiarContrasena(req.usuario!.id, actual, nueva);
      res.json({ ok: true });
    }),
  );

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
    ruta(async (req, res) => {
      const datos = esquemaPrealerta.parse(req.body);
      res.status(201).json({ envio: await contexto.envios.crearPrealerta(actorDe(req), datos) });
    }),
  );

  api.get('/envios/:id', exigirSesion, ruta(async (req, res) => res.json({ envio: await contexto.envios.detalle(actorDe(req), req.params.id!) })));

  api.patch(
    '/envios/:id',
    exigirSesion,
    ruta(async (req, res) => {
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

  api.post('/envios/:id/cerrar-recepcion', exigirSesion, ruta(async (req, res) => res.json({ envio: await contexto.envios.cerrarRecepcion(actorDe(req), req.params.id!) })));

  api.put(
    '/envios/:id/entrega',
    exigirSesion,
    ruta(async (req, res) => res.json({ envio: await contexto.envios.guardarEntrega(actorDe(req), req.params.id!, esquemaEntrega.parse(req.body)) })),
  );

  api.get('/envios/:id/pago', exigirSesion, ruta(async (req, res) => res.json(await contexto.pagos.informacionParaPagar(actorDe(req), req.params.id!))));

  api.post(
    '/envios/:id/pagos',
    exigirSesion,
    subida.single('archivo'),
    ruta(async (req, res) => {
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
  staff.post('/escaneo', ruta(async (req, res) => res.json(await contexto.envios.escanear(actorDe(req), z.object({ texto: z.string() }).parse(req.body).texto))));
  staff.post('/sin-prealerta', ruta(async (req, res) => res.status(201).json({ envio: await contexto.envios.registrarSinPrealerta(actorDe(req), z.object({ texto: z.string() }).parse(req.body).texto) })));
  staff.post('/envios/:id/asignar-cliente', ruta(async (req, res) => res.json({ envio: await contexto.envios.asignarCliente(actorDe(req), req.params.id!, z.object({ clienteId: z.string() }).parse(req.body).clienteId) })));
  staff.post('/paquetes/:id/peso', ruta(async (req, res) => res.json({ envio: await contexto.envios.registrarPeso(actorDe(req), req.params.id!, numero(req.body?.pesoKg)) })));
  staff.post('/paquetes/:id/foto', subida.single('archivo'), ruta(async (req, res) => res.json({ envio: await contexto.envios.registrarFotoPaquete(actorDe(req), req.params.id!, archivoDe(req)) })));
  staff.post('/paquetes/:id/avisado', ruta(async (req, res) => res.json({ envio: await contexto.envios.marcarAvisado(actorDe(req), req.params.id!) })));
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
    ruta(async (req, res) => {
      const c = z.object({ metodo: z.enum(['BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'MANUAL']), moneda: z.enum(['USD', 'BS']), monto: z.coerce.number(), referencia: z.string().optional() }).parse(req.body);
      res.status(201).json({ envio: await contexto.pagos.registrarManual(actorDe(req), req.params.id!, c) });
    }),
  );
  staff.post('/pagos/:id/confirmar', ruta(async (req, res) => res.json({ envio: await contexto.pagos.confirmar(actorDe(req), req.params.id!) })));
  staff.post('/pagos/:id/rechazar', ruta(async (req, res) => res.json({ envio: await contexto.pagos.rechazar(actorDe(req), req.params.id!, z.object({ motivo: z.string() }).parse(req.body).motivo) })));

  staff.post(
    '/envios/:id/despachar',
    subida.single('archivo'),
    ruta(async (req, res) => {
      const { guia } = z.object({ guia: z.string() }).parse(req.body);
      res.json({ envio: await contexto.envios.despachar(actorDe(req), req.params.id!, guia, archivoDe(req)) });
    }),
  );
  staff.post('/envios/:id/cerrar', ruta(async (req, res) => res.json({ envio: await contexto.envios.cerrar(actorDe(req), req.params.id!) })));
  staff.post('/envios/:id/cancelar', ruta(async (req, res) => res.json({ envio: await contexto.envios.cancelar(actorDe(req), req.params.id!, z.object({ motivo: z.string() }).parse(req.body).motivo) })));

  staff.get('/clientes', ruta(async (req, res) => res.json({ clientes: await contexto.auth.buscarClientes(typeof req.query.q === 'string' ? req.query.q : '') })));
  staff.post('/clientes/:id/clave-temporal', ruta(async (req, res) => res.json({ temporal: await contexto.auth.asignarTemporal(req.params.id!, actorDe(req).id) })));

  api.use('/staff', staff);

  const administracion = express.Router();
  administracion.use(admin);

  administracion.get('/config/:clave', ruta(async (req, res) => {
    const clave = req.params.clave!;
    if (!contexto.config.esClaveValida(clave)) throw AppError.notFound('Esa configuración no existe.');
    res.json({ valor: await contexto.config.obtener(clave) });
  }));
  administracion.put('/config/:clave', ruta(async (req, res) => {
    await contexto.config.guardar(req.params.clave!, req.body?.valor, actorDe(req).id);
    res.json({ ok: true });
  }));
  administracion.put('/tasa', ruta(async (req, res) => res.json({ tasa: await contexto.tasas.cargarManual(numero(req.body?.bolivaresPorUsd), actorDe(req).id) })));
  administracion.get('/tasa', ruta(async (_req, res) => res.json({ tasa: await contexto.tasas.vigente() })));
  administracion.get('/usuarios', ruta(async (_req, res) => res.json({ usuarios: await contexto.auth.listar(['OPERADOR', 'ADMIN']) })));
  administracion.post('/usuarios', ruta(async (req, res) => {
    const c = esquemaRegistro.extend({ rol: z.enum(['OPERADOR', 'ADMIN']) }).parse(req.body);
    res.status(201).json({ usuario: await contexto.auth.crearPersonal(c, actorDe(req).id) });
  }));
  administracion.patch('/usuarios/:id', ruta(async (req, res) => {
    const c = z.object({ activo: z.boolean() }).parse(req.body);
    res.json({ usuario: await contexto.auth.cambiarEstadoActivo(req.params.id!, c.activo, actorDe(req).id) });
  }));
  administracion.post('/envios/:id/ajuste', ruta(async (req, res) => {
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
