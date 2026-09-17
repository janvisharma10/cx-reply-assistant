/**
 * API client service for CX Reply Assistant Backend
 */

const BASE_URL = ''; // Relative URL leverages Vite proxy (/api, /health)

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchRootMeta() {
  const res = await fetch(`${BASE_URL}/`);
  if (!res.ok) throw new Error(`Root meta failed: ${res.statusText}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base APIs
// ─────────────────────────────────────────────────────────────────────────────

export async function listKnowledgeBases() {
  const res = await fetch(`${BASE_URL}/api/v1/kb`);
  if (!res.ok) throw new Error(`Failed to list KBs: ${res.statusText}`);
  return res.json();
}

export async function createKnowledgeBase(payload) {
  const res = await fetch(`${BASE_URL}/api/v1/kb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create Knowledge Base');
  }
  return res.json();
}

export async function getKnowledgeBase(kbId) {
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}`);
  if (!res.ok) throw new Error(`Failed to fetch KB '${kbId}': ${res.statusText}`);
  return res.json();
}

export async function deleteKnowledgeBase(kbId) {
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete KB '${kbId}': ${res.statusText}`);
  return res.json();
}

export async function uploadDocumentToKB(kbId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Document ingestion failed');
  }
  return res.json();
}

export async function listDocumentsInKB(kbId) {
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}/documents`);
  if (!res.ok) throw new Error(`Failed to list documents for KB '${kbId}': ${res.statusText}`);
  return res.json();
}

export async function deleteDocumentFromKB(kbId, documentId) {
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete document '${documentId}': ${res.statusText}`);
  return res.json();
}

export async function queryKnowledgeBase(kbId, query, topK = 3) {
  const res = await fetch(`${BASE_URL}/api/v1/kb/${kbId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'KB search query failed');
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent APIs
// ─────────────────────────────────────────────────────────────────────────────

export async function listAgents() {
  const res = await fetch(`${BASE_URL}/api/v1/agents`);
  if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
  return res.json();
}

export async function createAgent(payload) {
  const res = await fetch(`${BASE_URL}/api/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create Agent');
  }
  return res.json();
}

export async function deleteAgent(agentId) {
  const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete agent '${agentId}': ${res.statusText}`);
  return res.json();
}

export async function runAgentInference(agentId, message, enableGuardrails = true) {
  const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      enable_guardrails: enableGuardrails,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Agent inference failed');
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails & Pre-Made Suites APIs
// ─────────────────────────────────────────────────────────────────────────────

export async function listGuardrailSuites() {
  const res = await fetch(`${BASE_URL}/api/v1/agents/guardrails/suites`);
  if (!res.ok) throw new Error(`Failed to list guardrail suites: ${res.statusText}`);
  return res.json();
}

export async function getGuardrailSuite(suiteId) {
  const res = await fetch(`${BASE_URL}/api/v1/agents/guardrails/suites/${suiteId}`);
  if (!res.ok) throw new Error(`Failed to fetch guardrail suite '${suiteId}': ${res.statusText}`);
  return res.json();
}

export async function checkTextSafety(text, role = 'input', contextPrompt = null, suiteId = null) {
  const res = await fetch(`${BASE_URL}/api/v1/agents/guardrails/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      role,
      context_prompt: contextPrompt,
      suite_id: suiteId || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Safety evaluation failed');
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time Tool Call Status & SSE Streaming APIs
// ─────────────────────────────────────────────────────────────────────────────

export async function getAgentStatus(agentId) {
  const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json();
}

export function subscribeAgentStatus(agentId, onEvent, onError) {
  const url = `${BASE_URL}/api/v1/agents/${agentId}/status/stream`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch (err) {
      console.warn('SSE message parse error:', err);
    }
  };

  const eventTypes = [
    'snapshot',
    'inference_start',
    'guardrail_start',
    'guardrail_complete',
    'tool_start',
    'tool_complete',
    'inference_complete',
    'inference_error'
  ];

  eventTypes.forEach((evt) => {
    eventSource.addEventListener(evt, (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent({ ...data, type: evt });
      } catch (err) {
        console.warn(`SSE event parse error on ${evt}:`, err);
      }
    });
  });

  if (onError) {
    eventSource.onerror = onError;
  }

  return () => {
    eventSource.close();
  };
}

