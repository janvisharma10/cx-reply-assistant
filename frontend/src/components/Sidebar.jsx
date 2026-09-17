import React from 'react';
import {
  Hexagon,
  MessageSquare,
  Sparkles,
  Database,
  ShieldAlert,
  ExternalLink,
  X
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  agentsCount = 0,
  kbsCount = 0
}) {
  const mainNav = [
    { id: 'chat', label: 'Playground', icon: MessageSquare, badge: null },
    { id: 'agents', label: 'Agent Studio', icon: Sparkles, badge: `${agentsCount}` },
    { id: 'kb', label: 'Knowledge Bases', icon: Database, badge: `${kbsCount}` },
    { id: 'guardrails', label: 'Safety Lab', icon: ShieldAlert, badge: '12B' },
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
          padding: '16px 18px 14px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
            }}>
              <Hexagon size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#09090b' }}>
                  CX Agent Studio
                </span>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  v2.4
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                Agno • Llama Guard 4
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
            className="mobile-only btn btn-ghost"
            style={{ padding: '4px', border: 'none', color: '#64748b' }}
            title="Close Sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="kenzai-section-title" style={{ marginTop: '8px' }}>Navigation</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 0 6px' }}>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`kenzai-nav-item ${isActive ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '9999px',
                      background: isActive ? 'rgba(255, 255, 255, 0.22)' : '#f1f5f9',
                      color: isActive ? '#ffffff' : '#64748b'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom User / Links Profile */}
        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid #f1f5f9',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: '#fafafa'
        }}>
          {/* Swagger link */}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
            target="_blank"
            rel="noreferrer"
            className="kenzai-nav-item"
            style={{ width: '100%', margin: 0, padding: '8px 12px', fontSize: '0.78rem' }}
          >
            <ExternalLink size={14} color="#64748b" />
            <span>FastAPI Docs (Swagger)</span>
          </a>
        </div>
      </aside>
    </>
  );
}
