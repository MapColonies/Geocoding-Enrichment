import { Logger } from '@map-colonies/js-logger';
import { center } from '@turf/center';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { EnrichResponse, FeedbackResponse, IApplication } from '../../common/interfaces';
import { fetchUserDataService } from '../../common/utils';

const arabicRegex = /[\u0600-\u06FF]/;

@injectable()
export class ProcessManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.APPLICATION) private readonly appConfig: IApplication
  ) {}

  public async process(feedbackResponse: FeedbackResponse): Promise<EnrichResponse> {
    let score = 0;

    const selectedResponse = feedbackResponse.geocodingResponse.response.features[feedbackResponse.chosenResultId];
    const token = JSON.parse(Buffer.from(feedbackResponse.geocodingResponse.apiKey.split('.')[1], 'base64').toString()) as { sub: string };
    const queryText = this.getQueryText(feedbackResponse);

    if (selectedResponse.properties._score) {
      score = selectedResponse.properties._score;
    }

    const { endpoint, queryParams, headers } = this.appConfig.userDataService;
    const fetchedUserData = await fetchUserDataService(endpoint, feedbackResponse.geocodingResponse.userId, queryParams, headers);

    return {
      user: {
        name: feedbackResponse.geocodingResponse.userId,
        ...fetchedUserData,
      },
      query: {
        language: arabicRegex.test(queryText as string) ? 'ar' : 'he',
        text: queryText,
      },
      result: {
        rank: feedbackResponse.chosenResultId,
        score: score,
        source: selectedResponse.properties.matches[0].source,
        layer: selectedResponse.properties.matches[0].layer,
        name: selectedResponse.properties.names.default,
        region: selectedResponse.properties.regions[0].region,
        location: center(selectedResponse),
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      system: token?.sub,
      site: feedbackResponse.geocodingResponse.site,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      duration: new Date(feedbackResponse.responseTime) - new Date(feedbackResponse.geocodingResponse.respondedAt),
      timestamp: new Date(),
    };
  }

  public getQueryText(feedbackResponse: FeedbackResponse): string | undefined {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { query, tile, command_name, mgrs, sub_tile, control_point } = feedbackResponse.geocodingResponse.response.geocoding.query;
    return query != undefined
      ? query
      : sub_tile != undefined && tile != undefined
      ? `${tile}, ${sub_tile}`
      : tile != undefined
      ? tile
      : control_point != undefined && command_name != undefined
      ? `${command_name}, ${control_point}`
      : command_name != undefined
      ? command_name
      : mgrs;
  }
}
