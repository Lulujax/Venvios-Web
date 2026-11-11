import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: `La ruta ${req.method} ${req.path} no existe.` },
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Revisa los datos enviados.',
        detalles: error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        codigo: error.code,
        mensaje: error.message,
        detalles: error.details,
      },
    });
    return;
  }

  if (error instanceof MulterError) {
    const mensaje =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el límite de 6 MB.'
        : 'No pudimos procesar el archivo.';
    res.status(400).json({ error: { codigo: 'ARCHIVO_INVALIDO', mensaje } });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con esos datos.' },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        error: { codigo: 'NO_ENCONTRADO', mensaje: 'El registro no existe.' },
      });
      return;
    }
    logger.error('Error de base de datos', { code: error.code, path: req.path });
    res.status(500).json({
      error: { codigo: 'ERROR_BASE_DATOS', mensaje: 'No pudimos completar la operación.' },
    });
    return;
  }

  logger.error('Error no controlado', {
    path: req.path,
    method: req.method,
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' },
  });
}
