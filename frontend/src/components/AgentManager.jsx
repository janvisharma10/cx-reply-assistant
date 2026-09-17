import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  MessageSquare,
  Database,
  ShieldCheck,
  ShieldAlert,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { createAgent, deleteAgent, listGuardrailSuites } from '../services/api';

export default function AgentManager({ agents, kbs, onAgentsUpdated, onSelectAgentForChat }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedKbIds, setSelectedKbIds] = useState([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState('suite_standard_cx');
  const [suites, setSuites] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listGuardrailSuites()
      .then((data) => setSuites(data))
      .catch((err) => console.error('Failed to load guardrail suites:', err));
  }, []);

  const toggleKb = (id) => {
    setSelectedKbIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedKbIds.length === 0) {
      alert('Please bind at least one Knowledge Base to this agent.');
      return;
    }

    setSubmitting(true);
    try {
      await createAgent({
        name,
        description,
        instructions: instructions.trim() || undefined,
        kb_ids: selectedKbIds,
        guardrail_suite_id: selectedSuiteId
      });
      setName('');
      setDescription('');
      setInstructions('');
      setSelectedKbIds([]);
      setSelectedSuiteId('suite_standard_cx');
      setShowCreateModal(false);
      if (onAgentsUpdated) await onAgentsUpdated();
    } catch (err) {
      alert(`Failed to create Agent: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (agentId) => {
    if (!window.confirm(`Are you sure you want to delete agent '${agentId}'?`)) return;
    try {
      await deleteAgent(agentId);
      if (onAgentsUpdated) await onAgentsUpdated();
    } catch (err) {
      alert(`Failed to delete agent: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      {/* ── Top Header Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Agent Studio
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Configure and deploy AI Agents with Agno ReasoningTools, bound Knowledge Bases, and custom Guardrail Suites.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '9px 18px', fontSize: '0.8125rem' }}
        >
          <Plus size={16} />
          <span>Register New Agent</span>
        </button>
      </div>

      {/* ── Agents Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '20px'
      }}>
        {agents.map((ag) => (
          <div
            key={ag.id}
            className="glass-card"
            style={{
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '270px'
            }}
          >
            <div>
              {/* Card Header */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}>
                    <Bot size={22} color="#ffffff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {ag.name}
                    </h3>
                    <span className="code-block" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {ag.llm_name}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(ag.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--text-muted)' }}
                  title="Delete Agent"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Description */}
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                lineHeight: '1.4'
              }}>
                {ag.description || 'Specialized CX intelligent assistant'}
              </p>

              {/* Instructions preview */}
              {ag.instructions && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px'
                }}>
                  <strong style={{ color: '#09090b' }}>Custom Guidance:</strong> {ag.instructions}
                </div>
              )}

              {/* Bound Guardrail Suite Banner */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: '#f1f5f9',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#09090b'
                }}>
                  <ShieldCheck size={13} color="#000000" />
                  <span>Suite: {ag.guardrail_suite?.name || 'Standard CX Protection'}</span>
                  <span className="badge badge-monochrome" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                    {ag.guardrail_suite?.strictness || 'Standard'}
                  </span>
                </div>
              </div>

              {/* Bound KBs */}
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Authorized Knowledge Bases ({ag.bound_kbs?.length || 0}):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {ag.bound_kbs && ag.bound_kbs.length > 0 ? (
                    ag.bound_kbs.map((kb) => (
                      <span key={kb.id} className="badge badge-monochrome" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                        <Database size={10} />
                        {kb.name}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: '#f87171' }}>No bound KBs</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '12px'
            }}>
              <span className="badge badge-safe" style={{ fontSize: '0.68rem' }}>
                <ShieldCheck size={12} />
                Guardrailed (12B)
              </span>

              <button
                onClick={() => onSelectAgentForChat(ag)}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                <MessageSquare size={13} />
                <span>Chat Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Agent Modal ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-card" style={{
            width: '620px',
            maxWidth: '92vw',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            background: '#ffffff',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={20} color="#000000" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#09090b' }}>Register New Agent</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Return & Warranty Support Agent"
                  className="form-input"
                  style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                  Role Description *
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Answers customer returns, warranty, and refund inquiries"
                  className="form-input"
                  style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                  Custom System Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Always confirm receipt details and advise customers politely according to policy."
                  className="form-textarea"
                  style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
              </div>

              {/* ── Guardrail Suite Selection (User Request) ── */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#09090b', marginBottom: '6px' }}>
                  Bind Guardrail Safety Suite * (Select Policy)
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '190px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px'
                }}>
                  {suites.map((suite) => {
                    const isSelected = selectedSuiteId === suite.id;
                    return (
                      <div
                        key={suite.id}
                        onClick={() => setSelectedSuiteId(suite.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          border: isSelected ? '2px solid #000000' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ paddingTop: '2px' }}>
                          {isSelected ? (
                            <CheckCircle2 size={16} color="#000000" />
                          ) : (
                            <Square size={16} color="var(--border-strong)" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#09090b' }}>
                              {suite.name}
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                              {suite.strictness}
                            </span>
                          </div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.35', marginBottom: '4px' }}>
                            {suite.description}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {suite.monitored_categories.map((c) => (
                              <span key={c} className="badge badge-monochrome" style={{ fontSize: '0.58rem', padding: '0 4px' }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Knowledge Base Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#09090b', marginBottom: '6px' }}>
                  Bind Authorized Knowledge Bases * (Select at least 1)
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px'
                }}>
                  {kbs.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                      No Knowledge Bases found. Please create a Knowledge Base first!
                    </div>
                  ) : (
                    kbs.map((kb) => {
                      const isChecked = selectedKbIds.includes(kb.id);
                      return (
                        <div
                          key={kb.id}
                          onClick={() => toggleKb(kb.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: isChecked ? '#f8fafc' : '#ffffff',
                            border: `1px solid ${isChecked ? '#000000' : 'var(--border-subtle)'}`,
                            cursor: 'pointer'
                          }}
                        >
                          {isChecked ? (
                            <CheckSquare size={15} color="#000000" />
                          ) : (
                            <Square size={15} color="var(--border-strong)" />
                          )}
                          <div>
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#09090b' }}>
                              {kb.name}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {kb.description}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedKbIds.length === 0}
                  className="btn btn-primary"
                >
                  {submitting ? 'Registering...' : 'Register Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
