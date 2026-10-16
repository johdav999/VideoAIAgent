const $ = (id) => document.getElementById(id);
const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const stateLabels = {
  queued: 'In queue',
  preparing: 'Preparing',
  rendering: 'Rendering',
  verifying: 'Checking',
  cancelling: 'Cancelling',
  succeeded: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const stageLabels = {
  queued: 'Waiting in queue',
  preparing: 'Preparing scenes and soundtrack',
  rendering: 'Rendering video frames',
  verifying: 'Checking picture and sound',
  cancelling: 'Stopping generation',
  succeeded: 'Your video is ready',
  failed: 'Generation stopped',
  cancelled: 'Generation cancelled',
};
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Rendering does not depend on browser storage. */
    }
  },
};
let online = false,
  busy = false,
  selectedId = storage.get('videoai.selected'),
  current = null,
  draft = null,
  pending = null,
  actionPending = false,
  clientError = '',
  selectionVersion = 0;

async function request(url, options = {}) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(15000)});
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(value.error?.message || 'The request could not be completed.'), {
      status: response.status,
    });
  return value;
}
function post(url, body, headers = {}) {
  return request(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
}
function inputs() {
  return {
    brief: $('brief').value,
    brandName: $('brand').value,
    durationSeconds: Number($('duration').value),
    format: $('format').value,
    palette: document.querySelector('input[name=palette]:checked').value,
  };
}
function key(input) {
  return JSON.stringify(input);
}
function setBusy(value, label = 'Preparing your video…') {
  busy = value;
  $('generate').disabled = value || !online;
  $('prepare-copy').disabled = value;
  $('generate-label').textContent = value ? label : 'Generate video';
  $('video-form').setAttribute('aria-busy', String(value));
  for (const field of $('video-form').querySelectorAll('input,textarea,select'))
    field.disabled = value;
}
function formError(message = '') {
  $('form-error').textContent = message;
  $('form-error').hidden = !message;
}
function setConnection(value) {
  online = value;
  $('connection').dataset.online = String(value);
  $('connection-text').textContent = value ? 'Local studio online' : 'Reconnecting…';
  $('generate').disabled = busy || !value;
  if (current) {
    $('cancel').disabled = !value || actionPending || current.state === 'cancelling';
    $('retry').disabled = !value || actionPending;
  }
  if (!value && current && !terminal.has(current.state))
    $('status-detail').textContent =
      'Connection lost. Your job stays on the server. Reconnecting automatically…';
}
function sceneCopy() {
  return {
    title: $('title-copy').value,
    message: $('message-copy').value,
    callToAction: $('cta-copy').value,
  };
}
function applyPlan(plan, input, preservedCopy = null) {
  draft = {key: key(input), sourceBrief: input.brief, specification: plan.specification};
  const copy = preservedCopy || plan.specification;
  $('title-copy').value = copy.title;
  $('message-copy').value = copy.message;
  $('cta-copy').value = copy.callToAction;
  $('copy-fields').hidden = false;
  $('copy-note').textContent = preservedCopy
    ? 'Your scene copy is preserved. The current video settings will be used.'
    : plan.shortened.length
      ? 'Some text was shortened to fit the scene and reading time. You can edit it here.'
      : 'This is the text that will appear in your video.';
}
async function prepare() {
  if (busy || !$('video-form').reportValidity()) return;
  formError();
  const input = inputs();
  setBusy(true, 'Preparing scene copy…');
  try {
    const plan = await post('/v1/video-plans', input);
    if (key(inputs()) !== key(input))
      throw Error('Your brief changed while preparing. Try again with the updated brief.');
    applyPlan(plan, input);
    $('copy-details').open = true;
    $('title-copy').focus();
  } catch (error) {
    formError(error.message);
  } finally {
    setBusy(false);
  }
}
$('prepare-copy').addEventListener('click', () => void prepare());
for (const element of [
  $('brief'),
  $('brand'),
  $('duration'),
  $('format'),
  ...document.querySelectorAll('input[name=palette]'),
])
  element.addEventListener('input', () => {
    $('brief-count').textContent = `${$('brief').value.length} / 4000`;
    storage.set('videoai.brief', JSON.stringify(inputs()));
    if (draft && draft.sourceBrief !== $('brief').value) {
      draft = null;
      $('copy-fields').hidden = true;
      $('copy-note').textContent = '';
    }
    formError();
  });
$('video-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !online) return;
  formError();
  setBusy(true);
  const input = inputs();
  try {
    if (!draft || draft.key !== key(input)) {
      const preserved = draft?.sourceBrief === input.brief ? sceneCopy() : null;
      applyPlan(await post('/v1/video-plans', input), input, preserved);
    }
    const specification = {
      ...draft.specification,
      title: $('title-copy').value,
      message: $('message-copy').value,
      callToAction: $('cta-copy').value,
    };
    const body = JSON.stringify(specification);
    if (!pending || pending.body !== body) pending = {body, key: crypto.randomUUID()};
    $('generate-label').textContent = 'Starting generation…';
    const job = await post('/v1/video-jobs', specification, {'Idempotency-Key': pending.key});
    pending = null;
    selectedId = job.id;
    selectionVersion++;
    storage.set('videoai.selected', selectedId);
    renderJob(job);
    await refresh();
    if (matchMedia('(max-width:760px)').matches)
      $('preview-heading').scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
  } catch (error) {
    formError(error.message);
  } finally {
    setBusy(false);
  }
});
function renderJob(job) {
  if (current?.id !== job.id) clientError = '';
  current = job;
  $('job-status').hidden = false;
  const state = job.state,
    percent = Math.max(0, Math.min(100, Number(job.progress?.percent) || 0));
  $('state-badge').textContent = stateLabels[state] || state;
  $('state-badge').dataset.state = state;
  $('stage-label').textContent = stageLabels[state] || state;
  $('percent').textContent = `${percent}%`;
  $('progress').value = percent;
  $('result-title').textContent = job.specification.title;
  $('result-meta').textContent =
    `${job.specification.brand.name} · ${job.specification.durationSeconds}s · ${job.specification.width} × ${job.specification.height} · ${job.specification.fps} fps`;
  $('cancel').hidden = terminal.has(state);
  $('cancel').disabled = !online || actionPending || state === 'cancelling';
  $('retry').hidden = !['failed', 'cancelled'].includes(state);
  $('retry').disabled = !online || actionPending;
  $('job-error').hidden = state !== 'failed' && !clientError;
  $('job-error').textContent =
    clientError ||
    (state === 'failed'
      ? `${job.error?.message || 'The video could not be rendered.'} You can retry this video or edit your brief and generate another.`
      : '');
  const detail = {
    queued: 'Another video may be rendering. You can leave this page and come back.',
    preparing: 'Building the scenes and creating the soundtrack.',
    rendering: 'Rendering actual video frames. Progress updates as work completes.',
    verifying: 'Checking the encoded video and audio before making it available.',
    cancelling: 'Waiting for the render process to stop.',
    succeeded: job.result?.creativeQaPassed
      ? 'Render checks passed. Play the result to review your first cut.'
      : 'The video is rendered. Review the picture, copy and sound before sharing.',
    failed: 'Your brief is still here. Retry when the render setup is ready.',
    cancelled: 'No completed video was published. You can retry whenever you like.',
  };
  $('status-detail').textContent = detail[state] || '';
  const stages = ['preparing', 'rendering', 'verifying', 'succeeded'];
  const index = stages.indexOf(state);
  for (const li of document.querySelectorAll('.stages li')) {
    const i = stages.indexOf(li.dataset.stage);
    li.classList.toggle('done', index > i);
    li.classList.toggle('current', index === i);
  }
  const ready = state === 'succeeded' && job.result;
  const video = $('video');
  $('placeholder').hidden = !!ready;
  video.hidden = !ready;
  $('download').hidden = !ready;
  $('render-spinner').hidden = terminal.has(state) || state === 'queued';
  if (ready) {
    const url = job.result.url;
    if (video.getAttribute('src') !== url) {
      video.pause();
      video.src = url;
      video.load();
    }
    $('download').href = url;
    $('download').download = `video-${job.id}.mp4`;
  } else {
    if (video.hasAttribute('src')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    $('placeholder-title').textContent =
      state === 'failed'
        ? 'Let’s try that again.'
        : state === 'cancelled'
          ? 'Paused your idea.'
          : state === 'queued'
            ? 'Your idea is in line.'
            : 'Making room for your idea.';
    $('placeholder-note').textContent =
      state === 'failed'
        ? 'Generation failed. Details and retry are below.'
        : state === 'cancelled'
          ? 'Retry to make this video when you’re ready.'
          : state === 'queued'
            ? 'Your video will start when the worker is free.'
            : 'Creating your scenes, picture and sound.';
  }
}
$('video').addEventListener('error', () => {
  if (!$('video').hasAttribute('src')) return;
  clientError =
    'The preview could not load. Try the MP4 download or refresh this page. The completed job is still saved.';
  if (current) renderJob(current);
});
async function jobAction(action) {
  if (!selectedId || actionPending) return;
  const id = selectedId;
  clientError = '';
  actionPending = true;
  renderJob(current);
  try {
    const job = await post(`/v1/video-jobs/${id}/${action}`);
    if (selectedId === id) renderJob(job);
    await refresh();
  } catch (error) {
    if (selectedId === id) clientError = error.message;
  } finally {
    actionPending = false;
    if (current) renderJob(current);
  }
}
$('cancel').addEventListener('click', () => void jobAction('cancel'));
$('retry').addEventListener('click', () => void jobAction('retry'));
async function selectJob(id) {
  const version = ++selectionVersion;
  selectedId = id;
  storage.set('videoai.selected', id);
  try {
    const job = await request(`/v1/video-jobs/${id}`);
    if (version === selectionVersion) renderJob(job);
    await refresh();
  } catch (error) {
    formError(error.message);
  }
}
function renderRecent(jobs) {
  const root = $('recent-jobs');
  const focused = document.activeElement?.dataset.jobId;
  root.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement('p');
    empty.className = 'recent-empty';
    empty.textContent = 'Your videos will appear here. You can come back while they render.';
    root.append(empty);
    return;
  }
  for (const job of jobs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-job';
    button.dataset.jobId = job.id;
    button.setAttribute('aria-pressed', String(job.id === selectedId));
    button.setAttribute(
      'aria-label',
      `${job.specification.title}, ${stateLabels[job.state] || job.state}`,
    );
    const thumb = document.createElement('span');
    thumb.className = 'job-thumb';
    thumb.textContent = job.state === 'succeeded' ? '▷' : '◈';
    thumb.setAttribute('aria-hidden', 'true');
    const description = document.createElement('span');
    description.className = 'job-description';
    const title = document.createElement('strong');
    title.textContent = job.specification.title;
    const meta = document.createElement('small');
    meta.textContent = `${job.specification.brand.name} · ${job.specification.durationSeconds}s`;
    description.append(title, meta);
    const state = document.createElement('span');
    state.className = 'job-state';
    state.textContent = stateLabels[job.state] || job.state;
    button.append(thumb, description, state);
    button.addEventListener('click', () => void selectJob(job.id));
    root.append(button);
    if (focused === job.id) button.focus({preventScroll: true});
  }
}
let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  const version = selectionVersion;
  try {
    const value = await request('/v1/video-jobs?limit=6');
    setConnection(true);
    renderRecent(value.jobs);
    if (!selectedId && value.jobs.length) {
      selectedId = value.jobs[0].id;
      storage.set('videoai.selected', selectedId);
      renderRecent(value.jobs);
    }
    let job = value.jobs.find((j) => j.id === selectedId);
    if (selectedId && !job) {
      try {
        job = await request(`/v1/video-jobs/${selectedId}`);
      } catch (error) {
        if (error.status !== 404) throw error;
        if (version === selectionVersion) {
          selectedId = null;
          storage.set('videoai.selected', '');
        }
      }
    }
    if (job && version === selectionVersion && job.id === selectedId) renderJob(job);
  } catch {
    setConnection(false);
  } finally {
    refreshing = false;
  }
}
try {
  const saved = JSON.parse(storage.get('videoai.brief'));
  if (saved && typeof saved.brief === 'string') {
    $('brief').value = saved.brief.slice(0, 4000);
    $('brand').value = typeof saved.brandName === 'string' ? saved.brandName : 'Your brand';
    if (['8', '12', '20', '30'].includes(String(saved.durationSeconds)))
      $('duration').value = String(saved.durationSeconds);
    if (['landscape', 'portrait', 'square'].includes(saved.format))
      $('format').value = saved.format;
    for (const radio of document.querySelectorAll('input[name=palette]'))
      if (radio.value === saved.palette) radio.checked = true;
  }
} catch {
  /* An invalid local draft never blocks a new film. */
}
$('brief-count').textContent = `${$('brief').value.length} / 4000`;
setBusy(false);
await refresh();
async function poll() {
  await refresh();
  setTimeout(poll, 2000);
}
setTimeout(poll, 2000);
