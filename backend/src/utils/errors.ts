export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = 'ERROR',
    public readonly datos?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, code = 'SOLICITUD_INVALIDA', datos?: Record<string, unknown>): AppError {
    return new AppError(message, 400, code, datos);
  }

  static unauthorized(message = 'Debes iniciar sesión.'): AppError {
    return new AppError(message, 401, 'NO_AUTENTICADO');
  }

  static forbidden(message = 'No tienes permiso para esto.'): AppError {
    return new AppError(message, 403, 'SIN_PERMISO');
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404, 'NO_ENCONTRADO');
  }

  static conflict(message: string, datos?: Record<string, unknown>): AppError {
    return new AppError(message, 409, 'CONFLICTO', datos);
  }

  static tooMany(message = 'Demasiados intentos. Espera unos minutos.'): AppError {
    return new AppError(message, 429, 'DEMASIADOS_INTENTOS');
  }
}
