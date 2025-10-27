import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { trace, metrics as OtelMetrics } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { elasticClientFactory, ElasticClient } from './common/elastic/index';
import { tracing } from './common/tracing';
import { RedisClient, redisClientFactory } from './common/redis';
import { processRouterFactory, PROCESS_ROUTER_SYMBOL } from './process/routes/processRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IApplication } from './common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const cleanupRegistry = new CleanupRegistry();
  try {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

    const metrics = new Metrics();
    cleanupRegistry.register({ func: metrics.stop.bind(metrics), id: SERVICES.METER });
    metrics.start();

    cleanupRegistry.register({ func: tracing.stop.bind(tracing), id: SERVICES.TRACER });
    tracing.start();
    const tracer = trace.getTracer(SERVICE_NAME);

    const applicationConfig: IApplication = config.get<IApplication>('application');

    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: config } },
      { token: SERVICES.LOGGER, provider: { useValue: logger } },
      { token: SERVICES.TRACER, provider: { useValue: tracer } },
      { token: SERVICES.METER, provider: { useValue: OtelMetrics.getMeterProvider().getMeter(SERVICE_NAME) } },
      { token: SERVICES.APPLICATION, provider: { useValue: applicationConfig } },
      {
        token: SERVICES.ELASTIC_CLIENT,
        provider: { useFactory: instancePerContainerCachingFactory(elasticClientFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const elasticClient = deps.resolve<ElasticClient>(SERVICES.ELASTIC_CLIENT);
          try {
            const response = await elasticClient.ping();
            if (!response) {
              logger.error('Failed to connect to Elasticsearch', response);
            }
            cleanupRegistry.register({
              func: async () => {
                await elasticClient.close();
              },
              id: SERVICES.ELASTIC_CLIENT,
            });
          } catch (err) {
            logger.error('Failed to connect to Elasticsearch', err);
          }
        },
      },
      {
        token: SERVICES.CLEANUP_REGISTRY,
        provider: { useValue: cleanupRegistry },
      },
      { token: PROCESS_ROUTER_SYMBOL, provider: { useFactory: processRouterFactory } },
      {
        token: 'onSignal',
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const cleanupRegistry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);
            return cleanupRegistry.trigger.bind(cleanupRegistry);
          }),
        },
      },
      {
        token: SERVICES.REDIS,
        provider: { useFactory: instancePerContainerCachingFactory(redisClientFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const redis = deps.resolve<RedisClient>(SERVICES.REDIS);
          try {
            cleanupRegistry.register({
              func: async (): Promise<void> => {
                await redis.quit();
                return Promise.resolve();
              },
              id: SERVICES.REDIS,
            });
            await redis.connect();
          } catch (error) {
            logger.error({ msg: 'Connection to redis failed', error });
          }
        },
      },
    ];
    return await registerDependencies(dependencies, options?.override, options?.useChild);
  } catch (error) {
    await cleanupRegistry.trigger();
    throw error;
  }
};
