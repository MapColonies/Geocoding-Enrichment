import type { Feature, FeatureCollection, Point } from 'geojson';
import { BrokersFunction, KafkaConfig } from 'kafkajs';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface EnrichResponse {
  user?: {
    name: string;
  } & Partial<UserDataServiceResponse[string]>;
  query: {
    text?: string;
    language: string;
  };
  result: {
    rank: number | null;
    score?: number;
    source?: string;
    layer?: string;
    name?: string;
    location?: Feature<Point>;
    region?: string;
  };
  system: string;
  site: string;
  duration: number;
  timestamp: Date;
}

export interface FeedbackResponse {
  requestId: string;
  chosenResultId: number | null;
  responseTime: Date; // from FeedbackApi
  geocodingResponse: GeocodingResponse;
}

export interface GeocodingResponse {
  userId?: string;
  apiKey: string;
  site: string;
  response: QueryResult;
  respondedAt: Date; // from Geocoding
}

export interface QueryResult extends FeatureCollection {
  geocoding: {
    query: {
      query?: string;
      tile?: string;
      /* eslint-disable @typescript-eslint/naming-convention */
      sub_tile?: string;
      command_name?: string;
      control_point?: string;
      mgrs?: string;
      geo_context?: string;
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    version: string;
  };
  features: (FeatureCollection['features'][number] & {
    properties: {
      type: string;
      matches: {
        layer: string;
        source: string;
        /* eslint-disable @typescript-eslint/naming-convention */
        source_id: string[];
      }[];
      names: {
        default: string;
      };
      regions: {
        region: string;
        sub_region_names: string[];
      }[];
      _score: number;
      /* eslint-enable @typescript-eslint/naming-convention */
    };
  })[];
}

export interface IApplication {
  userDataService: {
    endpoint: string;
    headers?: {
      [key: string]: string | number | boolean;
    };
    queryParams?: {
      [key: string]: string | number | boolean;
    };
  };
}

export interface UserDataServiceResponse {
  [key: string]: {
    [key: string]: unknown;
    firstName: string;
    lastName: string;
    displayName: string;
    mail: string;
    domains: string[];
  } | null;
}

export type KafkaOptions = {
  brokers: string[] | BrokersFunction;
  enableSslAuth: boolean;
  sslPaths: { ca: string; cert: string; key: string };
} & KafkaConfig;
