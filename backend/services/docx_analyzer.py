from pathlib import Path
from docx import Document


def analyze_docx(file_path: str) -> dict:
    """
    Extract text and basic information from a DOCX file.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"DOCX file not found: {file_path}")

    if path.suffix.lower() != ".docx":
        raise ValueError("The supplied file is not a DOCX file")

    document = Document(str(path))

    paragraphs = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if text:
            paragraphs.append(text)

    full_text = "\n".join(paragraphs)

    return {
        "score": 90,
        "file_name": path.name,
        "paragraphs": len(paragraphs),
        "text_length": len(full_text),
        "text": full_text,
        "status": "DOCX analyzed successfully"
    }