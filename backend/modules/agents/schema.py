from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class BoundKBInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""


class GuardrailSuiteInfo(BaseModel):
    id: str
    name: str
    description: str
    badge: str
    strictness: str
    enable_input_pre_hook: bool = True
    enable_output_post_hook: bool = True
    monitored_categories: List[str] = []


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name of the Agent")
    description: Optional[str] = Field(default="", description="Description of the Agent's role or scope")
    instructions: Optional[str] = Field(
        default=None,
        description="Custom system instructions or guidelines for how the agent should behave and answer"
    )
    kb_ids: List[str] = Field(
        ...,
        min_length=1,
        description="List of Knowledge Base IDs that this agent is bound to and authorized to use"
    )
    guardrail_suite_id: Optional[str] = Field(
        default="suite_standard_cx",
        description="ID of the pre-made Guardrail Suite to bind to this Agent"
    )


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    llm_name: str
    bound_kbs: List[BoundKBInfo] = []
    guardrail_suite_id: str = "suite_standard_cx"
    guardrail_suite: Optional[GuardrailSuiteInfo] = None
    created_at: datetime


class AgentDeleteResponse(BaseModel):
    message: str
    agent_id: str


class GuardrailInfo(BaseModel):
    passed: bool = Field(..., description="Whether both input and output passed safety checks")
    model: str = Field(..., description="The guardrail model used for assessment")
    suite_id: Optional[str] = Field(None, description="The guardrail suite ID applied")
    suite_name: Optional[str] = Field(None, description="The guardrail suite display name")
    input_safe: bool = Field(True, description="Whether the input query was deemed safe")
    output_safe: bool = Field(True, description="Whether the generated response was deemed safe")
    violations: List[str] = Field(default_factory=list, description="List of safety categories violated, if any")
    message: Optional[str] = Field(None, description="Detailed explanation if blocked or flagged")


class AgentInferenceRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Question or prompt to send to the Agent")
    enable_guardrails: Optional[bool] = Field(
        default=True,
        description="Whether to run Llama Guard 4 input pre-hook and output post-hook guardrails"
    )


class AgentToolCall(BaseModel):
    tool: str
    kb_id: Optional[str] = None
    query: Optional[str] = None
    args: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None
    summary: Optional[str] = None
    output: Optional[str] = None


class AgentInferenceResponse(BaseModel):
    agent_id: str
    agent_name: str
    query: str
    response: str
    reasoning: Optional[str] = None
    tool_calls: List[AgentToolCall] = []
    tool_history: Optional[List[Dict[str, Any]]] = []
    bound_kbs: List[BoundKBInfo] = []
    guardrail: Optional[GuardrailInfo] = None


class GuardrailDirectCheckRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to evaluate with Llama Guard 4")
    role: Optional[str] = Field(default="input", description="'input' or 'output'")
    context_prompt: Optional[str] = Field(default=None, description="Preceding user prompt if evaluating output")
    suite_id: Optional[str] = Field(default=None, description="Optional Guardrail Suite ID to evaluate against")


class GuardrailDirectCheckResponse(BaseModel):
    is_safe: bool
    status: str
    violated_codes: List[str] = []
    category_names: List[str] = []
    reason: Optional[str] = None
    raw_output: Optional[str] = None
    model: str
    suite_id: Optional[str] = None
    suite_name: Optional[str] = None
