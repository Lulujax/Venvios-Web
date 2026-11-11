import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { ESTADOS_PAQUETE, type EstadoPaqueteValue } from '../domain/estados';
import type { PackageService } from '../services/PackageService';
import { guiaSchema, texto } from '../utils/sanitize';
import { AppError } from '../utils/errors';
import { BaseController } from './BaseController';

const crearPaqueteSchema = z
  .object({
    prealertaId: z.string().min(10).optional(),
    casilleroCodigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^VEX-CUC-[A-Z0-9]{4}$/, 'El casillero debe tener el formato VEX-CUC-XXXX.')
      .optional(),
    descripcion: texto(3, 200),
    pesoKg: z.coerce.number().positive('El peso debe ser mayor que cero.').max(500),
    largoCm: z.coerce.number().positive().max(300).optional(),
    anchoCm: z.coerce.number().positive().max(300).optional(),
    altoCm: z.coerce.number().positive().max(300).optional(),
    observaciones: texto(0, 500).optional(),
  })
  .refine((data) => Boolean(data.prealertaId || data.casilleroCodigo), {
    message: 'Indica una prealerta o el casillero del cliente.',
    path: ['casilleroCodigo'],
  })
  .refine((data) => {
    const dims = [data.largoCm, data.anchoCm, data.altoCm];
    return dims.every((value) => value === undefined) || dims.every((value) => value !== undefined);
  }, { message: 'Si registras dimensiones, envía largo, ancho y alto.', path: ['largoCm'] });

const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_PAQUETE),
  nota: texto(0, 300).optional(),
});

const nuevaPrealertaSchema = z.object({
  tienda: texto(2, 80),
  descripcion: texto(3, 200),
  trackingTienda: texto(0, 60).optional(),
  valorDeclarado: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
});

const filtrosAdminSchema = z.object({
  estado: z.enum(ESTADOS_PAQUETE).optional(),
  q: texto(0, 80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

const prealertasQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'RECIBIDA', 'CANCELADA']).optional(),
});

const casilleroQuerySchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^VEX-CUC-[A-Z0-9]{4}$/, 'El casillero debe tener el formato VEX-CUC-XXXX.'),
});

export class PackageController extends BaseController {
  constructor(private readonly packages: PackageService) {
    super();
  }

  // ---------- Cliente ----------

  listarMios = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const paquetes = await this.packages.listarCliente(req.user.id);
      res.json({ paquetes });
    });

  crearPrealerta = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const data = nuevaPrealertaSchema.parse(req.body);
      const prealerta = await this.packages.crearPrealerta(req.user.id, {
        ...data,
        trackingTienda: data.trackingTienda || null,
        valorDeclarado: data.valorDeclarado ?? null,
      });
      res.status(201).json({ prealerta });
    });

  listarPrealertas = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const prealertas = await this.packages.listarPrealertasCliente(req.user.id);
      res.json({ prealertas });
    });

  listarNotificaciones = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const notificaciones = await this.packages.listarNotificaciones(req.user.id);
      res.json({ notificaciones });
    });

  // ---------- Público ----------

  rastrear = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const guia = guiaSchema.parse(req.params.guia);
      const paquete = await this.packages.rastrear(guia);
      res.json({ paquete });
    });

  // ---------- Administración ----------

  listarAdmin = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const filtros = filtrosAdminSchema.parse(req.query);
      const resultado = await this.packages.listarAdmin({
        estado: filtros.estado as EstadoPaqueteValue | undefined,
        q: filtros.q || undefined,
        pagina: filtros.pagina,
        porPagina: filtros.porPagina,
      });
      res.json(resultado);
    });

  buscarAdmin = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const guia = guiaSchema.parse(req.query.guia ?? '');
      const paquete = await this.packages.buscarAdminPorGuia(guia);
      res.json({ paquete });
    });

  crear = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const data = crearPaqueteSchema.parse(req.body);
      const paquete = await this.packages.registrarIngreso(
        {
          prealertaId: data.prealertaId,
          casilleroCodigo: data.casilleroCodigo,
          descripcion: data.descripcion,
          pesoKg: data.pesoKg,
          largoCm: data.largoCm ?? null,
          anchoCm: data.anchoCm ?? null,
          altoCm: data.altoCm ?? null,
          observaciones: data.observaciones || null,
        },
        req.user.id,
      );
      res.status(201).json({ paquete });
    });

  cambiarEstado = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const data = cambiarEstadoSchema.parse(req.body);
      const paquete = await this.packages.cambiarEstado(
        req.params.id,
        data.estado,
        data.nota,
        req.user.id,
      );
      res.json({ paquete });
    });

  subirFoto = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.file) throw AppError.badRequest('Adjunta una imagen en el campo "foto".');
      const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '');
      const fotoUrl = `${baseUrl}/uploads/${req.file.filename}`;
      const paquete = await this.packages.registrarFoto(req.params.id, fotoUrl);
      res.status(201).json({ paquete });
    });

  listarPrealertasAdmin = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const { estado } = prealertasQuerySchema.parse(req.query);
      const prealertas = await this.packages.listarPrealertasAdmin(estado);
      res.json({ prealertas });
    });

  buscarCliente = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const { codigo } = casilleroQuerySchema.parse(req.query);
      const cliente = await this.packages.buscarClientePorCasillero(codigo);
      res.json({ cliente });
    });

  resumen = (_req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const resumen = await this.packages.resumenAdmin();
      res.json({ resumen });
    });
}
