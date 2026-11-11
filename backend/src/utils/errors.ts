export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'SOLICITUD_INVALIDA', message, details);
  }

  static unauthorized(message = 'Debes iniciar sesión.'): AppError {
    return new AppError(401, 'NO_AUTENTICADO', message);
  }

  static forbidden(message = 'No tienes permisos para esta acción.'): AppError {
    return new AppError(403, 'SIN_PERMISO', message);
  }

  static notFound(message = 'Recurso no encontrado.'): AppError {
    return new AppError(404, 'NO_ENCONTRADO', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICTO', message);
  }

  static tooMany(message = 'Demasiadas solicitudes. Intenta de nuevo más tarde.'): AppError {
    return new AppError(429, 'LIMITE_EXCEDIDO', message);
  }

  static internal(message = 'Ocurrió un error inesperado.'): AppError {
    return new AppError(500, 'ERROR_INTERNO', message);
  }
}
