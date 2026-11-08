import { createServer, IncomingMessage, ServerResponse } from 'http';
import httpStatus from 'http-status-codes';
import { UserDataServiceResponse } from '../../src/common/interfaces';

const port = 8080;

// eslint-disable-next-line @typescript-eslint/naming-convention
const jsonHeaders = { 'Content-Type': 'application/json' };

/* eslint-disable @typescript-eslint/naming-convention */
const users: UserDataServiceResponse = {
  'avi@mapcolonies.net': {
    firstName: 'avi',
    lastName: 'map',
    displayName: 'mapcolonies/avi',
    mail: 'avi@mapcolonies.net',
    domains: ['USA', 'FRANCE'],
  },
};
/* eslint-enable @typescript-eslint/naming-convention */

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const match = /^\/user_data\/([^/?]+)/.exec(req.url ?? '');

  if (req.method !== 'GET' || !match) {
    res.writeHead(httpStatus.NOT_FOUND, jsonHeaders);
    res.end(JSON.stringify({ message: 'not found' }));
    return;
  }

  const userId = decodeURIComponent(match[1]);
  console.log('new request', { userid: userId });
  const user = users[userId] ?? { [userId]: null };

  res.writeHead(httpStatus.OK, jsonHeaders);
  res.end(JSON.stringify(user));
});

server.listen(port, () => {
  console.log(`user-data-service mock is running on port ${port}`);
});
