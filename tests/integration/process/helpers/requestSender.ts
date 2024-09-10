import * as supertest from 'supertest';
import { FeedbackResponse } from '../../../../src/common/interfaces';

export class ProcessRequestSender {
  public constructor(private readonly app: Express.Application) {}
  public async process(body: FeedbackResponse): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/process').set('Content-Type', 'application/json').send(body);
  }
}
