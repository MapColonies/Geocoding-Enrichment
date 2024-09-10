import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './serverBuilder';
import { StreamerBuilder } from './streamerBuilder';
async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  await container.resolve(StreamerBuilder).build()

  return app;
}

export { getApp };
