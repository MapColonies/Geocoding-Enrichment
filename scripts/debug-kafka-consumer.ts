#!/usr/bin/env -S npx ts-node
// See README.md "Debugging Locally" for usage, prerequisites, and env vars.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Kafka } from 'kafkajs';
import { FeedbackResponse } from '../src/common/interfaces';

const DEFAULT_PAYLOAD_PATH = join(__dirname, 'sample-payloads', 'feedback-response.json');
const CLI_ARGS_OFFSET = 2; // skip `node` and the script path in argv

interface ParsedArgs {
  payloadPath: string;
  newRequestId: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  return {
    payloadPath: positional[0] ?? DEFAULT_PAYLOAD_PATH,
    newRequestId: argv.includes('--new-request-id'),
  };
}

function loadPayload(payloadPath: string, newRequestId: boolean): FeedbackResponse {
  const raw = readFileSync(payloadPath, 'utf-8');
  const payload = JSON.parse(raw) as FeedbackResponse;

  if (newRequestId) {
    payload.requestId = `debug-${process.pid}-${process.hrtime.bigint()}`;
  }

  return payload;
}

async function main(): Promise<void> {
  const { payloadPath, newRequestId } = parseArgs(process.argv.slice(CLI_ARGS_OFFSET));
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

main().catch((error: unknown) => {
  console.error('Failed to produce debug message:', error);
  process.exitCode = 1;
});
