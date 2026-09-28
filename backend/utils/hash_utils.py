import hashlib


def calculate_sha256(file_path):

    """
    Calculate SHA-256 hash of a file.
    """

    sha256_hash = hashlib.sha256()

    try:

        with open(
            file_path,
            "rb"
        ) as file:

            while True:

                data = file.read(4096)

                if not data:
                    break

                sha256_hash.update(data)

        return sha256_hash.hexdigest()

    except Exception as error:

        raise RuntimeError(
            f"Unable to calculate SHA-256: {error}"
        )
        