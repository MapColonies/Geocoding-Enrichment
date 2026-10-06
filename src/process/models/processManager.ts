import { Logger } from '@map-colonies/js-logger';
import { center } from '@turf/center';
import { inject, injectable } from 'tsyringe';
import axios from 'axios';
import { Counter, Histogram, Meter } from '@opentelemetry/api';
import { SERVICES } from '../../common/constants';
import { withSpan } from '../../common/tracing';
import { EnrichResponse, FeedbackResponse, IApplication, UserDataServiceResponse } from '../../common/interfaces';
import { fetchUserDataService } from '../../common/utils';
import { ProcessSpanName, ProcessAttributes } from '../tracing';

const arabicRegex = /[\u0600-\u06FF]/;

const getErrorType = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response !== undefined ? `http_${error.response.status}` : error.code ?? 'network_error';
  }
  return error instanceof Error ? error.name : 'unknown_error';
};

@injectable()
export class ProcessManager {
  private readonly processDurationRecorder: Histogram;
  private readonly userDataServiceErrorsCounter: Counter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.APPLICATION) private readonly appConfig: IApplication,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.processDurationRecorder = meter.createHistogram('process_duration_ms', { unit: 'ms' });
    this.userDataServiceErrorsCounter = meter.createCounter('user_data_service_errors');
  }

  public async process(feedbackResponse: FeedbackResponse): Promise<EnrichResponse> {
    return withSpan(
      ProcessSpanName.MANAGER_PROCESS,
      {
        attributes: {
          [ProcessAttributes.SITE]: feedbackResponse.geocodingResponse.site,
          [ProcessAttributes.CHOSEN_RESULT_ID]: feedbackResponse.chosenResultId ?? undefined,
        },
      },
      async (span) => {
        const token = JSON.parse(Buffer.from(feedbackResponse.geocodingResponse.apiKey.split('.')[1], 'base64').toString()) as { sub: string };
        const text = this.getQueryText(feedbackResponse);

        const enrichedResponse: EnrichResponse = {
          query: {
            language: arabicRegex.test(text) ? 'ar' : 'he',
            text,
          },
          result: {
            rank: null,
          },
          system: token.sub,
          site: feedbackResponse.geocodingResponse.site,
          duration: new Date(feedbackResponse.responseTime).getTime() - new Date(feedbackResponse.geocodingResponse.respondedAt).getTime(),
          timestamp: new Date(),
        };

        span?.setAttributes({
          [ProcessAttributes.LANGUAGE]: enrichedResponse.query.language,
          [ProcessAttributes.SYSTEM]: enrichedResponse.system,
          [ProcessAttributes.DURATION_MS]: enrichedResponse.duration,
        });
        this.processDurationRecorder.record(enrichedResponse.duration);

        return this.enrichData(feedbackResponse, enrichedResponse);
      }
    );
  }

  public getQueryText(feedbackResponse: FeedbackResponse): string {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { query, tile, command_name, mgrs, sub_tile, control_point } = feedbackResponse.geocodingResponse.response.geocoding.query;

    let text = query ?? tile ?? command_name ?? mgrs ?? '';
    const additionalInfo = sub_tile ?? control_point;
    text += additionalInfo != undefined ? `, ${additionalInfo}` : '';

    return text;
  }

  public async enrichData(feedbackResponse: FeedbackResponse, enrichedResponse: EnrichResponse): Promise<EnrichResponse> {
    const chosenResult = feedbackResponse.chosenResultId;
    if (chosenResult === null) {
      return enrichedResponse;
    }

    return withSpan(
      ProcessSpanName.MANAGER_ENRICH_DATA,
      { attributes: { [ProcessAttributes.CHOSEN_RESULT_ID]: chosenResult } },
      async (span) => {
        const selectedResponse = feedbackResponse.geocodingResponse.response.features[chosenResult];

        const { endpoint, queryParams, headers } = this.appConfig.userDataService;
        const userId = feedbackResponse.geocodingResponse.userId;

        if (userId !== undefined) {
          let fetchedUserData: UserDataServiceResponse;
          try {
            fetchedUserData = await withSpan(
              ProcessSpanName.MANAGER_FETCH_USER_DATA,
              { attributes: { [ProcessAttributes.USER_ID]: userId } },
              async () => fetchUserDataService(endpoint, userId, queryParams, headers)
            );
          } catch (error) {
            this.logger.error(`Failed to fetch user data for user: ${userId}`, error);
            this.userDataServiceErrorsCounter.add(1, { type: getErrorType(error) });
            throw error;
          }

          enrichedResponse.user = {
            name: userId,
          };

          const userData = fetchedUserData[userId] ?? fetchedUserData;
          enrichedResponse.user = { ...enrichedResponse.user, ...userData };
        }

        enrichedResponse.result = {
          rank: chosenResult,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          score: selectedResponse.properties?._score ?? 0,
          source: selectedResponse.properties.matches[0].source,
          layer: selectedResponse.properties.matches[0].layer,
          name: selectedResponse.properties.names.default,
          region: selectedResponse.properties.regions[0].region,
          location: center(selectedResponse),
        };

        span?.setAttributes({
          [ProcessAttributes.RESULT_RANK]: chosenResult,
          [ProcessAttributes.RESULT_SCORE]: enrichedResponse.result.score,
          [ProcessAttributes.RESULT_SOURCE]: enrichedResponse.result.source,
          [ProcessAttributes.RESULT_LAYER]: enrichedResponse.result.layer,
          [ProcessAttributes.RESULT_REGION]: enrichedResponse.result.region,
        });

        return enrichedResponse;
      }
    );
  }
}
