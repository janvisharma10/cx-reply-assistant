import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './components/ChatWorkspace';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import AgentManager from './components/AgentManager';
import GuardrailsLab from './components/GuardrailsLab';
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
      await new Promise((r) => setTimeout(r, 1000)); // 1s spacing between pings in burst
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

  const loadAllData = async () => {
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

      if (agentsData.status === 'fulfilled') {
        setAgents(agentsData.value);
        if (agentsData.value.length > 0 && !selectedAgent) {
          setSelectedAgent(agentsData.value[0]);
        }
      }

      if (kbsData.status === 'fulfilled') {
        setKbs(kbsData.value);
      }
    } catch (err) {
      console.error('Error loading initial app data:', err);
    }
  };

  useEffect(() => {
    loadAllData();

    // Burst of 10 pings every 5 minutes (300,000ms)
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
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const tabTitles = {
    chat: 'Playground',
    agents: 'Studio',
    kb: 'Knowledge',
    guardrails: 'Safety Lab'
  };

  return (
    <div className="kenzai-shell">
      {/* KenzAI Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        agentsCount={agents.length}
        kbsCount={kbs.length}
        healthStatus={healthStatus}
      />

      {/* Main Workspace Area */}
      <div className="kenzai-main">
        {/* Top Breadcrumb & Utilities Bar */}
        <header className="kenzai-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mobile-only btn btn-ghost"
              style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>
            <div className="kenzai-breadcrumb">
              <span>OS</span>
              <span>/</span>
              <span>CX Agent Studio</span>
              <span>/</span>
              <strong>{tabTitles[activeTab]}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={loadAllData}
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '6px' }}
              title="Refresh system state"
            >
              <RefreshCw size={13} />
              <span className="desktop-only">Sync</span>
            </button>

            <a
              href={`${import.meta.env.VITE_API_BASE_URL || ''}/docs`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
            >
              <span>API Docs</span>
              <ExternalLink size={13} />
            </a>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.75rem'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 6px #10b981'
              }} />
              <span className="desktop-only" style={{ fontWeight: 600, color: '#334155' }}>
                System Online
              </span>
            </div>
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

