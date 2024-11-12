import type { Feature, FeatureCollection, Point } from 'geojson';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface EnrichResponse {
  user: {
    name: string;
  };
  query: {
    text: string;
    language: string;
  };
  result: {
    rank: number;
    score: number;
    source?: string;
    layer?: string;
    name: string;
    location?: Feature<Point>;
  };
  system: string;
  site: string;
  duration: number;
  timestamp: Date;
}

export interface FeedbackResponse {
  requestId: string;
  chosenResultId: number;
  responseTime: Date; // from FeedbackApi
  geocodingResponse: GeocodingResponse;
}

export interface GeocodingResponse {
  userId: string;
  apiKey: string;
  site: string;
  response: QueryResult;
  respondedAt: Date; // from Geocoding
}

export interface QueryResult extends FeatureCollection {
  geocoding: {
    query: {
      text: string;
      // eslint-disable-next-line @typescript-eslint/naming-convention
      geo_context: string;
    };
    version: string;
  };
  features: (FeatureCollection['features'][number] & {
    properties: {
      type: string;
      source?: string;
      layer?: string;
      names: {
        default: string;
      };
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _score: number;
    };
  })[];
}
