import type { Server } from 'node:http';
import { Application } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';

class ServerBootstrap {
  private server: Server | null = null;
  private cerrando = false;

  start(): void {
    const application = new Application();
    this.server = application.app.listen(env.PORT, () => {
      logger.info(`API Venvios Express escuchando en ${env.PUBLIC_BASE_URL} (puerto ${env.PORT})`);
      logger.info(
        env.twilioEnabled
          ? 'WhatsApp: Twilio configurado.'
          : 'WhatsApp: modo simulación local (sin credenciales Twilio).',
      );
    });

    process.on('SIGINT', () => void this.shutdown('SIGINT'));
    process.on('SIGTERM', () => void this.shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Promesa rechazada sin manejar', { reason: String(reason) });
    });
    process.on('uncaughtException', (error) => {
      logger.error('Excepción no capturada', { error: error.message });
      void this.shutdown('uncaughtException');
    });
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.cerrando) return;
    this.cerrando = true;
    logger.info(`Cerrando servidor por ${signal}…`);

    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
    });

    await prisma.$disconnect();
    process.exit(0);
  }
}

new ServerBootstrap().start();
