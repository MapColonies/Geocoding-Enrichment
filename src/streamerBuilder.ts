import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from './common/constants';
import { FeedbackResponse, IConfig } from './common/interfaces';
import { Consumer, ConsumerConfig, Kafka, KafkaConfig, Producer, ProducerConfig } from 'kafkajs';
import { ProcessManager } from './process/models/processManager';

interface KafkaTopics {
  input: string;
  output: string;
}

@injectable()
export class StreamerBuilder {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly producer: Producer;
  
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ProcessManager) private readonly manager: ProcessManager,
  ) {
    let kafkaConfig = config.get<KafkaConfig>('kafka')
    if (typeof kafkaConfig.brokers === 'string' || kafkaConfig.brokers instanceof String) {
      kafkaConfig = {
        ...kafkaConfig,
        brokers: kafkaConfig.brokers.split(',')
      };
    }
    console.log(kafkaConfig)
    const consumerConfig = config.get<ConsumerConfig>('kafkaConsumer')
    const producerConfig = config.get<ProducerConfig>('kafkaProducer')
    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer(consumerConfig);
    this.producer = this.kafka.producer(producerConfig);
  }

  public async build(): Promise<void> {
    const {input: inputTopic, output: outputTopic} = this.config.get<KafkaTopics>('kafkaTopics')
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [inputTopic] });

    await this.producer.connect();
    
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const value = message?.value?.toString();
        if (value) {
          const input = JSON.parse(value) as FeedbackResponse;
          const output = this.manager.process(input)

          this.producer.send({
            topic: outputTopic,
            messages: [{ value: JSON.stringify(output) }]
          })
        }
      },
    });

    this.consumer.on(this.consumer.events.CRASH, error => {
      this.logger.error(error);
      this.logger.error(error.payload.error);
      if (!error.payload.restart) {
        process.exit(-1);
      }
    })
  }
}
