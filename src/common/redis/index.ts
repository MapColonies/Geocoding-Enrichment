import { readFileSync } from 'fs';
import { Logger } from '@map-colonies/js-logger';
import { createClient, RedisClientOptions } from 'redis';
import { DependencyContainer, FactoryFunction } from 'tsyringe';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';
import { RedisConfig } from './interfaces';

const createConnectionOptions = (redisConfig: RedisConfig): Partial<RedisClientOptions> => {
  const { host, port, enableSslAuth, sslPaths, ...clientOptions } = redisConfig;
  clientOptions.socket = { host, port };
  if (enableSslAuth) {
    clientOptions.socket = {
      ...clientOptions.socket,
      tls: true,
      key: sslPaths.key !== '' ? readFileSync(sslPaths.key) : undefined,
      cert: sslPaths.cert !== '' ? readFileSync(sslPaths.cert) : undefined,
      ca: sslPaths.ca !== '' ? readFileSync(sslPaths.ca) : undefined,
    };
  }
  return clientOptions;
};

export type RedisClient = ReturnType<typeof createClient>;

export const redisClientFactory: FactoryFunction<RedisClient | undefined> = (container: DependencyContainer): RedisClient | undefined => {
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const dbConfig = config.get<RedisConfig>('redis');
  const connectionOptions = createConnectionOptions(dbConfig);
  try {
    const redisClient = createClient(connectionOptions)
      // .on('error', (error: Error) => logger.error({ msg: 'redis client errored', err: error }))
      // .on('reconnecting', (...args) => logger.warn({ msg: 'redis client reconnecting', ...args }))
      .on('end', (...args) => logger.info({ msg: 'redis client end', ...args }))
      .on('connect', (...args) => logger.debug({ msg: 'redis client connected', ...args }))
      .on('ready', (...args) => logger.debug({ msg: 'redis client is ready', ...args }));

    logger.info(`Redis client is initialized`);
    return redisClient;
  } catch (error) {
    logger.error({ msg: 'Connection to Redis was unsuccessful', error });
  }
};
