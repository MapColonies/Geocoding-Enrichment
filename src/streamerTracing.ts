/* eslint-disable @typescript-eslint/naming-convention */
export const StreamerSpanName = {
  KAFKA_STARTUP: 'streamer.kafka.startup',
  KAFKA_HANDLE_MESSAGE: 'streamer.kafka.handle_message',
} as const;

export type StreamerSpanName = (typeof StreamerSpanName)[keyof typeof StreamerSpanName];

export const StreamerAttributes = {
  KAFKA_TOPIC: 'streamer.kafka.topic',
  KAFKA_PARTITION: 'streamer.kafka.partition',
  KAFKA_OFFSET: 'streamer.kafka.offset',
  ELASTIC_INDEX_NAME: 'streamer.elastic.index_name',
} as const;

export type StreamerAttributes = (typeof StreamerAttributes)[keyof typeof StreamerAttributes];
