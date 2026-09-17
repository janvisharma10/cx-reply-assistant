from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class GuardrailSuite(BaseModel):
    id: str = Field(..., description="Unique identifier for the guardrail suite")
    name: str = Field(..., description="Human-readable suite title")
    description: str = Field(..., description="Scope and purpose of this safety policy")
    badge: str = Field(..., description="Short display badge")
    strictness: str = Field(..., description="Standard, Strict, Targeted, or Permissive")
    enable_input_pre_hook: bool = Field(True, description="Whether to validate user prompts before agent execution")
    enable_output_post_hook: bool = Field(True, description="Whether to validate agent responses before returning")
    monitored_categories: List[str] = Field(
        ...,
        description="List of MLCommons hazard codes (S1–S14) monitored and enforced by this suite"
    )


# ──────────────────────────────────────────────────────────────────────────────
#  Pre-Made Guardrail Suites
# ──────────────────────────────────────────────────────────────────────────────
PRE_MADE_GUARDRAIL_SUITES: Dict[str, GuardrailSuite] = {
    "suite_standard_cx": GuardrailSuite(
        id="suite_standard_cx",
        name="Standard CX Protection Suite",
        description="Balanced, production-ready safety for customer support and reply assistants. Intercepts violent threats, illegal acts, weapons, hate speech, self-harm, and prompt injection/jailbreak attempts while maintaining smooth conversational flow.",
        badge="Standard CX",
        strictness="Standard",
        enable_input_pre_hook=True,
        enable_output_post_hook=True,
        monitored_categories=["S1", "S2", "S9", "S10", "S11", "S14"]
    ),
    "suite_strict_enterprise": GuardrailSuite(
        id="suite_strict_enterprise",
        name="Strict Enterprise Compliance Suite",
        description="Zero-tolerance compliance policy. Enforces all 14 MLCommons hazard categories across both incoming customer inputs and outgoing agent responses, preventing unauthorized advice, copyright infringements, defamation, and PII leaks.",
        badge="Enterprise Strict",
        strictness="Strict",
        enable_input_pre_hook=True,
        enable_output_post_hook=True,
        monitored_categories=[
            "S1", "S2", "S3", "S4", "S5", "S6", "S7",
            "S8", "S9", "S10", "S11", "S12", "S13", "S14"
        ]
    ),
    "suite_privacy_finance": GuardrailSuite(
        id="suite_privacy_finance",
        name="Privacy & Regulatory Compliance Suite",
        description="Specialized for fintech, banking, healthcare, and customer data operations. Focuses on privacy/PII leaks, unlicensed medical or financial counsel, defamation, property fraud, and system exploits.",
        badge="Privacy & Finance",
        strictness="Targeted",
        enable_input_pre_hook=True,
        enable_output_post_hook=True,
        monitored_categories=["S2", "S5", "S6", "S7", "S8", "S14"]
    ),
    "suite_input_only": GuardrailSuite(
        id="suite_input_only",
        name="Frontline Firewall (Input Pre-Hook Only)",
        description="High-throughput perimeter guardrail. Strictly validates and filters customer inputs before agent reasoning or KB vector retrieval occurs, eliminating post-generation latency for trusted agent responses.",
        badge="Frontline Firewall",
        strictness="Targeted",
        enable_input_pre_hook=True,
        enable_output_post_hook=False,
        monitored_categories=["S1", "S2", "S9", "S10", "S11", "S14"]
    ),
    "suite_permissive_sandbox": GuardrailSuite(
        id="suite_permissive_sandbox",
        name="Permissive Sandbox Safety Suite",
        description="Minimalist guardrail configuration tailored for internal testing, dev sandboxes, and policy exploration. Only blocks severe hazards: violent crimes, child exploitation, weapons, and suicide.",
        badge="Permissive Sandbox",
        strictness="Permissive",
        enable_input_pre_hook=True,
        enable_output_post_hook=False,
        monitored_categories=["S1", "S4", "S9", "S11"]
    )
}

DEFAULT_SUITE_ID = "suite_standard_cx"


def get_guardrail_suite(suite_id: Optional[str] = None) -> GuardrailSuite:
    """
    Retrieve a pre-made GuardrailSuite by ID.
    Falls back to `suite_standard_cx` if not found or empty.
    """
    if not suite_id:
        return PRE_MADE_GUARDRAIL_SUITES[DEFAULT_SUITE_ID]
    return PRE_MADE_GUARDRAIL_SUITES.get(suite_id, PRE_MADE_GUARDRAIL_SUITES[DEFAULT_SUITE_ID])


def list_guardrail_suites() -> List[GuardrailSuite]:
    """List all available pre-made GuardrailSuites."""
    return list(PRE_MADE_GUARDRAIL_SUITES.values())
