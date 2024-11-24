import https from 'https';
import axios, { AxiosResponse } from 'axios';
import { UserDataServiceResponse } from './interfaces';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

export const fetchUserDataService = async (
  endpoint: string,
  userId: string,
  queryParams?: { [key: string]: string | number | boolean | string[] },
  headerParams?: { [key: string]: string | number | boolean | string[] }
): Promise<UserDataServiceResponse> => {
  let res: AxiosResponse | null = null;

  const stringQueryParams = Object.entries(queryParams ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');

  res = await axiosInstance.get(`${endpoint}/${userId}?${stringQueryParams}`, { headers: headerParams });

  return (res?.data ?? {}) as UserDataServiceResponse;
};
