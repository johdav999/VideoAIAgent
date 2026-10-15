export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const invalid = (message) => {
  throw new ApiError(400, 'INVALID_SPECIFICATION', message);
};
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) invalid(`Unknown ${label} field: ${key}.`);
}
function text(value, label, max) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    invalid(`${label} must contain 1-${max} printable characters.`);
  return value.trim().replace(/\s+/g, ' ');
}
function number(value, label, fallback, min, max) {
  const result = value === undefined ? fallback : value;
  if (!Number.isInteger(result) || result < min || result > max)
    invalid(`${label} must be an integer from ${min} to ${max}.`);
  return result;
}
function colour(value, label, fallback) {
  const result = value === undefined ? fallback : value;
  if (typeof result !== 'string' || !/^#[a-f\d]{6}$/i.test(result))
    invalid(`${label} must be a six-digit hex colour.`);
  return result.toUpperCase();
}
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
export function decodeLogo(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^data:image\/png;base64,[A-Za-z\d+/]+={0,2}$/.test(value))
    invalid('brand.logoDataUrl must be an embedded base64 PNG, not a URL or filesystem path.');
  const encoded = value.slice('data:image/png;base64,'.length);
  if (encoded.length > 350000) invalid('PNG logo must be at most 256 KiB.');
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.length < 33 ||
    bytes.length > 256 * 1024 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    invalid('Invalid PNG logo.');
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 2048 * 2048)
    invalid('PNG logo dimensions must be 1-2048 pixels per side.');
  return bytes;
}
export function timing(spec) {
  const total = spec.durationSeconds * spec.fps;
  const beat = spec.fps / 2;
  const titleEnd = Math.round((total * 0.3) / beat) * beat;
  const messageEnd = Math.round((total * 0.65) / beat) * beat;
  return {total, titleEnd, messageEnd};
}
export function validateSpecification(input) {
  object(
    input,
    [
      'schemaVersion',
      'template',
      'title',
      'message',
      'callToAction',
      'durationSeconds',
      'width',
      'height',
      'fps',
      'brand',
    ],
    'specification',
  );
  if (input.schemaVersion !== 1 || input.template !== 'product-launch')
    invalid('Use schemaVersion: 1 and template: product-launch.');
  object(input.brand, ['name', 'background', 'foreground', 'accent', 'logoDataUrl'], 'brand');
  const spec = {
    schemaVersion: 1,
    template: 'product-launch',
    title: text(input.title, 'title', 72),
    message: text(input.message, 'message', 160),
    callToAction: text(input.callToAction, 'callToAction', 48),
    durationSeconds: number(input.durationSeconds, 'durationSeconds', 12, 6, 30),
    width: number(input.width, 'width', 1280, 320, 1920),
    height: number(input.height, 'height', 720, 180, 1920),
    fps: number(input.fps, 'fps', 30, 30, 60),
    brand: {
      name: text(input.brand.name, 'brand.name', 36),
      background: colour(input.brand.background, 'brand.background', '#101A2E'),
      foreground: colour(input.brand.foreground, 'brand.foreground', '#F4F7FB'),
      accent: colour(input.brand.accent, 'brand.accent', '#44D7B6'),
    },
  };
  if (
    ![30, 60].includes(spec.fps) ||
    spec.width % 2 ||
    spec.height % 2 ||
    spec.width * spec.height > 1920 * 1080
  )
    invalid('Use 30 or 60 fps, even dimensions, and at most 2,073,600 pixels.');
  if (
    contrast(spec.brand.foreground, spec.brand.background) < 4.5 ||
    contrast(spec.brand.accent, spec.brand.background) < 3
  )
    invalid(
      'Brand foreground/background contrast must be at least 4.5:1 and accent/background at least 3:1.',
    );
  const words = [spec.title, spec.message, spec.callToAction, spec.brand.name].map(
    (value) => value.split(' ').length,
  );
  if (words.reduce((sum, n) => sum + n, 0) > 28)
    invalid(
      'Use at most 28 words across title, message, callToAction and brand name (the template reserves seven label words).',
    );
  const {total, titleEnd, messageEnd} = timing(spec);
  for (const [index, frames] of [titleEnd, messageEnd - titleEnd, total - messageEnd].entries())
    if (frames / spec.fps - (index < 2 ? 0.75 : 0.45) < 0.6 + words[index] * 0.1)
      invalid('Increase durationSeconds or shorten the copy to allow enough reading time.');
  if (input.brand.logoDataUrl !== undefined) {
    const logo = decodeLogo(input.brand.logoDataUrl);
    spec.brand.logoDataUrl = `data:image/png;base64,${logo.toString('base64')}`;
  }
  return spec;
}
