import {createApiServer} from './server.mjs';

const portText = process.env.PORT ?? '4310';
const port = Number(portText);
if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const server = createApiServer();
server.on('error', (error) => {
  console.error(`Unable to start VideoAIAgent: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`VideoAIAgent foundation: http://127.0.0.1:${port}/health`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close());
}
