import type { NextFunction } from 'express';

/** Envuelve acciones asíncronas y delega errores al middleware central. */
export abstract class BaseController {
  protected async run(next: NextFunction, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      next(error);
    }
  }
}
