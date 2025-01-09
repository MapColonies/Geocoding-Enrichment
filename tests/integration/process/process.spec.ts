import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import nock from 'nock';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { DependencyContainer } from 'tsyringe';
import { Application } from 'express';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { EnrichResponse, FeedbackResponse } from '../../../src/common/interfaces';
import { IApplication } from '../../../src/common/interfaces';
import { ProcessRequestSender } from './helpers/requestSender';
import { mockApiKey } from './utils';

let currentKafkaTopics = {
  input: 'topic1-test',
};

jest.mock('config', () => {
  const originalConfig = jest.requireActual<typeof import('config')>('config');
  return {
    ...originalConfig,
    get: jest.fn((key: string) => {
      if (key === 'kafkaTopics') {
        return currentKafkaTopics;
      }
      return originalConfig.get(key);
    }),
  };
});

describe('process', function () {
  let requestSender: ProcessRequestSender;
  let app: { app: Application; container: DependencyContainer };

  beforeAll(async function () {
    app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new ProcessRequestSender(app.app);
  });

  beforeEach(function () {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterAll(async function () {
    nock.cleanAll();
    jest.clearAllTimers();
    const cleanupRegistry = app.container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);
    await cleanupRegistry.trigger();
  });

  describe('Happy Path', function () {
    it('should return 200 status code and the resource', async function () {
      const userId = 'avi@mapcolonies.net';
      const userDataServiceScope = nock(config.get<IApplication>('application').userDataService.endpoint, {
        reqheaders: {
          headerDetails: () => true,
        },
      })
        .get(`/${userId}?extraDetails=true`)
        .reply(httpStatusCodes.OK, {
          firstName: 'avi',
          lastName: 'map',
          displayName: 'mapcolonies/avi',
          mail: 'avi@mapcolonies.net',
          domains: ['USA', 'FRANCE'],
        });

      const input: FeedbackResponse = {
        requestId: 'req-id',
        chosenResultId: 1,
        responseTime: new Date(10000 + 500),
        geocodingResponse: {
          userId,
          apiKey: mockApiKey,
          site: 'site-name',
          respondedAt: new Date(10000),
          response: {
            type: 'FeatureCollection',
            geocoding: {
              version: 'version',
              query: {
                query: 'query-name',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                geo_context: 'geo_context',
              },
            },
            features: [
              {
                type: 'Feature',
                geometry: {
                  coordinates: [28.008903004732502, 19.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'not-layer-name',
                      source: 'not-source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['not-some-source-id'],
                    },
                  ],
                  names: {
                    default: 'not-default-name',
                  },
                  regions: [
                    {
                      region: 'not-region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 10,
                },
              },
              {
                type: 'Feature',
                geometry: {
                  coordinates: [29.008903004732502, 30.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'layer-name',
                      source: 'source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['some-source-id'],
                    },
                  ],
                  names: {
                    default: 'default-name',
                  },
                  regions: [
                    {
                      region: 'region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 5,
                },
              },
            ],
          },
        },
      };
      const response = await requestSender.process(input);

      expect(response.status).toBe(httpStatusCodes.OK);

      const output = response.body as EnrichResponse;
      expect(output.user?.name).toBe(userId);
      expect(output.query.text).toBe('query-name');
      expect(output.query.language).toBe('he');
      expect(output.result.rank).toBe(1);
      expect(output.result.score).toBe(5);
      expect(output.result.source).toBe('source-name');
      expect(output.result.layer).toBe('layer-name');
      expect(output.result.name).toBe('default-name');
      expect(output.result.region).toBe('region-name');
      expect(output.result.location).toStrictEqual({
        geometry: { coordinates: [29.008903004732502, 30.752611840282086], type: 'Point' },
        properties: {},
        type: 'Feature',
      });
      expect(output.system).toBe('map-colonies-test');
      expect(output.site).toBe('site-name');
      expect(output.duration).toBe(500);

      userDataServiceScope.done();
    });

    it('should return 200 status code and the resource when given multiple kafka topics', async function () {
      const userId = 'avi@mapcolonies.net';
      currentKafkaTopics = {
        input: 'topic1-test,topic2-test',
      };
      const userDataServiceScope = nock(config.get<IApplication>('application').userDataService.endpoint, {
        reqheaders: {
          headerDetails: () => true,
        },
      })
        .get(`/${userId}?extraDetails=true`)
        .reply(httpStatusCodes.OK, {
          firstName: 'avi',
          lastName: 'map',
          displayName: 'mapcolonies/avi',
          mail: 'avi@mapcolonies.net',
          domains: ['USA', 'FRANCE'],
        });

      const input: FeedbackResponse = {
        requestId: 'req-id',
        chosenResultId: 0,
        responseTime: new Date(10000 + 500),
        geocodingResponse: {
          userId,
          apiKey: mockApiKey,
          site: 'site-name',
          respondedAt: new Date(10000),
          response: {
            type: 'FeatureCollection',
            geocoding: {
              version: 'version',
              query: {
                tile: 'tile-name',
              },
            },
            features: [
              {
                type: 'Feature',
                geometry: {
                  coordinates: [28.008903004732502, 19.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'not-layer-name',
                      source: 'not-source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['not-some-source-id'],
                    },
                  ],
                  names: {
                    default: 'not-default-name',
                  },
                  regions: [
                    {
                      region: 'not-region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 10,
                },
              },
              {
                type: 'Feature',
                geometry: {
                  coordinates: [29.008903004732502, 30.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'layer-name',
                      source: 'source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['some-source-id'],
                    },
                  ],
                  names: {
                    default: 'default-name',
                  },
                  regions: [
                    {
                      region: 'region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 5,
                },
              },
            ],
          },
        },
      };
      const response = await requestSender.process(input);

      expect(response.status).toBe(httpStatusCodes.OK);

      const output = response.body as EnrichResponse;
      expect(output.user?.name).toBe(userId);
      expect(output.query.text).toBe('tile-name');
      expect(output.query.language).toBe('he');
      expect(output.result.rank).toBe(0);
      expect(output.result.score).toBe(10);
      expect(output.result.source).toBe('not-source-name');
      expect(output.result.layer).toBe('not-layer-name');
      expect(output.result.name).toBe('not-default-name');
      expect(output.result.region).toBe('not-region-name');
      expect(output.result.location).toStrictEqual({
        geometry: { coordinates: [28.008903004732502, 19.752611840282086], type: 'Point' },
        properties: {},
        type: 'Feature',
      });
      expect(output.system).toBe('map-colonies-test');
      expect(output.site).toBe('site-name');
      expect(output.duration).toBe(500);

      userDataServiceScope.done();
    });

    it('should return 200 status code when getting missing data - meaning user did not choose a response', async function () {
      currentKafkaTopics = {
        input: 'topic1-test,topic2-test',
      };
      const input: FeedbackResponse = {
        requestId: 'req-id',
        chosenResultId: '',
        responseTime: new Date(10000 + 500),
        geocodingResponse: {
          apiKey: mockApiKey,
          site: 'site-name',
          respondedAt: new Date(10000),
          response: {
            type: 'FeatureCollection',
            geocoding: {
              version: 'version',
              query: {
                query: 'query-name',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                geo_context: 'geo_context',
              },
            },
            features: [
              {
                type: 'Feature',
                geometry: {
                  coordinates: [28.008903004732502, 19.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'not-layer-name',
                      source: 'not-source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['not-some-source-id'],
                    },
                  ],
                  names: {
                    default: 'not-default-name',
                  },
                  regions: [
                    {
                      region: 'not-region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 10,
                },
              },
              {
                type: 'Feature',
                geometry: {
                  coordinates: [29.008903004732502, 30.752611840282086],
                  type: 'Point',
                },
                properties: {
                  type: 'Point',
                  matches: [
                    {
                      layer: 'layer-name',
                      source: 'source-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      source_id: ['some-source-id'],
                    },
                  ],
                  names: {
                    default: 'default-name',
                  },
                  regions: [
                    {
                      region: 'region-name',
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      sub_region_names: [],
                    },
                  ],
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 5,
                },
              },
            ],
          },
        },
      };
      const response = await requestSender.process(input);

      expect(response.status).toBe(httpStatusCodes.OK);

      const output = response.body as EnrichResponse;
      expect(output.user?.name).toBeUndefined();
      expect(output.query.text).toBe('query-name');
      expect(output.query.language).toBe('he');
      expect(output.result.rank).toBeNull();
      expect(output.result.score).toBeUndefined();
      expect(output.result.source).toBeUndefined();
      expect(output.result.layer).toBeUndefined();
      expect(output.result.name).toBeUndefined();
      expect(output.result.region).toBeUndefined();
      expect(output.result.location).toBeUndefined();
      expect(output.system).toBe('map-colonies-test');
      expect(output.site).toBe('site-name');
      expect(output.duration).toBe(500);
    });
  });
  describe('Bad Path', function () {
    // All requests with status code of 400
  });
  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
  });
});
