from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DeployRequest(BaseModel):
    """What frontend sends when deploying a model."""
    job_id: int
    name:   str   # user gives the model a name

class DeployedModelResponse(BaseModel):
    id:           int
    job_id:       int
    name:         str
    model_name:   str
    problem_type: str
    accuracy:     Optional[float]
    features:     List[str]
    target_column:str
    metrics:      Optional[Dict[str, Any]]
    is_active:    bool
    call_count:   int
    created_at:   datetime

    class Config:
        from_attributes = True

class APIKeyResponse(BaseModel):
    id:         int
    key:        str
    name:       Optional[str]
    is_active:  bool
    call_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class PredictRequest(BaseModel):
    """What gets sent to the prediction endpoint."""
    data: Dict[str, Any]   # feature name → value

class PredictionResult(BaseModel):
    """What comes back from prediction."""
    prediction:      Any
    prediction_label:Optional[str]
    probability:     Optional[float]
    shap_explanation: List[Dict[str, Any]]
    plain_english:   str
    model_name:      str
    problem_type:    str
