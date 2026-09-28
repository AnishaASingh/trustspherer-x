import os


# ============================================================
# ALLOWED FILE TYPES
# ============================================================

ALLOWED_EXTENSIONS = {

    ".pdf",
    ".docx",
    ".txt",

    ".jpg",
    ".jpeg",
    ".png",

    ".csv",

    ".xlsx",

    ".json"

}


# ============================================================
# MAXIMUM FILE SIZE
# ============================================================

MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# VALIDATE FILE
# ============================================================

def validate_file(filename, file_size=None):

    # --------------------------------------------------------
    # Check filename
    # --------------------------------------------------------

    if not filename:

        return {

            "valid": False,

            "message": "Filename is missing."

        }


    # --------------------------------------------------------
    # Get extension
    # --------------------------------------------------------

    extension = os.path.splitext(
        filename
    )[1].lower()


    # --------------------------------------------------------
    # Check extension
    # --------------------------------------------------------

    if extension not in ALLOWED_EXTENSIONS:

        return {

            "valid": False,

            "message": (
                f"Unsupported file type: {extension}. "
                f"Allowed types: "
                f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        }


    # --------------------------------------------------------
    # Check file size if provided
    # --------------------------------------------------------

    if file_size is not None:

        if file_size > MAX_FILE_SIZE:

            return {

                "valid": False,

                "message": (
                    "File is too large. "
                    "Maximum allowed size is 10 MB."
                )

            }


    # --------------------------------------------------------
    # Successful validation
    # --------------------------------------------------------

    return {

        "valid": True,

        "message": "File is valid.",

        "extension": extension

    }