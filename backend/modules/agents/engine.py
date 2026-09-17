import re
import json
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

# Agno Imports
from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from agno.models.openai.like import OpenAILike
from agno.tools.reasoning import ReasoningTools
from agno.run import RunStatus

from modules.agents.reasoning import RobustReasoningTools
from modules.agents.tracker import agent_status_tracker

from utilities.config import settings
from utilities.db_utilies import AgentModel, KnowledgeBaseModel
from modules.kb.engine import kb_engine
from modules.agents.schema import BoundKBInfo, AgentToolCall, GuardrailInfo, GuardrailSuiteInfo
from modules.agents.suites import (
    get_guardrail_suite,
    GuardrailSuite,
    DEFAULT_SUITE_ID
)
from modules.agents.guardrails import (
    llama_guard_input_pre_hook,
    llama_guard_output_post_hook,
    init_guardrail_context,
    get_guardrail_context
)


def _to_suite_info(suite: GuardrailSuite) -> GuardrailSuiteInfo:
    return GuardrailSuiteInfo(
        id=suite.id,
        name=suite.name,
        description=suite.description,
        badge=suite.badge,
        strictness=suite.strictness,
        enable_input_pre_hook=suite.enable_input_pre_hook,
        enable_output_post_hook=suite.enable_output_post_hook,
        monitored_categories=suite.monitored_categories
    )


