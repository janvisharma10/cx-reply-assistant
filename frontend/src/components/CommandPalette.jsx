import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Sparkles,
  Database,
  ShieldAlert,
  Bot,
  ExternalLink,
  RefreshCw,
  X,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  BookOpen
} from 'lucide-react';

export default function CommandPalette({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  agents = [],
  selectedAgent,
  setSelectedAgent,
  kbs = [],
  onSync
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items
  const navigationItems = [
    {
      id: 'nav-chat',
      title: 'Go to Playground',
      category: 'Navigation',
      subtitle: 'Interactive chat with AI agents and safety guardrails',
      icon: MessageSquare,
      action: () => {
        setActiveTab('chat');
        onClose();
      }
    },
    {
      id: 'nav-agents',
      title: 'Go to Agent Studio',
      category: 'Navigation',
      subtitle: 'Configure, test, and deploy AI Agents',
      icon: Sparkles,
      action: () => {
        setActiveTab('agents');
        onClose();
      }
    },
    {
      id: 'nav-kb',
      title: 'Go to Knowledge Bases',
      category: 'Navigation',
      subtitle: 'Manage vector stores, chunking, and document ingestion',
      icon: Database,
      action: () => {
        setActiveTab('kb');
        onClose();
      }
    },
    {
      id: 'nav-guardrails',
      title: 'Go to Safety Lab',
      category: 'Navigation',
      subtitle: 'Inspect Llama Guard 4 (12B) policies and test adversarial prompts',
      icon: ShieldAlert,
      action: () => {
        setActiveTab('guardrails');
        onClose();
      }
    },
    {
      id: 'action-sync',
      title: 'Sync System State',
      category: 'Actions',
      subtitle: 'Refresh agents, knowledge bases, and backend health',
      icon: RefreshCw,
      action: () => {
        if (onSync) onSync();
        onClose();
      }
    },
    {
      id: 'action-docs',
      title: 'Open FastAPI Swagger Docs',
      category: 'Actions',
      subtitle: 'Explore the complete REST API specification',
      icon: ExternalLink,
      action: () => {
        window.open(`${import.meta.env.VITE_API_BASE_URL || ''}/docs`, '_blank');
        onClose();
      }
    }
  ];

  const agentItems = agents.map((ag) => ({
    id: `agent-${ag.id}`,
    title: `Chat with ${ag.name}`,
    category: 'Agents',
    subtitle: `${ag.llm_name || 'Llama 3.3 70B'} • ${ag.kb_ids?.length || 0} Knowledge Bases`,
    icon: Bot,
    action: () => {
      if (setSelectedAgent) setSelectedAgent(ag);
      setActiveTab('chat');
      onClose();
    }
  }));

  const kbItems = kbs.map((kb) => ({
    id: `kb-${kb.id}`,
    title: `Knowledge Base: ${kb.name}`,
    category: 'Knowledge Bases',
    subtitle: `${kb.documents?.length || 0} docs • ${kb.chunking_config?.chunking_type || 'sentence'} chunking`,
    icon: Layers,
    action: () => {
      setActiveTab('kb');
      onClose();
    }
  }));

  const allItems = [...navigationItems, ...agentItems, ...kbItems];

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="cmd-palette-backdrop animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 9999
      }}
    >
      <div
        className="cmd-palette-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
          animation: 'modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Search Header Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          background: '#fafafa'
        }}>
          <Search size={18} color="#64748b" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search agents, knowledge bases..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.95rem',
              color: '#0f172a',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500
            }}
          />
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '4px', borderRadius: '6px', color: '#94a3b8' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="no-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.85rem'
            }}>
              No matching commands or resources found for "<strong>{query}</strong>"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? '#f1f5f9' : 'transparent',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isSelected ? '#000000' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#475569',
                      border: `1px solid ${isSelected ? '#000000' : '#e2e8f0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: isSelected ? '#0f172a' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span>{item.title}</span>
                      </div>
                      {item.subtitle && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isSelected ? '#ffffff' : '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {item.category}
                    </span>
                    {isSelected && (
                      <ArrowRight size={14} color="#000000" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span><kbd style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>↑</kbd> <kbd style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>↓</kbd> Navigate</span>
            <span><kbd style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>↵</kbd> Select</span>
            <span><kbd style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>esc</kbd> Close</span>
          </div>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>CX Agent Studio</span>
        </div>
      </div>
    </div>
  );
}
