import { Logger } from '@map-colonies/js-logger';
import { Client, ClientOptions } from '@elastic/elasticsearch';
import { DependencyContainer, FactoryFunction } from 'tsyringe';
import { IConfig } from '../interfaces';
import { SERVICES } from '../constants';

const createConnectionOptions = (clientOptions: ClientOptions): ClientOptions => ({
  ...clientOptions,
  sniffOnStart: false,
  sniffOnConnectionFault: false,
  tls: {
    rejectUnauthorized: false,
  },
});

const initElasticsearchClient = (clientOptions: ClientOptions): ElasticClient => {
  const client = new Client(createConnectionOptions(clientOptions));
  return client;
};

export const elasticClientFactory: FactoryFunction<ElasticClient> = (container: DependencyContainer): ElasticClient => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);

  const elasticClientConfig = config.get<ClientOptions>('elastic');

  const elasticClient = initElasticsearchClient(elasticClientConfig);
  logger.info(`Elasticsearch client is initialized`);

  return elasticClient;
};

export type ElasticClient = Client;
