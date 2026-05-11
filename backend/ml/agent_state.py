from typing import TypedDict, List, Optional, Any


class AgentState(TypedDict):
    """
    Shared memory between all agents.
    Like a whiteboard every agent can read and write to.
    Each agent picks up where the previous one left off.
    """
    # Input
    file_path:     str
    target_column: str

    # Data at each stage
    raw_df:        Optional[Any]
    cleaned_df:    Optional[Any]
    engineered_df: Optional[Any]

    # Problem info
    problem_type:  Optional[str]
    dataset_size:  Optional[int]

    # Agent outputs
    cleaning_report:    Optional[dict]
    engineering_report: Optional[dict]
    model_results:      Optional[list]
    tuned_results:      Optional[list]
    feature_importance: Optional[list]
    final_result:       Optional[dict]

    # Logging
    logs:         List[str]
    log_callback: Optional[Any]

    # Error handling
    error: Optional[str]