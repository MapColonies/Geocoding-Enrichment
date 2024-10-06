import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { EnrichResponse, FeedbackResponse } from '../../../src/common/interfaces';
import { ProcessRequestSender } from './helpers/requestSender';

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
  });

  describe('Happy Path', function () {
    it('should return 200 status code and the resource', async function () {
      const input: FeedbackResponse = {
        requestId: 'req-id',
        chosenResultId: 1,
        responseTime: new Date(10000 + 500),
        geocodingResponse: {
          userId: 'user-id',
          apiKey: jwt.sign({system: 'api-key'}, 'secret'),
          site: 'site-name',
          respondedAt: new Date(10000),
          response: {
            type: 'FeatureCollection',
            geocoding: {
              version: 'version',
              query: {
                text: 'query-name',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                geo_context: 'geo_context',
              },
            },
            features: [
              {
                type: 'Feature',
                properties: {
                  type: 'Point',
                  source: 'not-source-name',
                  layer: 'not-layer-name',
                  names: {
                    default: 'not-default-name',
                  },
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  _score: 10,
                },
              },
              {
                type: 'Feature',
                properties: {
                  type: 'Point',
                  source: 'source-name',
                  layer: 'layer-name',
                  names: {
                    default: 'default-name',
                  },
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
      expect(output.user.name).toBe('user-id');
      expect(output.query.text).toBe('query-name');
      expect(output.query.language).toBe('he');
      expect(output.result.rank).toBe(1);
      expect(output.result.score).toBe(5);
      expect(output.result.source).toBe('source-name');
      expect(output.result.layer).toBe('layer-name');
      expect(output.result.name).toBe('default-name');
      expect(output.system).toBe('api-key');
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
