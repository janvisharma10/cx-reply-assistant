import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatWorkspace from './components/ChatWorkspace';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import AgentManager from './components/AgentManager';
import GuardrailsLab from './components/GuardrailsLab';
import { fetchHealth, fetchRootMeta, listAgents, listKnowledgeBases } from './services/api';

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
    const interval = setInterval(() => {
      fetchHealth()
        .then((res) => setHealthStatus(res.status === 'healthy' ? 'online' : 'degraded'))
        .catch(() => setHealthStatus('offline'));
    }, 15000);
    return () => clearInterval(interval);
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
