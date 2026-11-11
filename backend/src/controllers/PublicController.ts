import type { NextFunction, Request, Response } from 'express';
import type { TarifaRepository } from '../repositories/TarifaRepository';
import { BaseController } from './BaseController';

export class PublicController extends BaseController {
  constructor(private readonly tarifas: TarifaRepository) {
    super();
  }

  listarTarifas = (_req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const tarifas = await this.tarifas.listarActivas();
      res.json({
        tarifas: tarifas.map((tarifa) => ({
          id: tarifa.id,
          nombre: tarifa.nombre,
          pesoHasta: tarifa.pesoHasta,
          precio: tarifa.precio,
          precioKgExcedente: tarifa.precioKgExcedente,
        })),
      });
    });
}
