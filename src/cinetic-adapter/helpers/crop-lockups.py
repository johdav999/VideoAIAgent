# Unchanged algorithm from Cinetic v1.0.0 brand-kit.sh, MIT; see third_party/cinetic/provenance.json.
import sys, cv2, numpy as np
work, out = sys.argv[1:3]
for g in ('light', 'dark'):
    im = cv2.imread(f'{work}/lockup-{g}.png', cv2.IMREAD_UNCHANGED)
    if im is None or im.shape[2] != 4:
        sys.exit(f'lockup-{g}.png has no alpha channel (the still must paint no background)')
    ys, xs = np.nonzero(im[..., 3] > 0)
    if not len(xs):
        sys.exit(f'lockup-{g}.png is empty')
    m = int(0.06 * (ys.max() - ys.min()))  # a small margin, proportional to the lockup
    y0, y1, x0, x1 = max(0, ys.min() - m), min(im.shape[0], ys.max() + m + 1), max(0, xs.min() - m), min(im.shape[1], xs.max() + m + 1)
    cv2.imwrite(f'{out}/lockup-{g}.png', im[y0:y1, x0:x1])
    print(f'  lockup-{g}.png {x1 - x0}x{y1 - y0}', file=sys.stderr)
