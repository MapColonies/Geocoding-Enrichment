import { Application } from 'express';
import { DependencyContainer } from 'tsyringe';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './serverBuilder';
import { StreamerBuilder } from './streamerBuilder';

async function getApp(registerOptions?: RegisterOptions): Promise<{ app: Application; container: DependencyContainer }> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  await container.resolve(StreamerBuilder).build();

  return { app, container };
}

export { getApp };
