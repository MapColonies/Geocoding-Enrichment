import https from 'https';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '@map-colonies/js-logger';
import { IApplication, IConfig, SpikeTokenResponse, UserDataServiceResponse } from './interfaces';
import { KartoffelDataService } from './kartoffel/kartoffelDataService';
import { RedisClient } from './redis';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const fetchMirageData = async (
  endpoint: string,
  userId: string,
  logger: Logger,
  queryParams?: { [key: string]: string | number | boolean | string[] },
  headerParams?: { [key: string]: string | number | boolean | string[] }
): Promise<UserDataServiceResponse> => {
  let res: AxiosResponse | null = null;

  const stringQueryParams = Object.entries(queryParams ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');

  res = await axiosInstance.get(`${endpoint}/${userId}?${stringQueryParams}`, { headers: headerParams });
  logger.info('Fetched user data from mirage');

  return (res?.data ?? {}) as UserDataServiceResponse;
};

const fetchKartoffelData = async (userId: string, endpoint: string, kartoffelDataService: KartoffelDataService, logger: Logger, domains?: string[]): Promise<UserDataServiceResponse> => {
  try {
    console.log(`Fetching kartoffel data for userId: ${userId}`);
    const kartoffelToken: SpikeTokenResponse = await kartoffelDataService.getTokenFromRedis();
    const token = kartoffelToken.access_token;

    const netUrl = `${endpoint}/search?uniqueId=${userId.split('@')[0].toLowerCase()}&expanded=true`;

    const reqOptions: AxiosRequestConfig = {
      url: netUrl,
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: token,
      },
    };
    const response = await axios.get(netUrl, reqOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return kartoffelDataService.convertToKartoffelUser(response.data.length > 0 ? response.data[0] : response.data, userId, domains);
  } catch (err) {
    logger.error(`Error getting kartoffel data: ${(err as Error).message}`);
    return {} as UserDataServiceResponse;
  }
};

export const getUserDataService = async (
  appConfig: IApplication,
  userId: string,
  logger: Logger,
  config: IConfig,
  redisClient?: RedisClient
): Promise<UserDataServiceResponse> => {
  if (appConfig.userDataService.serviceName === 'mirage') {
    const { endpoint, queryParams, headers } = appConfig.userDataService;
    return fetchMirageData(endpoint, userId, logger, queryParams, headers);
  }
  const { endpoint, domains } = appConfig.userDataService;
  const kartoffelDataService = new KartoffelDataService(logger, config, redisClient as RedisClient);
  return fetchKartoffelData(userId, endpoint, kartoffelDataService, logger, domains);
};
