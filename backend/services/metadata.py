from pathlib import Path
from datetime import datetime


def analyze_metadata(file_path: str) -> dict:
    """
    Analyze basic file metadata.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    stat = path.stat()

    file_size = stat.st_size

    created_time = datetime.fromtimestamp(stat.st_ctime)
    modified_time = datetime.fromtimestamp(stat.st_mtime)

    extension = path.suffix.lower()

    if file_size < 1024:
        size_category = "Very Small"
    elif file_size < 1024 * 1024:
        size_category = "Small"
    elif file_size < 10 * 1024 * 1024:
        size_category = "Medium"
    else:
        size_category = "Large"

    return {
        "score": 90,
        "metadata_count": 6,
        "file_name": path.name,
        "extension": extension,
        "file_size_bytes": file_size,
        "size_category": size_category,
        "created_at": created_time.isoformat(),
        "modified_at": modified_time.isoformat()
    }