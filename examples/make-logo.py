"""Reproduce the original test monogram from the repository root; not an official brand asset."""
import cv2
import numpy as np

image = np.zeros((256, 256, 4), dtype=np.uint8)
image[:, :, :] = (182, 215, 68, 255)
cv2.putText(image, 'VC', (30, 169), cv2.FONT_HERSHEY_SIMPLEX, 2.7,
            (46, 26, 16, 255), 8, cv2.LINE_AA)
cv2.imwrite('examples/logo.png', image)
