"""
Robust Reasoning Tools for Agno Agents.

Extends Agno's ReasoningTools with resilient defaults for parameters like 'title'
and 'result', preventing Pydantic ValidationError when LLMs omit them in tool calls.
"""
from typing import Optional, List, Any
from agno.run import RunContext
from agno.tools import Toolkit
from agno.tools.reasoning import ReasoningTools
from modules.agents.tracker import agent_status_tracker


class RobustReasoningTools(ReasoningTools):
    """
    Subclass of Agno's ReasoningTools with robust argument defaults
    and real-time execution telemetry to AgentStatusTracker.
    """
    def __init__(
        self,
        agent_id: Optional[str] = None,
        enable_think: bool = True,
        enable_analyze: bool = True,
        all: bool = False,
        instructions: Optional[str] = None,
        add_instructions: bool = True,
        add_few_shot: bool = False,
        few_shot_examples: Optional[str] = None,
        **kwargs,
    ):
        self.agent_id = agent_id
        if instructions is None:
            self.instructions = "<reasoning_instructions>\n" + self.DEFAULT_INSTRUCTIONS
            if add_few_shot:
                if few_shot_examples is not None:
                    self.instructions += "\n" + few_shot_examples
                else:
                    self.instructions += "\n" + self.FEW_SHOT_EXAMPLES
            self.instructions += "\n</reasoning_instructions>\n"
        else:
            self.instructions = instructions

        tools: List[Any] = []
        if all or enable_think:
            tools.append(self.think)
        if all or enable_analyze:
            tools.append(self.analyze)

        Toolkit.__init__(
            self,
            name="reasoning_tools",
            instructions=self.instructions,
            add_instructions=add_instructions,
            tools=tools,
            **kwargs,
        )

    def think(
        self,
        run_context: RunContext,
        thought: str = "",
        title: str = "Thinking",
        action: Optional[str] = None,
        confidence: float = 0.8,
    ) -> str:
        """Use this tool as a scratchpad to reason step-by-step.

        Args:
            thought: Your detailed thought for this step.
            title: A concise title for this step (default: 'Thinking').
            action: What you will do based on this thought.
            confidence: How confident you are about this thought (0.0 to 1.0).
        """
        aid = self.agent_id or getattr(run_context, "agent_id", "default_agent")
        agent_status_tracker.start_tool(aid, "think", {
            "title": title or "Thinking",
            "thought": (thought or "")[:250],
            "action": action
        })
        try:
            res = super().think(
                run_context=run_context,
                title=title or "Thinking",
                thought=thought or "Deliberating next step",
                action=action,
                confidence=confidence,
            )
            agent_status_tracker.finish_tool(aid, "think", result_summary=title or "Completed thought")
            return res
        except Exception as e:
            agent_status_tracker.finish_tool(aid, "think", result_summary=f"Error: {str(e)}")
            raise

    def analyze(
        self,
        run_context: RunContext,
        analysis: str = "",
        title: str = "Analysis",
        result: str = "Analysis completed",
        next_action: str = "final_answer",
        confidence: float = 0.8,
    ) -> str:
        """Use this tool to analyze results from a reasoning step and determine next actions.

        Args:
            analysis: Your analysis of the results.
            title: A concise title for this analysis step (default: 'Analysis').
            result: The outcome of the previous action (default: 'Analysis completed').
            next_action: What to do next ('continue', 'validate', or 'final_answer').
            confidence: How confident you are in this analysis (0.0 to 1.0).
        """
        aid = self.agent_id or getattr(run_context, "agent_id", "default_agent")
        agent_status_tracker.start_tool(aid, "analyze", {
            "title": title or "Analysis",
            "analysis": (analysis or "")[:250],
            "result": (result or "")[:250],
            "next_action": next_action
        })
        try:
            res = super().analyze(
                run_context=run_context,
                title=title or "Analysis",
                result=result or "Analysis completed",
                analysis=analysis or "Analysis verified",
                next_action=next_action,
                confidence=confidence,
            )
            agent_status_tracker.finish_tool(aid, "analyze", result_summary=result or analysis or "Analysis complete")
            return res
        except Exception as e:
            agent_status_tracker.finish_tool(aid, "analyze", result_summary=f"Error: {str(e)}")
            raise
