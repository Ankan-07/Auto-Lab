from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DatasetResponse(BaseModel):
    id:            int
    name:          str
    file_size:     int
    row_count:     Optional[int]
    column_count:  Optional[int]
    columns:       Optional[List[str]]
    target_column: Optional[str]
    status:        str
    created_at:    datetime

    class Config:
        from_attributes = True

class JobResponse(BaseModel):
    id:         int
    dataset_id: int
    status:     str
    progress:   int
    stage:      str
    logs:       Optional[List[str]]
    result:     Optional[dict]
    error:      Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    job_id:        int
    dataset:       DatasetResponse
    cached:        bool = False
    cache_message: Optional[str] = None

    class Config:
        from_attributes = True