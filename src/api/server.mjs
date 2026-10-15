import {createServer} from 'node:http';

export function createApiServer() {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200);
      response.end(JSON.stringify({
        service: 'VideoAIAgent',
        status: 'scaffold',
        capabilities: {
          rendering: false,
          cineticWindows: false,
          jobQueue: false,
          azureStorage: false,
        },
      }));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({error: 'Not found'}));
  });
}
