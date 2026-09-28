from pathlib import Path
from PIL import Image


def analyze_image(file_path: str) -> dict:
    """
    Analyze basic properties of an image.
    OCR is intentionally skipped for now.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Image file not found: {file_path}"
        )

    try:
        with Image.open(path) as image:

            width, height = image.size

            return {
                "score": 85,
                "file_name": path.name,
                "format": image.format,
                "width": width,
                "height": height,
                "mode": image.mode,
                "file_size_bytes": path.stat().st_size,
                "status": "Image analyzed successfully"
            }

    except Exception as e:

        raise ValueError(
            f"Unable to analyze image: {str(e)}"
        )