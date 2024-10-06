import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { Client, ClientOptions } from '@elastic/elasticsearch';
import { Consumer, ConsumerConfig, Kafka, KafkaConfig } from 'kafkajs';
import { SERVICES } from './common/constants';
import { FeedbackResponse, IConfig } from './common/interfaces';
import { ProcessManager } from './process/models/processManager';

interface KafkaTopics {
  input: string;
}

const elasticIndex = 'elastic.properties.index';
let elasticConfig: ClientOptions;

@injectable()
export class StreamerBuilder {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly elasticClient: Client;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ProcessManager) private readonly manager: ProcessManager
  ) {
    let kafkaConfig = config.get<KafkaConfig>('kafka');
    if (typeof kafkaConfig.brokers === 'string' || kafkaConfig.brokers instanceof String) {
      kafkaConfig = {
        ...kafkaConfig,
        brokers: kafkaConfig.brokers.split(','),
      };
    }
    const consumerConfig = config.get<ConsumerConfig>('kafkaConsumer');
    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer(consumerConfig);
    elasticConfig = config.get<ClientOptions>('elastic');
    this.elasticClient = new Client(elasticConfig);
  }

  public async build(): Promise<void> {
    const { input: inputTopic } = this.config.get<KafkaTopics>('kafkaTopics');

    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [inputTopic] });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value?.toString();
        if (value != null) {
          const input = JSON.parse(value) as FeedbackResponse;
          const requestId = input.requestId;
          const output = this.manager.process(input);

          // console.log(output)
          await this.elasticClient.index({
            index: this.config.get<string>(elasticIndex),
            body: output,
          });
          this.logger.info(`Added the enriched data of request: ${requestId} to Elastic successfully`);
        }
      },
    });

    this.consumer.on(this.consumer.events.CRASH, (error) => {
      this.logger.error(error);
      this.logger.error(error.payload.error);
    });
  }
}
