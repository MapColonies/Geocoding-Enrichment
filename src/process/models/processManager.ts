import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import jwt from 'jsonwebtoken';
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
    const token = jwt.decode(feedbackResponse.geocodingResponse.apiKey) as { system: string };
    const { text } = feedbackResponse.geocodingResponse.response.geocoding.query;

    if (selectedResponse.properties._score) {
      score = selectedResponse.properties._score;
    }

    const { endpoint, queryParams } = this.appConfig.userDataService;
    const fetchedUserData = await fetchUserDataService(endpoint, feedbackResponse.geocodingResponse.userId, queryParams);

    return {
      user: {
        name: feedbackResponse.geocodingResponse.userId,
        ...fetchedUserData,
      },
      query: {
        language: arabicRegex.test(text) ? 'ar' : 'he',
        text: text,
      },
      result: {
        rank: feedbackResponse.chosenResultId,
        score: score,
        source: selectedResponse.properties.source,
        layer: selectedResponse.properties.layer,
        name: selectedResponse.properties.names.default,
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      system: token?.system,
      site: feedbackResponse.geocodingResponse.site,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      duration: new Date(feedbackResponse.responseTime) - new Date(feedbackResponse.geocodingResponse.respondedAt),
      timestamp: new Date(),
    };
  }
}
