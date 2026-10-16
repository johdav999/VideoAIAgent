import {ApiError, timing, validateSpecification} from '../jobs/specification.mjs';

const formats = {landscape: [1280, 720], portrait: [720, 1280], square: [1080, 1080]};
const palettes = {
  evergreen: {background: '#101E1B', foreground: '#F3F8F5', accent: '#72E5B5'},
  ocean: {background: '#101A2E', foreground: '#F4F7FB', accent: '#66C8FF'},
  graphite: {background: '#191B20', foreground: '#F6F7FB', accent: '#D4E477'},
};
function compact(value, words, characters) {
  let result = value.trim().replace(/\s+/gu, ' ').split(' ').slice(0, words).join(' ');
  const points = Array.from(result);
  while (points.join('').length > characters) points.pop();
  result = points.join('').trim();
  return result;
}
export function planBrief(input) {
  const bad = (message) => {
    throw new ApiError(400, 'INVALID_BRIEF', message);
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('Enter a video brief.');
  for (const key of Object.keys(input))
    if (!['brief', 'brandName', 'durationSeconds', 'format', 'palette'].includes(key))
      bad(`Unknown brief field: ${key}.`);
  if (
    typeof input.brief !== 'string' ||
    input.brief.trim().length < 8 ||
    input.brief.length > 4000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(input.brief)
  )
    bad('Use a brief of 8–4000 characters.');
  const brand = input.brandName ?? 'Your brand';
  if (
    typeof brand !== 'string' ||
    !brand.trim() ||
    brand.length > 36 ||
    /[\x00-\x1f\x7f]/u.test(brand)
  )
    bad('Brand name must contain 1–36 printable characters.');
  if (brand.trim().split(/\s+/u).length > 4) bad('Keep the brand name to four words or fewer.');
  const format = input.format ?? 'landscape',
    palette = input.palette ?? 'evergreen',
    duration = input.durationSeconds ?? 12;
  if (!Object.hasOwn(formats, format)) bad('Choose landscape, portrait or square.');
  if (!Object.hasOwn(palettes, palette)) bad('Choose evergreen, ocean or graphite.');
  if (!Number.isInteger(duration) || duration < 6 || duration > 30)
    bad('Duration must be a whole number from 6 to 30 seconds.');
  const brief = input.brief.trim();
  const labeled = {};
  const paragraphs = [];
  for (const line of brief
    .split(/\r?\n/u)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const match = /^(title|headline|message|cta|call to action)\s*:\s*(.+)$/iu.exec(line);
    if (match)
      labeled[
        {headline: 'title', cta: 'callToAction', 'call to action': 'callToAction'}[
          match[1].toLowerCase()
        ] || match[1].toLowerCase()
      ] = match[2];
    else paragraphs.push(line);
  }
  const sentences = paragraphs
    .join(' ')
    .split(/(?<=[.!?])\s+/u)
    .filter(Boolean);
  const first = sentences[0] || labeled.title || labeled.message || brief;
  const source = {
    title: labeled.title || first,
    message: labeled.message || sentences[1] || first.split(/\s+/u).slice(6).join(' ') || first,
    callToAction: labeled.callToAction || sentences[2] || 'Learn more',
  };
  const {total, titleEnd, messageEnd} = timing({durationSeconds: duration, fps: 30});
  const lengths = [titleEnd, messageEnd - titleEnd, total - messageEnd];
  const caps = lengths.map((frames, i) =>
    Math.max(
      1,
      Math.min([6, 10, 4][i], Math.floor((frames / 30 - (i < 2 ? 0.75 : 0.45) - 0.6) * 10 + 1e-6)),
    ),
  );
  const [width, height] = formats[format];
  const specification = validateSpecification({
    schemaVersion: 1,
    template: 'product-launch',
    title: compact(source.title, caps[0], 72),
    message: compact(source.message, caps[1], 160),
    callToAction: compact(source.callToAction, caps[2], 48),
    brand: {name: brand, ...palettes[palette]},
    width,
    height,
    fps: 30,
    durationSeconds: duration,
  });
  return {
    method: 'local-extractive-v1',
    specification,
    notice:
      'Your wording is shortened into three scenes. This template does not interpret visual directions or generate footage.',
    shortened: ['title', 'message', 'callToAction'].filter(
      (key) => specification[key] !== source[key].trim(),
    ),
  };
}
