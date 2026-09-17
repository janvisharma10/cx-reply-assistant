import asyncio
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session

from utilities.db_utilies import get_db
from modules.agents.engine import agent_engine
from modules.agents.tracker import agent_status_tracker
from modules.agents.schema import (
    AgentCreateRequest,
    AgentResponse,
    AgentDeleteResponse,
    AgentInferenceRequest,
    AgentInferenceResponse,
    GuardrailDirectCheckRequest,
    GuardrailDirectCheckResponse,
    GuardrailSuiteInfo,
)
from modules.agents.suites import (
    list_guardrail_suites,
    get_guardrail_suite,
    PRE_MADE_GUARDRAIL_SUITES
)
from utilities.config import settings
from modules.agents.guardrails import (
    evaluate_input_safety,
    evaluate_output_safety,
    filter_assessment_by_suite
)

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get(
    "/guardrails/suites",
    response_model=List[GuardrailSuiteInfo],
    summary="List all pre-made Guardrail Suites"
)
def get_guardrail_suites():
    """
    Retrieve all curated pre-made Guardrail Suites available to bind to Agents.
    Includes MLCommons category coverage, pre/post hook statuses, and descriptions.
    """
    suites = list_guardrail_suites()
    return [
        GuardrailSuiteInfo(
            id=s.id,
            name=s.name,
            description=s.description,
            badge=s.badge,
            strictness=s.strictness,
            enable_input_pre_hook=s.enable_input_pre_hook,
            enable_output_post_hook=s.enable_output_post_hook,
            monitored_categories=s.monitored_categories
        )
        for s in suites
    ]


@router.get(
    "/guardrails/suites/{suite_id}",
    response_model=GuardrailSuiteInfo,
    summary="Get details of a specific Guardrail Suite"
)
def get_single_guardrail_suite(suite_id: str):
    """Retrieve configuration and hazard category list for a specific Guardrail Suite."""
    if suite_id not in PRE_MADE_GUARDRAIL_SUITES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail suite '{suite_id}' not found. Available suites: {list(PRE_MADE_GUARDRAIL_SUITES.keys())}"
        )
    s = PRE_MADE_GUARDRAIL_SUITES[suite_id]
    return GuardrailSuiteInfo(
        id=s.id,
        name=s.name,
        description=s.description,
        badge=s.badge,
        strictness=s.strictness,
        enable_input_pre_hook=s.enable_input_pre_hook,
        enable_output_post_hook=s.enable_output_post_hook,
        monitored_categories=s.monitored_categories
    )


@router.post(
    "",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Agent with LLM credentials, bound KBs, and bound Guardrail Suite"
)
def create_agent(
    request: AgentCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new AI Agent using Agno:
    - Sets name, description, and optional custom instructions
    - Binds the Agent strictly to the specified Knowledge Bases (kb_ids)
    - Binds the Agent to the specified Guardrail Suite (guardrail_suite_id)
    """
    try:
        agent = agent_engine.create_agent(
            name=request.name,
            description=request.description,
            instructions=request.instructions,
            kb_ids=request.kb_ids,
            guardrail_suite_id=request.guardrail_suite_id,
            db=db
        )
        return agent
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent: {str(e)}"
        )


@router.get(
    "",
    response_model=List[AgentResponse],
    summary="List all registered Agents"
)
def list_agents(db: Session = Depends(get_db)):
    """Retrieve all created Agents along with their bound Knowledge Bases and Guardrail Suite."""
    return agent_engine.list_agents(db=db)


@router.get(
    "/status",
    summary="Get real-time execution status of all agents"
)
def get_all_agents_status():
    """
    Retrieve real-time execution status for all active agents,
    including currently running tool calls, guardrail evaluations, and elapsed times.
    """
    return agent_status_tracker.get_all_statuses()


@router.get(
    "/{agent_id}",
    response_model=AgentResponse,
    summary="Get Agent details and bound Knowledge Bases"
)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Retrieve details of a single Agent and its bound Knowledge Bases."""
    try:
        return agent_engine.get_agent(agent_id=agent_id, db=db)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve agent: {str(e)}"
        )


