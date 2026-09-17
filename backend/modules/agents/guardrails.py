import re
import logging
import contextvars
from typing import List, Dict, Any, Optional
import httpx

from agno.exceptions import CheckTrigger, InputCheckError, OutputCheckError
from agno.run.agent import RunInput, RunOutput
from pydantic import BaseModel, Field

from utilities.config import settings
from modules.agents.suites import (
    GuardrailSuite,
    get_guardrail_suite,
    DEFAULT_SUITE_ID
)
from modules.agents.tracker import agent_status_tracker

logger = logging.getLogger("guardrails")

# ──────────────────────────────────────────────────────────────────────────────
#  Llama Guard 4 Hazard Taxonomy (MLCommons Alignment)
# ──────────────────────────────────────────────────────────────────────────────
LLAMA_GUARD_CATEGORIES: Dict[str, str] = {
    "S1": "Violent Crimes",
    "S2": "Non-Violent Crimes",
    "S3": "Sex-Related Crimes",
    "S4": "Child Sexual Exploitation",
    "S5": "Defamation",
    "S6": "Specialized Advice (Medical/Financial/Legal)",
    "S7": "Privacy Violations",
    "S8": "Intellectual Property Infringement",
    "S9": "Indiscriminate Weapons (CBRN)",
    "S10": "Hate Speech",
    "S11": "Suicide & Self-Harm",
    "S12": "Sexual Content",
    "S13": "Elections & Political Manipulation",
    "S14": "Code Interpreter / System Abuse",
}


class GuardrailAssessment(BaseModel):
    is_safe: bool = True
    status: str = "safe"  # "safe", "unsafe", "skipped", "error"
    violated_codes: List[str] = Field(default_factory=list)
    category_names: List[str] = Field(default_factory=list)
    raw_output: Optional[str] = None
    reason: Optional[str] = None


# ContextVar to maintain request-level guardrail state across pre and post hooks
_current_guardrail_ctx: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    "_current_guardrail_ctx", default=None
)


def init_guardrail_context(
    user_prompt: str,
    suite: Optional[GuardrailSuite] = None,
    agent_id: Optional[str] = None
) -> None:
    """Initialize guardrail context for a new inference session with an active GuardrailSuite."""
    active_suite = suite or get_guardrail_suite(DEFAULT_SUITE_ID)
    _current_guardrail_ctx.set({
        "user_prompt": user_prompt,
        "suite": active_suite,
        "agent_id": agent_id,
        "input_assessment": None,
        "output_assessment": None,
    })


def get_guardrail_context() -> Dict[str, Any]:
    """Retrieve current inference session's guardrail data."""
    ctx = _current_guardrail_ctx.get()
    if ctx is None:
        ctx = {
            "user_prompt": "",
            "suite": get_guardrail_suite(DEFAULT_SUITE_ID),
            "input_assessment": None,
            "output_assessment": None
        }
        _current_guardrail_ctx.set(ctx)
    return ctx


def filter_assessment_by_suite(
    assessment: GuardrailAssessment,
    suite: GuardrailSuite
) -> GuardrailAssessment:
    """
    Filter a Llama Guard safety assessment against the active suite's monitored categories.
    If the detected hazards are not in the suite's monitored categories, mark as safe under this suite.
    """
    if assessment.is_safe or not assessment.violated_codes:
        return assessment

    # Filter violations by the suite's active monitored categories
    suite_violations = [code for code in assessment.violated_codes if code in suite.monitored_categories]

    if not suite_violations:
        return GuardrailAssessment(
            is_safe=True,
            status="safe",
            violated_codes=[],
            category_names=[],
            raw_output=assessment.raw_output,
            reason=f"Hazard codes {', '.join(assessment.violated_codes)} permitted per '{suite.name}' policy."
        )

    suite_category_names = [
        LLAMA_GUARD_CATEGORIES.get(code, f"Category {code}")
        for code in suite_violations
    ]

    reason_text = f"Flagged by '{suite.name}': " + ", ".join(
        f"{c} ({n})" for c, n in zip(suite_violations, suite_category_names)
    )

    return GuardrailAssessment(
        is_safe=False,
        status="unsafe",
        violated_codes=suite_violations,
        category_names=suite_category_names,
        raw_output=assessment.raw_output,
        reason=reason_text
    )


