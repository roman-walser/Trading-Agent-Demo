// backend/index.ts
import { appConfig } from './config/index.js';
import { createHttpServer } from './server/http/index.js';
import { attachWebsocketServer } from './server/ws/index.js';

const app = createHttpServer();
const io = attachWebsocketServer(app);

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: appConfig.http.port, host: '0.0.0.0' });
    app.log.info(
      { port: appConfig.http.port, wsPath: appConfig.ws.path, version: appConfig.meta.version },
      'backend started'
    );
  } catch (err) {
    app.log.error({ err }, 'failed to start backend');
    process.exit(1);
  }
};

const shutdown = async (signal?: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down backend');

  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });

  await app.close();
  process.exit(0);
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    void shutdown(signal);
  });
});

void start();
