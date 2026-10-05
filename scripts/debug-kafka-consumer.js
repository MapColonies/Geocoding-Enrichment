#!/usr/bin/env node
/**
 * Produces a FeedbackResponse message to a local Kafka topic so the consumer
 * (`StreamerBuilder`, run via `npm run start:dev`) can be stepped through/debugged
 * against a payload shaped like a real one, instead of waiting for production traffic.
 *
 * Prerequisites: `docker compose up kafka kafka-init elasticsearch user-data-service jaeger`,
 * then run the service on the host with KAFKA_BROKERS=localhost:9094 so it points at the
 * docker-compose broker's host-reachable listener (the default PLAINTEXT listener only
 * advertises the in-network hostname "kafka", which the host can't resolve).
 *
 * Usage:
 *   node scripts/debug-kafka-consumer.js [path/to/payload.json] [--new-request-id]
 *
 *   path/to/payload.json   A FeedbackResponse JSON payload to replay, e.g. one captured
 *                          from production. Defaults to scripts/sample-payloads/feedback-response.json.
 *   --new-request-id       Overwrite requestId with a fresh one, useful for re-sending the
 *                          same payload repeatedly without colliding on request ids in traces/Elastic.
 *
 * Env vars:
 *   KAFKA_BROKERS   comma separated list, default "localhost:9094"
 *   KAFKA_TOPIC     default "topic" (matches config/default.json kafkaTopics.input[0])
 */

const fs = require('fs');
const path = require('path');
const { Kafka } = require('kafkajs');

const DEFAULT_PAYLOAD_PATH = path.join(__dirname, 'sample-payloads', 'feedback-response.json');

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  return {
    payloadPath: positional[0] ?? DEFAULT_PAYLOAD_PATH,
    newRequestId: argv.includes('--new-request-id'),
  };
}

function loadPayload(payloadPath, newRequestId) {
  const raw = fs.readFileSync(payloadPath, 'utf-8');
  const payload = JSON.parse(raw);

  if (newRequestId) {
    payload.requestId = `debug-${process.pid}-${process.hrtime.bigint()}`;
  }

  return payload;
}

async function main() {
  const { payloadPath, newRequestId } = parseArgs(process.argv.slice(2));
  const payload = loadPayload(payloadPath, newRequestId);

  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094').split(',');
  const topic = process.env.KAFKA_TOPIC ?? 'topic';

  const kafka = new Kafka({ clientId: 'debug-kafka-producer', brokers });
  const producer = kafka.producer();

  await producer.connect();
  try {
    const result = await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });

    console.log(`Sent ${payloadPath} to topic "${topic}" on [${brokers.join(', ')}] (requestId: ${payload.requestId})`);
    console.log(result);
  } finally {
    await producer.disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to produce debug message:', error);
  process.exitCode = 1;
});
