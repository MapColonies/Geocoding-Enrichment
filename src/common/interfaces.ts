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
  };
  system: string;
  site: string;
  duration: number;
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

export interface QueryResult {
  type: 'FeatureCollection';
  geocoding: {
    query: {
      text: string;
      geo_context: string;
    };
    version: string;
  };
  features: {
    type: 'Feature';
    properties: {
      type: string,
      source?: string;
      layer?: string;
      name: {
        default: string;
      };
      _score: number;
    };
  }[]
}
