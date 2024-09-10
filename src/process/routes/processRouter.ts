import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ProcessController } from '../controllers/ProcessController';

const processRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ProcessController);

  router.post('/', controller.process);

  return router;
};

export const PROCESS_ROUTER_SYMBOL = Symbol('processRouterFactory');

export { processRouterFactory };
