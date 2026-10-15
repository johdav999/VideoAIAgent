# Unchanged algorithm from Cinetic v1.0.0 deliver.sh, MIT; see third_party/cinetic/provenance.json.
import json, subprocess, sys
import numpy as np
f = sys.argv[1]
s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt,profile',
                               '-of', 'json', f], capture_output=True, text=True).stdout)['streams'][0]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'scale=320:-2', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                     capture_output=True).stdout
a = np.frombuffer(raw, np.uint8)[3::4]
clear = float((a < 250).mean()) if len(a) else 0.0
# Remotion encodes yuva444p10le; ffprobe reports the ProRes decoder's format, yuva444p12le
ok = s.get('codec_name') == 'prores' and str(s.get('pix_fmt', '')).startswith('yuva444p')
print(f"  {f}: {s.get('codec_name')} {s.get('profile')} {s.get('pix_fmt')}, first frame {clear:.0%} non-opaque"
      + ('' if clear > 0 else ' (warning: fully opaque; paint no background when rendering the alpha version)'))
sys.exit(0 if ok else 1)
