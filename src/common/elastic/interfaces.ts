import { ClientOptions } from '@elastic/elasticsearch';

export interface ElasticDbClientConfig {
  properties: {
    index: string | { [key: string]: string };
  };
}

export type ElasticDbConfig = ClientOptions;