@router.get(
    "/{agent_id}/status",
    summary="Get real-time tool call and execution status of a specific agent"
)
def get_agent_status(agent_id: str):
    """
    Retrieve real-time status of a specific agent:
    - Currently executing tool (name, arguments, elapsed_ms)
    - Active guardrail evaluation (input pre-hook / output post-hook)
    - Tool call history with execution durations
    - Current step description
    """
    return agent_status_tracker.get_status(agent_id)


@router.get(
    "/{agent_id}/status/stream",
    summary="Real-time Server-Sent Events (SSE) stream for agent tool calls and execution"
)
async def stream_agent_status(agent_id: str):
    """
    Stream real-time Server-Sent Events (SSE) as the agent performs inference:
    - Events emitted:
      - `snapshot`: Current status upon connection
      - `inference_start`: Inference began
      - `guardrail_start` / `guardrail_complete`: Pre/post hook execution
      - `tool_start`: Tool call initiated ('think', 'analyze', 'search_knowledge_base')
      - `tool_complete`: Tool call finished with elapsed duration
      - `inference_complete` / `inference_error`: Inference finished or errored
    """
    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        agent_status_tracker.register_subscriber(agent_id, queue, loop)
        try:
            # Send initial snapshot immediately
            snapshot = agent_status_tracker.get_status(agent_id)
            yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: {event.get('type', 'status_update')}\ndata: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            agent_status_tracker.unregister_subscriber(agent_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.delete(
    "/{agent_id}",
    response_model=AgentDeleteResponse,
    summary="Delete an Agent"
)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Permanently delete an Agent."""
    try:
        agent_engine.delete_agent(agent_id=agent_id, db=db)
        return AgentDeleteResponse(
            message=f"Agent '{agent_id}' deleted successfully.",
            agent_id=agent_id
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete agent: {str(e)}"
        )


@router.post(
    "/{agent_id}/infer",
    response_model=AgentInferenceResponse,
    summary="Run inference using Agno with ReasoningTools and bound Knowledge Bases"
)
@router.post(
    "/{agent_id}/query",
    response_model=AgentInferenceResponse,
    include_in_schema=False
)
def run_agent_inference(
    agent_id: str,
    request: AgentInferenceRequest,
    db: Session = Depends(get_db)
):
    """
    Run Agent inference:
    - Uses Agno's ReasoningTools (think & analyze)
    - Dynamically evaluates which bound KB to search using its Name and Description
    - Enforces the Agent's bound Guardrail Suite (input pre-hook and output post-hook)
    """
    try:
        return agent_engine.run_inference(
            agent_id=agent_id,
            message=request.message,
            db=db,
            enable_guardrails=request.enable_guardrails if request.enable_guardrails is not None else True
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent inference failed: {str(e)}"
        )


@router.post(
    "/guardrails/check",
    response_model=GuardrailDirectCheckResponse,
    summary="Direct evaluation endpoint for Llama Guard 4 (12B) with optional suite filtering"
)
def check_text_safety(request: GuardrailDirectCheckRequest):
    """
    Directly evaluate an input prompt or output response against
    meta-llama/llama-guard-4-12b via OpenRouter, optionally filtering
    by a specific Guardrail Suite policy.
    """
    suite = get_guardrail_suite(request.suite_id) if request.suite_id else None

    if request.role == "output":
        raw_assessment = evaluate_output_safety(
            user_prompt=request.context_prompt or "User prompt",
            agent_response=request.text
        )
    else:
        raw_assessment = evaluate_input_safety(user_prompt=request.text)

    # Filter against suite if provided
    if suite:
        assessment = filter_assessment_by_suite(raw_assessment, suite)
    else:
        assessment = raw_assessment

    return GuardrailDirectCheckResponse(
        is_safe=assessment.is_safe,
        status=assessment.status,
        violated_codes=assessment.violated_codes,
        category_names=assessment.category_names,
        reason=assessment.reason,
        raw_output=assessment.raw_output,
        model=settings.LLAMA_GUARD_MODEL,
        suite_id=suite.id if suite else None,
        suite_name=suite.name if suite else None
    )
