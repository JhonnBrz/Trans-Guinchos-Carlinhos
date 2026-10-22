"""Prepare photos for the site: clean up, enlarge and export as WebP.

Produces two files per photo in public/assets/img/: a full-size version
(at least 1100 px wide) and a 760 px version used on phones.

    python3 tools/enhance_images.py photo.jpg --name obra-construcao
    python3 tools/enhance_images.py photo.jpg --name montagem-detalhe --crop-top 0.4

Requires: pip install opencv-python pillow numpy

Upscaling here is classical (denoise + Lanczos + edge-aware sharpening).
It cleans compression artefacts but cannot invent detail, so the best
results always come from the original camera files, not screenshots.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "img"
TARGET_WIDTH = 1100
MOBILE_WIDTH = 760


def enhance(image: np.ndarray) -> np.ndarray:
    """Remove block noise, enlarge in 2x steps and restore edge contrast."""
    image = cv2.fastNlMeansDenoisingColored(image, None, 3, 3, 5, 15)

    while image.shape[1] < TARGET_WIDTH:
        height, width = image.shape[:2]
        image = cv2.resize(image, (width * 2, height * 2), interpolation=cv2.INTER_LANCZOS4)
        image = cv2.bilateralFilter(image, 5, 18, 5)
        blurred = cv2.GaussianBlur(image, (0, 0), 1.4)
        image = cv2.addWeighted(image, 1.35, blurred, -0.35, 0)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, a, b = cv2.split(lab)
    lightness = cv2.createCLAHE(clipLimit=0.6, tileGridSize=(8, 8)).apply(lightness)
    image = cv2.cvtColor(cv2.merge((lightness, a, b)), cv2.COLOR_LAB2BGR)

    # A whisper of grain hides the plastic look of upscaled flat areas.
    grain = np.random.default_rng(7).normal(0, 1.6, image.shape[:2]).astype(np.float32)
    return np.clip(image.astype(np.float32) + grain[..., None], 0, 255).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser(description="Enhance a photo for the site.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--name", required=True, help="output file name, without extension")
    parser.add_argument("--crop-top", type=float, default=0.0, help="fraction of the height to drop from the top")
    args = parser.parse_args()

    image = cv2.imread(str(args.source), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Could not read {args.source}")

    if args.crop_top:
        image = image[int(image.shape[0] * args.crop_top):]

    if image.shape[1] < TARGET_WIDTH:
        image = enhance(image)

    photo = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    full = OUTPUT_DIR / f"{args.name}.webp"
    mobile = OUTPUT_DIR / f"{args.name}-760.webp"

    photo.save(full, "WEBP", quality=84, method=6)
    ratio = MOBILE_WIDTH / photo.width
    photo.resize((MOBILE_WIDTH, round(photo.height * ratio)), Image.LANCZOS).save(
        mobile, "WEBP", quality=82, method=6
    )
    print(f"{full.name} {photo.size}  ·  {mobile.name}")


if __name__ == "__main__":
    main()
