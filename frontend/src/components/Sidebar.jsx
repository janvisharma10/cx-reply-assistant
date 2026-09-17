import React from 'react';
import {
  Hexagon,
  MessageSquare,
  Sparkles,
  Database,
  ShieldAlert,
  Bot,
  Layers,
  ShieldCheck,
  Activity,
  ExternalLink,
  ChevronRight,
  X,
  Search
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  agentsCount = 0,
  kbsCount = 0,
  healthStatus = 'online'
}) {
  const mainNav = [
    { id: 'chat', label: 'Playground', icon: MessageSquare },
    { id: 'agents', label: 'Studio', icon: Sparkles },
    { id: 'kb', label: 'Knowledge', icon: Database },
    { id: 'guardrails', label: 'Safety Lab', icon: ShieldAlert },
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (setSidebarOpen) setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`kenzai-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen && setSidebarOpen(false)}
      />

      {/* Sidebar Container */}
      <aside className={`kenzai-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid #f3f4f6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Hexagon size={16} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#111827' }}>
              CX Agent Studio
            </span>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
            className="mobile-only btn btn-ghost"
            style={{ padding: '4px', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ⌘K Search Box */}
        <div className="kenzai-search-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="#9ca3af" />
            <span style={{ fontSize: '0.8rem' }}>Search</span>
          </div>
          <span style={{
            fontSize: '0.68rem',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            padding: '1px 5px',
            color: '#6b7280',
            fontFamily: 'var(--font-mono)'
          }}>
            ⌘K
          </span>
        </div>

        {/* Main Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`kenzai-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Operations Section */}
        <div style={{ marginTop: '12px' }}>
          <div className="kenzai-section-title">Operations</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              onClick={() => handleNavClick('agents')}
              className="kenzai-nav-item"
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={16} color="#6b7280" />
                <span style={{ fontSize: '0.82rem' }}>Agents</span>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                {agentsCount}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('kb')}
              className="kenzai-nav-item"
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={16} color="#6b7280" />
                <span style={{ fontSize: '0.82rem' }}>Knowledge</span>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                {kbsCount}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('guardrails')}
              className="kenzai-nav-item"
              style={{ justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={16} color="#047857" />
                <span style={{ fontSize: '0.82rem' }}>Llama Guard 4</span>
              </div>
              <span className="badge badge-safe" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                12B
              </span>
            </button>
          </div>
        </div>

        {/* Bottom User / System Profile */}
        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid #f3f4f6',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {/* Swagger link */}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
            target="_blank"
            rel="noreferrer"
            className="kenzai-nav-item"
            style={{ width: '100%', margin: 0, padding: '7px 10px', fontSize: '0.78rem' }}
          >
            <ExternalLink size={14} />
            <span>FastAPI Docs</span>
          </a>

          {/* System status pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            fontSize: '0.75rem',
            color: '#4b5563'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px #10b981'
            }} />
            <span style={{ fontWeight: 600 }}>
              System Online
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
