import { Router } from 'express';
import { apiLimiter, authLimiter, trackingLimiter } from '../middleware/rateLimiters';
import { upload } from '../middleware/upload';
import type { AuthController } from '../controllers/AuthController';
import type { PackageController } from '../controllers/PackageController';
import type { PublicController } from '../controllers/PublicController';
import type { AuthGuard } from '../middleware/AuthGuard';

export interface RouterDependencies {
  authController: AuthController;
  packageController: PackageController;
  publicController: PublicController;
  guard: AuthGuard;
}

export class ApiRouter {
  constructor(private readonly deps: RouterDependencies) {}

  build(): Router {
    const router = Router();
    const { authController, packageController, publicController, guard } = this.deps;

    router.get('/health', (_req, res) => {
      res.json({ estado: 'ok', servicio: 'venvios-api', hora: new Date().toISOString() });
    });

    // Público
    router.get('/tarifas', trackingLimiter, publicController.listarTarifas);
    router.get('/rastreo/:guia', trackingLimiter, packageController.rastrear);

    // Autenticación
    router.post('/auth/registro', authLimiter, authController.registrar);
    router.post('/auth/login', authLimiter, authController.iniciarSesion);

    // A partir de aquí se exige sesión
    router.use(guard.autenticar);

    router.get('/auth/me', authController.perfil);
    router.post('/auth/logout', authController.cerrarSesion);

    // Cliente
    router.get('/paquetes', packageController.listarMios);
    router.get('/prealertas', packageController.listarPrealertas);
    router.post('/prealertas', packageController.crearPrealerta);
    router.get('/notificaciones', packageController.listarNotificaciones);

    // Administración
    router.get('/admin/resumen', guard.autorizar('ADMIN'), packageController.resumen);
    router.get('/admin/paquetes', guard.autorizar('ADMIN'), packageController.listarAdmin);
    router.get('/admin/paquetes/buscar', guard.autorizar('ADMIN'), packageController.buscarAdmin);
    router.post('/admin/paquetes', guard.autorizar('ADMIN'), packageController.crear);
    router.patch(
      '/admin/paquetes/:id/estado',
      guard.autorizar('ADMIN'),
      packageController.cambiarEstado,
    );
    router.post(
      '/admin/paquetes/:id/foto',
      guard.autorizar('ADMIN'),
      apiLimiter,
      upload.single('foto'),
      packageController.subirFoto,
    );
    router.get(
      '/admin/prealertas',
      guard.autorizar('ADMIN'),
      packageController.listarPrealertasAdmin,
    );
    router.get(
      '/admin/clientes/buscar',
      guard.autorizar('ADMIN'),
      packageController.buscarCliente,
    );

    return router;
  }
}
