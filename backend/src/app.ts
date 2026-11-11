import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { UPLOAD_PATH } from './middleware/upload';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiters';
import { ApiRouter } from './routes';
import { UserRepository } from './repositories/UserRepository';
import { CasilleroRepository } from './repositories/CasilleroRepository';
import { PrealertaRepository } from './repositories/PrealertaRepository';
import { PaqueteRepository } from './repositories/PaqueteRepository';
import { NotificacionRepository } from './repositories/NotificacionRepository';
import { TarifaRepository } from './repositories/TarifaRepository';
import { AuthService } from './services/AuthService';
import { QuoteService } from './services/QuoteService';
import { WhatsAppService } from './services/WhatsAppService';
import { PackageService } from './services/PackageService';
import { AuthController } from './controllers/AuthController';
import { PackageController } from './controllers/PackageController';
import { PublicController } from './controllers/PublicController';
import { AuthGuard } from './middleware/AuthGuard';
import { logger } from './utils/logger';

export class Application {
  public readonly app: Express;

  constructor() {
    const app = express();
    this.app = app;

    if (env.isProduction) app.set('trust proxy', 1);
    app.disable('x-powered-by');

    const origenesPermitidos = env.FRONTEND_URL.split(',').map((origen) => origen.trim());
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || origenesPermitidos.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error('Origen no permitido por CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    );

    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
      }),
    );
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(cookieParser());

    app.use((req, res, next) => {
      const inicio = Date.now();
      res.on('finish', () => {
        logger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - inicio}ms`);
      });
      next();
    });

    // Dependencias (composición manual, sin contenedores mágicos)
    const usuarios = new UserRepository();
    const casilleros = new CasilleroRepository();
    const prealertas = new PrealertaRepository();
    const paquetes = new PaqueteRepository();
    const notificaciones = new NotificacionRepository();
    const tarifas = new TarifaRepository();

    const authService = new AuthService(usuarios, casilleros);
    const quoteService = new QuoteService(tarifas);
    const whatsappService = new WhatsAppService(notificaciones);
    const packageService = new PackageService(
      paquetes,
      prealertas,
      usuarios,
      notificaciones,
      quoteService,
      whatsappService,
    );

    const authController = new AuthController(authService);
    const packageController = new PackageController(packageService);
    const publicController = new PublicController(tarifas);
    const guard = new AuthGuard(authService);

    const apiRouter = new ApiRouter({
      authController,
      packageController,
      publicController,
      guard,
    }).build();

    app.use('/uploads', express.static(UPLOAD_PATH, { maxAge: '7d', fallthrough: true }));
    app.use('/api', apiLimiter, apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
  }
}
