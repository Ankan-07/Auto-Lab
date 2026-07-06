from typing import TypedDict, List, Optional, Any


class AgentState(TypedDict):
    file_path:     str
    target_column: str

    raw_df:        Optional[Any]
    cleaned_df:    Optional[Any]
    engineered_df: Optional[Any]

    problem_type:  Optional[str]
    dataset_size:  Optional[int]

    cleaning_report:    Optional[dict]
    engineering_report: Optional[dict]
    model_results:      Optional[list]
    tuned_results:      Optional[list]
    feature_importance: Optional[list]
    final_result:       Optional[dict]

    logs:         List[str]
    log_callback: Optional[Any]

    retry_count: int
    use_aggressive_engineering: bool

    llm_strategy: Optional[dict]

    error: Optional[str]