import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { EnrichResponse, FeedbackResponse } from '../../common/interfaces';

@injectable()
export class ProcessManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public process(feedbackResponse: FeedbackResponse): EnrichResponse {
    const selectedResponse = feedbackResponse.geocodingResponse.response.features[feedbackResponse.chosenResultId]
    return {
      user: {
        name: feedbackResponse.geocodingResponse.userId,
      },
      query: {
        language: '',
        text: feedbackResponse.geocodingResponse.response.geocoding.query.text,
      },
      result: {
        rank: feedbackResponse.chosenResultId,
        score: selectedResponse.properties._score ?? 0,
        source: selectedResponse.properties.source,
        layer: selectedResponse.properties.layer,
        name: selectedResponse.properties.name.default,
      },
      system: feedbackResponse.geocodingResponse.apiKey,
      site: feedbackResponse.geocodingResponse.site,
      // @ts-expect-error
      duration: new Date(feedbackResponse.responseTime) - new Date(feedbackResponse.geocodingResponse.respondedAt),
    }
  }
}
