# Unchanged algorithm from Cinetic v1.0.0 deliver.sh, MIT; see third_party/cinetic/provenance.json.
import subprocess, sys
import numpy as np
def rgb(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                        '-of', 'csv=p=0', p], capture_output=True, text=True, check=True).stdout.split(',')
    w, h = int(r[0]), int(r[1])
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', 'format=rgb24', '-f', 'rawvideo', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(b, np.uint8).reshape(h, w, 3).astype(np.int16)
a, b = rgb(sys.argv[1]), rgb(sys.argv[2])
if a.shape != b.shape:
    print(f'it is {a.shape[1]}x{a.shape[0]}, the master {b.shape[1]}x{b.shape[0]}'); sys.exit(1)
d = np.abs(a - b)
mad, far = float(d.mean()), float((d.max(axis=2) > 32).mean())
# the same frame measures MAD < 1 and < 0.1% of pixels off by > 32 (4:2:0 edges, blur); a neighbouring frame 0.4%
print(f'MAD {mad:.2f}, {100 * far:.2f}% of pixels off by > 32 levels')
sys.exit(0 if mad <= 2.0 and far <= 0.0025 else 1)