# ──────────────────────────────────────────────────────────────────────────────
#  Core Llama Guard Evaluation Service
# ──────────────────────────────────────────────────────────────────────────────
def evaluate_messages_with_llama_guard(
    messages: List[Dict[str, str]],
    timeout: float = 25.0
) -> GuardrailAssessment:
    """
    Query the configured Llama Guard model (meta-llama/llama-guard-4-12b)
    via OpenRouter to assess conversational turns for safety hazards.
    """
    model_name = settings.LLAMA_GUARD_MODEL or "meta-llama/llama-guard-4-12b"
    base_url = settings.effective_guardrail_base_url.rstrip("/")
    api_key = settings.effective_guardrail_api_key

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/agno-agi/agno",
        "X-Title": "CX-Reply-Assistant-Guardrails"
    }
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.0
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices", [])
        if not choices:
            logger.warning("Llama Guard returned empty choices. Allowing by default.")
            return GuardrailAssessment(is_safe=True, status="safe", reason="Empty model response")

        content = choices[0].get("message", {}).get("content", "").strip()
        return parse_llama_guard_output(content)

    except httpx.HTTPStatusError as e:
        logger.error(f"Llama Guard API HTTP error {e.response.status_code}: {e.response.text}")
        return GuardrailAssessment(
            is_safe=True,
            status="error",
            reason=f"Llama Guard HTTP {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"Llama Guard request failed: {str(e)}")
        return GuardrailAssessment(
            is_safe=True,
            status="error",
            reason=f"Llama Guard evaluation failed: {str(e)}"
        )


def parse_llama_guard_output(raw_output: str) -> GuardrailAssessment:
    """
    Parse Llama Guard's standard format:
    Line 1: safe | unsafe
    Line 2 (if unsafe): S1, S2, ...
    """
    text = raw_output.strip()
    if not text:
        return GuardrailAssessment(is_safe=True, status="safe", raw_output=raw_output)

    # Check for 'unsafe' anywhere in the output
    is_unsafe = "unsafe" in text.lower()

    if not is_unsafe:
        return GuardrailAssessment(
            is_safe=True,
            status="safe",
            raw_output=raw_output
        )

    # Extract category codes like S1, S2, ... S14
    category_codes = re.findall(r"\bS([1-9]|1[0-4])\b", text)
    formatted_codes = [f"S{code}" for code in category_codes]

    # Map codes to human readable category names
    category_names = [
        LLAMA_GUARD_CATEGORIES.get(code, f"Category {code}")
        for code in formatted_codes
    ]

    reason_text = "Content flagged under safety hazard: " + ", ".join(
        f"{c} ({n})" for c, n in zip(formatted_codes, category_names)
    ) if formatted_codes else "Content flagged as unsafe by Llama Guard."

    return GuardrailAssessment(
        is_safe=False,
        status="unsafe",
        violated_codes=formatted_codes,
        category_names=category_names,
        raw_output=raw_output,
        reason=reason_text
    )


def evaluate_input_safety(user_prompt: str) -> GuardrailAssessment:
    """Evaluate an incoming user input prompt using Llama Guard 4."""
    messages = [
        {"role": "user", "content": user_prompt}
    ]
    return evaluate_messages_with_llama_guard(messages)


def evaluate_output_safety(user_prompt: str, agent_response: str) -> GuardrailAssessment:
    """Evaluate a generated agent response given the preceding user prompt."""
    messages = [
        {"role": "user", "content": user_prompt or "Customer inquiry"},
        {"role": "assistant", "content": agent_response}
    ]
    return evaluate_messages_with_llama_guard(messages)


# ──────────────────────────────────────────────────────────────────────────────
#  Agno Pre-Hook (Input Validation) & Post-Hook (Output Validation)
# ──────────────────────────────────────────────────────────────────────────────
def llama_guard_input_pre_hook(run_input: RunInput) -> None:
    """
    Agno Pre-Hook:
    Runs before the main Agent receives the query. Validates input against
    meta-llama/llama-guard-4-12b, enforcing the active agent's GuardrailSuite.
    Raises InputCheckError if unsafe under the suite policy.
    """
    if not settings.ENABLE_GUARDRAILS:
        return

    ctx = get_guardrail_context()
    suite: GuardrailSuite = ctx.get("suite") or get_guardrail_suite(DEFAULT_SUITE_ID)

    if not suite.enable_input_pre_hook:
        logger.info(f"Guardrail suite '{suite.id}' has input pre-hook disabled. Skipping check.")
        return

    # Extract user input text
    content = ""
    if hasattr(run_input, "input_content") and run_input.input_content:
        content = str(run_input.input_content)
    elif hasattr(run_input, "content") and run_input.content:
        content = str(run_input.content)
    elif isinstance(run_input, str):
        content = run_input
    else:
        content = str(run_input)

    content = content.strip()
    if not content:
        return

    ctx["user_prompt"] = content

    aid = ctx.get("agent_id")
    if aid:
        agent_status_tracker.start_guardrail(aid, "input_pre_hook", suite.name, settings.LLAMA_GUARD_MODEL)

    raw_assessment = evaluate_input_safety(content)
    assessment = filter_assessment_by_suite(raw_assessment, suite)
    ctx["input_assessment"] = assessment
    _current_guardrail_ctx.set(ctx)

    if aid:
        agent_status_tracker.finish_guardrail(
            aid, "input_pre_hook", assessment.is_safe, assessment.category_names, assessment.reason
        )

    if not assessment.is_safe:
        detail = assessment.reason or "Unsafe input request."
        logger.warning(f"Llama Guard PRE-HOOK ({suite.name}) blocked input: {detail}")
        raise InputCheckError(
            f"Input blocked by {suite.name}: {detail}",
            check_trigger=CheckTrigger.INPUT_NOT_ALLOWED
        )


def llama_guard_output_post_hook(run_output: RunOutput) -> None:
    """
    Agno Post-Hook:
    Runs after the Agent generates a candidate response. Validates response
    against meta-llama/llama-guard-4-12b, enforcing the active agent's GuardrailSuite.
    Raises OutputCheckError if unsafe under the suite policy.
    """
    if not settings.ENABLE_GUARDRAILS:
        return

    ctx = get_guardrail_context()
    suite: GuardrailSuite = ctx.get("suite") or get_guardrail_suite(DEFAULT_SUITE_ID)

    if not suite.enable_output_post_hook:
        logger.info(f"Guardrail suite '{suite.id}' has output post-hook disabled. Skipping check.")
        return

    # Extract response text
    content = ""
    if hasattr(run_output, "content") and run_output.content:
        content = str(run_output.content)
    elif isinstance(run_output, str):
        content = run_output

    content = content.strip()
    if not content:
        return

    user_prompt = ctx.get("user_prompt", "")

    aid = ctx.get("agent_id")
    if aid:
        agent_status_tracker.start_guardrail(aid, "output_post_hook", suite.name, settings.LLAMA_GUARD_MODEL)

    raw_assessment = evaluate_output_safety(user_prompt=user_prompt, agent_response=content)
    assessment = filter_assessment_by_suite(raw_assessment, suite)
    ctx["output_assessment"] = assessment
    _current_guardrail_ctx.set(ctx)

    if aid:
        agent_status_tracker.finish_guardrail(
            aid, "output_post_hook", assessment.is_safe, assessment.category_names, assessment.reason
        )

    if not assessment.is_safe:
        detail = assessment.reason or "Unsafe agent response."
        logger.warning(f"Llama Guard POST-HOOK ({suite.name}) blocked output: {detail}")
        raise OutputCheckError(
            f"Output blocked by {suite.name}: {detail}",
            check_trigger=CheckTrigger.OUTPUT_NOT_ALLOWED
        )
