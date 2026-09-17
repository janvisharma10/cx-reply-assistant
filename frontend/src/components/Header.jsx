import React from 'react';
import { 
  ShieldCheck, 
  Bot, 
  Database, 
  ShieldAlert, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'chat', label: 'Agent Chat', icon: Bot },
    { id: 'kb', label: 'Knowledge Bases', icon: Database },
    { id: 'agents', label: 'Agent Studio', icon: Sparkles },
    { id: 'guardrails', label: 'Safety Lab', icon: ShieldAlert },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          gap: '12px'
        }}>
          {/* Brand & Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
              flexShrink: 0
            }}>
              <ShieldCheck size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#09090b', whiteSpace: 'nowrap' }}>
                  CX Reply Assistant
                </h1>
                <span className="badge badge-monochrome desktop-only" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                  Agno • Llama Guard 4
                </span>
              </div>
              <p className="desktop-only" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Knowledge Base Routing • Safety Guardrails (12B)
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="desktop-only" style={{ alignItems: 'center', gap: '4px' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '7px 13px', fontSize: '0.8125rem' }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="badge badge-safe desktop-only" style={{ padding: '4px 10px' }} title="Input Pre-Hook & Output Post-Hook active">
              <ShieldCheck size={12} />
              <span>Llama Guard 4 • 12B</span>
            </div>

            <a
              href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ padding: '5px 8px', fontSize: '0.75rem' }}
              title="Open Swagger API Docs"
            >
              <span>Docs</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Mobile Scrollable Tab Bar */}
        <nav className="mobile-only no-scrollbar" style={{
          overflowX: 'auto',
          paddingBottom: '8px',
          gap: '6px',
          width: '100%'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-full)',
                  flexShrink: 0
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
