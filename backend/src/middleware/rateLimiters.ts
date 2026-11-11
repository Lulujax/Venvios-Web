import rateLimit from 'express-rate-limit';

const respuesta = {
  error: {
    codigo: 'LIMITE_EXCEDIDO',
    mensaje: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  },
};

/** Límite general de la API. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: respuesta,
});

/** Protección reforzada para credenciales y registro. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      codigo: 'LIMITE_EXCEDIDO',
      mensaje: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.',
    },
  },
});

/** Búsqueda pública de guías. */
export const trackingLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: respuesta,
});
