import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {ApiError} from '../jobs/specification.mjs';
import {planBrief} from '../agent/brief-plan.mjs';
import {serveUi} from './ui.mjs';

export function publicJob(record) {
  const {id, state, progress, attempts, recoveries, createdAt, updatedAt} = record;
  const {logoDataUrl, ...brand} = record.spec.brand;
  const result =
    record.result &&
    (({file, project, ...rest}) => ({
      ...rest,
      url: `/v1/video-jobs/${id}/video`,
      contentType: 'video/mp4',
    }))(record.result);
  return {
    id,
    state,
    progress,
    attempts,
    recoveries,
    createdAt,
    updatedAt,
    specification: {...record.spec, brand: {...brand, logoProvided: Boolean(logoDataUrl)}},
    links: {
      self: `/v1/video-jobs/${id}`,
      cancel: `/v1/video-jobs/${id}/cancel`,
      retry: `/v1/video-jobs/${id}/retry`,
    },
    ...(record.error
      ? {
          error: {
            code: record.error.code,
            message:
              record.error.code === 'INTERRUPTED'
                ? 'Previous attempt was interrupted.'
                : record.error.code === 'CANCELLED'
                  ? 'Video job was cancelled.'
                  : 'Render failed. The local job record and film log contain details.',
          },
        }
      : {}),
    ...(result ? {result} : {}),
  };
}

async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))
    throw new ApiError(415, 'JSON_REQUIRED', 'Use Content-Type: application/json.');
  if (Number(request.headers['content-length']) > 1024 * 1024)
    throw new ApiError(413, 'BODY_TOO_LARGE', 'JSON body must be at most 1 MiB.');
  return new Promise((resolve, reject) => {
    let bytes = 0,
      finished = false;
    const chunks = [];
    const fail = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(
      () =>
        fail(new ApiError(408, 'BODY_TIMEOUT', 'JSON body was not received within 15 seconds.')),
      15000,
    );
    request.on('data', (chunk) => {
      if (finished) return;
      bytes += chunk.length;
      if (bytes > 1024 * 1024) {
        fail(new ApiError(413, 'BODY_TOO_LARGE', 'JSON body must be at most 1 MiB.'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('error', fail);
    request.on('aborted', () =>
      fail(new ApiError(400, 'REQUEST_ABORTED', 'Request body was interrupted.')),
    );
    request.on('end', () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON.'));
      }
    });
  });
}

async function video(request, response, record) {
  if (record.state !== 'succeeded' || !record.result)
    throw new ApiError(409, 'VIDEO_NOT_READY', 'The job has no completed video.');
  const {file, project} = record.result;
  let actual, info;
  try {
    actual = await realpath(file);
    info = await stat(actual);
  } catch {
    throw new ApiError(
      410,
      'ARTIFACT_MISSING',
      'The completed video is missing from local storage.',
    );
  }
  if (!info.isFile() || path.dirname(actual) !== (await realpath(path.join(project, 'out'))))
    throw new ApiError(
      410,
      'ARTIFACT_MISSING',
      'The artifact is outside its recorded output directory.',
    );
  const size = info.size;
  response.setHeader('Content-Type', 'video/mp4');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Disposition', `inline; filename="video-${record.id}.mp4"`);
  response.setHeader('ETag', `"${record.result.sha256}"`);
  let start = 0,
    end = size - 1,
    status = 200;
  const range = request.headers.range;
  if (
    range &&
    (!request.headers['if-range'] || request.headers['if-range'] === response.getHeader('ETag'))
  ) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.setHeader('Content-Range', `bytes */${size}`);
      throw new ApiError(416, 'INVALID_RANGE', 'Use a single valid byte range.');
    }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= size
    ) {
      response.setHeader('Content-Range', `bytes */${size}`);
      throw new ApiError(416, 'INVALID_RANGE', 'Byte range is outside the video.');
    }
    status = 206;
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  response.writeHead(status, {'Content-Length': end - start + 1});
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(actual, {start, end});
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

export function createApiServer({jobs} = {}) {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      response.writeHead(status);
      response.end(JSON.stringify(body));
    };
    try {
      const host = request.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
        throw new ApiError(403, 'LOCAL_HOST_REQUIRED', 'Use the local loopback service address.');
      if (request.headers.origin && request.headers.origin !== `http://${host}`)
        throw new ApiError(
          403,
          'ORIGIN_REJECTED',
          'Cross-origin browser requests are not enabled.',
        );
      const url = new URL(request.url, `http://${host}`);
      if (await serveUi(request, response, url.pathname)) return;
      if (request.method === 'GET' && url.pathname === '/health') {
        send(jobs?.fatal ? 503 : 200, {
          service: 'VideoAIAgent',
          status: jobs ? 'local-service' : 'scaffold',
          capabilities: {
            rendering: Boolean(jobs),
            cineticWindows: Boolean(jobs),
            jobQueue: Boolean(jobs),
            azureStorage: false,
          },
        });
        return;
      }
      if (!jobs) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
      if (request.method === 'POST' && url.pathname === '/v1/video-plans') {
        send(200, planBrief(await readBody(request)));
        return;
      }
      if (url.pathname === '/v1/video-jobs') {
        if (request.method === 'POST') {
          const {job, replayed} = await jobs.submit(
            await readBody(request),
            request.headers['idempotency-key'],
          );
          response.setHeader('Location', `/v1/video-jobs/${job.id}`);
          if (replayed) response.setHeader('Idempotency-Replayed', 'true');
          send(replayed ? 200 : 202, publicJob(job));
          return;
        }
        if (request.method === 'GET') {
          const raw = url.searchParams.get('limit') ?? '50';
          const limit = Number(raw);
          if (!/^\d+$/.test(raw) || !Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new ApiError(400, 'INVALID_LIMIT', 'limit must be 1-100.');
          send(200, {jobs: jobs.list(limit).map(publicJob)});
          return;
        }
      }
      const match =
        /^\/v1\/video-jobs\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})(?:\/(cancel|retry|video))?$/.exec(
          url.pathname,
        );
      if (match) {
        const [, id, action] = match;
        if (!action && request.method === 'GET') {
          send(200, publicJob(jobs.get(id)));
          return;
        }
        if (action === 'cancel' && request.method === 'POST') {
          send(202, publicJob(await jobs.cancel(id)));
          return;
        }
        if (action === 'retry' && request.method === 'POST') {
          send(202, publicJob(await jobs.retry(id)));
          return;
        }
        if (action === 'video' && ['GET', 'HEAD'].includes(request.method)) {
          await video(request, response, jobs.get(id));
          return;
        }
      }
      throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      send(error.status ?? 500, {
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.status ? error.message : 'Unexpected service error.',
        },
      });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}
