import React from 'react';
import { 
  ShieldCheck, 
  Bot, 
  Database, 
  ShieldAlert, 
  Activity, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function Header({ activeTab, setActiveTab, healthStatus, systemMeta }) {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '66px',
        gap: '20px'
      }}>
        {/* Brand & Identity - Minimalist White & Black */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}>
            <ShieldCheck size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#09090b' }}>
                CX Reply Assistant
              </h1>
              <span className="badge badge-monochrome" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                Agno • Llama Guard 4
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Knowledge Base Routing • Safety Guardrails (12B)
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('chat')}
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: '0.8125rem' }}
          >
            <Bot size={15} />
            Agent Chat
          </button>

          <button
            onClick={() => setActiveTab('kb')}
            className={`btn ${activeTab === 'kb' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: '0.8125rem' }}
          >
            <Database size={15} />
            Knowledge Bases
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`btn ${activeTab === 'agents' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: '0.8125rem' }}
          >
            <Sparkles size={15} />
            Agent Studio
          </button>

          <button
            onClick={() => setActiveTab('guardrails')}
            className={`btn ${activeTab === 'guardrails' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: '0.8125rem' }}
          >
            <ShieldAlert size={15} />
            Safety Lab
          </button>
        </nav>

        {/* System & Guardrail Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Llama Guard 4 Pill */}
          <div className="badge badge-safe" style={{ padding: '5px 12px' }} title="Input Pre-Hook & Output Post-Hook active">
            <ShieldCheck size={13} />
            <span>Llama Guard 4 • 12B</span>
          </div>

          {/* Backend Health Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: '#f1f5f9',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: healthStatus === 'online' ? '#047857' : (healthStatus === 'connecting' ? '#b45309' : '#b91c1c')
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: healthStatus === 'online' ? '#10b981' : (healthStatus === 'connecting' ? '#f59e0b' : '#ef4444'),
              boxShadow: healthStatus === 'online' ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none'
            }} />
            <span style={{ fontWeight: 600 }}>
              {healthStatus === 'online' ? 'System Online' : (healthStatus === 'connecting' ? 'Connecting...' : 'Offline (Waking up...)')}
            </span>
          </div>

          {/* Fast API docs link */}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ padding: '6px 8px', fontSize: '0.75rem' }}
            title="Open Swagger API Docs"
          >
            <span>Docs</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </header>
  );
}
