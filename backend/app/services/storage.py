import os
import shutil
from fastapi import UploadFile

UPLOAD_DIR = "/app/uploads"

def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_file(file: UploadFile, filename: str) -> str:
    ensure_upload_dir()
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return file_path

def delete_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)