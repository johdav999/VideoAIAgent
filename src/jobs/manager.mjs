import {mkdir, readdir, stat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {repositoryRoot, json} from '../cinetic-adapter/workspace.mjs';
import {atomicJson, readJson} from '../shared/files.mjs';
import {createProductFilm} from '../templates/create-product-film.mjs';
import {renderFilm} from '../renderer/render-film.mjs';
import {ApiError, validateSpecification} from './specification.mjs';
import {acquireOwner} from './owner-lock.mjs';

export const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const active = new Set(['preparing', 'rendering', 'verifying', 'cancelling']);
const copy = (value) => structuredClone(value);
const now = () => new Date().toISOString();
const fingerprint = (spec) => createHash('sha256').update(JSON.stringify(spec)).digest('hex');

export class JobManager {
  constructor({root = path.join(repositoryRoot, 'data/service'), execute} = {}) {
    this.root = path.resolve(root);
    this.records = new Map();
    this.keys = new Map();
    this.chain = Promise.resolve();
    this.execute = execute ?? this.executeReal.bind(this);
    this.closing = false;
    this.runner = null;
    this.current = null;
  }
  async start() {
    this.release = await acquireOwner(this.root);
    try {
      await mkdir(path.join(this.root, 'jobs'), {recursive: true});
      for (const name of await readdir(path.join(this.root, 'jobs'))) {
        if (!/^[a-f\d-]{36}\.json$/.test(name)) continue;
        const record = await readJson(path.join(this.root, 'jobs', name));
        if (record.id !== name.slice(0, -5) || record.schemaVersion !== 1)
          throw new Error(`Invalid persisted job ${name}.`);
        if (active.has(record.state)) {
          const wasCancelling = record.state === 'cancelling';
          record.state = wasCancelling ? 'cancelled' : 'queued';
          record.progress = {stage: record.state, percent: 0};
          record.recoveries = (record.recoveries ?? 0) + 1;
          record.error = {
            code: wasCancelling ? 'CANCELLED' : 'INTERRUPTED',
            message: wasCancelling
              ? 'Cancellation completed after restart.'
              : 'Service stopped during the previous attempt.',
          };
          record.updatedAt = now();
          await this.save(record);
        }
        this.records.set(record.id, record);
        if (record.idempotencyKey) this.keys.set(record.idempotencyKey, record.id);
      }
      this.kick();
      return this;
    } catch (error) {
      await this.release();
      throw error;
    }
  }
  serial(action) {
    const result = this.chain.then(action);
    this.chain = result.catch(() => {});
    return result;
  }
  async save(record) {
    await atomicJson(path.join(this.root, 'jobs', `${record.id}.json`), record);
  }
  get(id) {
    const result = this.records.get(id);
    if (!result) throw new ApiError(404, 'JOB_NOT_FOUND', 'Video job not found.');
    return copy(result);
  }
  list(limit = 50) {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(copy);
  }
  async submit(input, key) {
    const spec = validateSpecification(input);
    if (key !== undefined && !/^[A-Za-z\d._:-]{1,128}$/.test(key))
      throw new ApiError(
        400,
        'INVALID_IDEMPOTENCY_KEY',
        'Idempotency-Key must be 1-128 letters, numbers, dots, underscores, colons or hyphens.',
      );
    const result = await this.serial(async () => {
      if (this.closing || this.fatal)
        throw new ApiError(
          503,
          'WORKER_UNAVAILABLE',
          'Service is stopping or its worker is unavailable.',
        );
      if (key && this.keys.has(key)) {
        const prior = this.records.get(this.keys.get(key));
        if (prior.fingerprint !== fingerprint(spec))
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was already used for a different specification.',
          );
        return {job: copy(prior), replayed: true};
      }
      if ([...this.records.values()].filter((job) => !terminal.has(job.state)).length >= 100)
        throw new ApiError(429, 'QUEUE_FULL', 'The local queue holds at most 100 unfinished jobs.');
      const record = {
        schemaVersion: 1,
        id: randomUUID(),
        spec,
        fingerprint: fingerprint(spec),
        ...(key ? {idempotencyKey: key} : {}),
        state: 'queued',
        progress: {stage: 'queued', percent: 0},
        attempts: 0,
        recoveries: 0,
        createdAt: now(),
        queuedAt: now(),
        updatedAt: now(),
      };
      await this.save(record);
      this.records.set(record.id, record);
      if (key) this.keys.set(key, record.id);
      return {job: copy(record), replayed: false};
    });
    this.kick();
    return result;
  }
  async cancel(id) {
    const job = await this.serial(async () => {
      const record = this.records.get(id);
      if (!record) throw new ApiError(404, 'JOB_NOT_FOUND', 'Video job not found.');
      if (record.state === 'cancelled' || record.state === 'cancelling') return copy(record);
      if (terminal.has(record.state))
        throw new ApiError(409, 'JOB_TERMINAL', 'A completed or failed job cannot be cancelled.');
      const next = {
        ...record,
        state: record.state === 'queued' ? 'cancelled' : 'cancelling',
        updatedAt: now(),
      };
      next.progress = {...record.progress, stage: next.state};
      await this.save(next);
      this.records.set(id, next);
      return copy(next);
    });
    if (this.current?.id === id) this.current.controller.abort();
    return job;
  }
  async retry(id) {
    const job = await this.serial(async () => {
      if (this.closing || this.fatal)
        throw new ApiError(
          503,
          'WORKER_UNAVAILABLE',
          'Service is stopping or its worker is unavailable.',
        );
      const old = this.get(id);
      if (!['failed', 'cancelled'].includes(old.state))
        throw new ApiError(
          409,
          'JOB_NOT_RETRYABLE',
          'Only failed or cancelled jobs can be retried.',
        );
      const {error, result, ...rest} = old;
      const next = {
        ...rest,
        state: 'queued',
        progress: {stage: 'queued', percent: 0},
        queuedAt: now(),
        updatedAt: now(),
      };
      await this.save(next);
      this.records.set(id, next);
      return copy(next);
    });
    this.kick();
    return job;
  }
  kick() {
    if (this.runner || this.closing) return;
    this.runner = this.loop()
      .catch((error) => {
        this.fatal = error;
        console.error('Job worker stopped:', error);
      })
      .finally(() => {
        this.runner = null;
        if (
          !this.closing &&
          !this.fatal &&
          [...this.records.values()].some((job) => job.state === 'queued')
        )
          this.kick();
      });
  }
  async loop() {
    while (!this.closing && !this.fatal) {
      const job = await this.serial(async () => {
        const old = [...this.records.values()]
          .filter((record) => record.state === 'queued')
          .sort((a, b) => (a.queuedAt ?? a.createdAt).localeCompare(b.queuedAt ?? b.createdAt))[0];
        if (!old) return null;
        const record = {
          ...old,
          state: 'preparing',
          attempts: old.attempts + 1,
          progress: {stage: 'preparing', percent: 2},
          updatedAt: now(),
        };
        await this.save(record);
        this.records.set(record.id, record);
        return copy(record);
      });
      if (!job) break;
      const controller = new AbortController();
      this.current = {id: job.id, controller};
      if (this.closing || this.records.get(job.id).state === 'cancelling') controller.abort();
      const onEvent = (event) =>
        this.serial(async () => {
          const record = this.records.get(job.id);
          if (!record || terminal.has(record.state) || record.state === 'cancelling') return;
          if (!['preparing', 'rendering', 'verifying'].includes(event.stage)) return;
          const percent =
            event.stage === 'preparing'
              ? 5
              : event.stage === 'verifying'
                ? 90
                : 10 + Math.round(event.percent * 0.75);
          const next = {
            ...record,
            state: event.stage,
            progress: {stage: event.stage, percent: Math.max(record.progress.percent, percent)},
            updatedAt: now(),
          };
          await this.save(next);
          this.records.set(job.id, next);
        }).catch((error) => {
          this.fatal = error;
          controller.abort();
        });
      try {
        const result = await this.execute(job, {signal: controller.signal, onEvent});
        await this.serial(async () => {
          const latest = this.records.get(job.id);
          const cancelled = latest.state === 'cancelling';
          const next = {
            ...latest,
            state: cancelled ? 'cancelled' : 'succeeded',
            progress: {
              stage: cancelled ? 'cancelled' : 'succeeded',
              percent: cancelled ? latest.progress.percent : 100,
            },
            updatedAt: now(),
            ...(cancelled ? {} : {result}),
          };
          delete next.error;
          await this.save(next);
          this.records.set(job.id, next);
        });
      } catch (error) {
        await this.serial(async () => {
          const latest = this.records.get(job.id);
          const cancelled = latest.state === 'cancelling';
          const state = cancelled ? 'cancelled' : this.closing ? 'queued' : 'failed';
          const next = {
            ...latest,
            state,
            progress: {stage: state, percent: state === 'queued' ? 0 : latest.progress.percent},
            updatedAt: now(),
            error: {
              code: cancelled
                ? 'CANCELLED'
                : this.closing
                  ? 'INTERRUPTED'
                  : (error.code ?? 'RENDER_FAILED'),
              message: String(error.message).slice(-4000),
            },
          };
          await this.save(next);
          this.records.set(job.id, next);
        });
      } finally {
        this.current = null;
      }
    }
  }
  async executeReal(job, {signal, onEvent}) {
    const project = await createProductFilm(job.spec, `job-${job.id}-${job.attempts}`);
    const status = await renderFilm(project, {signal, onEvent, onOutput: () => {}});
    const acceptance = await json(path.join(project, 'out/qa/acceptance.json'));
    const file = await realpath(status.output);
    if (path.dirname(file) !== (await realpath(path.join(project, 'out'))))
      throw new Error('Artifact escaped its job workspace.');
    const info = await stat(file);
    return {
      file,
      project,
      bytes: info.size,
      sha256: acceptance.sha256,
      width: job.spec.width,
      height: job.spec.height,
      fps: job.spec.fps,
      durationSeconds: job.spec.durationSeconds,
      technicalQaPassed: status.technicalQaPassed,
      creativeQaPassed: status.creativeQaPassed,
      shipReady: false,
    };
  }
  async close() {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.current?.controller.abort();
    this.closePromise = (async () => {
      await this.runner;
      await this.chain;
      if (this.release) {
        await this.release();
        this.release = null;
      }
    })();
    return this.closePromise;
  }
}
