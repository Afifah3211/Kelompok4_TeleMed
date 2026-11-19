from typing import Optional


def normalize_gender(value: Optional[str]) -> Optional[str]:
    """Map common gender labels to the database's single-character codes."""
    if value is None or not value.strip():
        return None

    normalized = value.strip().casefold().replace("_", "-")
    if normalized == "-":
        return None
    if normalized in {"l", "laki-laki", "laki laki", "male"}:
        return "L"
    if normalized in {"p", "perempuan", "female"}:
        return "P"
    return None
