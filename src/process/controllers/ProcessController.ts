import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { EnrichResponse, FeedbackResponse } from '../../common/interfaces';
import { ProcessManager } from '../models/processManager';

type ProcessHandler = RequestHandler<undefined, EnrichResponse, FeedbackResponse>;

@injectable()
export class ProcessController {
  private readonly processedounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ProcessManager) private readonly manager: ProcessManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.processedounter = meter.createCounter('processed');
  }

  public process: ProcessHandler = (req, res) => {
    const result = this.manager.process(req.body);
    this.processedounter.add(1);
    return res.status(httpStatus.OK).json(result);
  };
}
