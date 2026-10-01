import { Logger } from '@map-colonies/js-logger';
import { center } from '@turf/center';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { withSpan } from '../../common/tracing';
import { EnrichResponse, FeedbackResponse, IApplication } from '../../common/interfaces';
import { fetchUserDataService } from '../../common/utils';
import { ProcessSpanName, ProcessAttributes } from '../tracing';

const arabicRegex = /[\u0600-\u06FF]/;

@injectable()
export class ProcessManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.APPLICATION) private readonly appConfig: IApplication
  ) {}

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
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          system: token?.sub,
          site: feedbackResponse.geocodingResponse.site,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          duration: new Date(feedbackResponse.responseTime) - new Date(feedbackResponse.geocodingResponse.respondedAt),
          timestamp: new Date(),
        };

        span?.setAttributes({
          [ProcessAttributes.LANGUAGE]: enrichedResponse.query.language,
          [ProcessAttributes.SYSTEM]: enrichedResponse.system,
          [ProcessAttributes.DURATION_MS]: enrichedResponse.duration,
        });

        if (feedbackResponse.chosenResultId === null) {
          return enrichedResponse;
        }
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
    return withSpan(
      ProcessSpanName.MANAGER_ENRICH_DATA,
      { attributes: { [ProcessAttributes.CHOSEN_RESULT_ID]: feedbackResponse.chosenResultId ?? undefined } },
      async (span) => {
        const chosenResult: number = feedbackResponse.chosenResultId as number;
        const selectedResponse = feedbackResponse.geocodingResponse.response.features[chosenResult];

        const { endpoint, queryParams, headers } = this.appConfig.userDataService;
        const userId = feedbackResponse.geocodingResponse.userId;

        if (userId !== undefined) {
          const fetchedUserData = await withSpan(
            ProcessSpanName.MANAGER_FETCH_USER_DATA,
            { attributes: { [ProcessAttributes.USER_ID]: userId } },
            async () => fetchUserDataService(endpoint, userId, queryParams, headers)
          );

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
