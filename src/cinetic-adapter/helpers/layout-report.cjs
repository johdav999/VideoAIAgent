// Unchanged algorithm from Cinetic v1.0.0 layout-audit.sh, MIT; see third_party/cinetic/provenance.json.
const fs = require('fs');
const [log, jsonPath, comp, framesArg, outDir, maxArg, lenArg] = process.argv.slice(2);
const want = framesArg.split(',').map(Number);
const maxV = Number(maxArg); // text-speed limit, px/f in a 1080 px tall frame; 0: the check is off
const pairs = maxV > 0 ? want.filter((f) => f + 1 < Number(lenArg)) : []; // f -> f+1
const byFrame = new Map();
for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
  const i = line.indexOf('BF_AUDIT ');
  if (i < 0) continue;
  try { const d = JSON.parse(line.slice(i + 9)); byFrame.set(d.frame, d); } catch { /* truncated line */ }
}
const missing = [...new Set([...want, ...pairs.map((f) => f + 1)])].filter((f) => !byFrame.has(f));
const audited = want.filter((f) => byFrame.has(f)).map((f) => byFrame.get(f)); // f+1 frames only feed the speed
const issues = [];
for (const d of audited) for (const x of d.issues) issues.push({ frame: d.frame, ...x });
// Text speed: each box's centre from f to the nearest box with its id on f+1, in px of a 1080 px
// tall frame. Readable: effective opacity >= 0.5 and at least the minimum size.
let fastest = null;
for (const f of pairs) {
  const a = byFrame.get(f), b = byFrame.get(f + 1);
  if (!a || !b) continue;
  const k = 1080 / a.height;
  for (const box of a.boxes) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const d = Math.min(...b.boxes.filter((n) => n.id === box.id).map((n) => Math.hypot(n.x + n.w / 2 - cx, n.y + n.h / 2 - cy)));
    if (!Number.isFinite(d)) continue; // gone (or faded out) on f+1
    box.speed = Math.round(d * k * 10) / 10;
    if (box.opacity < 0.5 || box.px < (a.minPx ?? 0)) continue;
    if (!fastest || box.speed > fastest.speed) fastest = { frame: f, id: box.id, speed: box.speed };
    if (box.speed <= maxV) continue;
    const at = k === 1 ? '' : ` (${Math.round(d * 10) / 10} px/f in ${a.width}x${a.height}, scaled to 1080 px tall)`;
    issues.push({ frame: f, kind: 'text-speed', id: box.id,
      detail: `${box.speed} px/f > ${maxV}${at}: slow it under ${maxV} px/f, or fade its text out for the flight and resolve it on landing`, speed: box.speed });
  }
}
issues.sort((p, q) => p.frame - q.frame);
const report = {
  tool: 'layout-audit', comp, frames: want, audited: audited.length, missing, stills: outDir,
  pass: issues.length === 0 && missing.length === 0 && audited.length > 0,
  issues,
  speed: maxV > 0 ? { max: maxV, pairs: pairs.length, fastest } : null,
  zone: audited[0]?.zone, safe: audited[0]?.safe,
  boxes: audited.map((d) => ({ frame: d.frame, safe: d.safe, boxes: d.boxes })),
};
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 1) + '\n');
for (const x of issues) console.log(`  f${x.frame}  ${x.kind}  ${x.id}  ${x.detail}`);
if (!byFrame.size) console.log(`  no BF_AUDIT output: does ${comp} accept the audit prop and render <Audit/> inside <FontGate>?`);
else if (missing.length) console.log(`  no audit line for frames ${missing.join(',')}`);
const n = audited.reduce((s, d) => s + d.boxes.length, 0);
const z = report.safe ? ` in ${report.zone} (top ${report.safe.top}, right ${report.safe.right}, bottom ${report.safe.bottom}, left ${report.safe.left})` : '';
const v = maxV > 0 ? `, fastest readable text ${fastest ? `${fastest.speed} px/f (${fastest.id} f${fastest.frame})` : 'not measured'}` : '';
console.log(`layout-audit: ${audited.length}/${want.length} frames, ${n} text boxes${z}${v}, ${issues.length} issues -> ${report.pass ? 'pass' : 'FAIL'} (${jsonPath}, stills in ${outDir})`);
process.exit(report.pass ? 0 : 1);
