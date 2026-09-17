import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatWorkspace from './components/ChatWorkspace';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import AgentManager from './components/AgentManager';
import GuardrailsLab from './components/GuardrailsLab';
import { fetchHealth, fetchRootMeta, listAgents, listKnowledgeBases } from './services/api';

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
  const [healthStatus, setHealthStatus] = useState('connecting');
  const [systemMeta, setSystemMeta] = useState(null);

  const loadAllData = async () => {
    try {
      const [health, meta, agentsData, kbsData] = await Promise.allSettled([
        fetchHealth(),
        fetchRootMeta(),
        listAgents(),
        listKnowledgeBases(),
      ]);

      if (health.status === 'fulfilled') {
        setHealthStatus(health.value.status === 'healthy' ? 'online' : 'degraded');
      } else {
        setHealthStatus('offline');
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
              // Backend just came online / woke up from cold start — load agents & KBs
              loadAllData();
            }
            return isHealthy ? 'online' : 'degraded';
          });
        })
        .catch(() => setHealthStatus('offline'));
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(healthInterval);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthStatus={healthStatus}
        systemMeta={systemMeta}
      />

      <main style={{ flex: 1 }}>
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
      </main>
    </div>
  );
}
