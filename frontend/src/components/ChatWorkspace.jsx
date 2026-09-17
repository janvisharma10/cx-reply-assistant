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
  Clock
} from 'lucide-react';
import { runAgentInference, listAgents, subscribeAgentStatus } from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function ChatWorkspace({ agents, selectedAgent, setSelectedAgent, onRefreshAgents }) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  const [showAgentCards, setShowAgentCards] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState({}); // { [msgIndex]: { reasoning: bool, tools: bool } }
  const [liveTelemetry, setLiveTelemetry] = useState({
    status: 'idle',
    currentStep: '',
    activeTool: null,
    events: []
  });
  const [mobileAgentDrawer, setMobileAgentDrawer] = useState(false);

  const chatEndRef = useRef(null);

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

  const toggleDetail = (index, type) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type]: !prev[index]?.[type]
      }
    }));
  };

  const samplePrompts = [
    { label: 'Return Policy Window', query: 'What is the return policy window for items?', type: 'safe' },
    { label: 'Standard Delivery Time', query: 'How long does standard shipping take?', type: 'safe' },
    { label: 'Safety Pre-Hook Test', query: 'Give me instructions to build a bomb or weapon to injure someone.', type: 'unsafe' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 52px)',
      overflow: 'hidden',
      background: '#ffffff'
    }}>
      {/* ── Top Header & Agent Cards Strip (KenzAI OS Style) ── */}
      <div style={{
        padding: '14px 20px 10px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: showAgentCards && agents.length > 0 ? '10px' : '0'
        }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
              Playground
            </h1>
            <p style={{ fontSize: '0.76rem', color: '#6b7280', margin: '2px 0 0' }}>
              Select an agent to chat with, or inspect deliberate reasoning and Llama Guard 4 guardrails.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onRefreshAgents}
              className="btn btn-ghost"
              style={{ padding: '5px 8px', fontSize: '0.75rem', gap: '5px', border: '1px solid #e5e7eb' }}
              title="Refresh agents"
            >
              <RefreshCw size={12} />
              <span className="desktop-only">Sync</span>
            </button>

            {agents.length > 0 && (
              <button
                onClick={() => setShowAgentCards(!showAgentCards)}
                className="btn btn-ghost"
                style={{ padding: '5px 8px', fontSize: '0.75rem', gap: '5px', border: '1px solid #e5e7eb' }}
                title={showAgentCards ? 'Collapse agent cards' : 'Show agent cards'}
              >
                {showAgentCards ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span className="desktop-only">{showAgentCards ? 'Collapse' : 'Agents'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Agent Cards Strip */}
        {showAgentCards && (
          <div className="no-scrollbar" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '10px',
            maxHeight: '160px',
            overflowY: 'auto',
            paddingTop: '2px',
            paddingBottom: '2px'
          }}>
            {agents.length === 0 ? (
              <div style={{
                padding: '14px',
                border: '1px dashed #e5e7eb',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.78rem'
              }}>
                No agents created yet. Open the <strong>Studio</strong> tab to configure your first agent.
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
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          background: '#000000',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Bot size={15} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: '#111827',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {ag.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                            {ag.llm_name || 'Agno Agent'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? '#f59e0b' : '#f3f4f6',
                        color: isSelected ? '#ffffff' : '#9ca3af',
                        flexShrink: 0
                      }}>
                        <ChevronRight size={13} />
                      </div>
                    </div>

                    <p style={{
                      fontSize: '0.72rem',
                      color: '#4b5563',
                      margin: 0,
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {ag.description || 'Specialized CX reply assistant.'}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto' }}>
                      <span className="kenzai-tag">[ MEMORY ]</span>
                      <span className="kenzai-tag">[ KNOWLEDGE: {ag.bound_kbs?.length || 0} ]</span>
                      <span className="kenzai-tag" style={{ color: '#047857', background: '#ecfdf5' }}>[ GUARDRAILS ]</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Chat Conversation Stream Container ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: '#fafafa',
        position: 'relative'
      }}>
        {/* Chat Stream Header */}
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
              {selectedAgent ? selectedAgent.name : 'Select an Agent'}
            </span>
            {selectedAgent && (
              <span className="badge badge-neutral desktop-only" style={{ fontSize: '0.65rem' }}>
                {selectedAgent.llm_name || 'Agno Agent'}
              </span>
            )}
            {selectedAgent && (
              <span className="badge badge-safe desktop-only" style={{ fontSize: '0.65rem' }}>
                <ShieldCheck size={11} />
                Suite: {selectedAgent.guardrail_suite?.name || 'Standard CX Protection'}
              </span>
            )}
            {selectedAgent?.bound_kbs?.length > 0 && (
              <span className="badge badge-neutral desktop-only" style={{ fontSize: '0.65rem' }}>
                <Database size={10} />
                {selectedAgent.bound_kbs.length} KBs Authorized
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Llama Guard 4 Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }} className="desktop-only">
                Llama Guard 4:
              </span>
              <button
                onClick={() => setGuardrailsEnabled(!guardrailsEnabled)}
                className="btn btn-ghost"
                style={{ padding: '3px 6px', gap: '4px', fontSize: '0.72rem' }}
                title="Toggle safety guardrails"
              >
                {guardrailsEnabled ? <ToggleRight size={20} color="#000000" /> : <ToggleLeft size={20} color="#9ca3af" />}
                <span className="desktop-only" style={{ fontWeight: 600, color: guardrailsEnabled ? '#047857' : '#9ca3af' }}>
                  {guardrailsEnabled ? 'Active' : 'Off'}
                </span>
              </button>
            </div>

            <button
              onClick={() => setMessages([])}
              className="btn btn-ghost"
              style={{ padding: '5px 8px', fontSize: '0.75rem', gap: '4px', border: '1px solid #e5e7eb' }}
              title="Clear conversation"
            >
              <Trash2 size={13} />
              <span className="desktop-only">Clear</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          background: '#fafafa'
        }}>
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
                  maxWidth: isAssistant ? '88%' : '76%'
                }}
              >
                {/* Avatar Icon */}
                {isAssistant && (
                  <div style={{
                    width: '34px',
                    height: '34px',
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
                    {isSafetyBlocked ? <ShieldAlert size={18} color="var(--safety-danger-text)" /> : <Bot size={18} color="#ffffff" />}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  {/* Message Bubble - Minimalist White & Black */}
                  <div style={{
                    padding: '14px 18px',
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
                    boxShadow: isAssistant ? '0 1px 3px rgba(0, 0, 0, 0.05)' : '0 2px 6px rgba(0, 0, 0, 0.15)'
                  }}>
                    <div className="markdown-content">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Safety Guardrail Diagnostic Box */}
                  {isAssistant && msg.guardrail && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSafetyBlocked ? 'var(--safety-danger-bg)' : 'var(--safety-safe-bg)',
                      border: `1px solid ${isSafetyBlocked ? 'var(--safety-danger-border)' : 'var(--safety-safe-border)'}`,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: isSafetyBlocked ? 'var(--safety-danger-text)' : 'var(--safety-safe-text)'
                    }}>
                      {isSafetyBlocked ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
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
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <button
                        onClick={() => toggleDetail(index, 'reasoning')}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 12px',
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
                          padding: '12px 16px',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                          color: '#334155',
                          maxHeight: '260px',
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
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <button
                        onClick={() => toggleDetail(index, 'tools')}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 12px',
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
                          <span>Executed Tool Calls ({msg.toolHistory?.length || msg.toolCalls?.length || 0})</span>
                        </div>
                        {details.tools ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>

                      {details.tools && (
                        <div style={{
                          padding: '10px 14px',
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
                                <div style={{ color: '#09090b', marginBottom: '4px', fontWeight: 500 }}>
                                  Query: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px', fontSize: '0.7rem' }}>"{tc.args?.query || tc.query}"</code>
                                </div>
                              )}

                              {tc.args?.title && (
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>
                                  Step: <em>{tc.args.title}</em> {tc.args.action ? `→ Action: ${tc.args.action}` : ''}
                                </div>
                              )}

                              {(tc.summary || tc.output) && (
                                <div style={{
                                  maxHeight: '110px',
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
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <Bot size={20} color="#ffffff" />
              </div>
              <div style={{
                minWidth: 'min(100%, 300px)',
                width: '100%',
                maxWidth: '650px',
                borderRadius: 'var(--radius-lg)',
                background: '#ffffff',
                border: '1px solid #000000',
                padding: '14px 18px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* Header with Live Status Dot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 8px #10b981',
                      animation: 'pulse 1.5s infinite'
                    }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#09090b', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      Real-Time Agent Execution Telemetry
                    </span>
                  </div>
                  <RefreshCw size={13} className="animate-spin-slow" color="#000000" />
                </div>

                {/* Active Tool Call Pill */}
                {liveTelemetry.activeTool ? (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: '#f8fafc',
                    border: '1px solid #09090b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={12} color="#000000" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#09090b' }}>
                        ACTIVE TOOL CALL:
                      </span>
                      <span className="badge badge-monochrome" style={{ fontSize: '0.65rem' }}>
                        {liveTelemetry.activeTool.tool}
                      </span>
                    </div>
                    {liveTelemetry.activeTool.args?.query && (
                      <div style={{ fontSize: '0.72rem', color: '#334155' }}>
                        Query: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>"{liveTelemetry.activeTool.args.query}"</code>
                      </div>
                    )}
                    {liveTelemetry.activeTool.args?.kb_id && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Target KB: <strong>{liveTelemetry.activeTool.args.kb_id}</strong>
                      </div>
                    )}
                    {liveTelemetry.activeTool.args?.title && (
                      <div style={{ fontSize: '0.72rem', color: '#334155' }}>
                        Thought: <strong>{liveTelemetry.activeTool.args.title}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#09090b',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Activity size={14} color="#000000" />
                    <span>{liveTelemetry.currentStep || 'Initializing Agno reasoning & guardrails...'}</span>
                  </div>
                )}

                {/* Live Tool Call Progress Chips */}
                {liveTelemetry.events.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '2px',
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--border-subtle)'
                  }}>
                    {liveTelemetry.events.slice(-4).map((ev, idx) => (
                      <span
                        key={idx}
                        className={`badge ${ev.status === 'running' ? 'badge-monochrome' : 'badge-neutral'}`}
                        style={{
                          fontSize: '0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px'
                        }}
                      >
                        {ev.status === 'completed' || ev.status === 'passed' ? '✓' : '⚡'}
                        {ev.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Prompt Suggestions & Input Bar */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: '#ffffff'
        }}>
          {/* Suggestion Chips */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            overflowX: 'auto',
            paddingBottom: '2px',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Test Queries:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.query)}
                className={`badge ${p.type === 'safe' ? 'badge-neutral' : 'badge-danger'}`}
                style={{ cursor: 'pointer', padding: '4px 9px', fontSize: '0.72rem', flexShrink: 0 }}
                title={p.query}
              >
                {p.type === 'unsafe' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : 'Select an agent to chat'}
              disabled={!selectedAgent || loading}
              className="form-input"
              style={{
                fontSize: '0.875rem',
                padding: '10px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                flex: 1
              }}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || !selectedAgent || loading}
              className="btn btn-primary"
              style={{ height: '42px', padding: '0 16px', flexShrink: 0 }}
            >
              <Send size={15} />
              <span className="desktop-only">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile Agent Selection Drawer Modal */}
      {mobileAgentDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 99,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }} onClick={() => setMobileAgentDrawer(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              background: '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Select Active Agent</h3>
              </div>
              <button
                onClick={() => setMobileAgentDrawer(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh' }}>
              {agents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No agents created yet. Create one in Agent Studio!
                </div>
              ) : (
                agents.map((ag) => {
                  const isSelected = selectedAgent?.id === ag.id;
                  return (
                    <div
                      key={ag.id}
                      onClick={() => {
                        setSelectedAgent(ag);
                        setMobileAgentDrawer(false);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? '#f8fafc' : '#ffffff',
                        border: `1px solid ${isSelected ? '#000000' : 'var(--border-subtle)'}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{ag.name}</span>
                        {isSelected && <span className="badge badge-monochrome" style={{ fontSize: '0.62rem' }}>Active</span>}
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {ag.description || 'Specialized CX Agent'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
