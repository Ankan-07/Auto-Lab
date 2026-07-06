from langgraph.graph import StateGraph, END
from ml.agent_state import AgentState
from ml.agents import (
    dataset_analyst_agent,
    data_cleaner_agent,
    feature_engineer_agent,
    model_selector_agent,
    tuner_agent,
    explainer_agent,
)


def should_continue(state: AgentState) -> str:
    if state.get("error"):
        return "end"
    return "continue"


def should_retry_or_tune(state: AgentState) -> str:
    if state.get("error"):
        return "end"
    if state.get("use_aggressive_engineering") and (state.get("retry_count", 0) or 0) > 0:
        return "retry"
    return "tune"


def build_pipeline_graph():
    graph = StateGraph(AgentState)

    graph.add_node("dataset_analyst",  dataset_analyst_agent)
    graph.add_node("data_cleaner",     data_cleaner_agent)
    graph.add_node("feature_engineer", feature_engineer_agent)
    graph.add_node("model_selector",   model_selector_agent)
    graph.add_node("tuner",            tuner_agent)
    graph.add_node("explainer",        explainer_agent)

    graph.set_entry_point("dataset_analyst")

    graph.add_edge("dataset_analyst", "data_cleaner")
    graph.add_conditional_edges(
        "data_cleaner",
        should_continue,
        {"continue": "feature_engineer", "end": END}
    )
    graph.add_conditional_edges(
        "feature_engineer",
        should_continue,
        {"continue": "model_selector", "end": END}
    )
    graph.add_conditional_edges(
        "model_selector",
        should_retry_or_tune,
        {"retry": "feature_engineer", "tune": "tuner", "end": END}
    )
    graph.add_conditional_edges(
        "tuner",
        should_continue,
        {"continue": "explainer", "end": END}
    )

    graph.add_edge("explainer", END)

    return graph.compile()


def run_agentic_pipeline(
    file_path: str,
    target_column: str,
    log_callback=None
) -> dict:
    initial_state: AgentState = {
        "file_path":           file_path,
        "target_column":       target_column,
        "raw_df":              None,
        "cleaned_df":          None,
        "engineered_df":       None,
        "problem_type":        None,
        "dataset_size":        None,
        "cleaning_report":     None,
        "engineering_report":  None,
        "model_results":       None,
        "tuned_results":       None,
        "feature_importance":  None,
        "final_result":        None,
        "logs":                [],
        "log_callback":        log_callback,
        "retry_count":              0,
        "use_aggressive_engineering": False,
        "llm_strategy":        None,
        "error":               None,
    }

    pipeline    = build_pipeline_graph()
    final_state = pipeline.invoke(initial_state)

    if final_state.get("error"):
        raise Exception(final_state["error"])

    return final_state["final_result"]