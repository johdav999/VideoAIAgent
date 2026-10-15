# Unchanged algorithm from Cinetic v1.0.0 deliver.sh, MIT; see third_party/cinetic/provenance.json.
import json, subprocess, sys
from fractions import Fraction
d = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_streams', '-of', 'json', sys.argv[1]],
                              capture_output=True, text=True, check=True).stdout)
v = next(s for s in d['streams'] if s['codec_type'] == 'video')
a = any(s['codec_type'] == 'audio' for s in d['streams'])
print(v['width'], v['height'], float(Fraction(v['avg_frame_rate'])), v['nb_read_packets'], int(a))
