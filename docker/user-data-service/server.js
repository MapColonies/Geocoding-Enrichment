// Minimal mock of the external userData service, based on the README's reference implementation.
// Only intended for local docker-compose use.
const http = require('http');

const port = process.env.PORT ?? 8080;

const users = {
  'avi@mapcolonies.net': {
    firstName: 'avi',
    lastName: 'map',
    displayName: 'mapcolonies/avi',
    mail: 'avi@mapcolonies.net',
    domains: ['USA', 'FRANCE'],
  },
};

const server = http.createServer((req, res) => {
  const match = /^\/user_data\/([^/?]+)/.exec(req.url ?? '');

  if (req.method !== 'GET' || !match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'not found' }));
    return;
  }

  const userId = decodeURIComponent(match[1]);
  console.log('new request', { userid: userId });
  const user = users[userId] ?? { [userId]: null };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(user));
});

server.listen(port, () => {
  console.log(`user-data-service mock is running on port ${port}`);
});
