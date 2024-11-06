// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';

import { getApp } from './app';

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

getApp()
  .then((app) => {
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    const stubHealthCheck = async (): Promise<void> => Promise.resolve();
    const server = createServer(app);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const terminus = createTerminus(server, { healthChecks: { '/liveness': stubHealthCheck, onSignal: container.resolve('onSignal') } });

    terminus.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch((error) => {
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    logger.error(`Failed to connect to app. Error: ${(error as Error).message}`);
  });
