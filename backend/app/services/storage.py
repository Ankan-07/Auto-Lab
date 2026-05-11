import os
import shutil
from fastapi import UploadFile

# Where uploaded files get stored inside the container
UPLOAD_DIR = "/app/uploads"

def ensure_upload_dir():
    """Create uploads folder if it doesn't exist."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_file(file: UploadFile, filename: str) -> str:
    """
    Save uploaded file to disk.
    Returns the full file path.
    """
    ensure_upload_dir()
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return file_path

def delete_file(file_path: str):
    """Delete a file from disk."""
    if os.path.exists(file_path):
        os.remove(file_path)