# Unchanged algorithm from Cinetic v1.0.0 deliver.sh, MIT; see third_party/cinetic/provenance.json.
import json, subprocess, sys
import numpy as np
src, out = sys.argv[1:3]
W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H}:flags=area,format=rgb24', '-f', 'rawvideo', '-'],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.int16)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2, 3))            # step i -> i+1
seam = float(np.abs(fr[0] - fr[-1]).mean())                      # last frame -> frame 0
ends = np.concatenate([d[:8], d[-8:]])                            # the steps around the wrap
local = float(np.median(ends)) if len(ends) else 0.0
limit = max(0.4, 1.5 * local)                                     # same rule as forensics.py --loop
ok = seam <= limit
res = {'check': 'loop_seam', 'pass': bool(ok), 'seam_mad': round(seam, 3), 'median_step_at_ends': round(local, 3),
       'limit': round(limit, 3), 'median_step': round(float(np.median(d)), 3) if len(d) else None,
       'rule': 'seam <= max(0.4, 1.5 x median of the 8 steps at each end)'}
json.dump(res, open(out, 'w'), indent=1)
print(f"  loop seam MAD {seam:.3f}, limit {limit:.3f} (median step at the ends {local:.3f}): "
      + ('OK' if ok else 'FAIL: the last frame does not flow into frame 0 (match state and velocity; whole bars)'))
sys.exit(0 if ok else 1)
