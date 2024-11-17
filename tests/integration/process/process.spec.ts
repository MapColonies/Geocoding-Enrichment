import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import nock from 'nock';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { EnrichResponse, FeedbackResponse } from '../../../src/common/interfaces';
import { IApplication } from '../../../src/common/interfaces';
import { ProcessRequestSender } from './helpers/requestSender';
import { mockApiKey } from './utils';

const TIMEOUT = 10000;

describe('process', function () {
  let requestSender: ProcessRequestSender;
  beforeAll(async function () {
    const app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new ProcessRequestSender(app);
  }, TIMEOUT);

  afterAll(function () {
    nock.cleanAll();
  });

  describe('Happy Path', function () {
    it('should return 200 status code and the resource', async function () {
      const userId = 'avi@mapcolonies.net';
      const userDataServiceScope = nock(config.get<IApplication>('application').userDataService.endpoint)
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
      expect(output.user.name).toBe(userId);
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
  });
  describe('Bad Path', function () {
    // All requests with status code of 400
  });
  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
  });
});
