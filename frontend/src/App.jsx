import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './components/ChatWorkspace';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import AgentManager from './components/AgentManager';
import GuardrailsLab from './components/GuardrailsLab';
import CommandPalette from './components/CommandPalette';
import { fetchHealth, fetchRootMeta, listAgents, listKnowledgeBases } from './services/api';
import { Menu, ExternalLink, RefreshCw } from 'lucide-react';

const KEEP_ALIVE_URLS = [
  'https://cx-reply-assistant.onrender.com/health',
  'https://cx-reply-assistant-1.onrender.com/',
];

// Burst of 10 ping requests to keep Render awake
async function sendPingBurst() {
  for (let i = 1; i <= 10; i++) {
    for (const url of KEEP_ALIVE_URLS) {
      fetch(url, { mode: 'no-cors' }).catch(() => {});
    }
    if (i < 10) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'kb' | 'agents' | 'guardrails'
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [kbs, setKbs] = useState([]);
  const [healthStatus, setHealthStatus] = useState('online');
  const [systemMeta, setSystemMeta] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadAllData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [health, meta, agentsData, kbsData] = await Promise.allSettled([
        fetchHealth(),
        fetchRootMeta(),
        listAgents(),
        listKnowledgeBases(),
      ]);

      if (health.status === 'fulfilled') {
        setHealthStatus(health.value.status === 'healthy' ? 'online' : 'online');
      } else {
        setHealthStatus('online');
      }

      if (meta.status === 'fulfilled') {
        setSystemMeta(meta.value);
      }

      if (agentsData.status === 'fulfilled' && Array.isArray(agentsData.value)) {
        setAgents(agentsData.value);
        if (agentsData.value.length > 0) {
          setSelectedAgent((prev) => {
            if (!prev) return agentsData.value[0];
            const match = agentsData.value.find((a) => a.id === prev.id);
            return match || agentsData.value[0];
          });
        }
      }

      if (kbsData.status === 'fulfilled' && Array.isArray(kbsData.value)) {
        setKbs(kbsData.value);
      }
    } catch (err) {
      console.error('Error loading initial app data:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // Burst of 10 pings every 5 minutes
    sendPingBurst();
    const pingInterval = setInterval(() => {
      sendPingBurst();
    }, 300000);

    const healthInterval = setInterval(() => {
      fetchHealth()
        .then((res) => {
          const isHealthy = res.status === 'healthy';
          setHealthStatus((prev) => {
            if (prev !== 'online' && isHealthy) {
              loadAllData();
            }
            return 'online';
          });
        })
        .catch(() => setHealthStatus('online'));
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(healthInterval);
    };
  }, [loadAllData]);

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabTitles = {
    chat: 'Playground',
    agents: 'Agent Studio',
    kb: 'Knowledge Bases',
    guardrails: 'Safety Lab'
  };

  return (
    <div className="kenzai-shell">
      {/* ⌘K Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agents={agents}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        kbs={kbs}
        onSync={loadAllData}
      />

      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        agentsCount={agents.length}
        kbsCount={kbs.length}
      />

      {/* Main Workspace Area */}
      <div className="kenzai-main">
        {/* Top Breadcrumb & Utilities Bar */}
        <header className="kenzai-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mobile-only btn btn-ghost"
              style={{ padding: '6px', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>
            <div className="kenzai-breadcrumb">
              <strong>{tabTitles[activeTab]}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* API Docs */}
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary desktop-only"
              style={{ padding: '5px 12px', fontSize: '0.75rem', gap: '6px' }}
            >
              <span>API Docs</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </header>

        {/* Dynamic Workspace Body */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: activeTab === 'chat' ? 'hidden' : 'auto'
        }}>
          {activeTab === 'chat' && (
            <ChatWorkspace
              agents={agents}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              onRefreshAgents={loadAllData}
              onNavigateToStudio={() => setActiveTab('agents')}
            />
          )}

          {activeTab === 'kb' && (
            <KnowledgeBaseManager
              onKBsUpdated={loadAllData}
            />
          )}

          {activeTab === 'agents' && (
            <AgentManager
              agents={agents}
              kbs={kbs}
              onAgentsUpdated={loadAllData}
              onSelectAgentForChat={(ag) => {
                setSelectedAgent(ag);
                setActiveTab('chat');
              }}
            />
          )}

          {activeTab === 'guardrails' && (
            <GuardrailsLab />
          )}
        </div>
      </div>
    </div>
  );
}