class AgentEngine:
    def __init__(self):
        pass

    # --------------------------------------------------------------------------
    # 1. Agent Management (CRUD)
    # --------------------------------------------------------------------------
    def create_agent(
        self,
        name: str,
        description: Optional[str],
        instructions: Optional[str],
        kb_ids: List[str],
        db: Session,
        guardrail_suite_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create and persist a new Agno Agent:
        1. Validates that all bound kb_ids exist in the database.
        2. Validates and binds the selected Guardrail Suite.
        3. Auto-generates a unique agent ID.
        4. Persists agent configuration, bound KB IDs, and guardrail_suite_id in the database.
        LLM credentials (api_key, base_url, llm_name) are always sourced from .env.
        """
        # Validate that all requested KB IDs exist
        bound_kbs: List[BoundKBInfo] = []
        for kid in kb_ids:
            kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kid).first()
            if not kb:
                raise ValueError(f"Knowledge Base with ID '{kid}' does not exist.")
            bound_kbs.append(BoundKBInfo(id=kb.id, name=kb.name, description=kb.description or ""))

        # Resolve Guardrail Suite
        suite = get_guardrail_suite(guardrail_suite_id or DEFAULT_SUITE_ID)

        slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower().strip()).strip("_")
        short_slug = slug[:20] if slug else "agent"
        agent_id = f"agent_{short_slug}_{uuid.uuid4().hex[:8]}"

        agent_record = AgentModel(
            id=agent_id,
            name=name,
            description=description or "",
            instructions=instructions or "",
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
            llm_name=settings.DEFAULT_MODEL,
            kb_ids=json.dumps(kb_ids),
            guardrail_suite_id=suite.id
        )
        db.add(agent_record)
        db.commit()
        db.refresh(agent_record)

        return {
            "id": agent_record.id,
            "name": agent_record.name,
            "description": agent_record.description,
            "instructions": agent_record.instructions,
            "llm_name": agent_record.llm_name,
            "bound_kbs": bound_kbs,
            "guardrail_suite_id": suite.id,
            "guardrail_suite": _to_suite_info(suite),
            "created_at": agent_record.created_at
        }

    def list_agents(self, db: Session) -> List[Dict[str, Any]]:
        """List all registered agents along with their bound Knowledge Bases and Guardrail Suite."""
        records = db.query(AgentModel).order_by(AgentModel.created_at.desc()).all()
        results = []
        for rec in records:
            kb_id_list = json.loads(rec.kb_ids) if rec.kb_ids else []
            bound_kbs = []
            for kid in kb_id_list:
                kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kid).first()
                if kb:
                    bound_kbs.append(BoundKBInfo(id=kb.id, name=kb.name, description=kb.description or ""))

            suite_id = getattr(rec, "guardrail_suite_id", None) or DEFAULT_SUITE_ID
            suite = get_guardrail_suite(suite_id)

            results.append({
                "id": rec.id,
                "name": rec.name,
                "description": rec.description,
                "instructions": rec.instructions,
                "llm_name": rec.llm_name or settings.DEFAULT_MODEL,
                "bound_kbs": bound_kbs,
                "guardrail_suite_id": suite.id,
                "guardrail_suite": _to_suite_info(suite),
                "created_at": rec.created_at
            })
        return results

    def get_agent(self, agent_id: str, db: Session) -> Dict[str, Any]:
        """Retrieve details of a single agent and its bound Knowledge Bases and Guardrail Suite."""
        rec = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
        if not rec:
            raise KeyError(f"Agent with ID '{agent_id}' not found.")

        kb_id_list = json.loads(rec.kb_ids) if rec.kb_ids else []
        bound_kbs = []
        for kid in kb_id_list:
            kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kid).first()
            if kb:
                bound_kbs.append(BoundKBInfo(id=kb.id, name=kb.name, description=kb.description or ""))

        suite_id = getattr(rec, "guardrail_suite_id", None) or DEFAULT_SUITE_ID
        suite = get_guardrail_suite(suite_id)

        return {
            "id": rec.id,
            "name": rec.name,
            "description": rec.description,
            "instructions": rec.instructions,
            "llm_name": rec.llm_name or settings.DEFAULT_MODEL,
            "bound_kbs": bound_kbs,
            "guardrail_suite_id": suite.id,
            "guardrail_suite": _to_suite_info(suite),
            "created_at": rec.created_at
        }

    def delete_agent(self, agent_id: str, db: Session) -> bool:
        """Delete an agent from the database."""
        rec = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
        if not rec:
            raise KeyError(f"Agent with ID '{agent_id}' not found.")
        db.delete(rec)
        db.commit()
        return True

    # --------------------------------------------------------------------------
    # 2. Agent Inference with Agno & ReasoningTools & Guardrail Suite
    # --------------------------------------------------------------------------
    def run_inference(
        self,
        agent_id: str,
        message: str,
        db: Session,
        enable_guardrails: bool = True
    ) -> Dict[str, Any]:
        """
        Execute an agent run using Agno:
        1. Loads the agent and its bound Knowledge Bases.
        2. Resolves the agent's bound GuardrailSuite.
        3. Binds ONLY the authorized KBs to the agent as search tools.
        4. Embeds ReasoningTools for systematic thinking (think & analyze).
        5. Runs input pre-hook and output post-hook guardrails adhering to the bound GuardrailSuite.
        6. Returns the agent's response, reasoning, tool calls, and guardrail assessment.
        """
        rec = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
        if not rec:
            raise KeyError(f"Agent with ID '{agent_id}' not found.")

        # Real-time status: start inference session
        agent_status_tracker.start_inference(rec.id, rec.name, message)

        # Resolve bound Guardrail Suite
        suite_id = getattr(rec, "guardrail_suite_id", None) or DEFAULT_SUITE_ID
        suite = get_guardrail_suite(suite_id)

        # Determine whether guardrails are active
        should_guard = enable_guardrails and settings.ENABLE_GUARDRAILS
        if should_guard:
            init_guardrail_context(user_prompt=message, suite=suite, agent_id=rec.id)
            pre_hooks = [llama_guard_input_pre_hook]
            post_hooks = [llama_guard_output_post_hook]
        else:
            pre_hooks = []
            post_hooks = []

        # 1. Fetch authorized bound KBs
        kb_id_list = json.loads(rec.kb_ids) if rec.kb_ids else []
        bound_kbs_map: Dict[str, Dict[str, str]] = {}
        bound_kbs_info: List[BoundKBInfo] = []

        for kid in kb_id_list:
            kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kid).first()
            if kb:
                bound_kbs_map[kb.id] = {
                    "id": kb.id,
                    "name": kb.name,
                    "description": kb.description or ""
                }
                bound_kbs_info.append(BoundKBInfo(id=kb.id, name=kb.name, description=kb.description or ""))
            else:
                print(f"Warning: KB '{kid}' is bound to agent '{agent_id}' but no longer exists in the database.")

        if not bound_kbs_map:
            raise ValueError(
                f"Agent '{agent_id}' has no accessible Knowledge Bases. "
                f"All bound KB IDs ({kb_id_list}) were not found — they may have been deleted."
            )

        # 2. Construct dynamic tool for searching bound KBs
        kb_catalog_lines = [
            f"- KB ID: '{kid}' | Name: '{info['name']}' | Description: '{info['description']}'"
            for kid, info in bound_kbs_map.items()
        ]
        kb_catalog = "\n".join(kb_catalog_lines)

        executed_tool_calls: List[AgentToolCall] = []

        def search_knowledge_base(kb_id: str, query: str) -> str:
            """
            Search one of the authorized Knowledge Bases bound to this agent for relevant context.
            
            Args:
                kb_id: The exact KB ID to query (must be one of the authorized Knowledge Bases).
                query: The search query to retrieve relevant chunks for.

            Returns:
                str: Excerpts and text chunks retrieved from that Knowledge Base.
            """
            agent_status_tracker.start_tool(rec.id, "search_knowledge_base", {"kb_id": kb_id, "query": query})
            # Strict boundary enforcement: agent can ONLY access bound KBs
            if kb_id not in bound_kbs_map:
                err_msg = f"Unauthorized KB '{kb_id}'. You may only search these bound KBs: {list(bound_kbs_map.keys())}"
                executed_tool_calls.append(AgentToolCall(
                    tool="search_knowledge_base",
                    kb_id=kb_id,
                    query=query,
                    output=err_msg
                ))
                agent_status_tracker.finish_tool(rec.id, "search_knowledge_base", result_summary=err_msg)
                return err_msg

            try:
                results = kb_engine.query_kb(kb_id=kb_id, query=query, top_k=3, db=db)
                if not results:
                    content = f"No matching results found in Knowledge Base '{kb_id}' for query '{query}'."
                else:
                    formatted_chunks = []
                    for idx, r in enumerate(results, 1):
                        formatted_chunks.append(
                            f"Chunk {idx} (Similarity: {r['score']}, Document: {r['filename']}):\n{r['text']}"
                        )
                    content = "\n\n".join(formatted_chunks)

                executed_tool_calls.append(AgentToolCall(
                    tool="search_knowledge_base",
                    kb_id=kb_id,
                    query=query,
                    output=content
                ))
                agent_status_tracker.finish_tool(rec.id, "search_knowledge_base", result_summary=f"Retrieved {len(results)} chunks")
                return content
            except Exception as e:
                agent_status_tracker.finish_tool(rec.id, "search_knowledge_base", result_summary=f"Error: {str(e)}")
                raise

        # Update docstring dynamically so LLM reads the list of bound KBs
        search_knowledge_base.__doc__ = f"""Search one of the authorized Knowledge Bases bound to this agent.

AVAILABLE BOUND KNOWLEDGE BASES:
{kb_catalog}

Args:
    kb_id (str): The exact KB ID to query (choose from the available list above based on its name and description).
    query (str): The search query to retrieve relevant facts for.

Returns:
    str: Relevant excerpts and matching chunks from that knowledge base.
"""

        # 3. Model setup: Use OpenAIResponses for direct OpenAI, OpenAILike for OpenRouter
        model_id = rec.llm_name or settings.DEFAULT_MODEL
        base_url = rec.base_url or settings.OPENROUTER_BASE_URL
        api_key = rec.api_key or settings.OPENROUTER_API_KEY

        if "openrouter" in (base_url or "").lower():
            model = OpenAILike(
                id=model_id,
                base_url=base_url,
                api_key=api_key
            )
        else:
            try:
                model = OpenAIResponses(
                    id=model_id,
                    base_url=base_url if base_url else None,
                    api_key=api_key
                )
            except Exception:
                model = OpenAILike(
                    id=model_id,
                    base_url=base_url,
                    api_key=api_key
                )

        # 4. Instructions explaining available KBs and reasoning flow
        system_instructions = [
            f"You are '{rec.name}', an intelligent assistant.",
            f"Role / Description: {rec.description or 'Specialized assistant'}",
            "",
            "AUTHORIZED KNOWLEDGE BASES YOU HAVE ACCESS TO:",
            kb_catalog,
            "",
            "CRITICAL TOOL INVOCATION & REASONING RULES:",
            "1. When answering user inquiries requiring information from your bound Knowledge Bases, you MUST CALL the 'search_knowledge_base' tool. Do NOT just state or promise in text that you will search—you MUST execute the function call.",
            "2. You have access to ReasoningTools ('think' and 'analyze'). If you use 'think', keep your thought brief and immediately follow it by calling 'search_knowledge_base'.",
            "3. After receiving information from 'search_knowledge_base', formulate and deliver a comprehensive, helpful, well-formatted final response to the user.",
            "4. Never output internal monologue or deliberation thoughts as your final answer to the user.",
            "5. If none of the bound Knowledge Bases contain the answer, politely explain what was searched."
        ]
        if rec.instructions:
            system_instructions.append(f"\nCustom Instructions: {rec.instructions}")

        # 5. Build Agno Agent with RobustReasoningTools, Knowledge Search tool, and Guardrail Hooks
        agno_agent = Agent(
            model=model,
            tools=[
                RobustReasoningTools(add_instructions=True, agent_id=rec.id),
                search_knowledge_base
            ],
            instructions=system_instructions,
            pre_hooks=pre_hooks if pre_hooks else None,
            post_hooks=post_hooks if post_hooks else None,
            markdown=True
        )

        # 6. Execute inference
        try:
            run_output = agno_agent.run(message)
        except Exception as e:
            agent_status_tracker.fail_inference(rec.id, str(e))
            raise

        # Extract answer and reasoning
        final_answer = run_output.content or ""
        reasoning_str = getattr(run_output, "reasoning_content", None) or ""

        # If reasoning_content was empty, extract structured steps from ReasoningTools
        if not reasoning_str and hasattr(run_output, "reasoning_steps") and run_output.reasoning_steps:
            steps_formatted = []
            for idx, step in enumerate(run_output.reasoning_steps, 1):
                title = getattr(step, "title", None) or f"Reasoning Step {idx}"
                thought = getattr(step, "reasoning", None) or ""
                action = getattr(step, "action", None)
                res = getattr(step, "result", None)
                conf = getattr(step, "confidence", None)

                step_lines = [f"### {title}"]
                if thought:
                    step_lines.append(thought)
                if action:
                    step_lines.append(f"**Action:** {action}")
                if res:
                    step_lines.append(f"**Result:** {res}")
                if conf is not None:
                    step_lines.append(f"**Confidence:** {conf}")
                steps_formatted.append("\n".join(step_lines))
            reasoning_str = "\n\n".join(steps_formatted)

        # If final_answer is empty, synthesize final answer from tool execution
        if not final_answer.strip():
            if executed_tool_calls:
                try:
                    synth_run = agno_agent.run("Based on the retrieved knowledge base information above, write the comprehensive final response for the user.")
                    if synth_run and synth_run.content:
                        final_answer = synth_run.content
                except Exception:
                    pass
            if not final_answer.strip() and reasoning_str.strip():
                final_answer = reasoning_str

        # Also capture any reasoning step from messages if present
        if not reasoning_str and getattr(run_output, "messages", None):
            for m in run_output.messages:
                if getattr(m, "reasoning_content", None):
                    reasoning_str = m.reasoning_content
                    break

        # 7. Evaluate and construct guardrail metadata
        guardrail_info: Optional[GuardrailInfo] = None
        if should_guard:
            ctx = get_guardrail_context()
            input_assess = ctx.get("input_assessment")
            output_assess = ctx.get("output_assessment")

            # Check if run status indicates hook validation failure
            if getattr(run_output, "status", None) != RunStatus.completed:
                # Pre-hook input violation
                if input_assess and not input_assess.is_safe:
                    final_answer = f"I cannot assist with this request because it violates safety policy ({suite.name})."
                    guardrail_info = GuardrailInfo(
                        passed=False,
                        model=settings.LLAMA_GUARD_MODEL,
                        suite_id=suite.id,
                        suite_name=suite.name,
                        input_safe=False,
                        output_safe=True,
                        violations=input_assess.category_names,
                        message=input_assess.reason or f"Input flagged by {suite.name}."
                    )
                # Post-hook output violation
                elif output_assess and not output_assess.is_safe:
                    # Critical: Suppress/withhold any unsafe generated content
                    final_answer = f"I cannot provide the requested response because the generated content was flagged by safety policy ({suite.name})."
                    guardrail_info = GuardrailInfo(
                        passed=False,
                        model=settings.LLAMA_GUARD_MODEL,
                        suite_id=suite.id,
                        suite_name=suite.name,
                        input_safe=True,
                        output_safe=False,
                        violations=output_assess.category_names,
                        message=output_assess.reason or f"Generated response flagged by {suite.name}."
                    )
                else:
                    guardrail_info = GuardrailInfo(
                        passed=False,
                        model=settings.LLAMA_GUARD_MODEL,
                        suite_id=suite.id,
                        suite_name=suite.name,
                        input_safe=True,
                        output_safe=True,
                        violations=[],
                        message=str(run_output.content) if run_output.content else "Inference run error"
                    )
            else:
                # Both hooks passed
                guardrail_info = GuardrailInfo(
                    passed=True,
                    model=settings.LLAMA_GUARD_MODEL,
                    suite_id=suite.id,
                    suite_name=suite.name,
                    input_safe=True,
                    output_safe=True,
                    violations=[]
                )

        # Real-time status: complete inference session
        agent_status_tracker.finish_inference(rec.id, final_answer, len(executed_tool_calls))
        tracker_status = agent_status_tracker.get_status(rec.id)
        all_tool_history = tracker_status.get("tool_history", [])

        # Sync any search tool calls that might have been recorded in tracker
        for item in all_tool_history:
            if item.get("tool") == "search_knowledge_base" and not any(tc.tool == "search_knowledge_base" for tc in executed_tool_calls):
                args = item.get("args", {})
                executed_tool_calls.append(AgentToolCall(
                    tool="search_knowledge_base",
                    kb_id=args.get("kb_id"),
                    query=args.get("query"),
                    duration_ms=item.get("duration_ms"),
                    summary=item.get("summary"),
                    output=item.get("summary")
                ))

        return {
            "agent_id": rec.id,
            "agent_name": rec.name,
            "query": message,
            "response": final_answer,
            "reasoning": reasoning_str if reasoning_str else None,
            "tool_calls": executed_tool_calls,
            "tool_history": all_tool_history,
            "bound_kbs": bound_kbs_info,
            "guardrail": guardrail_info
        }


# Global AgentEngine instance
agent_engine = AgentEngine()
