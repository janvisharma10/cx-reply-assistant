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
  CheckCircle2,
  X,
  Zap,
  Info,
  Sliders,
  Check
} from 'lucide-react';
import { createAgent, deleteAgent, listGuardrailSuites } from '../services/api';

const PROMPT_TEMPLATES = [
  {
    label: 'Customer Support Specialist',
    description: 'General inquiry and polite customer care assistant',
    instructions: 'You are an empathetic, professional, and concise customer support specialist. Always prioritize the customer\'s satisfaction while adhering strictly to company policies and knowledge base guidance. If information is unavailable in the knowledge base, transparently acknowledge it.'
  },
  {
    label: 'Returns & Refund Coordinator',
    description: 'Strict policy and order resolution assistant',
    instructions: 'You are an automated Returns & Refunds coordinator. Consult the store return policies to determine eligibility. Ask clarifying questions regarding item condition, purchase date, and receipt status before confirming return authorizations.'
  },
  {
    label: 'Technical Troubleshooter',
    description: 'Step-by-step diagnostic and bug assistant',
    instructions: 'You are a patient, methodical technical support engineer. Provide step-by-step troubleshooting instructions formatted with clear numbered lists. Verify if previous diagnostic steps succeeded before proposing advanced actions.'
  },
  {
    label: 'Strict Compliance Guardian',
    description: 'Adherence to legal, privacy, and safety policies',
    instructions: 'You are a compliance assistant ensuring all communications strictly adhere to legal privacy mandates, data protection rules, and brand safety guidelines. Never divulge sensitive customer PII or internal credentials.'
  }
];

export default function AgentManager({ agents = [], kbs = [], onAgentsUpdated, onSelectAgentForChat }) {
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

  const applyTemplate = (tmpl) => {
    if (!name) setName(tmpl.label);
    if (!description) setDescription(tmpl.description);
    setInstructions(tmpl.instructions);
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedKbIds.length === 0) {
      alert('Please select at least one Knowledge Base to bind to this agent.');
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
    <div className="page-container">
      {/* ── Top Header Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '22px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#09090b', letterSpacing: '-0.02em', margin: 0 }}>
              Agent Studio
            </h1>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
              {agents.length} Registered
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Configure and deploy AI Agents equipped with deliberate reasoning, vector search tools, and Llama Guard 4 policies.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Register New Agent</span>
        </button>
      </div>

      {/* ── Agents Grid ── */}
      {agents.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px dashed #cbd5e1',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              No Agents Configured
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, maxWidth: '420px' }}>
              Create your first agent to bind specialized Knowledge Bases, select Guardrail safety suites, and test interactive reasoning.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ marginTop: '6px', padding: '8px 16px' }}
          >
            <Plus size={15} />
            <span>Create Agent</span>
          </button>
        </div>
      ) : (
        <div className="responsive-card-grid">
          {agents.map((ag) => (
            <div
              key={ag.id}
              className="glass-card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px',
                position: 'relative'
              }}
            >
              <div>
                {/* Card Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
                    }}>
                      <Bot size={20} color="#ffffff" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#09090b', margin: 0 }}>
                        {ag.name}
                      </h3>
                      <span className="code-block" style={{ fontSize: '0.66rem', padding: '1px 5px', color: '#475569' }}>
                        {ag.llm_name || 'Groq Llama 3.3 70B'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(ag.id)}
                    className="btn btn-ghost"
                    style={{ padding: '5px', color: '#94a3b8' }}
                    title="Delete Agent"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '0.8rem',
                  color: '#475569',
                  marginBottom: '10px',
                  lineHeight: '1.4'
                }}>
                  {ag.description || 'Specialized intelligent assistant for CX reasoning and operations.'}
                </p>

                {/* Instructions preview */}
                {ag.instructions && (
                  <div style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.72rem',
                    color: '#475569',
                    marginBottom: '10px',
                    maxHeight: '60px',
                    overflowY: 'auto'
                  }}>
                    <strong style={{ color: '#09090b' }}>Guidance:</strong> {ag.instructions}
                  </div>
                )}

                {/* Bound Guardrail Suite Banner */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}>
                    <ShieldCheck size={12} color="#10b981" />
                    <span>Suite: {ag.guardrail_suite?.name || 'Standard CX Protection'}</span>
                    <span className="badge badge-monochrome" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                      {ag.guardrail_suite?.strictness || 'Standard'}
                    </span>
                  </div>
                </div>

                {/* Bound KBs */}
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Bound Knowledge Bases ({ag.bound_kbs?.length || 0}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {ag.bound_kbs && ag.bound_kbs.length > 0 ? (
                      ag.bound_kbs.map((kb) => (
                        <span key={kb.id} className="badge badge-neutral" style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
                          <Database size={10} />
                          {kb.name}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>None attached</span>
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
                borderTop: '1px solid #f1f5f9',
                marginTop: '12px'
              }}>
                <span className="badge badge-safe" style={{ fontSize: '0.66rem' }}>
                  <ShieldCheck size={11} />
                  Llama Guard 4 (12B)
                </span>

                <button
                  onClick={() => onSelectAgentForChat(ag)}
                  className="btn btn-primary"
                  style={{ padding: '6px 13px', fontSize: '0.78rem', gap: '5px' }}
                >
                  <MessageSquare size={13} />
                  <span>Open in Playground</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Agent Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '640px', maxWidth: '94vw', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#09090b', margin: 0 }}>
                    Register New AI Agent
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Configure persona, deliberate instructions, bound knowledge, and safety suite.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Templates Starter */}
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ✨ Quick Role Templates (Auto-fill):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PROMPT_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="starter-chip"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  >
                    <Sparkles size={11} />
                    <span>{tmpl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CX Store Specialist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Specializes in order fulfillment, refunds, and store policy queries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  System Instructions & Reasoning Guidance
                </label>
                <textarea
                  rows={4}
                  placeholder="Specify persona, tone, answering constraints, and safety guidelines..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="form-textarea"
                />
              </div>

              {/* Bound Knowledge Bases */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Bind Knowledge Bases * (Required for RAG Tooling)</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {selectedKbIds.length} Selected
                  </span>
                </label>

                {kbs.length === 0 ? (
                  <div style={{ padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
                    No Knowledge Bases available. Please create a Knowledge Base first.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                    {kbs.map((kb) => {
                      const isChecked = selectedKbIds.includes(kb.id);
                      return (
                        <div
                          key={kb.id}
                          onClick={() => toggleKb(kb.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${isChecked ? '#000000' : '#e2e8f0'}`,
                            background: isChecked ? '#f8fafc' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <Database size={14} color={isChecked ? '#000000' : '#64748b'} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {kb.name}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                {kb.documents?.length || 0} docs
                              </div>
                            </div>
                          </div>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: `1px solid ${isChecked ? '#000000' : '#cbd5e1'}`,
                            background: isChecked ? '#000000' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            {isChecked && <Check size={12} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Guardrail Policy Suite */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  Llama Guard 4 (12B) Safety Guardrail Suite
                </label>
                <select
                  value={selectedSuiteId}
                  onChange={(e) => setSelectedSuiteId(e.target.value)}
                  className="form-select"
                >
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.strictness} strictness) - {s.description}
                    </option>
                  ))}
                  {suites.length === 0 && (
                    <option value="suite_standard_cx">Standard CX Protection (Recommended)</option>
                  )}
                </select>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || selectedKbIds.length === 0}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px' }}
                >
                  {submitting ? 'Registering...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
