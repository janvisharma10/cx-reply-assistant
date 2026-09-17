import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  ShieldCheck,
  ShieldAlert,
  BrainCircuit,
  Database,
  Terminal,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
  Activity,
  Zap,
  Clock,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import { runAgentInference, listAgents, subscribeAgentStatus } from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function ChatWorkspace({
  agents = [],
  selectedAgent,
  setSelectedAgent,
  onRefreshAgents,
  onNavigateToStudio
}) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  const [showAgentCards, setShowAgentCards] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState({}); // { [msgIndex]: { reasoning: bool, tools: bool } }
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState({
    status: 'idle',
    currentStep: '',
    activeTool: null,
    events: []
  });

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, liveTelemetry.events.length]);

  // Initial welcome message when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello! I am **${selectedAgent.name}**. I am specialized to answer questions using my bound Knowledge Bases with deliberate reasoning and protected by **Llama Guard 4 (12B)** safety guardrails. How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          guardrail: {
            passed: true,
            model: 'meta-llama/llama-guard-4-12b',
            input_safe: true,
            output_safe: true
          }
        }
      ]);
    }
  }, [selectedAgent?.id]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || !selectedAgent || loading) return;

    const userMessage = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);
    setLiveTelemetry({
      status: 'running',
      currentStep: 'Initializing agent reasoning engine...',
      activeTool: null,
      events: []
    });

    let unsubscribe = null;
    try {
      // Connect to real-time Server-Sent Events stream for live tool tracking
      unsubscribe = subscribeAgentStatus(selectedAgent.id, (event) => {
        if (!event) return;
        setLiveTelemetry((prev) => {
          let updatedStep = prev.currentStep;
          let activeTool = prev.activeTool;
          const updatedEvents = [...prev.events];

          if (event.type === 'inference_start') {
            updatedStep = 'Reasoning engine initialized. Evaluating query...';
          } else if (event.type === 'guardrail_start') {
            const hookName = event.hook === 'input_pre_hook' ? 'Input Pre-Hook' : 'Output Post-Hook';
            updatedStep = `Evaluating ${hookName} safety (${event.suite_name || 'Policy'})...`;
            updatedEvents.push({
              type: 'guardrail',
              label: `Safety: ${hookName}`,
              status: 'running'
            });
          } else if (event.type === 'guardrail_complete') {
            const hookName = event.hook === 'input_pre_hook' ? 'Input' : 'Output';
            updatedStep = event.is_safe ? `${hookName} Guardrail Passed ✓` : `Safety Flag in ${hookName} ⚠️`;
            updatedEvents.push({
              type: 'guardrail',
              label: `${hookName} Safety: ${event.is_safe ? 'Safe ✓' : 'Blocked ⚠️'}`,
              status: event.is_safe ? 'passed' : 'blocked'
            });
          } else if (event.type === 'tool_start') {
            updatedStep = event.description || `Executing tool '${event.tool}'...`;
            activeTool = {
              tool: event.tool,
              args: event.args || {},
              description: event.description
            };
            updatedEvents.push({
              type: 'tool',
              tool: event.tool,
              label: event.description || `Calling tool: ${event.tool}`,
              status: 'running',
              args: event.args
            });
          } else if (event.type === 'tool_complete') {
            updatedStep = `Finished ${event.tool} (${event.duration_ms}ms)`;
            activeTool = null;
            updatedEvents.push({
              type: 'tool',
              tool: event.tool,
              label: `Finished ${event.tool} (${event.duration_ms}ms)`,
              status: 'completed',
              duration_ms: event.duration_ms,
              summary: event.summary
            });
          } else if (event.type === 'inference_complete') {
            updatedStep = 'Response complete.';
            activeTool = null;
          }

          return {
            status: event.type === 'tool_start' ? 'executing_tool' : 'running',
            currentStep: updatedStep,
            activeTool,
            events: updatedEvents
          };
        });
      });

      const result = await runAgentInference(selectedAgent.id, query, guardrailsEnabled);

      const assistantMessage = {
        role: 'assistant',
        content: result.response,
        reasoning: result.reasoning,
        toolCalls: result.tool_calls || [],
        toolHistory: result.tool_history || [],
        guardrail: result.guardrail,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `Error during inference: ${err.message}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (unsubscribe) unsubscribe();
      setLoading(false);
      setLiveTelemetry({
        status: 'idle',
        currentStep: '',
        activeTool: null,
        events: []
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e) => {
    setInputQuery(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const toggleDetail = (index, type) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type]: !prev[index]?.[type]
      }
    }));
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    if (window.confirm('Clear current playground chat history?')) {
      if (selectedAgent) {
        setMessages([
          {
            role: 'assistant',
            content: `Chat cleared. Ready for your questions with **${selectedAgent.name}**!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            guardrail: { passed: true, model: 'meta-llama/llama-guard-4-12b' }
          }
        ]);
      } else {
        setMessages([]);
      }
    }
  };


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: 1,
      overflow: 'hidden',
      background: '#ffffff'
    }}>
      {/* ── Top Header & Agent Selector Strip ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: showAgentCards && agents.length > 0 ? '8px' : '0'
        }}>
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Playground
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '1px 0 0' }}>
                Test deliberate agent reasoning, vector knowledge retrieval, and Llama Guard 4 (12B) safety checks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }} className="mobile-only">
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
              {selectedAgent ? `Active: ${selectedAgent.name}` : 'Select an Agent'}
            </span>
            {agents.length > 0 && (
              <button
                onClick={() => setShowAgentCards(!showAgentCards)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.72rem', gap: '4px', border: '1px solid #e2e8f0' }}
              >
                {showAgentCards ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span>{showAgentCards ? 'Hide' : 'Agents'}</span>
              </button>
            )}
          </div>

          <div className="desktop-only" style={{ alignItems: 'center', gap: '8px' }}>
            {agents.length > 0 && (
              <button
                onClick={() => setShowAgentCards(!showAgentCards)}
                className="btn btn-ghost"
                style={{ padding: '5px 9px', fontSize: '0.75rem', gap: '5px', border: '1px solid #e2e8f0' }}
                title={showAgentCards ? 'Collapse agent list' : 'Show agent list'}
              >
                {showAgentCards ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span>{showAgentCards ? 'Collapse' : 'Agents'}</span>
              </button>
            )}

            <button
              onClick={onNavigateToStudio}
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.75rem', gap: '5px' }}
              title="Create new agent in Studio"
            >
              <Plus size={13} />
              <span>Studio</span>
            </button>
          </div>
        </div>

        {/* Agent Cards Horizontal Grid */}
        {showAgentCards && (
          <div className="no-scrollbar" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '8px',
            maxHeight: '140px',
            overflowY: 'auto',
            paddingTop: '2px',
            paddingBottom: '2px'
          }}>
            {agents.length === 0 ? (
              <div style={{
                padding: '10px 14px',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span>No agents registered yet.</span>
                <button
                  onClick={onNavigateToStudio}
                  className="btn btn-primary"
                  style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                >
                  Create Agent
                </button>
              </div>
            ) : (
              agents.map((ag) => {
                const isSelected = selectedAgent?.id === ag.id;
                return (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedAgent(ag)}
                    className={`kenzai-card ${isSelected ? 'active-card' : ''}`}
                    style={{
                      cursor: 'pointer',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: isSelected ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: isSelected ? '#000000' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Bot size={14} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {ag.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {ag.llm_name || 'Groq Llama 3.3 70B'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? '#000000' : '#e2e8f0',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        flexShrink: 0
                      }}>
                        <ChevronRight size={12} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                        <Database size={10} />
                        {ag.kb_ids?.length || 0} KBs
                      </span>
                      <span className="badge badge-safe" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                        <ShieldCheck size={10} />
                        {ag.guardrail_suite_id || 'Standard'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Chat Messages Stream Area ── */}
      <div
        className="no-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: '#f8fafc'
        }}
      >
        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          const isSafetyBlocked = msg.guardrail && !msg.guardrail.passed;
          const details = expandedDetails[index] || {};

          return (
            <div
              key={index}
              className="animate-fade-in"
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                maxWidth: isAssistant ? '88%' : '78%',
                width: 'auto'
              }}
            >
              {/* Avatar Icon */}
              {isAssistant && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: isSafetyBlocked 
                    ? 'var(--safety-danger-bg)'
                    : '#000000',
                  border: `1px solid ${isSafetyBlocked ? 'var(--safety-danger-border)' : '#000000'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  {isSafetyBlocked ? <ShieldAlert size={16} color="var(--safety-danger-text)" /> : <Bot size={16} color="#ffffff" />}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                {/* Message Bubble */}
                <div style={{
                  position: 'relative',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: isAssistant 
                    ? (isSafetyBlocked ? 'var(--safety-danger-bg)' : '#ffffff')
                    : '#000000',
                  border: `1px solid ${
                    isAssistant 
                      ? (isSafetyBlocked ? 'var(--safety-danger-border)' : 'var(--border-subtle)')
                      : '#000000'
                  }`,
                  color: isAssistant ? '#09090b' : '#ffffff',
                  boxShadow: isAssistant ? '0 1px 3px rgba(0, 0, 0, 0.04)' : '0 2px 6px rgba(0, 0, 0, 0.12)'
                }}>
                  <div className="markdown-content">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Copy button on assistant messages */}
                  {isAssistant && (
                    <button
                      onClick={() => copyToClipboard(msg.content, index)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: '3px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s ease'
                      }}
                      title="Copy response"
                    >
                      {copiedIndex === index ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>

                {/* Safety Guardrail Diagnostic Box */}
                {isAssistant && msg.guardrail && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '4px 9px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSafetyBlocked ? 'var(--safety-danger-bg)' : 'var(--safety-safe-bg)',
                    border: `1px solid ${isSafetyBlocked ? 'var(--safety-danger-border)' : 'var(--safety-safe-border)'}`,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: isSafetyBlocked ? 'var(--safety-danger-text)' : 'var(--safety-safe-text)'
                  }}>
                    {isSafetyBlocked ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                    <span>
                      {isSafetyBlocked
                        ? `BLOCKED by ${msg.guardrail.suite_name || 'Guardrail Suite'} [${msg.guardrail.violations?.join(', ') || 'Safety Policy'}]`
                        : `Verified Safe by ${msg.guardrail.suite_name || 'Guardrail Suite'} (Llama Guard 4 • 12B)`}
                    </span>
                    {msg.guardrail.message && isSafetyBlocked && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.68rem' }}>
                        {msg.guardrail.message}
                      </span>
                    )}
                  </div>
                )}

                {/* Expandable Reasoning Box */}
                {isAssistant && msg.reasoning && (
                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: '#ffffff',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-xs)'
                  }}>
                    <button
                      onClick={() => toggleDetail(index, 'reasoning')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        background: '#f8fafc',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BrainCircuit size={13} color="#000000" />
                        <span>Agent Deliberation & Reasoning</span>
                      </div>
                      {details.reasoning ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {details.reasoning && (
                      <div style={{
                        padding: '10px 14px',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                        color: '#334155',
                        maxHeight: '240px',
                        overflowY: 'auto'
                      }}>
                        <div className="markdown-content">
                          <ReactMarkdown>
                            {msg.reasoning}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Tool Calls Box */}
                {isAssistant && ((msg.toolCalls && msg.toolCalls.length > 0) || (msg.toolHistory && msg.toolHistory.length > 0)) && (
                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: '#ffffff',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-xs)'
                  }}>
                    <button
                      onClick={() => toggleDetail(index, 'tools')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        background: '#f8fafc',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={13} color="#000000" />
                        <span>Executed Tools ({msg.toolHistory?.length || msg.toolCalls?.length || 0})</span>
                      </div>
                      {details.tools ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {details.tools && (
                      <div style={{
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        {(msg.toolHistory && msg.toolHistory.length > 0 ? msg.toolHistory : msg.toolCalls).map((tc, tcIdx) => (
                          <div key={tcIdx} style={{
                            padding: '8px 10px',
                            background: '#f8fafc',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.72rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge badge-monochrome" style={{ fontSize: '0.65rem' }}>
                                  {tc.tool}
                                </span>
                                {tc.args?.kb_id || tc.kb_id ? (
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    KB: <strong>{tc.args?.kb_id || tc.kb_id}</strong>
                                  </span>
                                ) : null}
                              </div>
                              {tc.duration_ms !== undefined && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={10} />
                                  {tc.duration_ms}ms
                                </span>
                              )}
                            </div>

                            {(tc.args?.query || tc.query) && (
                              <div style={{ color: '#09090b', marginBottom: '3px', fontWeight: 500 }}>
                                Query: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px', fontSize: '0.7rem' }}>"{tc.args?.query || tc.query}"</code>
                              </div>
                            )}

                            {(tc.summary || tc.output) && (
                              <div style={{
                                maxHeight: '100px',
                                overflowY: 'auto',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.68rem',
                                color: '#475569',
                                whiteSpace: 'pre-wrap',
                                background: '#ffffff',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-xs)',
                                border: '1px solid var(--border-subtle)'
                              }}>
                                {tc.summary || tc.output}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <span style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                  padding: '0 4px'
                }}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {/* Real-Time Telemetry & Loading Card */}
        {loading && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              <Bot size={16} color="#ffffff" />
            </div>
            <div style={{
              minWidth: 'min(100%, 320px)',
              width: '100%',
              maxWidth: '650px',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              border: '1px solid #000000',
              padding: '12px 16px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }} className="animate-pulse-glow" />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#09090b', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    Agent Reasoning in Progress
                  </span>
                </div>
                <span className="badge badge-monochrome" style={{ fontSize: '0.62rem' }}>
                  Llama Guard 4 • 12B
                </span>
              </div>

              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#1e293b',
                background: '#f8fafc',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                {liveTelemetry.currentStep || 'Synthesizing verified output...'}
              </div>

              {liveTelemetry.events.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {liveTelemetry.events.map((ev, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.7rem',
                      color: ev.status === 'blocked' ? '#b91c1c' : '#475569'
                    }}>
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: ev.status === 'blocked' ? '#ef4444' : (ev.status === 'completed' || ev.status === 'passed' ? '#10b981' : '#f59e0b')
                      }} />
                      <span>{ev.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>



      {/* ── Chat Input Dock ── */}
      <div style={{
        padding: '10px 14px 12px',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: 'var(--radius-lg)',
          padding: '6px 10px',
          background: '#ffffff',
          boxShadow: 'var(--shadow-xs)',
          transition: 'all 0.18s ease'
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={selectedAgent ? `Ask ${selectedAgent.name}...` : 'Please select an agent first...'}
            disabled={!selectedAgent || loading}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-sans)',
              color: '#0f172a',
              maxHeight: '120px',
              padding: '4px 0',
              lineHeight: 1.4
            }}
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || !selectedAgent || loading}
            className="btn btn-primary"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              flexShrink: 0,
              height: '34px'
            }}
            title="Send Query"
          >
            {loading ? <RefreshCw size={14} className="animate-spin-slow" /> : <Send size={14} />}
            <span className="desktop-only">Send</span>
          </button>
        </div>

        {/* Bottom controls & status strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Guardrails toggle */}
            <button
              onClick={() => setGuardrailsEnabled(!guardrailsEnabled)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.72rem',
                color: guardrailsEnabled ? '#047857' : '#94a3b8',
                fontWeight: 600,
                padding: 0
              }}
              title="Toggle Llama Guard 4 (12B) safety check"
            >
              {guardrailsEnabled ? <ToggleRight size={18} color="#10b981" /> : <ToggleLeft size={18} color="#94a3b8" />}
              <span>Llama Guard 4 {guardrailsEnabled ? 'Active' : 'Off'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={clearChat}
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.72rem', gap: '4px', color: '#94a3b8' }}
              title="Clear conversation history"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
