# Unchanged algorithm from Cinetic v1.0.0 deliver.sh, MIT; see third_party/cinetic/provenance.json.
import json, os, subprocess, sys
from fractions import Fraction
outdir, checks, master = sys.argv[1:4]
items = []
for name in sorted(os.listdir(outdir)):
    p = os.path.join(outdir, name)
    if name.startswith('.') or not os.path.isfile(p):
        continue  # the qa/ folder and hidden files are not deliverables
    e = {'file': name, 'mb': round(os.path.getsize(p) / 1e6, 3)}
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', p], capture_output=True, text=True)
    if r.returncode == 0:
        d = json.loads(r.stdout)
        v = next((s for s in d.get('streams', []) if s['codec_type'] == 'video'), None)
        if v:
            e.update(codec=v['codec_name'], size=f"{v['width']}x{v['height']}", pix_fmt=v.get('pix_fmt'))
            try:
                fr = float(Fraction(v.get('avg_frame_rate', '0/1')))
                if fr > 0 and d['format'].get('duration'):
                    e.update(fps=round(fr, 3), seconds=round(float(d['format']['duration']), 3))
            except (ValueError, ZeroDivisionError):
                pass
            e['audio'] = any(s['codec_type'] == 'audio' for s in d['streams'])
    items.append(e)
res = [json.loads(l) for l in open(checks) if l.strip()]
m = {'master': master, 'files': items, 'checks': res, 'pass': all(c.get('pass', True) for c in res)}
json.dump(m, open(os.path.join(outdir, 'qa', 'manifest.json'), 'w'), indent=1)
for e in items:
    print(f"  {e['file']:<28} {e['mb']:>8.2f} MB  {e.get('codec', '')} {e.get('size', '')} {e.get('pix_fmt', '') or ''}", file=sys.stderr)
