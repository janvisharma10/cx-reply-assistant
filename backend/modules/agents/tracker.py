"""
Real-time Tool & Execution Status Tracker for Agno Agents.

Provides real-time tracking of active tool calls (think, analyze, search_knowledge_base),
guardrail hook evaluations (input/output Llama Guard), and inference progress.
Supports both REST polling and Server-Sent Events (SSE) streaming.
"""
import time
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from threading import Lock


class AgentStatusTracker:
    def __init__(self):
        self._lock = Lock()
        # Active status per agent_id
        self._statuses: Dict[str, Dict[str, Any]] = {}
        # Subscriber queues per agent_id for SSE streaming: list of (asyncio.Queue, loop)
        self._subscribers: Dict[str, List[Tuple[asyncio.Queue, asyncio.AbstractEventLoop]]] = {}

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _broadcast(self, agent_id: str, event: Dict[str, Any]):
        with self._lock:
            subscribers = list(self._subscribers.get(agent_id, []))
        for q, loop in subscribers:
            try:
                if loop and loop.is_running():
                    loop.call_soon_threadsafe(q.put_nowait, event)
                else:
                    q.put_nowait(event)
            except Exception:
                pass

    def start_inference(self, agent_id: str, agent_name: str, message: str) -> str:
        """Mark start of agent inference."""
        now = self._now()
        with self._lock:
            status_obj = {
                "agent_id": agent_id,
                "agent_name": agent_name,
                "status": "running",
                "message": message,
                "current_step": "Initializing agent reasoning engine...",
                "current_tool": None,
                "tool_history": [],
                "guardrails": {
                    "input_pre_hook": {"status": "idle"},
                    "output_post_hook": {"status": "idle"}
                },
                "started_at": now,
                "last_updated": now
            }
            self._statuses[agent_id] = status_obj

        self._broadcast(agent_id, {
            "type": "inference_start",
            "agent_id": agent_id,
            "agent_name": agent_name,
            "message": message,
            "timestamp": now
        })
        return agent_id

    def start_guardrail(self, agent_id: str, hook: str, suite_name: str, model: str):
        """Mark guardrail evaluation start."""
        now = self._now()
        with self._lock:
            if agent_id in self._statuses:
                self._statuses[agent_id]["status"] = "evaluating_guardrails"
                self._statuses[agent_id]["current_step"] = f"Evaluating {hook.replace('_', ' ')} with {suite_name}..."
                self._statuses[agent_id]["guardrails"][hook] = {
                    "status": "evaluating",
                    "suite": suite_name,
                    "model": model,
                    "started_at": now
                }
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "guardrail_start",
            "agent_id": agent_id,
            "hook": hook,
            "suite_name": suite_name,
            "model": model,
            "timestamp": now
        })

    def finish_guardrail(self, agent_id: str, hook: str, is_safe: bool, violations: List[str], reason: Optional[str] = None):
        """Mark guardrail evaluation completion."""
        now = self._now()
        with self._lock:
            if agent_id in self._statuses:
                self._statuses[agent_id]["status"] = "running"
                self._statuses[agent_id]["guardrails"][hook] = {
                    "status": "passed" if is_safe else "blocked",
                    "is_safe": is_safe,
                    "violations": violations,
                    "reason": reason,
                    "completed_at": now
                }
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "guardrail_complete",
            "agent_id": agent_id,
            "hook": hook,
            "is_safe": is_safe,
            "violations": violations,
            "reason": reason,
            "timestamp": now
        })

    def start_tool(self, agent_id: str, tool_name: str, args: Dict[str, Any]):
        """Record real-time tool start (e.g. search_knowledge_base, think, analyze)."""
        now = self._now()
        tool_desc = ""
        if tool_name == "search_knowledge_base":
            kb = args.get("kb_id", "knowledge base")
            q = args.get("query", "")
            tool_desc = f"Searching Knowledge Base '{kb}' for '{q}'"
        elif tool_name == "think":
            title = args.get("title") or "Deliberation"
            tool_desc = f"Thinking: {title}"
        elif tool_name == "analyze":
            title = args.get("title") or "Analysis"
            tool_desc = f"Analyzing: {title}"
        else:
            tool_desc = f"Calling tool '{tool_name}'"

        tool_record = {
            "tool": tool_name,
            "status": "executing",
            "description": tool_desc,
            "args": args,
            "started_at": now,
            "start_time": time.time()
        }

        with self._lock:
            if agent_id in self._statuses:
                self._statuses[agent_id]["status"] = "executing_tool"
                self._statuses[agent_id]["current_step"] = tool_desc
                self._statuses[agent_id]["current_tool"] = tool_record
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "tool_start",
            "agent_id": agent_id,
            "tool": tool_name,
            "description": tool_desc,
            "args": args,
            "timestamp": now
        })

    def finish_tool(self, agent_id: str, tool_name: str, result_summary: Optional[str] = None):
        """Record real-time tool completion."""
        now = self._now()
        duration_ms = 0.0
        tool_args = {}

        with self._lock:
            if agent_id in self._statuses:
                curr = self._statuses[agent_id].get("current_tool")
                if curr and curr.get("tool") == tool_name:
                    start_t = curr.get("start_time", time.time())
                    duration_ms = round((time.time() - start_t) * 1000, 2)
                    tool_args = curr.get("args", {})

                history_item = {
                    "tool": tool_name,
                    "status": "completed",
                    "args": tool_args,
                    "duration_ms": duration_ms,
                    "summary": (result_summary or "")[:300],
                    "completed_at": now
                }
                self._statuses[agent_id]["tool_history"].append(history_item)
                self._statuses[agent_id]["current_tool"] = None
                self._statuses[agent_id]["status"] = "running"
                self._statuses[agent_id]["current_step"] = f"Finished {tool_name} ({duration_ms}ms)"
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "tool_complete",
            "agent_id": agent_id,
            "tool": tool_name,
            "duration_ms": duration_ms,
            "summary": (result_summary or "")[:300],
            "timestamp": now
        })

    def finish_inference(self, agent_id: str, response_preview: str, tool_count: int):
        """Mark inference finished."""
        now = self._now()
        with self._lock:
            if agent_id in self._statuses:
                self._statuses[agent_id]["status"] = "completed"
                self._statuses[agent_id]["current_step"] = "Response completed"
                self._statuses[agent_id]["current_tool"] = None
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "inference_complete",
            "agent_id": agent_id,
            "tool_calls_executed": tool_count,
            "response_preview": response_preview[:200],
            "timestamp": now
        })

    def fail_inference(self, agent_id: str, error_msg: str):
        """Mark inference error."""
        now = self._now()
        with self._lock:
            if agent_id in self._statuses:
                self._statuses[agent_id]["status"] = "error"
                self._statuses[agent_id]["current_step"] = f"Error: {error_msg}"
                self._statuses[agent_id]["current_tool"] = None
                self._statuses[agent_id]["last_updated"] = now

        self._broadcast(agent_id, {
            "type": "inference_error",
            "agent_id": agent_id,
            "error": error_msg,
            "timestamp": now
        })

    def get_status(self, agent_id: str) -> Dict[str, Any]:
        """Retrieve snapshot of an agent's real-time execution status."""
        with self._lock:
            if agent_id not in self._statuses:
                return {
                    "agent_id": agent_id,
                    "status": "idle",
                    "current_step": "Waiting for prompt",
                    "current_tool": None,
                    "tool_history": [],
                    "guardrails": {
                        "input_pre_hook": {"status": "idle"},
                        "output_post_hook": {"status": "idle"}
                    },
                    "last_updated": self._now()
                }

            s = dict(self._statuses[agent_id])
            # Calculate elapsed time for active tool if running
            if s.get("current_tool") and "start_time" in s["current_tool"]:
                ct = dict(s["current_tool"])
                ct["elapsed_ms"] = round((time.time() - ct["start_time"]) * 1000, 2)
                ct.pop("start_time", None)
                s["current_tool"] = ct

            return s

    def get_all_statuses(self) -> List[Dict[str, Any]]:
        """List statuses for all active agents."""
        with self._lock:
            agent_ids = list(self._statuses.keys())
        return [self.get_status(aid) for aid in agent_ids]

    def register_subscriber(self, agent_id: str, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        with self._lock:
            if agent_id not in self._subscribers:
                self._subscribers[agent_id] = []
            self._subscribers[agent_id].append((queue, loop))

    def unregister_subscriber(self, agent_id: str, queue: asyncio.Queue):
        with self._lock:
            if agent_id in self._subscribers:
                self._subscribers[agent_id] = [
                    (q, l) for (q, l) in self._subscribers[agent_id] if q is not queue
                ]


# Global singleton instance
agent_status_tracker = AgentStatusTracker()
