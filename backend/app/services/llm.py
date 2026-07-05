
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_llm_available() -> bool:
    return bool(settings.OPENAI_API_KEY)


def _build_chat():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=settings.LLM_MODEL_NAME,
        api_key=settings.OPENAI_API_KEY,
        max_tokens=400,
        timeout=15,
    )


def explain_prediction(
    *,
    model_name: str,
    problem_type: str,
    target: str,
    prediction,
    probability: Optional[float],
    top_factors: list,
) -> Optional[str]:
    if not is_llm_available():
        return None

    top3 = top_factors[:3] if top_factors else []
    factors_str = "\n".join(
        f"- {f.get('feature')} = {f.get('value')} "
        f"({f.get('direction')} prediction by {f.get('magnitude')})"
        for f in top3
    ) or "(no SHAP factors available)"

    prob_line = (
        f"Confidence: {probability * 100:.1f}%\n"
        if problem_type == "classification" and probability is not None
        else ""
    )

    user_prompt = (
        f"You are explaining a machine-learning prediction to a non-technical "
        f"business user.\n\n"
        f"Model: {model_name}\n"
        f"Problem type: {problem_type}\n"
        f"Target variable: {target}\n"
        f"Prediction: {prediction}\n"
        f"{prob_line}"
        f"Top contributing features (by SHAP magnitude):\n{factors_str}\n\n"
        f"Write exactly two short sentences in plain business English. "
        f"First sentence: state the prediction and (if applicable) confidence. "
        f"Second sentence: explain which input(s) drove it most and which way. "
        f"Do not mention SHAP, models, or jargon. No bullet points."
    )

    try:
        chat = _build_chat()
        response = chat.invoke(user_prompt)
        text = getattr(response, "content", None) or str(response)
        return text.strip() if text else None
    except Exception as exc:
        logger.warning("LLM explanation failed, falling back to rules: %s", exc)
        return None


def analyze_dataset(
    *,
    target_column: str,
    columns: list,
    dtypes: dict,
    missing_counts: dict,
    sample_rows: list,
    row_count: int,
) -> Optional[dict]:
    if not is_llm_available():
        return None

    import json

    schema_lines = "\n".join(
        f"- {col}: dtype={dtypes.get(col)}, missing={missing_counts.get(col, 0)}"
        for col in columns
    )
    sample_str = json.dumps(sample_rows[:5], default=str, indent=2)[:2000]

    user_prompt = (
        f"You are a senior data scientist reviewing a tabular dataset before "
        f"an automated ML pipeline runs.\n\n"
        f"Row count: {row_count}\n"
        f"Target column: {target_column}\n"
        f"Schema:\n{schema_lines}\n\n"
        f"Sample rows (first 5):\n{sample_str}\n\n"
        f"Return a single JSON object with these exact keys:\n"
        f'  "columns_to_drop": [string]  // IDs, timestamps, free-text, or columns '
        f'that look like leakage of {target_column}. Empty list if none.\n'
        f'  "high_cardinality_columns": [string]  // object/string columns that '
        f'likely have many unique values and should be label-encoded not one-hot.\n'
        f'  "use_smote": boolean  // true ONLY if classification AND classes appear imbalanced.\n'
        f'  "expected_problem_type": "classification" | "regression"\n'
        f'  "notes": string  // 1-2 sentence rationale\n'
        f"\nRespond with ONLY the JSON object, no prose, no code fences."
    )

    try:
        chat = _build_chat()
        response = chat.invoke(user_prompt)
        text = getattr(response, "content", None) or str(response)
        text = text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return None
        return parsed
    except Exception as exc:
        logger.warning("LLM dataset analysis failed: %s", exc)
        return None
