import axios, { AxiosResponse } from 'axios';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { MAX_RETRIES, SERVICE_REDIS_KEY, SERVICES } from '../constants';
import { UserDataServiceResponse, KartoffelResponseData, SpikeTokenResponse, Spike, IConfig } from '../interfaces';
import { RedisClient } from '../redis';

const TOKEN_MIN_TTL = 1000;
const CONVERT_TO_MILLISECONDS = 1000;
const STRINGIFY_REPLACER = 2;

@injectable()
export class KartoffelDataService {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.REDIS) private readonly redisClient: RedisClient
  ) {}

  /**
   * Save the spike token in redis as SpikeTokenResponse
   */

  public saveTokenInRedis = async (): Promise<void> => {
    const spikeToken = await this.getToken();
    if (spikeToken.access_token) {
      const tokenObj: string = JSON.stringify(
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          access_token: spikeToken.access_token,
          expires_in: Date.now() + spikeToken.expires_in * CONVERT_TO_MILLISECONDS,
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        null,
        STRINGIFY_REPLACER
      );
      await this.redisClient.setEx(SERVICE_REDIS_KEY, spikeToken.expires_in, tokenObj);
    }
  };

  /**
   * Gets the token from spike from their api
   * @return the spike token
   */

  public getToken = async (): Promise<SpikeTokenResponse> => {
    const spike: Spike = this.config.get<Spike>('spike');
    const secondarySpike: Spike = this.config.get<Spike>('secondarySpike');
    try {
      const response: AxiosResponse = await axios.post(
        spike.url,
        { ...spike.requestBody },
        {
          auth: {
            username: spike.auth.username,
            password: spike.auth.password,
          },
        }
      );
      return response.data as SpikeTokenResponse;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error getting token from spike: ${error.message}`);
      try {
        const response: AxiosResponse = await axios.post(
          secondarySpike.url,
          { ...secondarySpike.requestBody },
          {
            auth: {
              username: secondarySpike.auth.username,
              password: secondarySpike.auth.password,
            },
          }
        );
        return response.data as SpikeTokenResponse;
      } catch (ex) {
        const e = ex as Error;
        this.logger.error(`Error getting token from secondary spike: ${e.message}`);
        throw e;
      }
    }
  };

  /**
   * Check if there is an active token
   * @return SpikeTokenResponse : return SpikeTokenResponse of the spike token
   */

  public getTokenFromRedis = async (retries = 0): Promise<SpikeTokenResponse> => {
    try {
      if (retries > MAX_RETRIES) {
        throw new Error('Max retries reached - could not get token from redis');
      }
      const stringifyToken = await this.redisClient.get(SERVICE_REDIS_KEY);
      if (stringifyToken !== null) {
        const tokenData: SpikeTokenResponse = JSON.parse(stringifyToken) as SpikeTokenResponse;
        const currtime = Date.now();
        if (tokenData.expires_in - currtime > TOKEN_MIN_TTL) {
          // if the token has very little time before expiration, get a new one
          return tokenData;
        }
      }
      await this.saveTokenInRedis();
      return await this.getTokenFromRedis(retries + 1);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error getting token from redis: ${error.message}`);
      throw err;
    }
  };

  /**
   * Convert the response we got from kartoffel to UserDataServiceResponse type
   * @param KartoffelResponseData: the data we got from kartoffel api
   * @return KartoffelResponseData: converted data
   */

  public convertToKartoffelUser = (kartoffelResponseData: KartoffelResponseData, userId: string, domains?: string[]): UserDataServiceResponse => {
    const { firstName, lastName, displayName, mail } = kartoffelResponseData;

    return {
      [userId]: {
        firstName,
        lastName,
        displayName,
        mail,
        domains: domains ? domains : [],
      },
    } as UserDataServiceResponse;
  };
}
