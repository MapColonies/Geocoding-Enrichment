import { readFileSync } from 'fs';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { Client, ClientOptions } from '@elastic/elasticsearch';
import { Consumer, ConsumerConfig, Kafka } from 'kafkajs';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { Counter, Histogram, Meter } from '@opentelemetry/api';
import { SERVICES } from './common/constants';
import { withSpan } from './common/tracing';
import { FeedbackResponse, IConfig, KafkaOptions } from './common/interfaces';
import { ProcessManager } from './process/models/processManager';
import { StreamerAttributes, StreamerSpanName } from './streamerTracing';

interface KafkaTopics {
  input: string[];
}

const elasticIndex = 'elastic.properties.index';
let elasticConfig: ClientOptions;

@injectable()
export class StreamerBuilder {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly elasticClient: Client;
  private readonly kafkaErrorsCounter: Counter;
  private readonly recordsIndexedCounter: Counter;
  private readonly elasticIndexDurationRecorder: Histogram;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CLEANUP_REGISTRY) private readonly cleanupRegistry: CleanupRegistry,
    @inject(ProcessManager) private readonly manager: ProcessManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.kafkaErrorsCounter = meter.createCounter('kafka_errors');
    this.recordsIndexedCounter = meter.createCounter('records_indexed');
    this.elasticIndexDurationRecorder = meter.createHistogram('elastic_index_duration_ms', { unit: 'ms' });
    let kafkaConfig = config.get<KafkaOptions>('kafka');
    if (typeof kafkaConfig.brokers === 'string' || kafkaConfig.brokers instanceof String) {
      kafkaConfig = {
        ...kafkaConfig,
        brokers: kafkaConfig.brokers.split(','),
        ssl: kafkaConfig.enableSslAuth
          ? {
              key: readFileSync(kafkaConfig.sslPaths.key, 'utf-8'),
              cert: readFileSync(kafkaConfig.sslPaths.cert, 'utf-8'),
              ca: [readFileSync(kafkaConfig.sslPaths.ca, 'utf-8')],
            }
          : undefined,
        sasl: kafkaConfig.sasl ? { ...kafkaConfig.sasl } : undefined,
      };
    }
    const consumerConfig = config.get<ConsumerConfig>('kafkaConsumer');
    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer(consumerConfig);
    elasticConfig = config.get<ClientOptions>('elastic');
    this.elasticClient = new Client(elasticConfig);
    this.cleanupRegistry.register({ func: this.consumer.disconnect.bind(this.consumer) });
  }

  public async build(): Promise<void> {
    const { input: inputTopic } = this.config.get<KafkaTopics>('kafkaTopics');

    await withSpan(StreamerSpanName.KAFKA_STARTUP, { attributes: { [StreamerAttributes.KAFKA_TOPIC]: inputTopic.join(',') } }, async () => {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: inputTopic });
    });
    this.logger.info(`Kafka consumer subscribed successfully to ${inputTopic.toString()}`);

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value?.toString();
        if (value == undefined) {
          return;
        }

        try {
          await withSpan(
            StreamerSpanName.KAFKA_HANDLE_MESSAGE,
            {
              attributes: {
                [StreamerAttributes.KAFKA_TOPIC]: topic,
                [StreamerAttributes.KAFKA_PARTITION]: partition,
                [StreamerAttributes.KAFKA_OFFSET]: message.offset,
              },
            },
            async (span) => {
              const input = JSON.parse(value) as FeedbackResponse;
              const requestId = input.requestId;
              const output = await this.manager.process(input);
              const index = this.config.get<string>(elasticIndex);
              span?.setAttribute(StreamerAttributes.ELASTIC_INDEX_NAME, index);

              const indexStartTime = Date.now();
              await this.elasticClient.index({ index, body: output });
              this.elasticIndexDurationRecorder.record(Date.now() - indexStartTime);
              this.recordsIndexedCounter.add(1);

              this.logger.info(`Added the enriched data of request: ${requestId} to Elastic successfully`);
            }
          );
        } catch (error) {
          this.kafkaErrorsCounter.add(1);
          this.logger.error(`Error: Could not add data to elastic. Reason: ${(error as Error).message}`);
        }
      },
    });

    this.consumer.on(this.consumer.events.CRASH, (error) => {
      this.kafkaErrorsCounter.add(1);
      this.logger.error(error);
      this.logger.error(error.payload.error);
    });
  }
}
