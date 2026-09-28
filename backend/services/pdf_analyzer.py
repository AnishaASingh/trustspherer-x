from pathlib import Path
from pypdf import PdfReader


def analyze_pdf(file_path: str) -> dict:
    """
    Extract and analyze text from a PDF file.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError("The supplied file is not a PDF")

    reader = PdfReader(str(path))

    pages = len(reader.pages)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    text = text.strip()

    return {
        "score": 90,
        "file_name": path.name,
        "pages": pages,
        "text_length": len(text),
        "text": text,
        "status": "PDF analyzed successfully"
    }