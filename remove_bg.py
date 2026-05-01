#!/usr/bin/env python3
"""Remove background from images using rembg (AI-based)."""

import sys
import os
from pathlib import Path


def remove_background(input_path: str, output_path: str | None = None) -> str:
    try:
        from rembg import remove
    except ImportError:
        print("rembg not installed. Run: pip install rembg", file=sys.stderr)
        sys.exit(1)

    from PIL import Image
    import io

    input_path = Path(input_path)
    if not input_path.exists():
        print(f"File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if output_path is None:
        output_path = input_path.with_stem(input_path.stem + "_nobg").with_suffix(".png")
    else:
        output_path = Path(output_path)

    with open(input_path, "rb") as f:
        data = f.read()

    result = remove(data)
    image = Image.open(io.BytesIO(result))
    image.save(output_path, "PNG")

    print(f"Saved: {output_path}")
    return str(output_path)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <image> [output]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    remove_background(input_file, output_file)


if __name__ == "__main__":
    main()
