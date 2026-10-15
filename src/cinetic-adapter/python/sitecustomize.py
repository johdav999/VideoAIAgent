"""Repository-scoped OpenCV Unicode path adapter for native Windows workers."""
import os
if os.name == 'nt':
    import cv2
    import numpy as np
    def imread(file, flags=cv2.IMREAD_COLOR):
        try:
            return cv2.imdecode(np.fromfile(file, dtype=np.uint8), flags)
        except (OSError, ValueError):
            return None
    def imwrite(file, image, params=None):
        ok, encoded = cv2.imencode(os.path.splitext(file)[1], image, params or [])
        if ok:
            encoded.tofile(file)
        return ok
    cv2.imread = imread
    cv2.imwrite = imwrite
